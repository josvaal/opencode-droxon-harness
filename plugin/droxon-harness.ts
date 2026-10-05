// Droxon harness plugin — OpenCode v2 server plugin (format: default export
// `{ id, setup }`; the v1 factory returning a Hooks object was removed in
// v2.0.x and fails to load with "Plugin must export a default definition with
// an id and an effect or setup function").
//
// Mechanical enforcement of the standing rules that are NOT already enforced
// by code elsewhere (fastloop owns the typecheck gate; OpenCode owns
// read-before-write). This plugin adds exactly one enforcement:
//
//   Subagent prompt hygiene: when the orchestrator spawns a subagent via the
//   `subagent` tool (formerly `task`), the harness requires project
//   conventions and user-named constraints to travel VERBATIM in the prompt
//   (subagents have no memory of the parent conversation). If the prompt does
//   not mention them, we append a self-contained contract so the child cannot
//   silently drift.
//
// Qwen model-family support: per-session family detection. ONLY detected-Qwen
// sessions receive injected intelligence (system block + subagent note);
// glm/unknown sessions keep the contract byte-identical (decision 2b).
//
// v1 → v2 hook mapping (v2.0.22):
//   "chat.message"                          → event.subscribe("message.updated")
//   "experimental.chat.system.transform"    → aisdk.hook("language") + doStream/doGenerate wrapper
//   "tool.execute.before" (tool === "task") → tool.hook("execute.before") (tool === "subagent" | "task")

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
// depends on the deployment layout: in-repo and `install.sh` resolve
// "./model-family.ts" (sibling of this file); the OpenCode installer stages
// it under "$DEST/lib/" (OUTSIDE plugins/ — OpenCode auto-loads every file
// in plugins/, and this is a data module, not a plugin). Family features
// silently disable if no layout resolves; the REMINDER contract keeps working
// regardless.
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
  "- ALL questions to the user go through ask_questions (pi-questions) and are asked in absolutely plain natural language — no technical jargon unless the user explicitly asks for it. Any task with more than one step is tracked with the todo tool (pi-todo). Plan/gate interrogation always goes through the grill-me skill first. (Tools are Pi-side; if unavailable, ask in plain natural-language chat.)",
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

// Family per session, recorded from the event stream (v1's "chat.message"
// equivalent: user/assistant messages carry the model). Model-less messages
// NEVER overwrite (a missing model must not flip a detected session back to
// unknown). The map is capped to bound growth in long-lived server processes.
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

// Wraps a LanguageModelV3 so every request carries the Qwen intel block as a
// leading system message (v1's "experimental.chat.system.transform"
// equivalent — v2 has no per-request system hook, but the language model is
// resolved per provider+model, and family detection is model-based, so a
// doStream/doGenerate wrapper is semantically equivalent for detected-Qwen
// models). Idempotent: skips if a system entry already carries the marker.
function withQwenSystemBlock(base: any, block: string): any {
  if (!base || typeof base.doStream !== "function") return base;
  const inject = (options: any) => {
    try {
      const prompt = Array.isArray(options?.prompt) ? options.prompt : [];
      const already = prompt.some(
        (m: any) =>
          m?.role === "system" &&
          typeof m?.content === "string" &&
          m.content.includes("QWEN MODEL FAMILY INTELLIGENCE"),
      );
      if (already) return options;
      return { ...options, prompt: [{ role: "system", content: block }, ...prompt] };
    } catch {
      return options;
    }
  };
  const wrapped: any = {
    ...base,
    doStream: (options: any) => base.doStream(inject(options)),
  };
  if (typeof base.doGenerate === "function") {
    wrapped.doGenerate = (options: any) => base.doGenerate(inject(options));
  }
  return wrapped;
}

// Structural typing of the v2.0.22 setup context (only the domains this
// plugin uses; the published .d.ts lags the shipped runtime, so no SDK type
// imports — the file must transpile standalone inside OpenCode's bun loader).
type Registration = { dispose?: () => Promise<void> };
interface SetupContext {
  tool: {
    hook(
      name: "execute.before" | "execute.after",
      handler: (input: { tool: string; sessionID?: string; agent?: string; input?: any }) => unknown,
    ): Promise<Registration>;
  };
  event: {
    subscribe(handler: (event: unknown) => unknown): Promise<Registration>;
  };
  aisdk: {
    hook(
      name: "sdk" | "language",
      handler: (input: {
        model?: { providerID?: string; modelID?: string; id?: string; settings?: Record<string, any> };
        sdk?: any;
        language?: any;
      }) => unknown,
    ): Promise<Registration>;
  };
}
export interface DroxonHarnessDefinition {
  id: string;
  setup: (context: SetupContext) => Promise<void>;
}

export const DroxonHarnessPlugin: DroxonHarnessDefinition = {
  id: "droxon-harness",
  async setup(ctx) {
    const familyMod = await loadFamilyModule();

    // (a) Record model family per session from the event stream. The decoded
    // event is defensive-read: the runtime may deliver {type, properties} or
    // a flattened {type, ...properties}. Handler never throws into the host.
    await ctx.event.subscribe((raw) => {
      try {
        const event = raw as any;
        if (event?.type !== "message.updated") return;
        const props = event.properties ?? event;
        const info = props.info;
        if (!info || (info.role !== "user" && info.role !== "assistant")) return;
        const model = info.model;
        recordFamily(
          props.sessionID ?? event.sessionID,
          model
            ? familyMod!.detectModelFamily({
                modelID: model.modelID,
                providerID: model.providerID,
              })
            : null, // no model in this message -> keep last known family
        );
      } catch {
        // never break the host over a malformed event
      }
    });

    // (b) Qwen system-block injection via the (cached, model-scoped) language
    // hook. Detection is per model, which is exactly what v1's transform did.
    await ctx.aisdk.hook("language", (input) => {
      try {
        if (!familyMod || !input?.model) return;
        const model = input.model;
        const modelID = model.modelID ?? model.id;
        if (!modelID) return;
        const family = familyMod.detectModelFamily({
          modelID,
          providerID: model.providerID,
          baseUrl:
            model.settings?.baseURL ??
            model.settings?.baseUrl ??
            model.settings?.endpoint,
        });
        if (family !== "qwen") return;
        const base = input.language ?? input.sdk?.languageModel?.(modelID);
        input.language = withQwenSystemBlock(base, familyMod.familyIntelBlock("qwen"));
      } catch {
        // never break the host over a hook-shape change
      }
    });

    // (c) Subagent prompt contract. v2 renamed the tool: "subagent" (the
    // "task" name survives only as a deprecated alias, matched defensively).
    await ctx.tool.hook("execute.before", (hookInput) => {
      try {
        if (hookInput.tool !== "subagent" && hookInput.tool !== "task") return;
        const args = hookInput.input;
        if (!args || typeof args !== "object") return;
        const prompt = String(args.prompt ?? "");
        if (prompt.length === 0) return; // let OpenCode's own validation handle it
        if (prompt.includes("DROXON HARNESS CONTRACT")) return; // idempotent
        const note =
          familyMod && hookInput.sessionID && sessionFamilies.get(hookInput.sessionID) === "qwen"
            ? QWEN_SUBAGENT_NOTE
            : "";
        args.prompt = prompt + REMINDER + note;
      } catch {
        // never break the host over an args-shape change
      }
    });
  },
};

export default DroxonHarnessPlugin;
