/**
 * `ifws doctor` (commons 0025-ifws FR-014, 0023-if-workspaces FR-012, FR-014, FR-036): checks the runtime and the tools, the layout and the portability of every path, the file system of the root, the
 * hooks of each repository and the generated files, and reports each check as `ok`, `suggest` (an informational finding), `warn` (a warning) or `error` (an error), each with what to do. It changes nothing.
 *
 * @remarks
 * The policy scans (the plaintext-token scan, signed commits, tools and modules outside the catalog) are another module's work (`workspaces/scan/`); `DOCTOR_CHECKS` is the documented list they are
 * added to: each is a function from the loaded workspace to checks, run after the checks here, and a check that fails to run is a check that did not run, never a pass.
 *
 * @module
 */
import { err, ok } from "../../kernel/result.ts";
import { build, runtimeName, runtimeVersion } from "../../runtime/proc.ts";
import { type Check, findingsOf, fsCheck, hookChecks, type HookFacts, pathChecks, runtimeChecks } from "../doctor.ts";
import { discoverModules } from "../host/discovery.ts";
import { fileFacts } from "../host/files.ts";
import { probeFileSystem, probeLongPaths, probeTool } from "../host/probe.ts";
import { type Loaded, situate } from "../host/workspace.ts";
import { defineCommand, GLOBAL_OPTIONS, type Context, type IfwsModule } from "../modules/types.ts";
import { hiddenFindings, resolveAll } from "../modules/registry.ts";
import { verifyFindings } from "../state-record.ts";
import type { RepoPath } from "../types.ts";
import { jsonOf, withWorkspace } from "./common.ts";

/** A check the doctor runs besides its own: from the loaded workspace to what it found. */
export type DoctorCheck = (ctx: Context, loaded: Loaded) => Promise<readonly Check[]>;

/** The checks added to the doctor's own, in order: none yet; the policy scans of `workspaces/scan/` are added here when they are wired in. */
export const DOCTOR_CHECKS: readonly DoctorCheck[] = [];

const doctor = defineCommand({
  name: "doctor",
  summary: "Check the runtime and tools, the layout, the file system, the hooks and the generated files, and say what to do about each.",
  options: { ...GLOBAL_OPTIONS },
  run: (ctx) =>
    withWorkspace(ctx, async (loaded) => {
      const checks: Check[] = [];
      const runtime = runtimeName();
      checks.push(
        ...runtimeChecks({ name: runtime, version: runtimeVersion() }, [
          await probeTool("git", ctx.env["PATH"]),
          await probeTool("bun", ctx.env["PATH"]),
          await probeTool("node", ctx.env["PATH"]),
        ]),
      );

      const paths: RepoPath[] = [
        ...loaded.manifest.repositories.flatMap((r) => [r.path, ...r.worktrees.map((w) => w.path)]),
        ...loaded.files.map((f) => f.path),
      ];
      checks.push(
        ...pathChecks({
          home: loaded.home,
          windows: ctx.platform.windows,
          longPaths: ctx.platform.windows ? await probeLongPaths() : "unknown",
          paths,
        }),
      );
      checks.push(fsCheck(await probeFileSystem(loaded.home), loaded.home));

      const s = await situate(ctx, loaded, { fetch: false });
      if (s.kind === "err")
        return err({ kind: "environment", message: `git cannot be run (${s.error.program} is not installed or not on the PATH)` });
      const wanted = s.value.desired.repos[0]?.settings["core.hooksPath"];
      if (wanted !== undefined) {
        const facts: HookFacts[] = s.value.desired.repos.map((r) => {
          const seen = s.value.observed.repos[r.path];
          return {
            repo: r.path,
            present:
              seen !== undefined && seen.state.kind !== "Missing" && seen.state.kind !== "NotARepo" && seen.state.kind !== "WrongRemote",
            hooksPath: seen?.config["core.hooksPath"],
          };
        });
        checks.push(...hookChecks(facts, wanted));
      }

      const generated = verifyFindings(await fileFacts(loaded), ctx.today);
      for (const f of generated)
        checks.push({
          id: f.ruleId,
          level: f.severity === "Error" ? "error" : f.severity === "Warning" ? "warn" : "suggest",
          subject: f.subject,
          message: f.message,
        });
      if (generated.length === 0)
        checks.push({
          id: "ifws/generated",
          level: "ok",
          subject: "generated files",
          message: "every generated file is as written and as the templates give it",
        });

      // a module that a module of an earlier source hides is told (0025-ifws FR-004)
      const found = await discoverModules(ctx);
      for (const f of [...found.findings, ...hiddenFindings(resolveAll(found.candidates), ctx.today)])
        checks.push({ id: f.ruleId, level: "suggest", subject: f.subject, message: f.message });

      for (const extra of DOCTOR_CHECKS) checks.push(...(await extra(ctx, loaded)));

      const findings = findingsOf(checks, ctx.today);
      const lines = checks.map((c) => `${c.level.padEnd(7)} ${c.subject}: ${c.message}`);
      return ok({
        text: lines.join("\n"),
        data: { os: build.os, checks: jsonOf(checks) },
        findings,
        facts: { planSha256: s.value.planSha, tools: await toolVersions(ctx) },
      });
    }),
});

async function toolVersions(ctx: Context): Promise<readonly { readonly name: string; readonly version: string }[]> {
  const out: { name: string; version: string }[] = [];
  for (const name of ["git", "bun", "node"]) {
    const t = await probeTool(name, ctx.env["PATH"]);
    if (t.version !== undefined) out.push({ name, version: t.version });
  }
  return out;
}

/** The module `ifws doctor`. */
export const doctorModule: IfwsModule = { name: "doctor", summary: doctor.summary, commands: [doctor] };
