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

const REMINDER = [
  "",
  "---",
  "DROXON HARNESS CONTRACT (appended by plugin — do not remove):",
  "- Your prompt is self-contained: you have NO memory of the parent conversation. If context is missing, say so in your final message instead of inventing it.",
  "- Follow the project AGENTS.md conventions; they override your defaults.",
  "- Report outcomes faithfully: failing checks are reported with output; 'done' means verified (fastloop_verify green for touched repos).",
  "- Everything the caller needs must be in your FINAL message: status, what was done, evidence, risks. No tool calls after it.",
].join("\n");

export const DroxonHarnessPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "task") return;
      const prompt = String(output.args?.prompt ?? "");
      if (prompt.length === 0) return; // let OpenCode's own validation handle it
      if (prompt.includes("DROXON HARNESS CONTRACT")) return; // idempotent
      output.args.prompt = prompt + REMINDER;
    },
  };
};

export default DroxonHarnessPlugin;
