import { describe, expect, test } from "bun:test";
import {
  detectModelFamily,
  familyIntelBlock,
  resolveFamily,
  type ModelFamily,
} from "../plugin/model-family.ts";

// Detection table (C7): modelID signal first, endpoint signal second,
// case-insensitive, unknown otherwise. See plugin/model-family.ts.
describe("detectModelFamily", () => {
  const table: Array<{
    name: string;
    input: { modelID?: string; providerID?: string; baseUrl?: string };
    want: ModelFamily;
  }> = [
    { name: "glm-5.3-flash -> glm", input: { modelID: "glm-5.3-flash" }, want: "glm" },
    {
      name: "glm-5 + z.ai endpoint -> glm",
      input: { modelID: "glm-5", baseUrl: "https://api.z.ai/api/paas/v4" },
      want: "glm",
    },
    { name: "qwen3-coder-plus -> qwen", input: { modelID: "qwen3-coder-plus" }, want: "qwen" },
    { name: "qwen3.6-plus -> qwen", input: { modelID: "qwen3.6-plus" }, want: "qwen" },
    { name: "qwen3-coder-next -> qwen", input: { modelID: "qwen3-coder-next" }, want: "qwen" },
    { name: "kimi-k2.5 -> unknown", input: { modelID: "kimi-k2.5" }, want: "unknown" },
    { name: "deepseek-v4 -> unknown", input: { modelID: "deepseek-v4" }, want: "unknown" },
    { name: "GPT-5.2 -> unknown", input: { modelID: "GPT-5.2" }, want: "unknown" },
    { name: "GLM-5 uppercase -> glm", input: { modelID: "GLM-5" }, want: "glm" },
    {
      // modelID wins over the endpoint signal
      name: "glm-5 + dashscope provider -> glm (modelID precedence)",
      input: { modelID: "glm-5", providerID: "dashscope" },
      want: "glm",
    },
    {
      name: "dashscope baseUrl only -> qwen",
      input: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
      want: "qwen",
    },
    {
      name: "coding-intl dashscope baseUrl only -> qwen",
      input: { baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1" },
      want: "qwen",
    },
    {
      name: "z.ai baseUrl only -> glm",
      input: { baseUrl: "https://api.z.ai/api/paas/v4" },
      want: "glm",
    },
    { name: "dashscope providerID only -> qwen", input: { providerID: "dashscope" }, want: "qwen" },
    { name: "empty input -> unknown", input: {}, want: "unknown" },
  ];

  for (const { name, input, want } of table) {
    test(name, () => {
      expect(detectModelFamily(input)).toBe(want);
    });
  }
});

describe("resolveFamily", () => {
  test("unknown maps to glm (decision 2b: GLM treatment for unknowns)", () => {
    expect(resolveFamily("unknown")).toBe("glm");
  });
  test("glm stays glm", () => {
    expect(resolveFamily("glm")).toBe("glm");
  });
  test("qwen stays qwen", () => {
    expect(resolveFamily("qwen")).toBe("qwen");
  });
});

describe("familyIntelBlock", () => {
  test("qwen block contains qwen-coder tool_call syntax", () => {
    const block = familyIntelBlock("qwen");
    expect(block).toContain("tool_call");
  });
  test("qwen block mentions Qwen and the final-message contract", () => {
    const block = familyIntelBlock("qwen");
    expect(block).toContain("Qwen");
    expect(block).toContain("final message");
  });
  test("qwen block carries the marker the plugin idempotency guard greps for", () => {
    const block = familyIntelBlock("qwen");
    expect(block).toContain("QWEN MODEL FAMILY INTELLIGENCE");
  });
  test("glm block mentions the final-message contract", () => {
    const block = familyIntelBlock("glm");
    expect(block).toContain("final message");
  });
});

describe("statelessness (C6)", () => {
  test("consecutive calls with different inputs are independent", () => {
    const a = detectModelFamily({ modelID: "qwen3-coder-plus" });
    const b = detectModelFamily({ modelID: "glm-5.3-flash" });
    const c = detectModelFamily({ baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" });
    const d = detectModelFamily({ modelID: "kimi-k2.5" });
    const e = detectModelFamily({ modelID: "qwen3-coder-plus" });
    expect(a).toBe("qwen");
    expect(b).toBe("glm");
    expect(c).toBe("qwen");
    expect(d).toBe("unknown");
    expect(e).toBe("qwen");
  });
});

// Hook-level wiring (C1/C3/C5 regression-zero contract): the OpenCode plugin
// is unit-testable under bun — its SDK import is type-only, erased at runtime.
describe("opencode plugin hooks", () => {
  const REMINDER_MARK = "DROXON HARNESS CONTRACT";
  const NOTE_MARK = "QWEN SUBAGENT NOTE";

  async function makeHooks() {
    const mod = await import("../plugin/droxon-harness.ts");
    const hooks = await mod.DroxonHarnessPlugin();
    return hooks as Record<
      string,
      (input: any, output: any) => Promise<void>
    >;
  }

  async function taskPrompt(
    hooks: Record<string, (input: any, output: any) => Promise<void>>,
    sessionID: string,
  ): Promise<string> {
    const output = { args: { prompt: "BASE" } };
    await hooks["tool.execute.before"]({ tool: "task", sessionID, callID: "c1" }, output);
    return String(output.args.prompt);
  }

  test("qwen session: task prompt gets contract + qwen note", async () => {
    const hooks = await makeHooks();
    await hooks["chat.message"](
      { sessionID: "s-qwen", model: { providerID: "dashscope", modelID: "qwen3-coder-plus" } },
      { message: {}, parts: [] },
    );
    const prompt = await taskPrompt(hooks, "s-qwen");
    expect(prompt.startsWith("BASE")).toBe(true);
    expect(prompt).toContain(REMINDER_MARK);
    expect(prompt).toContain(NOTE_MARK);
  });

  test("glm and unknown sessions: byte-identical contract, no note (C3/C4)", async () => {
    const hooks = await makeHooks();
    await hooks["chat.message"](
      { sessionID: "s-glm", model: { providerID: "zai", modelID: "glm-5.3-flash" } },
      { message: {}, parts: [] },
    );
    await hooks["chat.message"](
      { sessionID: "s-unk", model: { providerID: "openai", modelID: "kimi-k2.5" } },
      { message: {}, parts: [] },
    );
    const glmPrompt = await taskPrompt(hooks, "s-glm");
    const unkPrompt = await taskPrompt(hooks, "s-unk");
    expect(glmPrompt).toBe(unkPrompt); // byte-identical
    expect(glmPrompt.startsWith("BASE")).toBe(true);
    expect(glmPrompt).toContain(REMINDER_MARK);
    expect(glmPrompt).not.toContain(NOTE_MARK);
    // qwen prompt is exactly the glm prompt plus the note suffix (C5):
    // first, an unregistered session yields the bare contract...
    const bare = await taskPrompt(hooks, "s-qwen-2");
    expect(bare).toBe(glmPrompt); // no session family recorded yet
    // ...then, once the qwen model is seen, the note is appended after it.
    await hooks["chat.message"](
      { sessionID: "s-qwen-2", model: { providerID: "dashscope", modelID: "qwen3-coder-plus" } },
      { message: {}, parts: [] },
    );
    const qwenAfter = await taskPrompt(hooks, "s-qwen-2");
    expect(qwenAfter.startsWith(glmPrompt)).toBe(true);
    expect(qwenAfter).toContain(NOTE_MARK);
  });

  test("model-less message never flips a detected session (judge B major-adjacent guard)", async () => {
    const hooks = await makeHooks();
    await hooks["chat.message"](
      { sessionID: "s-flip", model: { providerID: "dashscope", modelID: "qwen3-coder-plus" } },
      { message: {}, parts: [] },
    );
    await hooks["chat.message"]({ sessionID: "s-flip" }, { message: {}, parts: [] });
    const prompt = await taskPrompt(hooks, "s-flip");
    expect(prompt).toContain(NOTE_MARK); // still qwen
  });

  test("transform injects exactly one block for qwen and is re-run safe; glm untouched", async () => {
    const hooks = await makeHooks();
    const out = { system: ["base"] };
    await hooks["experimental.chat.system.transform"](
      {
        sessionID: "s-t1",
        model: { id: "qwen3-coder-plus", providerID: "dashscope", api: { url: "https://dashscope.aliyuncs.com/v1" } },
      },
      out,
    );
    expect(out.system.length).toBe(2);
    expect(out.system[1]).toContain("QWEN MODEL FAMILY INTELLIGENCE");
    await hooks["experimental.chat.system.transform"](
      {
        sessionID: "s-t1",
        model: { id: "qwen3-coder-plus", providerID: "dashscope", api: { url: "https://dashscope.aliyuncs.com/v1" } },
      },
      out,
    );
    expect(out.system.length).toBe(2); // no duplicate
    const untouched = { system: ["base"] };
    await hooks["experimental.chat.system.transform"](
      { sessionID: "s-t2", model: { id: "glm-5.3-flash", providerID: "zai" } },
      untouched,
    );
    expect(untouched.system).toEqual(["base"]);
  });

  test("transform with full model upgrades the task-note signal (endpoint-only qwen)", async () => {
    const hooks = await makeHooks();
    // chat.message sees only providerID+modelID (silent ID); the transform's
    // full model (with endpoint) must upgrade the recorded family.
    await hooks["chat.message"](
      { sessionID: "s-endpoint", model: { providerID: "custom-relay", modelID: "my-model" } },
      { message: {}, parts: [] },
    );
    let prompt = await taskPrompt(hooks, "s-endpoint");
    expect(prompt).not.toContain(NOTE_MARK);
    await hooks["experimental.chat.system.transform"](
      {
        sessionID: "s-endpoint",
        model: { id: "my-model", providerID: "custom-relay", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
      },
      { system: ["base"] },
    );
    prompt = await taskPrompt(hooks, "s-endpoint");
    expect(prompt).toContain(NOTE_MARK);
  });
});

describe("pi extension before_agent_start", () => {
  async function makeHandler() {
    const mod = await import("../pi/extensions/droxon-harness.ts");
    let handler: ((event: any, ctx: any) => Promise<any>) | null = null;
    const fakePi = {
      on: (event: string, h: (event: any, ctx: any) => Promise<any>) => {
        if (event === "before_agent_start") handler = h;
      },
      registerCommand: () => {},
    };
    (mod.default as (pi: unknown) => void)(fakePi);
    return handler as (event: any, ctx: any) => Promise<any>;
  }

  const baseEvent = {
    type: "before_agent_start",
    prompt: "hello",
    systemPrompt: "BASE",
    systemPromptOptions: {},
  };

  test("qwen model: returns systemPrompt with the qwen block", async () => {
    const handler = await makeHandler();
    const result = await handler(baseEvent, {
      model: { id: "qwen3-coder-plus", provider: "dashscope", baseUrl: "https://dashscope.aliyuncs.com/v1" },
    });
    expect(result?.systemPrompt.startsWith("BASE")).toBe(true);
    expect(result?.systemPrompt).toContain("QWEN MODEL FAMILY INTELLIGENCE");
  });

  test("glm, unknown and undefined models: returns undefined (regression zero)", async () => {
    const handler = await makeHandler();
    expect(
      await handler(baseEvent, {
        model: { id: "glm-5.3-flash", provider: "zai", baseUrl: "https://api.z.ai/api/paas/v4" },
      }),
    ).toBeUndefined();
    expect(
      await handler(baseEvent, {
        model: { id: "kimi-k2.5", provider: "openai", baseUrl: "https://api.openai.com/v1" },
      }),
    ).toBeUndefined();
    expect(await handler(baseEvent, { model: undefined })).toBeUndefined();
  });
});
