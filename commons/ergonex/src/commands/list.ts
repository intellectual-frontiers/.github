// Spec: 0001-ergonex FR-002
/**
 * `ergonex modules` (commons 0001-ergonex FR-002, FR-003, FR-009): names every module with its source (`ergonex:BuiltIn`, `ergonex:Registered` or `ergonex:Path`) and its summary, and a module that a module of an earlier source hides is told as an
 * informational finding. It runs no module found on the `PATH` unless `--probe` is given, which asks each such module for its `--ergonex-manifest` and runs nothing else. The help of the command and of each command is Headless': `ergonex help`.
 *
 * @module
 */
import { flag, type Parser, value } from "../platform/k-args.ts";
import { err, ok, absurd } from "@intellectual-frontiers/core";
import type { Finding } from "../findings.ts";
import { MANIFEST_TIMEOUT_MS } from "../modules/external.ts";
import { discoverModules, probeModule } from "../host/discovery.ts";
import { hiddenFindings, resolveAll } from "../modules/registry.ts";
import { jsonOf } from "./common.ts";
import { defineCommand } from "./define.ts";
import { HOME, readsHere } from "./options.ts";

/** A number of seconds to wait: a whole number, at least one. */
const seconds: Parser<number> = (t) => (/^\d+$/.test(t) && Number(t) >= 1 ? ok(Number(t)) : err("a whole number of seconds, at least 1"));

const LIST_OPTIONS = {
  ...HOME,
  probe: flag({
    help: "Run each module registered or found on the PATH, to ask it for --ergonex-manifest (it runs nothing else). A module on the PATH is run only after you say yes to it, or with --trust; it is not sandboxed.",
  }),
  trust: flag({
    help: "With --probe, do not ask before running a module found on the PATH.",
  }),
  probeTimeout: value({
    help: `With --probe, how long to wait for each module to answer (the default is ${MANIFEST_TIMEOUT_MS / 1000}); a module that does not answer in time is listed as opaque and is a warning, and the run goes on.`,
    valueName: "SECONDS",
    parse: seconds,
  }),
};

/** The command `ergonex modules`. */
export const modulesCommand = defineCommand({
  name: "modules",
  summary: "List every module with its source and summary; --probe asks the modules on the PATH for their manifest.",
  options: LIST_OPTIONS,
  action: readsHere(),
  examples: [
    { args: [], says: "Name every module and where it was found; run none." },
    { args: ["--probe", "--trust"], says: "Ask each module on the PATH for its manifest without asking first." },
  ],
  run: async (ctx, args) => {
    const found = await discoverModules(ctx);
    const resolved = resolveAll(found.candidates);
    const findings: Finding[] = [...found.findings, ...hiddenFindings(resolved, ctx.today)];
    // a module on the PATH is run only with the person's yes for it, or with --yes (0001-ergonex FR-028); a registered one is the workspace's own
    const onPath = args.options.probe ? resolved.modules.filter((m) => m.source === "Path") : [];
    if (onPath.length > 0 && !args.options.trust && !ctx.interact.terminal)
      return err({
        kind: "usage",
        message: `there is no terminal to ask on, and --probe would run ${onPath.map((m) => m.name).join(", ")} from the PATH: run it in a terminal, or give --trust to run them`,
      });
    const waitMs = (args.options.probeTimeout ?? MANIFEST_TIMEOUT_MS / 1000) * 1000;
    const rows: {
      name: string;
      source: string;
      summary: string;
      where: string;
      opaque?: string;
      probed?: false;
      commands?: { name: string; summary: string }[];
    }[] = [];
    for (const m of resolved.modules) {
      const row: (typeof rows)[number] = {
        name: m.name,
        source: `ergonex:${m.source}`,
        summary: m.summary,
        where: m.where,
      };
      if (args.options.probe && m.source !== "BuiltIn") {
        const approved =
          m.source !== "Path" ||
          args.options.trust ||
          (await ctx.interact.confirm(`Run ${m.where} to ask it for its manifest? It is not sandboxed.`)) === true;
        if (!approved) {
          row.summary = "(not probed: it was not run)";
          row.probed = false;
          rows.push(row);
          continue;
        }
        const probed = await probeModule(m.where, waitMs);
        switch (probed.kind) {
          case "typed":
            row.summary = probed.manifest.summary;
            row.commands = probed.manifest.commands.map((c) => ({
              name: c.name,
              summary: c.summary,
            }));
            break;
          case "opaque":
            row.summary = `(opaque: ${probed.why})`;
            row.opaque = probed.why;
            break;
          case "timed-out": {
            const wait = probed.ms / 1000;
            row.summary = `(opaque: no answer in ${wait} second${wait === 1 ? "" : "s"})`;
            row.opaque = `no answer in ${wait} second${wait === 1 ? "" : "s"}`;
            findings.push({
              ruleId: "ergonex/module-probe-timeout",
              severity: "Informational",
              message: `${m.name} did not answer --ergonex-manifest in ${wait} second${wait === 1 ? "" : "s"}; it is listed as an opaque command; raise the wait with --probe-timeout SECONDS`,
              subject: m.name,
              firstSeen: ctx.today,
            });
            break;
          }
          default:
            return absurd(probed);
        }
      }
      rows.push(row);
    }
    const width = Math.max(0, ...rows.map((r) => r.name.length));
    const sourceWidth = Math.max(0, ...rows.map((r) => r.source.length));
    const lines = rows.map((r) => `${r.name.padEnd(width)}  ${r.source.padEnd(sourceWidth)}  ${r.summary}`);
    return ok({
      text: lines.join("\n"),
      data: { modules: jsonOf(rows) },
      findings,
    });
  },
});

