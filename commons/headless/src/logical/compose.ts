// Spec: 0009-composition FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * One program tree built from the branches that several packages contribute (commons headless 0009-composition): a host program (the composition root of a fleet or an
 * application) and plugin packages named `<program>-<noun>`, each of which contributes nodes only through the value it exports (`Plugin`, made by `definePlugin`). `compose`
 * gives one `Program`, so that there is one help, one completion script, one man page, one run log and one tier gate for the whole command; where two plugins claim one verb it
 * gives the conflict as a value, never a throw and never a silent winner.
 *
 * @remarks
 * Pure and deterministic: the plugins are placed in the order of their ids, so the tree does not depend on the order in which a program imports its packages. A plugin may
 * place a node at the root only under its own noun (`desired-os-state-server` contributes `server`), and below another branch (`at`) where that branch exists; two contributions of the same branch name merge,
 * and the same verb claimed twice is a `conflict`. A plugin names the plugins it needs, and a missing one is an error. The tier of every command MUST be on the host's ladder: the one gate.
 *
 * @example
 * ```ts
 * import { branch, command, compose, definePlugin } from "./mod.ts";
 * const run = async () => ({}) as never;
 * const list = command({ name: "list", summary: "List.", options: {}, action: { kind: "report" }, run });
 * const plugin = definePlugin({ program: "tool", noun: "server", version: "1.0.0", summary: "Servers.", contributes: [{ node: branch({ name: "server", summary: "Servers.", children: [list] }) }] });
 * plugin.kind; // "ok"
 * ```
 *
 * @module
 */
import { absurd, err, ok, refine, string, type Brand, type Result } from "@intellectual-frontiers/core";
import { tierGate } from "@intellectual-frontiers/headless/governance";
import { modelProblems, placedCommands, type Node, type ModelProblem } from "./model.ts";
import { programOf, type Program, type ProgramConfig } from "./program.ts";

/** The version of the plugin contract, which a plugin states and a host checks. */
export const PLUGIN_CONTRACT = 1;

/** The stable identity of a plugin: the program's name, a hyphen and the noun (`desired-os-state-server`). Made only by `parsePluginId`. */
export type PluginId = Brand<string, "plugin id">;

const WORD = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const idDecoder = refine(string, "plugin id", (t) => WORD.test(t));

/** The id of the plugin of a program for a noun, or why the parts are not one: the one way a `PluginId` is made. */
export function parsePluginId(program: string, noun: string): Result<PluginId, string> {
  if (!WORD.test(program)) return err(`${JSON.stringify(program)} is not a program name: lower-case words joined by hyphens`);
  if (!WORD.test(noun) || noun.includes("-")) return err(`${JSON.stringify(noun)} is not a noun: one lower-case word`);
  const r = idDecoder(`${program}-${noun}`, "id");
  return r.kind === "ok" ? ok(r.value) : err(`${program}-${noun} is not a plugin id`);
}

