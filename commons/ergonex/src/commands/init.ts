// Spec: 0003-host FR-002
/**
 * `ergonex init` (commons 0003-host FR-002, 0001-ergonex FR-025): makes the root and the workspace's own area, and writes a starter manifest where there is none, then puts ergonex on the path by the runtime's global install (0004-onboarding FR-002); it installs no tool and changes nothing else outside the root, and run again it changes nothing. The starter is written once and never rewritten (0003-host FR-002).
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { flag, value } from "../platform/k-args.ts";
import { parseJson5 } from "@intellectual-frontiers/formats";
import { decodeAgentsPolicy } from "../agents/policy.ts";
import { agentsFilePath } from "../host/workspace.ts";
import { readTextFile } from "../platform/r-fs.ts";
import { writeBeside } from "../agents/host/write.ts";
import { exists, mkdir, writeTextFile } from "../platform/r-fs.ts";
import { defineCommand } from "./define.ts";
import { changes, HOME } from "./options.ts";
import { AREA, manifestPath } from "../host/workspace.ts";
import { starterManifest } from "../setup/starter.ts";
import { launchFor } from "../setup/onpath.ts";
import { putOnPath, type PathDeps } from "../setup/host/path.ts";
import { ERGONEX_VERSION } from "../state-record.ts";
import { dirname, fromFileUrl, join } from "../platform/r-path.ts";
import { run as runProgram, runtimeName, which } from "../platform/r-proc.ts";

/** The files that run now: the launcher of this package, where it is. */
const ENTRY = join(dirname(fromFileUrl(import.meta.url)), "..", "..", "bin", "ergonex.mjs");

/** The host as the step of the path uses it. */
const hostDeps: PathDeps = {
  which: (name) => which(name),
  run: (argv) => runProgram(argv),
};

const OPTIONS = {
  ...HOME,
  noInstall: flag({
    help: "Make the root only: do not put ergonex on the path.",
  }),
  noPath: flag({
    help: "On Windows, do not add the folder of the command files to your path.",
  }),
  policy: value({
    help: "With --persona agent: the file (or - for standard input) that holds the agents policy; it is decoded, refused where it is not valid, and kept in .ergonex/agents.json.",
    valueName: "FILE",
  }),
};

const init = defineCommand({
  name: "init",
  summary: "Make the root and the workspace's own area, write a starter manifest where there is none, and put ergonex on your path.",
  options: OPTIONS,
  action: changes({ idempotent: true }),
  examples: [
    { args: [], says: "Make the workspace at $ERGONEX_HOME (else $HOME/workspaces) and put ergonex on your path." },
    { args: ["--no-install"], says: "Make the workspace and leave your path as it is." },
  ],
  run: async (ctx, args) => {
    if (ctx.home === undefined)
      return err({
        kind: "environment",
        message: "no root can be found: set ERGONEX_HOME, or HOME (USERPROFILE on Windows), or give --home",
      });
    const home = ctx.home;
    const made: string[] = [];
    try {
      for (const folder of [home, join(home, AREA)]) {
        if (!(await exists(folder))) {
          await mkdir(folder, { recursive: true });
          made.push(folder);
        }
      }
      const manifest = manifestPath(home);
      if (!(await exists(manifest))) {
        await writeTextFile(manifest, starterManifest(), { createNew: true });
        made.push(manifest);
      }
    } catch (e) {
      return err({
        kind: "environment",
        message: `the root ${home} cannot be written: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    // the persona and the policy of an agent's machine (0006-agents FR-029): decoded here, and kept where the manifest reads them
    if (args.options.policy !== undefined) {
      const source = args.options.policy;
      const text = source === "-" ? await ctx.stdin() : await readTextFile(source).catch(() => undefined);
      if (text === undefined) return err({ kind: "usage", message: `${source} cannot be read` });
      const parsed = parseJson5(text);
      if (parsed.kind === "err") return err({ kind: "usage", message: "the agents policy is not JSON" });
      const policy = decodeAgentsPolicy(parsed.value);
      if (policy.kind === "err") return err({ kind: "usage", message: `the agents policy is not valid: ${policy.error.map((i) => `${i.path}: ${i.message}`).join("; ")}` });
      const persona = ctx.globals.persona ?? "agent";
      if (persona !== "agent" && persona !== "human") return err({ kind: "usage", message: `${JSON.stringify(persona)} is not a persona: use human or agent` });
      const changed = await writeBeside(agentsFilePath(home), `${JSON.stringify({ persona, agents: parsed.value }, null, 2)}\n`);
      if (changed) made.push(agentsFilePath(home));
    }
    const lines =
      made.length === 0
        ? [`${home} is already a workspace; nothing changed`]
        : [`made ${made.length} thing${made.length === 1 ? "" : "s"} in ${home}:`, ...made.map((m) => `  ${m}`)];
    let onPath: { readonly how: string } | undefined;
    if (!args.options.noInstall) {
      const r = await putOnPath(
        hostDeps,
        launchFor({
          runtime: runtimeName(),
          entry: ENTRY,
          version: ERGONEX_VERSION,
        }),
      );
      lines.push(...r.lines);
      onPath = r.data;
    }
    return ok({
      text: lines.join("\n"),
      data: { home, made, onPath: onPath ?? null },
      findings: [],
      title: made.length === 0 ? "Already a workspace" : "Workspace made",
      next: ["ergonex repos add github.com/owner/repo"],
    });
  },
});

/** The command `ergonex init`. */
export const initCommand = init;
