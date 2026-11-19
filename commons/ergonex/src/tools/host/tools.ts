// Spec: 0001-ergonex FR-018
/**
 * `ergonex tools` (commons 0001-ergonex FR-018, 0002-workspace-model FR-037 to FR-040): lists the catalog with what is installed, verifies the installed tools against their install records and the
 * probes of `git`, `bun` and `node`, and exports the catalog and the inventory as OSCAL, SPDX and CycloneDX. It reads and never installs or writes: a plan or a run of this command holds no
 * `InstallTool` (0002-workspace-model FR-030).
 *
 * @remarks
 * `tools(args, deps)` returns a `Result` of a report: the lead wires it as the module `ergonex tools` (M5's `ErgonexModule` contract is not in this tree). The report's `findings` are
 * `ergonex:Finding`s: a probe that fails (error), an installed tool changed since its record (error), a tool in the folder that the catalog does not list (informational for 90 days, then a warning).
 *
 * @module
 */
import type { Places } from "../../places.ts";
import { ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { listDirs } from "../../platform/r-fs.ts";

import { type Finding, exitStatusOf, firstSeenOf } from "../../findings.ts";
import { type ToolsArgs, type UsageError } from "../args.ts";
import { type Tool, type ToolArch, type ToolCatalog, type ToolOs, artifactFor, toolNamed } from "../catalog.ts";
import { describeDrift } from "../install.ts";
import { type InstalledTool, exportDocument, outsideCatalogFindings } from "../inventory.ts";
import { type Probe, probeFinding, probedVersions } from "../probe.ts";
import { installedTools, verifyTool } from "./install.ts";

/** What `ergonex tools` needs from the host. */
export type ToolsDeps = {
  /** Where the tools are installed (0031-install-locations). */
  readonly places: Places;
  readonly catalog: ToolCatalog;
  readonly os: ToolOs;
  readonly arch: ToolArch;
  /** Today, `YYYY-MM-DD`: nothing here reads a clock. */
  readonly today: string;
  /** The instant of the run, an ISO 8601 text, for the documents that carry one. */
  readonly at: string;
  /** The days tools outside the catalog were first seen, by name, from the state record (the clock is never restarted). */
  readonly firstSeen: Readonly<Record<string, string>>;
  /** How the probes are made (the real ones by default are `probeAll`). */
  readonly probe: () => Promise<readonly Probe[]>;
  /** The workspace's name, for the exported documents. */
  readonly workspace: string;
  /** The grace days of a tool outside the catalog (90 by default). */
  readonly graceDays?: number;
};

/** One row of the list. */
export type ToolRow = {
  readonly name: string;
  readonly version: string;
  /** Whether it is installed whole, drifted from its record, not installed, or not pinned for this system. */
  readonly status: "installed" | "drifted" | "not-installed" | "not-pinned-for-this-system";
  readonly messages: readonly string[];
};

/** What `ergonex tools` reports. */
export type ToolsReport = {
  readonly command: ToolsArgs["command"];
  readonly rows: readonly ToolRow[];
  readonly probes: readonly Probe[];
  readonly findings: readonly Finding[];
  /** The tools' versions the run used, for the evidence (0002-workspace-model FR-042, FR-043). */
  readonly versions: Readonly<Record<string, string>>;
  /** The exported document, for `export`. */
  readonly document?: Readonly<Record<string, unknown>>;
  /** The days of the tools outside the catalog, to record in the state record (never restarted). */
  readonly seen: Readonly<Record<string, string>>;
  readonly exit: "Ok" | "Findings";
};

async function rowOf(deps: ToolsDeps, tool: Tool): Promise<{ readonly row: ToolRow; readonly findings: readonly Finding[] }> {
  if (artifactFor(tool, deps.os, deps.arch) === undefined) {
    return {
      row: {
        name: tool.name,
        version: tool.version,
        status: "not-pinned-for-this-system",
        messages: [],
      },
      findings: [],
    };
  }
  const v = await verifyTool(deps.places, tool, deps.os, deps.arch);
  if (v.kind === "err")
    return {
      row: {
        name: tool.name,
        version: tool.version,
        status: "not-installed",
        messages: [],
      },
      findings: [],
    };
  if (v.value.length === 0)
    return {
      row: {
        name: tool.name,
        version: tool.version,
        status: "installed",
        messages: [],
      },
      findings: [],
    };
  const messages = v.value.map((d) => describeDrift(tool.name, d));
  return {
    row: {
      name: tool.name,
      version: tool.version,
      status: "drifted",
      messages,
    },
    findings: messages.map((message) => ({
      ruleId: "ergonex/tool-drift",
      severity: "Error" as const,
      message,
      subject: tool.name,
      firstSeen: deps.today,
    })),
  };
}

/** The folders of the tools directory that the catalog does not list (a tool put there by hand). */
async function strangers(deps: ToolsDeps): Promise<readonly string[]> {
  const names = await listDirs(deps.places.tools);
  return names.filter((n) => toolNamed(deps.catalog, n) === undefined);
}

/** Runs `ergonex tools`: the report, or a usage error. */
export async function tools(args: ToolsArgs, deps: ToolsDeps): Promise<Result<ToolsReport, UsageError>> {
  const probes = await deps.probe();
  const rows: ToolRow[] = [];
  const findings: Finding[] = [];
  for (const t of deps.catalog.tools) {
    const r = await rowOf(deps, t);
    rows.push(r.row);
    findings.push(...r.findings);
  }
  for (const p of probes) {
    const f = probeFinding(p, deps.today);
    if (f !== undefined) findings.push(f);
  }
  const names = await strangers(deps);
  const seen: Record<string, string> = {};
  for (const n of names) seen[n] = firstSeenOf(deps.firstSeen, n, deps.today);
  findings.push(
    ...outsideCatalogFindings(
      deps.catalog,
      names.map((name) => ({ name, firstSeen: seen[name] ?? deps.today })),
      deps.today,
      deps.graceDays,
    ),
  );

  let document: Readonly<Record<string, unknown>> | undefined;
  if (args.command === "export") {
    const installed: readonly InstalledTool[] = await installedTools(deps.places);
    document = await exportDocument(args.format, deps.catalog, installed, deps.at, deps.workspace);
  }
  const exit = args.command === "export" ? "Ok" : exitStatusOf(findings);
  return ok({
    command: args.command,
    rows,
    probes,
    findings,
    versions: probedVersions(probes),
    ...(document === undefined ? {} : { document }),
    seen,
    exit,
  });
}