/** A plugin id from text that already is one (`desired-os-state-server`), for a requirement of another plugin. */
export function parsePluginIdText(text: string): Result<PluginId, string> {
  const r = idDecoder(text, "id");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a plugin id: <program>-<noun>`);
}

/** One thing a plugin contributes: a node, and the path of the branch it is placed in (empty: the root of the program). */
export type Contribution = { readonly at: readonly string[]; readonly node: Node };

/** What a package exports to extend a program: its identity, the contract it was written for, and the nodes it contributes. */
export type Plugin = {
  readonly contract: number;
  readonly id: PluginId;
  /** The program it extends. */
  readonly program: string;
  readonly noun: string;
  readonly version: string;
  readonly summary: string;
  readonly contributes: readonly Contribution[];
  /** The plugins that must be composed with it. */
  readonly requires: readonly PluginId[];
};

/** What `definePlugin` takes. */
export type PluginDefinition = {
  readonly program: string;
  readonly noun: string;
  readonly version: string;
  readonly summary: string;
  readonly contributes: readonly { readonly at?: readonly string[]; readonly node: Node }[];
  readonly requires?: readonly string[];
};

/** What is wrong with a plugin's definition. */
export type PluginProblem =
  | { readonly rule: "plugin/id"; readonly message: string }
  | { readonly rule: "plugin/version"; readonly message: string }
  | { readonly rule: "plugin/summary"; readonly message: string }
  | { readonly rule: "plugin/empty"; readonly message: string }
  | { readonly rule: "plugin/root-claim"; readonly word: string; readonly message: string }
  | { readonly rule: "plugin/requires"; readonly message: string };

/** A plugin from its definition, or everything wrong with it. */
export function definePlugin(d: PluginDefinition): Result<Plugin, readonly PluginProblem[]> {
  const problems: PluginProblem[] = [];
  const id = parsePluginId(d.program, d.noun);
  if (id.kind === "err") problems.push({ rule: "plugin/id", message: id.error });
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(d.version)) problems.push({ rule: "plugin/version", message: `${JSON.stringify(d.version)} is not a version` });
  if (d.summary.trim() === "") problems.push({ rule: "plugin/summary", message: `${d.program}-${d.noun} has no summary` });
  if (d.contributes.length === 0) problems.push({ rule: "plugin/empty", message: `${d.program}-${d.noun} contributes nothing` });
  for (const c of d.contributes) {
    if ((c.at ?? []).length === 0 && c.node.name !== d.noun) {
      problems.push({ rule: "plugin/root-claim", word: c.node.name, message: `${d.program}-${d.noun} claims the word ${c.node.name} at the root: a plugin claims only its noun (${d.noun}) there` });
    }
  }
  const requires: PluginId[] = [];
  for (const r of d.requires ?? []) {
    const p = parsePluginIdText(r);
    if (p.kind === "err") problems.push({ rule: "plugin/requires", message: p.error });
    else if (id.kind === "ok" && p.value === id.value) problems.push({ rule: "plugin/requires", message: `${p.value} requires itself` });
    else requires.push(p.value);
  }
  if (problems.length > 0 || id.kind === "err") return err(problems);
  return ok({
    contract: PLUGIN_CONTRACT,
    id: id.value,
    program: d.program,
    noun: d.noun,
    version: d.version,
    summary: d.summary,
    contributes: d.contributes.map((c) => ({ at: c.at ?? [], node: c.node })),
    requires,
  });
}

/** Who put a node in the tree. */
export type Owner = { readonly kind: "host" } | { readonly kind: "plugin"; readonly id: PluginId };

/** The name of an owner as a sentence and as the run log writes it. */
export function ownerName(o: Owner, program: string): string {
  switch (o.kind) {
    case "host":
      return program;
    case "plugin":
      return o.id;
    default:
      return absurd(o);
  }
}

/** Why two claims on the tree cannot both stand. */
export type ConflictKind = "claimed-twice" | "command-vs-branch" | "missing-parent" | "parent-is-command";

/** A conflict between claims: the path claimed and who claimed it (the first owner, then the one that came after). */
export type Conflict = { readonly kind: ConflictKind; readonly path: readonly string[]; readonly owners: readonly Owner[] };

/** What can stop a composition. */
export type CompositionError =
  | { readonly kind: "duplicate-plugin"; readonly id: PluginId }
  | { readonly kind: "wrong-program"; readonly id: PluginId; readonly expected: string; readonly found: string }
  | { readonly kind: "contract"; readonly id: PluginId; readonly expected: number; readonly found: number }
  | { readonly kind: "missing-requirement"; readonly id: PluginId; readonly requires: PluginId }
  | { readonly kind: "conflict"; readonly conflict: Conflict }
  | { readonly kind: "tier-not-on-ladder"; readonly path: readonly string[]; readonly tier: string }
  | { readonly kind: "model"; readonly problem: ModelProblem };

/** The composed program: the one `Program`, who owns each command, and the plugins that are in it. */
export type Composed = {
  readonly program: Program;
  readonly plugins: readonly PluginId[];
  /** The owner of each command, by the words of its id (`server list`). */
  readonly owners: Readonly<Record<string, Owner>>;
};

type Tree = { readonly nodes: readonly Node[]; readonly owners: Readonly<Record<string, Owner>> };

const key = (path: readonly string[]): string => path.join(" ");

/** The owners of the commands of a tree, all one owner. */
function ownersOf(nodes: readonly Node[], owner: Owner, base: readonly string[]): Readonly<Record<string, Owner>> {
  return Object.fromEntries(placedCommands(nodes, base).map((p) => [key(p.path), owner]));
}

/** Places a node in a tree below `at`, merging a branch with a branch of the same name; a claim that cannot stand is pushed to `conflicts` and the tree is left as it was. */
function place(tree: Tree, at: readonly string[], node: Node, owner: Owner, conflicts: Conflict[], parents: readonly string[] = []): Tree {
  const head = at[0];
  if (head !== undefined) {
    const found = tree.nodes.find((n) => n.name === head);
    const path = [...parents, head];
    if (found === undefined) {
      conflicts.push({ kind: "missing-parent", path, owners: [owner] });
      return tree;
    }
    if (found.kind === "command") {
      conflicts.push({ kind: "parent-is-command", path, owners: [owner] });
      return tree;
    }
    const inner = place({ nodes: found.children, owners: tree.owners }, at.slice(1), node, owner, conflicts, path);
    const rebuilt: Node = { ...found, children: inner.nodes };
    return { nodes: tree.nodes.map((n) => (n === found ? rebuilt : n)), owners: inner.owners };
  }
  const path = [...parents, node.name];
  const existing = tree.nodes.find((n) => n.name === node.name);
  if (existing === undefined) return { nodes: [...tree.nodes, node], owners: { ...tree.owners, ...ownersOf([node], owner, parents) } };
  if (existing.kind === "branch" && node.kind === "branch") {
    let merged: Tree = { nodes: existing.children, owners: tree.owners };
    for (const child of node.children) merged = place(merged, [], child, owner, conflicts, path);
    const rebuilt: Node = { ...existing, children: merged.nodes };
    return { nodes: tree.nodes.map((n) => (n === existing ? rebuilt : n)), owners: merged.owners };
  }
  const first = ownerOfPath(tree, path);
  conflicts.push({ kind: existing.kind === node.kind ? "claimed-twice" : "command-vs-branch", path, owners: [first, owner] });
  return tree;
}

/** The owner of a path of the tree: the owner of the command, or of the first command below a branch. */
function ownerOfPath(tree: Tree, path: readonly string[]): Owner {
  const exact = tree.owners[key(path)];
  if (exact !== undefined) return exact;
  const below = Object.entries(tree.owners).find(([k]) => k.startsWith(`${key(path)} `));
  return below?.[1] ?? { kind: "host" };
}

/** What `compose` gives: the host's children are first, then each plugin's in the order of the plugin ids. */
export function compose(host: ProgramConfig, plugins: readonly Plugin[]): Result<Composed, readonly CompositionError[]> {
  const errors: CompositionError[] = [];
  const ordered = [...plugins].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const seen = new Set<PluginId>();
  const present = new Set<PluginId>(ordered.map((p) => p.id));
  for (const p of ordered) {
    if (seen.has(p.id)) errors.push({ kind: "duplicate-plugin", id: p.id });
    seen.add(p.id);
    if (p.program !== host.name) errors.push({ kind: "wrong-program", id: p.id, expected: host.name, found: p.program });
    if (p.contract !== PLUGIN_CONTRACT) errors.push({ kind: "contract", id: p.id, expected: PLUGIN_CONTRACT, found: p.contract });
    for (const r of p.requires) if (!present.has(r)) errors.push({ kind: "missing-requirement", id: p.id, requires: r });
  }
  const conflicts: Conflict[] = [];
  let tree: Tree = { nodes: host.children, owners: ownersOf(host.children, { kind: "host" }, []) };
  // the shallower claims are placed first, so that a plugin that places a node below the branch of another finds the branch, whatever the order of the ids
  const claims = ordered.flatMap((p) => p.contributes.map((c) => ({ id: p.id, c })));
  const byDepth = [...claims].sort((a, b) => a.c.at.length - b.c.at.length);
  for (const { id, c } of byDepth) tree = place(tree, c.at, c.node, { kind: "plugin", id }, conflicts);
  for (const c of conflicts) errors.push({ kind: "conflict", conflict: c });
  const origins = Object.fromEntries(Object.entries(tree.owners).map(([k, o]) => [k, ownerName(o, host.name)]));
  const program = programOf({ ...host, children: tree.nodes, origins });
  for (const p of placedCommands(program.children)) {
    if (tierGate(program.tiers, p.facts.tier, p.facts.tier).kind === "hidden") errors.push({ kind: "tier-not-on-ladder", path: p.path, tier: p.facts.tier });
  }
  for (const problem of modelProblems(program, { requireReach: true })) errors.push({ kind: "model", problem });
  if (errors.length > 0) return err(errors);
  return ok({ program, plugins: ordered.map((p) => p.id), owners: tree.owners });
}

/** The stable identifiers of the verbs of a program: the words of each command below the program's name, sorted, as `desired-os-state server list`. A plugin's test holds them in a snapshot. */
export function verbIds(program: Program): readonly string[] {
  return placedCommands(program.children)
    .map((p) => `${program.name} ${p.id}`)
    .sort();
}

/** One rule of the conformance suite and whether the plugin passes it. */
export type ConformanceResult = { readonly rule: ConformanceRule; readonly passed: boolean; readonly messages: readonly string[] };

/** The rules of the conformance suite a plugin runs, each a named case. */
export type ConformanceRule =
  | "conformance/definition"
  | "conformance/contract"
  | "conformance/program"
  | "conformance/root-claim"
  | "conformance/composes"
  | "conformance/tiers"
  | "conformance/reach"
  | "conformance/deterministic"
  | "conformance/ids";

/** Every rule, in the order the suite runs them. */
export const CONFORMANCE_RULES: readonly ConformanceRule[] = [
  "conformance/definition",
  "conformance/contract",
  "conformance/program",
  "conformance/root-claim",
  "conformance/composes",
  "conformance/tiers",
  "conformance/reach",
  "conformance/deterministic",
  "conformance/ids",
];

/** What `pluginConformance` gives: a result for every rule, and whether all passed. */
export type ConformanceReport = { readonly plugin: PluginId; readonly results: readonly ConformanceResult[]; readonly passed: boolean };

const sentence = (e: CompositionError): string => {
  switch (e.kind) {
    case "duplicate-plugin":
      return `${e.id} is composed twice`;
    case "wrong-program":
      return `${e.id} extends ${e.found}, not ${e.expected}`;
    case "contract":
      return `${e.id} was written for the plugin contract ${e.found}; this is ${e.expected}`;
    case "missing-requirement":
      return `${e.id} requires ${e.requires}, which is not composed`;
    case "conflict":
      return `${e.conflict.kind} at ${e.conflict.path.join(" ")}`;
    case "tier-not-on-ladder":
      return `${e.path.join(" ")} needs the tier ${e.tier}, which is not on the host's ladder`;
    case "model":
      return `${e.problem.rule}${"id" in e.problem ? ` ${e.problem.id}` : ""}`;
    default:
      return absurd(e);
  }
};

