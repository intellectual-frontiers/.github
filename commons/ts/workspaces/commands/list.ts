/**
 * `ifws list` and `ifws help` (commons 0025-ifws FR-002, FR-003, FR-009): `list` names every module with its source (`ifws:BuiltIn`, `ifws:Registered` or `ifws:Path`) and its summary, and a module that a
 * module of an earlier source hides is told as an informational finding; `help` describes the command and, given a module, the commands of that module. Neither runs a module found on the `PATH` unless
 * `list` is given `--probe`, which asks each such module for its `--ifws-manifest` and runs nothing else.
 *
 * @module
 */
import { flag, type Parser, value } from "../../kernel/args.ts";
import { err, ok } from "../../kernel/result.ts";
import type { Finding } from "../findings.ts";
import { MANIFEST_TIMEOUT_MS } from "../modules/external.ts";
import { discoverModules, probeModule } from "../host/discovery.ts";
import { absurd } from "../../kernel/absurd.ts";
import { hiddenFindings, resolveAll } from "../modules/registry.ts";
import { defineCommand, dispatch, GLOBAL_OPTIONS, type IfwsModule } from "../modules/types.ts";
import { nearestNames } from "../modules/name.ts";
import { jsonOf, textOf } from "./common.ts";

/** What `ifws` says it is, in these words (0025-ifws FR-002). */
export const SCOPE_STATEMENT =
  "ifws manages only Intellectual Frontiers Workspaces. It is not a general IFC or Mizan controller and does not front ifc.";

/** The help of the command: its scope, its usage and the modules it holds. */
export function topHelp(builtins: readonly IfwsModule[]): string {
  const width = Math.max(0, ...builtins.map((m) => m.name.length));
  return [
    "ifws: the command of Intellectual Frontiers Workspaces.",
    "",
    SCOPE_STATEMENT,
    "",
    "Usage: ifws <module> [options] [arguments]",
    "       ifws help [module]",
    "       ifws list [--probe]",
    "",
    "`ifws <name>` runs the module ifws-<name>: a built-in one, one the workspace registers, or an executable named ifws-<name> on the PATH.",
    "",
    "Modules:",
    ...builtins.map((m) => `  ${m.name.padEnd(width)}  ${m.summary}`),
    "",
    "Every module takes --home DIR, --json, --sarif, --no-color and --help. Exit status: 0 ok, 1 findings, 2 usage, 3 environment.",
  ].join("\n");
}

/** A number of seconds to wait: a whole number, at least one. */
const seconds: Parser<number> = (t) => (/^\d+$/.test(t) && Number(t) >= 1 ? ok(Number(t)) : err("a whole number of seconds, at least 1"));

const LIST_OPTIONS = {
  ...GLOBAL_OPTIONS,
  probe: flag({
    help: "Run each module registered or found on the PATH, to ask it for --ifws-manifest (it runs nothing else). A module on the PATH is run only after you say yes to it, or with --yes; it is not sandboxed.",
  }),
  yes: flag({ help: "With --probe, do not ask before running a module found on the PATH." }),
  probeTimeout: value({
    help: `With --probe, how long to wait for each module to answer (the default is ${MANIFEST_TIMEOUT_MS / 1000}); a module that does not answer in time is listed as opaque and is a warning, and the run goes on.`,
    valueName: "SECONDS",
    parse: seconds,
  }),
};

const list = defineCommand({
  name: "list",
  summary: "List every module with its source and summary; --probe asks the modules on the PATH for their manifest.",
  options: LIST_OPTIONS,
  run: async (ctx, args) => {
    const found = await discoverModules(ctx);
    const resolved = resolveAll(found.candidates);
    const findings: Finding[] = [...found.findings, ...hiddenFindings(resolved, ctx.today)];
    // a module on the PATH is run only with the person's yes for it, or with --yes (0025-ifws FR-028); a registered one is the workspace's own
    const onPath = args.options.probe ? resolved.modules.filter((m) => m.source === "Path") : [];
    if (onPath.length > 0 && !args.options.yes && !ctx.interact.terminal)
      return err({
        kind: "usage",
        message: `there is no terminal to ask on, and --probe would run ${onPath.map((m) => m.name).join(", ")} from the PATH: run it in a terminal, or give --yes to run them`,
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
      const row: (typeof rows)[number] = { name: m.name, source: `ifws:${m.source}`, summary: m.summary, where: m.where };
      if (args.options.probe && m.source !== "BuiltIn") {
        const approved =
          m.source !== "Path" ||
          args.options.yes ||
          /^\s*y(es)?\s*$/i.test((await ctx.interact.ask(`Run ${m.where} to ask it for its manifest? It is not sandboxed. [y/N] `)) ?? "");
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
            row.commands = probed.manifest.commands.map((c) => ({ name: c.name, summary: c.summary }));
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
              ruleId: "ifws/module-probe-timeout",
              severity: "Informational",
              message: `${m.name} did not answer --ifws-manifest in ${wait} second${wait === 1 ? "" : "s"}; it is listed as an opaque command; raise the wait with --probe-timeout SECONDS`,
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
    return ok({ text: textOf(lines, findings), data: { modules: jsonOf(rows) }, findings });
  },
});

const help = defineCommand({
  name: "help",
  summary: "Describe the command, or the commands of a module.",
  options: { ...GLOBAL_OPTIONS },
  operands: [{ name: "MODULE", help: "A module to describe.", arity: "optional" }],
  run: async (ctx, args) => {
    const [name] = args.positionals;
    if (name === undefined) return ok({ text: topHelp(ctx.builtins), data: null, findings: [], noEvidence: true });
    const module = ctx.builtins.find((m) => m.name === name);
    if (module === undefined) {
      const found = await discoverModules(ctx);
      const known = resolveAll(found.candidates).modules.find((m) => m.name === name);
      if (known !== undefined)
        return ok({
          text: `${name} is a module on this computer (${known.source}: ${known.where}); help does not run it: run \`ifws list --probe\` to ask it, or \`ifws ${name} --help\``,
          data: null,
          findings: [],
          noEvidence: true,
        });
      const near = nearestNames(
        name,
        resolveAll(found.candidates).modules.map((m) => m.name),
      );
      return ok({
        text: `no module is named ${name}${near.length === 0 ? "" : `; did you mean ${near.join(", ")}?`}`,
        data: null,
        findings: [
          {
            ruleId: "ifws/unknown-module",
            severity: "Warning",
            message: `no module is named ${name}`,
            subject: name,
            firstSeen: ctx.today,
          },
        ],
        noEvidence: true,
      });
    }
    const d = dispatch(module, ["--help"]);
    const lines =
      d.kind === "help"
        ? [`ifws ${module.name}: ${module.summary}`, "", ...module.commands.map((c) => `  ifws ${module.name} ${c.name}  ${c.summary}`)]
        : d.kind === "command"
          ? [d.command.help(`ifws ${module.name}`)]
          : [];
    return ok({ text: lines.join("\n"), data: null, findings: [], noEvidence: true });
  },
});

/** The module `ifws list`. */
export const listModule: IfwsModule = { name: "list", summary: list.summary, commands: [list] };

/** The module `ifws help`. */
export const helpModule: IfwsModule = { name: "help", summary: help.summary, commands: [help] };
