import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Shared family module, loaded dynamically because its installed location
// depends on the deployment layout: in-place (pi install <repo>) resolves
// "../../plugin/model-family.ts"; the no-CLI fallback stages the extension
// alone into <agent-dir>/extensions/, so the installer puts the module at the
// agent-dir root and the cascade resolves "../model-family.ts". Family
// features silently disable if no layout resolves; /droxon-verify keeps
// working regardless.

// Droxon harness extension for Pi.
//
// Mechanical equivalent of the OpenCode fastloop completion gate: a command
// that resolves and runs the project's REAL build/typecheck gate and reports
// the outcome. Nothing is "done" without it green. It does not replace tests
// or E2E — it is the cheap signal that the touched code at least compiles.

type VerifyScript = { cmd: string; args: string[]; label: string };

type FamilyModule = {
  detectModelFamily(input: {
    modelID?: string;
    providerID?: string;
    baseUrl?: string;
  }): "glm" | "qwen" | "unknown";
  resolveFamily(family: "glm" | "qwen" | "unknown"): "glm" | "qwen";
  familyIntelBlock(family: "glm" | "qwen"): string;
};

let familyModulePromise: Promise<FamilyModule | null> | null = null;
function loadFamilyModule(): Promise<FamilyModule | null> {
  if (!familyModulePromise) {
    familyModulePromise = (async () => {
      for (const spec of [
        "../../plugin/model-family.ts", // in-place package layout
        "../model-family.ts", // manual fallback: staged at agent-dir root
      ] as const) {
        try {
          return (await import(spec)) as FamilyModule;
        } catch {
          // try the next layout
        }
      }
      return null;
    })();
  }
  return familyModulePromise;
}

const SCRIPT_PRIORITY = [
  "typecheck",
  "check",
  "verify",
  "lint",
  "build",
] as const;

function resolveGate(cwd: string): VerifyScript | null {
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        scripts?: Record<string, string>;
        packageManager?: string;
      };
      const scripts = pkg.scripts ?? {};
      // Never descend into framework-unaware fallbacks when a real build
      // script exists: prefer the project's own gate order above.
      for (const name of SCRIPT_PRIORITY) {
        if (scripts[name]) {
          const runner = (pkg.packageManager ?? "npm").split("@")[0] === "pnpm" ? "pnpm" : "npm";
          return { cmd: runner, args: ["run", name], label: `${runner} run ${name}` };
        }
      }
      // No relevant script: a bare tsc is still better than nothing, but the
      // output says so explicitly so it is never mistaken for a full gate.
      if (existsSync(join(cwd, "tsconfig.json"))) {
        return {
          cmd: "npx",
          args: ["--no-install", "tsc", "--noEmit"],
          label: "npx tsc --noEmit (weak gate: skips framework templates)",
        };
      }
    } catch {
      // fall through to non-JS detection
    }
  }
  if (existsSync(join(cwd, "go.mod"))) {
    return { cmd: "go", args: ["build", "./..."], label: "go build ./..." };
  }
  if (existsSync(join(cwd, "Cargo.toml"))) {
    return { cmd: "cargo", args: ["check"], label: "cargo check" };
  }
  return null;
}

function run(cmd: string, args: string[], cwd: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve) => {
      execFile(cmd, args, { cwd, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        const code = err && typeof (err as { code?: number }).code === "number" ? (err as { code: number }).code : err ? 1 : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      });
    },
  );
}

export default function droxonHarness(pi: ExtensionAPI) {
  // Qwen model-family support: per-prompt detection, silent (no runtime
  // announcements). Only detected-Qwen models get the family block appended;
  // glm/unknown return undefined and keep Pi's prompt untouched (regression
  // zero). Official pattern: examples/extensions/pirate.ts. Model fields
  // verified against pi-ai's Model type: id, provider, baseUrl.
  pi.on("before_agent_start", async (event, ctx) => {
    const mod = await loadFamilyModule();
    if (!mod) return undefined;
    const model = ctx.model;
    // Model fields verified against pi-ai's Model type: id, provider, baseUrl.
    const family = mod.resolveFamily(
      mod.detectModelFamily({
        modelID: model?.id,
        providerID: model?.provider,
        baseUrl: model?.baseUrl,
      }),
    );
    if (family !== "qwen") return undefined;
    return { systemPrompt: event.systemPrompt + "\n\n" + mod.familyIntelBlock("qwen") };
  });

  pi.registerCommand("droxon-verify", {
    description:
      "Run the project's real build/typecheck gate (Droxon completion gate)",
    handler: async (_args, ctx) => {
      const gate = resolveGate(ctx.cwd);
      if (!gate) {
        ctx.ui.notify(
          "droxon-verify: no build gate found (no package.json scripts typecheck/check/verify/lint/build, no go.mod, no Cargo.toml). Resolve the project's real gate manually — do not declare done without it.",
          "warning",
        );
        return;
      }
      if (ctx.hasUI) ctx.ui.setStatus(`droxon-verify: running ${gate.label}...`);
      const started = Date.now();
      const res = await run(gate.cmd, gate.args, ctx.cwd);
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      if (res.code === 0) {
        ctx.ui.notify(`droxon-verify: PASS — ${gate.label} (${secs}s)`, "info");
      } else {
        const tail = (res.stderr || res.stdout).trim().split("\n").slice(-15).join("\n");
        ctx.ui.notify(
          `droxon-verify: FAIL — ${gate.label} (exit ${res.code}, ${secs}s)\n${tail}`,
          "error",
        );
      }
      if (ctx.hasUI) ctx.ui.setStatus("");
    },
  });
}
