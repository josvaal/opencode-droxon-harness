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
// v2 contract: default export is a DEFINITION ({ id, setup }); hooks register
// through the setup context domains (event.subscribe, tool.hook,
// aisdk.hook("language")). This harness stubs those domains and captures the
// registrations.
describe("opencode plugin (v2 setup contract)", () => {
  const REMINDER_MARK = "DROXON HARNESS CONTRACT";
  const NOTE_MARK = "QWEN SUBAGENT NOTE";
  const BLOCK_MARK = "QWEN MODEL FAMILY INTELLIGENCE";

  type Handler = (input: any) => unknown;

  async function makeWiring() {
    const mod = await import("../plugin/droxon-harness.ts");
    const toolHooks = new Map<string, Handler>();
    const eventHandlers: Handler[] = [];
    const aisdkHooks = new Map<string, Handler>();
    const registration = { dispose: async () => {} };
    const ctx = {
      tool: {
        hook: async (name: string, handler: Handler) => {
          toolHooks.set(name, handler);
          return registration;
        },
      },
      event: {
        subscribe: async (handler: Handler) => {
          eventHandlers.push(handler);
          return registration;
        },
      },
      aisdk: {
        hook: async (name: string, handler: Handler) => {
          aisdkHooks.set(name, handler);
          return registration;
        },
      },
    };
    await mod.default.setup(ctx as any);
    return { mod, toolHooks, eventHandlers, aisdkHooks };
  }

  // v1 "chat.message" equivalent: a user message event carrying the model.
  async function recordMessage(
    wiring: Awaited<ReturnType<typeof makeWiring>>,
    sessionID: string,
    model?: { providerID: string; modelID: string },
  ) {
    for (const handler of wiring.eventHandlers) {
      await handler({
        type: "message.updated",
        properties: {
          sessionID,
          info: model
            ? { role: "user", sessionID, model }
            : { role: "user", sessionID },
        },
      });
    }
  }

  // v1 "tool.execute.before" equivalent: the subagent tool's execute.before
  // hook receives {tool, sessionID, input} with a mutable args object.
  async function subagentPrompt(
    wiring: Awaited<ReturnType<typeof makeWiring>>,
    sessionID: string,
    tool = "subagent",
  ): Promise<string> {
    const hookInput = { tool, sessionID, input: { prompt: "BASE" } };
    await wiring.toolHooks.get("execute.before")!(hookInput);
    return String(hookInput.input.prompt);
  }

  test("definition shape satisfies the v2 loader ({id, setup})", async () => {
    const { mod } = await makeWiring();
    expect(typeof mod.default).toBe("object");
    expect(mod.default.id).toBe("droxon-harness");
    expect(typeof mod.default.setup).toBe("function");
  });

  test("qwen session: subagent prompt gets contract + qwen note", async () => {
    const wiring = await makeWiring();
    await recordMessage(wiring, "s-qwen", {
      providerID: "dashscope",
      modelID: "qwen3-coder-plus",
    });
    const prompt = await subagentPrompt(wiring, "s-qwen");
    expect(prompt.startsWith("BASE")).toBe(true);
    expect(prompt).toContain(REMINDER_MARK);
    expect(prompt).toContain(NOTE_MARK);
  });

  test("glm and unknown sessions: byte-identical contract, no note (C3/C4)", async () => {
    const wiring = await makeWiring();
    await recordMessage(wiring, "s-glm", {
      providerID: "zai",
      modelID: "glm-5.3-flash",
    });
    await recordMessage(wiring, "s-unk", {
      providerID: "openai",
      modelID: "kimi-k2.5",
    });
    const glmPrompt = await subagentPrompt(wiring, "s-glm");
    const unkPrompt = await subagentPrompt(wiring, "s-unk");
    expect(glmPrompt).toBe(unkPrompt); // byte-identical
    expect(glmPrompt.startsWith("BASE")).toBe(true);
    expect(glmPrompt).toContain(REMINDER_MARK);
    expect(glmPrompt).not.toContain(NOTE_MARK);
    // qwen prompt is exactly the glm prompt plus the note suffix (C5):
    // first, an unregistered session yields the bare contract...
    const bare = await subagentPrompt(wiring, "s-qwen-2");
    expect(bare).toBe(glmPrompt); // no session family recorded yet
    // ...then, once the qwen model is seen, the note is appended after it.
    await recordMessage(wiring, "s-qwen-2", {
      providerID: "dashscope",
      modelID: "qwen3-coder-plus",
    });
    const qwenAfter = await subagentPrompt(wiring, "s-qwen-2");
    expect(qwenAfter.startsWith(glmPrompt)).toBe(true);
    expect(qwenAfter).toContain(NOTE_MARK);
  });

  test("model-less message never flips a detected session (judge B major-adjacent guard)", async () => {
    const wiring = await makeWiring();
    await recordMessage(wiring, "s-flip", {
      providerID: "dashscope",
      modelID: "qwen3-coder-plus",
    });
    await recordMessage(wiring, "s-flip"); // no model -> must not overwrite
    const prompt = await subagentPrompt(wiring, "s-flip");
    expect(prompt).toContain(NOTE_MARK); // still qwen
  });

  test("tool match covers 'subagent' and the deprecated 'task' alias", async () => {
    const wiring = await makeWiring();
    const viaSubagent = await subagentPrompt(wiring, "s-tool", "subagent");
    const viaTask = await subagentPrompt(wiring, "s-tool-2", "task");
    expect(viaSubagent).toContain(REMINDER_MARK);
    expect(viaTask).toContain(REMINDER_MARK);
    // other tools are untouched
    const hookInput = { tool: "bash", sessionID: "s-tool-3", input: { command: "ls" } };
    await wiring.toolHooks.get("execute.before")!(hookInput);
    expect(hookInput.input.command).toBe("ls");
    expect(hookInput.input).not.toHaveProperty("prompt");
  });

  // v1 "experimental.chat.system.transform" equivalent: the aisdk "language"
  // hook replaces input.language with a wrapper; the wrapper's doStream /
  // doGenerate prepend the Qwen block as a system message (idempotent).
  function makeFakeLanguageModel() {
    const captured: { stream: any[]; generate: any[] } = { stream: [], generate: [] };
    const base = {
      specificationVersion: "v3",
      provider: "dashscope",
      modelId: "qwen3-coder-plus",
      supportedUrls: {},
      doStream: async (options: any) => {
        captured.stream.push(options);
        return { stream: [] };
      },
      doGenerate: async (options: any) => {
        captured.generate.push(options);
        return {};
      },
    };
    return { base, captured };
  }

  test("language hook wraps qwen models and injects exactly one block, re-run safe", async () => {
    const wiring = await makeWiring();
    const hook = wiring.aisdkHooks.get("language")!;
    const { base, captured } = makeFakeLanguageModel();
    const input: any = {
      model: { providerID: "dashscope", modelID: "qwen3-coder-plus" },
      sdk: {},
      language: base,
    };
    await hook(input);
    expect(input.language).not.toBe(base); // wrapped
    const first = { prompt: [{ role: "user", content: "hi" }] };
    await input.language.doStream(first);
    expect(captured.stream[0].prompt.length).toBe(2);
    expect(captured.stream[0].prompt[0].role).toBe("system");
    expect(captured.stream[0].prompt[0].content).toContain(BLOCK_MARK);
    // re-run safe: a prompt already carrying the block is not duplicated
    await input.language.doStream({
      prompt: [{ role: "system", content: `x ${BLOCK_MARK} y` }, { role: "user", content: "hi" }],
    });
    expect(captured.stream[1].prompt.length).toBe(2);
    // doGenerate is wrapped too
    await input.language.doGenerate({ prompt: [{ role: "user", content: "hi" }] });
    expect(captured.generate[0].prompt[0].role).toBe("system");
  });

  test("language hook leaves glm/unknown models untouched (regression zero)", async () => {
    const wiring = await makeWiring();
    const hook = wiring.aisdkHooks.get("language")!;
    const glm = makeFakeLanguageModel();
    const inputGlm: any = {
      model: { providerID: "zai", modelID: "glm-5.3-flash" },
      sdk: {},
      language: glm.base,
    };
    await hook(inputGlm);
    expect(inputGlm.language).toBe(glm.base);

    const unk = makeFakeLanguageModel();
    const inputUnk: any = {
      model: { providerID: "openai", modelID: "kimi-k2.5" },
      sdk: {},
      language: unk.base,
    };
    await hook(inputUnk);
    expect(inputUnk.language).toBe(unk.base);
  });

  test("endpoint signal (settings.baseURL) upgrades injection for endpoint-only qwen", async () => {
    const wiring = await makeWiring();
    const hook = wiring.aisdkHooks.get("language")!;
    const { base, captured } = makeFakeLanguageModel();
    const input: any = {
      // modelID carries no family signal; the endpoint does (DashScope -> qwen)
      model: {
        providerID: "custom-relay",
        modelID: "my-model",
        settings: { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
      },
      sdk: {},
      language: base,
    };
    await hook(input);
    await input.language.doStream({ prompt: [{ role: "user", content: "hi" }] });
    expect(captured.stream[0].prompt[0].content).toContain(BLOCK_MARK);
    // v2 limitation (no sessionID in the language hook): the session-family
    // map is NOT upgraded by the language hook, so the subagent NOTE for an
    // endpoint-only qwen stays absent — graceful degradation, never a crash.
    const prompt = await subagentPrompt(wiring, "s-endpoint");
    expect(prompt).toContain(REMINDER_MARK);
    expect(prompt).not.toContain(NOTE_MARK);
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
