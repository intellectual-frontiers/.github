// Spec: 0001-ergonex FR-001
/**
 * The program `ergonex` as Headless' tree (commons 0001-ergonex FR-001, FR-003; commons headless 0003-headless-output FR-001): its commands and branches, each declared with the facts of its action, its options, operands and examples, and the data
 * Headless configures itself with (the name and version, the prefix of the variables, the codes it explains, the secrets it redacts, the command it runs where none is given). `ergonexProgram(host)` is the one place the tree is made; the
 * command line runs it (`ergonex.ts`), and anything that describes a program (a documentation lens, a tool server) reads it.
 *
 * @module
 */
import { branch, type Node, type Program, programOf } from "@intellectual-frontiers/headless/logical";
import { absurd, ok } from "@intellectual-frontiers/core";
import { existsSync } from "../platform/r-fs.ts";
import { join } from "../platform/r-path.ts";
import { ERGONEX_VERSION } from "../state-record.ts";
import { AREA } from "../host/workspace.ts";
import type { ErgonexModule } from "../modules/types.ts";
import { CATALOGUE, PATTERNS } from "./catalogue.ts";
import { defineCommand, type Host, type Make } from "./define.ts";
import { doctorCommand } from "./doctor.ts";
import { guidanceFor } from "./guidance.ts";
import { hookCommand } from "./hook.ts";
import { initCommand } from "./init.ts";
import { modulesCommand } from "./list.ts";
import { HOME, reads } from "./options.ts";
import { pathsCommand } from "./paths.ts";
import { applyCommand, planCommand } from "./plan.ts";
import { addCommand, adoptCommand, deleteRepoCommand, removeRepoCommand } from "./repos.ts";
import { setupCommand } from "./setup.ts";
import { shellCommands } from "./shell.ts";
import { statusCommand } from "./status.ts";
import { toolsCommand } from "./tools.ts";
import { renderCommand, verifyCommand } from "./verify.ts";
import { worktreeCommands } from "./worktree.ts";

/** What a person who types the name and nothing else is told: what to do next, in plain words, from whether there is a workspace (0004-onboarding FR-003). */
const start = defineCommand({
  name: "start",
  summary: "Say what to do next, from whether there is a workspace yet.",
  options: { ...HOME },
  action: reads(),
  run: (ctx) => {
    const home = ctx.home;
    return Promise.resolve(
      ok({
        text: guidanceFor({ home, hasWorkspace: home !== undefined && existsSync(join(home, AREA)) }),
        data: { home: home ?? null },
        findings: [],
        noEvidence: true,
      }),
    );
  },
});

/** An entry of the program's tree: a command, or a branch of commands, each made for a host. Tagged, so that a `switch` over it is exhaustive. */
export type Entry =
  | { readonly kind: "command"; readonly make: Make }
  | { readonly kind: "branch"; readonly name: string; readonly summary: string; readonly children: readonly Make[] };

const command = (make: Make): Entry => ({ kind: "command", make });
const branchOf = (name: string, summary: string, children: readonly Make[]): Entry => ({ kind: "branch", name, summary, children });

/** The tree of the program, in the order the help lists it. */
export const TREE: readonly Entry[] = [
  command(start),
  command(initCommand),
  branchOf("repos", "Keep the list of repositories of the workspace.", [addCommand, removeRepoCommand, deleteRepoCommand, adoptCommand]),
  command(planCommand),
  command(applyCommand),
  command(statusCommand),
  command(doctorCommand),
  command(verifyCommand),
  command(renderCommand),
  branchOf("worktree", "Make, list and prune the worktrees of the managed repositories.", [worktreeCommands.create, worktreeCommands.list, worktreeCommands.prune]),
  branchOf("shell", "Print the shell snippet, or put it in (or take it out of) your start-up file.", [shellCommands.print, shellCommands.install, shellCommands.uninstall]),
  command(pathsCommand),
  command(setupCommand),
  command(toolsCommand),
  command(modulesCommand),
  command(hookCommand),
];

/** The nodes of the tree, made for a host. */
function nodesOf(tree: readonly Entry[], host: Host): readonly Node[] {
  return tree.map((t): Node => {
    switch (t.kind) {
      case "command":
        return t.make(host);
      case "branch":
        return branch({ name: t.name, summary: t.summary, children: t.children.map((c) => c(host)) });
      default:
        return absurd(t);
    }
  });
}

/** The words of the program's own tree, for the modules a command lists and the snippet of a shell: each top-level word with its summary and the words below it. */
export function modulesOf(nodes: readonly Node[]): readonly ErgonexModule[] {
  return nodes.map((n) => ({ name: n.name, summary: n.summary, commands: n.kind === "branch" ? n.children.map((c) => c.name) : [] }));
}

/** What the host needs of the tree before it is made: the modules its commands list are the words of the tree itself. */
export type ProgramHost = Omit<Host, "builtins">;

/** `ergonex` as a Headless program, for the host it runs on. */
export function ergonexProgram(host: ProgramHost): Program {
  const names = nodesOf(TREE, { ...host, builtins: [] });
  const builtins = modulesOf(names);
  const children = nodesOf(TREE, { ...host, builtins });
  return programOf({
    name: "ergonex",
    summary: "The workspaces management of Intellectual Frontiers: it sets up and operates a team's repositories, tools and shell. It manages only Intellectual Frontiers Workspaces; it is not a general IFC or Mizan controller and does not front ifc.",
    version: ERGONEX_VERSION,
    children,
    envPrefix: "ERGONEX",
    stateApp: "ergonex",
    catalogue: CATALOGUE,
    patterns: PATTERNS,
    secrets: () => {
      const token = host.env["ERGONEX_GITHUB_TOKEN"];
      return token === undefined || token === "" ? [] : [token];
    },
    secretKeys: ["ERGONEX_GITHUB_TOKEN"],
    defaultCommand: ["start"],
  });
}
