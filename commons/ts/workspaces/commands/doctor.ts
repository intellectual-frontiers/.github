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
import { rememberSeen } from "../host/seen.ts";
import { type Loaded, native, situate } from "../host/workspace.ts";
import { defineCommand, GLOBAL_OPTIONS, type Context, type IfwsModule } from "../modules/types.ts";
import { hiddenFindings, resolveAll } from "../modules/registry.ts";
import { nativePath } from "../portable.ts";
import { type FoundModule, moduleSourceFindings, type CommitSignature, signedCommitFindings } from "../scan/policy-scans.ts";
import { commitSignatures, gitConfigFilesOf, modulesOnPath, scanRoot } from "../scan/host/scan.ts";
import { longPathFindings } from "../setup/windows.ts";
import { STATE_RECORD_PATH, verifyFindings } from "../state-record.ts";
import type { Finding } from "../findings.ts";
import { existsSync } from "../../runtime/fs.ts";
import { join } from "../../runtime/path.ts";
import type { RepoPath } from "../types.ts";
import { jsonOf, withWorkspace } from "./common.ts";

/** A check the doctor runs besides its own: from the loaded workspace to what it found. */
export type DoctorCheck = (ctx: Context, loaded: Loaded) => Promise<readonly Check[]>;

/** A finding as a check: an error is `error`, a warning `warn`, an informational finding `suggest`. */
function asCheck(f: Finding): Check {
  return {
    id: f.ruleId,
    level: f.severity === "Error" ? "error" : f.severity === "Warning" ? "warn" : "suggest",
    subject: f.subject,
    message: f.message,
  };
}

/** The plaintext-token scan (0023-if-workspaces FR-031): the manifest, the generated files, the state record and each repository's local Git configuration. A finding names the file and the line, never the secret. */
const secretsCheck: DoctorCheck = async (ctx, loaded) => {
  const files = [
    ".if-workspaces/workspace.ts",
    STATE_RECORD_PATH,
    ...loaded.files.map((f) => f.path as string),
    ...loaded.manifest.repositories.flatMap((r) => gitConfigFilesOf(r.path)),
  ];
  const r = await scanRoot(loaded.home, files, ctx.today);
  const out = r.findings.map(asCheck);
  for (const x of r.refused)
    out.push({ id: "ifws/scan-refused", level: "suggest", subject: x.path, message: `${x.path} was not scanned: ${x.reason}` });
  if (r.findings.length === 0)
    out.push({
      id: "ifws/plaintext-token",
      level: "ok",
      subject: "managed files",
      message: `no plaintext token in ${r.scanned.length} managed files`,
    });
  return out;
};

/** The signed-commit policy (0023-if-workspaces FR-032): each commit of a managed repository that its upstream does not have (all that Git can say where there is no upstream) is judged by its signature: an error where a regulated domain is named, a warning elsewhere. */
const signaturesCheck: DoctorCheck = async (ctx, loaded) => {
  const commits: CommitSignature[] = [];
  let looked = 0;
  for (const r of loaded.manifest.repositories) {
    const folder = native(loaded.home, r.path);
    if (!existsSync(join(folder, ".git"))) continue;
    const ahead = await commitSignatures(folder, "@{upstream}..HEAD", 50);
    const said = ahead.kind === "ok" ? ahead : await commitSignatures(folder, "HEAD", 20);
    if (said.kind === "ok") {
      looked++;
      commits.push(...said.value.map((c) => ({ ...c, repo: r.path })));
    }
  }
  const findings = signedCommitFindings(loaded.manifest.policy, commits, ctx.today);
  return findings.length > 0
    ? findings.map(asCheck)
    : [
        {
          id: "ifws/commit-not-signed",
          level: "ok",
          subject: "commits",
          message: `${commits.length} local commit${commits.length === 1 ? "" : "s"} of ${looked} repositor${looked === 1 ? "y" : "ies"} checked, each signed and verified`,
        },
      ];
};

/** The modules outside the catalog (0023-if-workspaces FR-033): an `ifws-*` on the `PATH`, or registered without its hash, that the catalog does not list is informational for the grace days from the day first seen and then a warning; the day is kept in the state record. */
const modulesCheck: DoctorCheck = async (ctx, loaded) => {
  const seen = loaded.record.firstSeen;
  const registered: FoundModule[] = loaded.manifest.modules.map((m) => ({
    name: `ifws-${m.name}`,
    source: m.sha256 === undefined ? "registered" : "registered-with-hash",
    firstSeen: seen[`ifws-${m.name}`] ?? ctx.today,
  }));
  const names = new Set(registered.map((m) => m.name));
  const found = [
    ...registered,
    ...modulesOnPath(ctx.env["PATH"] ?? "", seen, ctx.today, ctx.platform.windows).filter((m) => !names.has(m.name)),
  ];
  const findings = moduleSourceFindings(loaded.manifest.catalog, found, ctx.today, loaded.manifest.policy.unapprovedGraceDays);
  await rememberSeen(loaded.home, Object.fromEntries(findings.map((f) => [f.subject, f.firstSeen])));
  return findings.length > 0
    ? findings.map(asCheck)
    : [
        {
          id: "ifws/module-outside-catalog",
          level: "ok",
          subject: "modules",
          message: "every ifws-* module is in the catalog or registered with its hash",
        },
      ];
};

/** Windows long paths (0023-if-workspaces FR-012, FR-036): `Windows long paths not enabled` is informational while no path of the workspace is over the limit and an error once one is, and each such path is an error naming it; the error says `ifws setup` is the way. */
const longPathsCheck: DoctorCheck = async (ctx, loaded) => {
  if (!ctx.platform.windows) return [];
  const paths = [
    ...loaded.manifest.repositories.flatMap((r) => [r.path, ...r.worktrees.map((w) => w.path)]),
    ...loaded.files.map((f) => f.path),
  ];
  const findings = longPathFindings(
    { os: "windows", longPathsEnabled: (await probeLongPaths()) === "enabled", paths: paths.map((p) => nativePath(loaded.home, p, "\\")) },
    ctx.today,
  );
  return findings.length > 0
    ? findings.map(asCheck)
    : [{ id: "ifws/windows-long-paths", level: "ok", subject: "windows", message: "Windows long paths are enabled" }];
};

/** The checks added to the doctor's own, in order: the policy scans of `workspaces/scan/` and the long-path finding of `setup/windows.ts`. */
export const DOCTOR_CHECKS: readonly DoctorCheck[] = [secretsCheck, signaturesCheck, modulesCheck, longPathsCheck];

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
      // on Windows the long-path finding is the setup module's (`longPathsCheck` below); elsewhere the limit does not apply and the check says so
      if (!ctx.platform.windows) checks.push(...pathChecks({ home: loaded.home, windows: false, longPaths: "unknown", paths }));
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