/**
 * The conformance suite of a plugin, pure: the plugin composed alone with a host that declares nothing but its name and ladder must give a tree (the host is given with no children of
 * its own, so that nothing but the plugin is judged), and the result is judged by rule. A plugin's own test runs it and asserts `passed`, which is what a host relies on before it composes the plugin with others.
 */
export function pluginConformance(plugin: Plugin, host: Omit<ProgramConfig, "children">): ConformanceReport {
  const alone = compose({ ...host, children: [] }, [plugin, ...requiredStubs(plugin)]);
  const errors = alone.kind === "err" ? alone.error : [];
  const only = (pick: (e: CompositionError) => boolean): readonly string[] => errors.filter(pick).map(sentence);
  const redefined = definePlugin({
    program: plugin.program,
    noun: plugin.noun,
    version: plugin.version,
    summary: plugin.summary,
    contributes: plugin.contributes,
    requires: plugin.requires,
  });
  const again = compose({ ...host, children: [] }, [plugin, ...requiredStubs(plugin)]);
  const ids = alone.kind === "ok" ? verbIds(alone.value.program) : [];
  const results: readonly ConformanceResult[] = [
    { rule: "conformance/definition", passed: redefined.kind === "ok" && redefined.value.id === plugin.id, messages: redefined.kind === "err" ? redefined.error.map((p) => p.message) : [] },
    { rule: "conformance/contract", passed: plugin.contract === PLUGIN_CONTRACT, messages: only((e) => e.kind === "contract") },
    { rule: "conformance/program", passed: plugin.program === host.name, messages: only((e) => e.kind === "wrong-program") },
    {
      rule: "conformance/root-claim",
      passed: plugin.contributes.every((c) => c.at.length > 0 || c.node.name === plugin.noun),
      messages: plugin.contributes.filter((c) => c.at.length === 0 && c.node.name !== plugin.noun).map((c) => `${c.node.name} is claimed at the root; only ${plugin.noun} may be`),
    },
    { rule: "conformance/composes", passed: errors.every((e) => e.kind !== "conflict" && e.kind !== "duplicate-plugin"), messages: only((e) => e.kind === "conflict" || e.kind === "duplicate-plugin") },
    { rule: "conformance/tiers", passed: errors.every((e) => e.kind !== "tier-not-on-ladder"), messages: only((e) => e.kind === "tier-not-on-ladder") },
    { rule: "conformance/reach", passed: errors.every((e) => e.kind !== "model"), messages: only((e) => e.kind === "model") },
    { rule: "conformance/deterministic", passed: JSON.stringify(errors.map(sentence)) === JSON.stringify((again.kind === "err" ? again.error : []).map(sentence)) && JSON.stringify(ids) === JSON.stringify(again.kind === "ok" ? verbIds(again.value.program) : []), messages: [] },
    { rule: "conformance/ids", passed: alone.kind === "ok" && ids.length > 0 && new Set(ids).size === ids.length, messages: alone.kind === "ok" ? [] : ["the plugin does not compose, so it has no verb ids"] },
  ];
  return { plugin: plugin.id, results, passed: results.every((r) => r.passed) };
}

/** Stand-ins for the plugins a plugin requires, so that a plugin is judged alone: each contributes nothing and satisfies the requirement. */
function requiredStubs(plugin: Plugin): readonly Plugin[] {
  return plugin.requires.map((id) => ({ contract: PLUGIN_CONTRACT, id, program: plugin.program, noun: id.slice(plugin.program.length + 1), version: "0.0.0", summary: "stand-in", contributes: [], requires: [] }));
}
