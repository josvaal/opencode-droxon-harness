// Model-family intelligence for the Droxon harness: detection + distilled
// per-family behavior blocks (single source of truth — per-model knowledge
// lives here in data, never scattered in prose). Imported by the OpenCode
// plugin (in-repo as "./model-family.ts"; installed as "$DEST/lib/model-family.ts",
// outside the auto-loaded plugins/ dir, via the plugin's import cascade) and by
// the Pi extension (in-place "../../plugin/model-family.ts", fallback
// "../model-family.ts" at the agent-dir root).
//
// Decision 2b: only DETECTED-Qwen sessions receive injected blocks; glm and
// unknown keep the static GLM-tuned harness byte-identical (regression zero).

export type ModelFamily = "glm" | "qwen" | "unknown";

// Detection is data-driven, mirroring qwen-code's name-based gating:
// model-ID signal first — a model that NAMES itself glm/qwen is that family
// even when routed through the other family's endpoint (e.g. glm-5 on
// DashScope) — then endpoint signal from providerID+baseUrl concatenated.
// All matching is case-insensitive; anything else is "unknown".
export function detectModelFamily(input: {
  modelID?: string;
  providerID?: string;
  baseUrl?: string;
}): ModelFamily {
  const modelID = input.modelID ?? "";
  if (/qwen/i.test(modelID)) return "qwen";
  if (/glm/i.test(modelID)) return "glm";
  const endpoint = `${input.providerID ?? ""} ${input.baseUrl ?? ""}`;
  if (/dashscope|maas|aliyuncs/i.test(endpoint)) return "qwen";
  if (/z\.ai/i.test(endpoint)) return "glm";
  return "unknown";
}

// Unknown families get the GLM treatment (decision 2b): the static harness
// already IS the GLM deal, so "no signal" means "no injected block, GLM prose".
export function resolveFamily(f: ModelFamily): "glm" | "qwen" {
  return f === "qwen" ? "qwen" : "glm";
}

// Marker string is load-bearing: the OpenCode plugin greps the system entries
// for it to keep the transform idempotent. tests/family.spec.ts pins it.
const QWEN_BLOCK_HEADER = "QWEN MODEL FAMILY INTELLIGENCE";

// GLM: distilled from docs/harness.md "GLM notes" — the standing assumptions
// the static harness already encodes.
const GLM_BLOCK = [
  "GLM MODEL FAMILY INTELLIGENCE (distilled GLM notes):",
  "- GLM emits reasoning parts the user never sees: the final message carries the deliverable.",
  "  Everything the user needs must be in the final message of the turn.",
  "- Order stable instructions first, volatile context last (prompt-cache friendly).",
  "- Discipline lives in gates and tools, not in hoping the model remembers.",
].join("\n");

// QWEN: distilled from the official qwen-code harness (not a calque — see
// docs/qwen-notes.md). Injected only when the family is detected as qwen.
const QWEN_BLOCK = [
  `${QWEN_BLOCK_HEADER} (injected by the harness for detected Qwen models):`,
  "- Hidden reasoning is not a delivery channel: many Qwen coder models emit none at all, and",
  "  hosted plus/max tiers may emit some. Everything the user needs must be in the final message",
  "  of the turn — outcome first, then evidence and risks. No tool calls after it.",
  "- Tool-call syntax (qwen-coder XML form):",
  "  <tool_call><function=name><parameter=key>value</parameter></function></tool_call>",
  "- Hosted Qwen coder models allow ~1M input tokens / ~64K output tokens: do not assume smaller",
  "  limits and do not truncate deliverables to save space.",
  "- Never rely on forced tool selection (tool_choice=\"required\") while thinking mode is active:",
  "  DashScope rejects that combination.",
  "- Qwen specifics (detection signals, model tiers, thinking behavior, auth): docs/qwen-notes.md.",
].join("\n");

export function familyIntelBlock(family: "glm" | "qwen"): string {
  return family === "qwen" ? QWEN_BLOCK : GLM_BLOCK;
}
