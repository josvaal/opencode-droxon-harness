import type { Plugin } from "@opencode-ai/plugin";

// Droxon harness plugin — mechanical enforcement of the standing rules that
// are NOT already enforced by code elsewhere (fastloop owns the typecheck gate;
// OpenCode owns read-before-write). This plugin adds exactly one enforcement:
//
//   Subagent prompt hygiene: when the orchestrator spawns a subagent via the
//   `task` tool, the harness requires project conventions and user-named
//   constraints to travel VERBATIM in the prompt (subagents have no memory of
//   the parent conversation). If the prompt does not mention them, we append
//   a self-contained contract so the child cannot silently drift.
//
// Qwen model-family support: per-prompt family detection. ONLY detected-Qwen
// sessions receive injected intelligence (system block + subagent note);
// glm/unknown sessions keep the contract byte-identical (decision 2b).

type ModelFamily = "glm" | "qwen" | "unknown";

type FamilyModule = {
  detectModelFamily(input: {
    modelID?: string;
    providerID?: string;
    baseUrl?: string;
  }): ModelFamily;
  familyIntelBlock(family: "glm" | "qwen"): string;
};

// The shared module is loaded dynamically because its installed location
// depends on the deployment layout: in-repo and `pi install <repo>` resolve
// "./model-family.ts" (sibling of this file); the OpenCode installer stages
// it under "$DEST/lib/" (OUTSIDE plugins/ — OpenCode auto-loads every file
// in plugins/, and this is a data module, not a plugin factory). Family
// features silently disable if no layout resolves; the REMINDER contract
// keeps working regardless.
let familyModule: FamilyModule | null = null;
let familyModulePromise: Promise<FamilyModule | null> | null = null;
function loadFamilyModule(): Promise<FamilyModule | null> {
  if (familyModule) return Promise.resolve(familyModule);
  if (!familyModulePromise) {
    familyModulePromise = (async () => {
      for (const spec of ["./model-family.ts", "../lib/model-family.ts"] as const) {
        try {
          familyModule = (await import(spec)) as FamilyModule;
          return familyModule;
        } catch {
          // try the next layout
        }
      }
      return null;
    })();
  }
  return familyModulePromise;
}

const REMINDER = [
  "",
  "---",
  "DROXON HARNESS CONTRACT (appended by plugin — do not remove):",
  "- Your prompt is self-contained: you have NO memory of the parent conversation. If context is missing, say so in your final message instead of inventing it.",
  "- Follow the project AGENTS.md conventions; they override your defaults.",
  "- Report outcomes faithfully: failing checks are reported with output; 'done' means verified (fastloop_verify green for touched repos).",
  "- Everything the caller needs must be in your FINAL message: status, what was done, evidence, risks. No tool calls after it.",
].join("\n");

// Qwen addendum appended AFTER the REMINDER only when the session's detected
// family is qwen. GLM/unknown sessions keep the REMINDER byte-identical.
// The tool-call syntax is scoped to qwen-coder models: upstream qwen-code
// gates that syntax to /qwen[^-]*-coder/i only — plus/max thinking tiers use
// their platform's native function-call format.
const QWEN_SUBAGENT_NOTE = [
  "",
  "QWEN SUBAGENT NOTE (appended by plugin):",
  "- Everything the caller needs must be in your FINAL message: Qwen hidden reasoning (when present) never reaches the user.",
  "- For qwen-coder models, tool-call syntax in examples uses the qwen-coder XML form: <tool_call><function=name><parameter=key>value</parameter></function></tool_call>.",
].join("\n");

// Family per session. "chat.message" is the only per-message hook that names
// the model; "experimental.chat.system.transform" sees the full Model (with
// endpoint) and records too — the task-note path uses the most complete
// signal. Keyed by sessionID; model-less messages NEVER overwrite (a missing
// model must not flip a detected session back to unknown). The map is capped
// to bound growth in long-lived server processes.
const sessionFamilies = new Map<string, ModelFamily>();
const SESSION_FAMILY_CAP = 500;

function recordFamily(sessionID: string | undefined, family: ModelFamily | null): void {
  if (!sessionID || family === null) return;
  sessionFamilies.set(sessionID, family);
  if (sessionFamilies.size > SESSION_FAMILY_CAP) {
    const oldest = sessionFamilies.keys().next().value;
    if (oldest !== undefined) sessionFamilies.delete(oldest);
  }
}

export const DroxonHarnessPlugin: Plugin = async () => {
  const familyMod = await loadFamilyModule();
  return {
    "chat.message": async (input) => {
      if (!familyMod || !input.model) return; // no model in this message -> keep last known family
      recordFamily(
        input.sessionID,
        familyMod.detectModelFamily({
          modelID: input.model.modelID,
          providerID: input.model.providerID,
        }),
      );
    },
    "experimental.chat.system.transform": async (input, output) => {
      if (!familyMod) return;
      // Experimental hook: absent in older OpenCode builds -> never called
      // (graceful degradation); shape-defensive read because the SDK Model
      // carries the endpoint at api.url today.
      const model = input.model as
        | { id?: string; providerID?: string; api?: { url?: string }; baseUrl?: string }
        | undefined;
      // No signal at all -> record nothing, keep the previous family.
      if (!model || (!model.id && !model.providerID && !model.api?.url && !model.baseUrl)) return;
      const family = familyMod.detectModelFamily({
        modelID: model.id,
        providerID: model.providerID,
        baseUrl: model.api?.url ?? model.baseUrl,
      });
      recordFamily(input.sessionID, family);
      if (family !== "qwen") return;
      // Each transform call is fresh for its request; the guard only protects
      // against a host that re-runs the transform over an already-extended list.
      if (output.system.some((entry) => entry.includes("QWEN MODEL FAMILY INTELLIGENCE"))) return;
      output.system.push(familyMod.familyIntelBlock("qwen"));
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "task") return;
      const prompt = String(output.args?.prompt ?? "");
      if (prompt.length === 0) return; // let OpenCode's own validation handle it
      if (prompt.includes("DROXON HARNESS CONTRACT")) return; // idempotent
      const note =
        familyMod && sessionFamilies.get(input.sessionID) === "qwen" ? QWEN_SUBAGENT_NOTE : "";
      output.args.prompt = prompt + REMINDER + note;
    },
  };
};

export default DroxonHarnessPlugin;
