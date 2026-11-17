/**
 * `ifws tools` (commons 0025-ifws FR-015, 0023-if-workspaces FR-037 to FR-040): lists the tool catalog of the manifest with what is installed, verifies the installed tools against their install records
 * and the probes of `git`, `bun` and `node`, and exports the catalog and the inventory as OSCAL, SPDX or CycloneDX. It installs nothing (only `ifws setup --apply` does), and a tool that is in the tools
 * folder and not in the catalog is informational for 90 days from the day first seen and then a warning, the day kept in the state record and never restarted. This module wraps `tools/host/tools.ts`.
 *
 * @module
 */
import { err, ok } from "../../kernel/result.ts";
import { basename } from "../../runtime/path.ts";
import { type Finding } from "../findings.ts";
import { rememberSeen } from "../host/seen.ts";
import { type Platform, defineCommand, GLOBAL_OPTIONS, type IfwsModule } from "../modules/types.ts";
import { probeAll } from "../tools/host/probe.ts";
import { type ToolArch, type ToolOs } from "../tools/catalog.ts";
import { tools } from "../tools/host/tools.ts";
import { parseToolsArgs } from "../tools/args.ts";
import { jsonOf, textOf, withWorkspace } from "./common.ts";

/** The operating system and architecture as the catalog names them, or undefined for a system the catalog has no name for. */
export function hostTarget(p: Platform): { readonly os: ToolOs; readonly arch: ToolArch } | undefined {
  const os: ToolOs | undefined = p.os === "linux" ? "linux" : p.os === "darwin" ? "macos" : p.os === "windows" ? "windows" : undefined;
  const arch: ToolArch | undefined = p.arch === "x86_64" ? "x64" : p.arch === "aarch64" ? "arm64" : undefined;
  return os === undefined || arch === undefined ? undefined : { os, arch };
}

const toolsCommand = defineCommand({
  name: "tools",
  summary:
    "List the tool catalog and what is installed, verify the installed tools, or export the catalog (oscal, spdx, cyclonedx); installs nothing.",
  options: { ...GLOBAL_OPTIONS },
  operands: [
    { name: "COMMAND", help: "list (the default), verify or export.", arity: "optional" },
    { name: "FORMAT", help: "For export: oscal, spdx or cyclonedx.", arity: "optional" },
  ],
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      const parsed = parseToolsArgs(args.positionals);
      if (parsed.kind === "err") return err({ kind: "usage", message: parsed.error.message });
      const target = hostTarget(ctx.platform);
      if (target === undefined)
        return err({ kind: "environment", message: `ifws tools has no pinned tools for ${ctx.platform.os} ${ctx.platform.arch}` });
      const done = await tools(parsed.value, {
        home: loaded.home,
        catalog: loaded.manifest.catalog,
        os: target.os,
        arch: target.arch,
        today: ctx.today,
        at: new Date().toISOString(),
        firstSeen: loaded.record.firstSeen,
        probe: () => probeAll(),
        workspace: basename(loaded.home),
        graceDays: loaded.manifest.policy.unapprovedGraceDays,
      });
      if (done.kind === "err") return err({ kind: "usage", message: done.error.message });
      const r = done.value;
      await rememberSeen(loaded.home, r.seen);
      const findings: readonly Finding[] = r.findings;
      const lines =
        r.document !== undefined
          ? [JSON.stringify(r.document, null, 2)]
          : [
              ...(r.rows.length === 0
                ? ["the catalog names no tool"]
                : r.rows.map((x) => `${x.name} ${x.version}  ${x.status}${x.messages.length === 0 ? "" : `: ${x.messages.join("; ")}`}`)),
              ...r.probes.map((p) => `probe ${p.tool}: ${p.kind}`),
            ];
      return ok({
        text: r.document !== undefined ? lines.join("\n") : textOf(lines, findings),
        data: { command: r.command, tools: jsonOf(r.rows), ...(r.document === undefined ? {} : { document: jsonOf(r.document) }) },
        findings,
        status: r.exit,
        runFacts: {
          command: "tools",
          argv: [],
          tools: r.versions,
          findings,
          exit: r.exit,
          notRun: [],
          policy: loaded.manifest.policy,
        },
      });
    }),
});

/** The module `ifws tools`. */
export const toolsModule: IfwsModule = { name: "tools", summary: toolsCommand.summary, commands: [toolsCommand] };
