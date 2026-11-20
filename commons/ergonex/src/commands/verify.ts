// Spec: 0003-host FR-009
/**
 * `ergonex verify` and `ergonex render` (commons 0003-host FR-009 to FR-012, 0001-ergonex FR-015): `verify` compares the disk with the state record and the record with what the templates give now, and
 * reports a hand edit as an error and a missing, an unrecorded and a drifted file as warnings, changing nothing; `render` writes the generated files (never over a hand edit unless `--force`),
 * `render --check` writes nothing, names each file that would change and ends with findings, and `render --diff` shows each difference as a unified diff and writes nothing.
 *
 * @module
 */
import { flag } from "../platform/k-args.ts";
import { err, ok } from "@intellectual-frontiers/core";
import { existsSync, readTextFile } from "../platform/r-fs.ts";
import { unifiedDiff } from "../diff.ts";
import type { Finding } from "../findings.ts";
import { applyPlan } from "../host/apply.ts";
import { fileFacts } from "../host/files.ts";
import { type Loaded, native, situate } from "../host/workspace.ts";
import { defineCommand, GLOBAL_OPTIONS, type ErgonexModule } from "../modules/types.ts";
import { verifyFindings } from "../state-record.ts";
import { jsonOf, textOf, withWorkspace } from "./common.ts";

const verify = defineCommand({
  name: "verify",
  summary: "Compare the generated files with the state record and with what the templates give now; change nothing.",
  options: { ...GLOBAL_OPTIONS },
  run: (ctx) =>
    withWorkspace(ctx, async (loaded) => {
      const facts = await fileFacts(loaded);
      const findings = verifyFindings(facts, ctx.today);
      const clean = facts.filter((f) => f.onDisk !== undefined && f.onDisk === f.recorded && f.onDisk === f.wanted).length;
      return ok({
        text: textOf(
          [
            `${facts.length} generated file${facts.length === 1 ? "" : "s"} checked, ${clean} as written and as the templates give them now`,
          ],
          findings,
        ),
        data: {
          files: jsonOf(
            facts.map((f) => ({
              path: f.path,
              onDisk: f.onDisk ?? null,
              recorded: f.recorded ?? null,
              wanted: f.wanted ?? null,
            })),
          ),
        },
        findings,
      });
    }),
});

/** What would change on disk if the files were rendered: each generated file whose bytes differ from the templates' (or that is absent), with the text on disk now. */
async function pending(loaded: Loaded): Promise<
  readonly {
    readonly path: string;
    readonly before: string;
    readonly after: string;
    readonly edited: boolean;
  }[]
> {
  const facts = await fileFacts(loaded);
  const out: {
    path: string;
    before: string;
    after: string;
    edited: boolean;
  }[] = [];
  for (const f of loaded.files) {
    const fact = facts.find((x) => x.path === f.path);
    const disk = native(loaded, f.path);
    const before = existsSync(disk) ? await readTextFile(disk) : "";
    if (fact?.onDisk === fact?.wanted && fact?.onDisk !== undefined) continue;
    out.push({
      path: f.path,
      before,
      after: f.content,
      edited: fact?.recorded !== undefined && fact.onDisk !== undefined && fact.onDisk !== fact.recorded,
    });
  }
  return out;
}

const RENDER_OPTIONS = {
  ...GLOBAL_OPTIONS,
  check: flag({
    help: "Write nothing; name each file that would change and end with findings if any would.",
  }),
  diff: flag({
    help: "Write nothing; show each difference as a unified diff.",
  }),
  force: flag({ help: "Replace a generated file that was edited by hand." }),
  wait: flag({
    help: "Wait for another run of ergonex on this workspace instead of refusing.",
  }),
};

const render = defineCommand({
  name: "render",
  summary: "Write the generated files from the manifest; --check names what would change and writes nothing, --diff shows it.",
  options: RENDER_OPTIONS,
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      const todo = await pending(loaded);
      const findings: Finding[] = [];
      const lines: string[] = [];
      if (args.options.check || args.options.diff) {
        for (const p of todo) {
          lines.push(
            `would ${p.before === "" ? "write" : "change"} ${p.path}${p.edited ? " (edited by hand: render refuses without --force)" : ""}`,
          );
          if (args.options.diff) lines.push(unifiedDiff(p.path, p.before, p.after).trimEnd());
          if (args.options.check)
            findings.push({
              ruleId: "ergonex/render-would-change",
              severity: "Warning",
              message: `${p.path} would ${p.before === "" ? "be written" : "change"}; run \`ergonex render\``,
              subject: p.path,
              firstSeen: ctx.today,
            });
        }
        if (todo.length === 0) lines.push("every generated file is as the templates give it");
        return ok({
          text: lines.filter((l) => l !== "").join("\n"),
          data: { wouldChange: todo.map((p) => p.path) },
          findings,
          ...(args.options.check && todo.length > 0 ? { status: "Findings" as const } : {}),
        });
      }
      const s = await situate(ctx, loaded, { fetch: false });
      if (s.kind === "err")
        return err({
          kind: "environment",
          message: `git cannot be run (${s.error.program} is not installed or not on the PATH)`,
        });
      // only the generated files: render never clones, fast-forwards or configures a repository
      const filesOnly = {
        ...s.value,
        plan: {
          actions: s.value.plan.actions.filter(
            (a) =>
              a.kind === "WriteGenerated" ||
              (a.kind === "Refuse" && a.why.kind === "generated-edited") ||
              (a.kind === "Skip" && (a.why.kind === "file-current" || a.why.kind === "file-absent")),
          ),
        },
      };
      const done = await applyPlan(filesOnly, ctx, {
        allowDestructive: false,
        force: args.options.force,
        wait: args.options.wait,
        recordPlan: false,
      });
      if (done.kind === "err")
        return err({
          kind: "environment",
          message: `another run of ergonex holds the workspace: ${done.error.holder}; run again when it ends, or give --wait`,
        });
      const mine = done.value.steps.filter((x) => x.action.kind === "WriteGenerated" || x.action.kind === "Refuse");
      for (const x of mine)
        lines.push(`${x.status} ${"target" in x.action ? x.action.target : ""}${x.detail === "" ? "" : ` (${x.detail})`}`);
      if (mine.length === 0) lines.push("every generated file is as the templates give it; nothing written");
      return ok({
        text: textOf(lines, done.value.findings),
        data: {
          written: done.value.steps.filter((x) => x.status === "done").length,
        },
        findings: done.value.findings,
        facts: { stateSha256: done.value.recordSha },
      });
    }),
});

/** The module `ergonex verify`. */
export const verifyModule: ErgonexModule = {
  name: "verify",
  summary: verify.summary,
  commands: [verify],
};

/** The module `ergonex render`. */
export const renderModule: ErgonexModule = {
  name: "render",
  summary: render.summary,
  commands: [render],
};
