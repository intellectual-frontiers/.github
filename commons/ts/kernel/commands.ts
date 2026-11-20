/**
 * A command tree declared once as data (commons 0005-typescript-runtime FR-072): a command of groups and verbs to any depth, each with a
 * name and a summary, and each verb with its options (`./args.ts`'s declaration) and its arguments. From that declaration alone it
 * resolves an argument vector to the verb it names, to the help asked for, or to a typed error that names the word not known, where, the
 * words known there and the nearest of them; and it renders the help of every level, so that help never runs a verb.
 *
 * @remarks
 * A group named with no verb asks for its help, as `git remote` with no verb would list; `--help` or `-h` anywhere before `--` asks for
 * the help of the deepest group or verb named before it. Unknown options of a verb are its own parser's business (`parseArgs`), which the
 * verb runs on the arguments left to it.
 *
 * @example
 * ```ts
 * import { group, resolveCommand, verb } from "./commands.ts";
 * const tree = group({ name: "tool", summary: "A tool.", children: [group({ name: "work", summary: "Works.", children: [
 *   verb({ name: "build", summary: "Build.", options: {} }),
 * ] })] });
 * resolveCommand(tree, ["work", "build", "a"]); // ok: the verb build, with ["a"] left
 * resolveCommand(tree, ["wrk"]); // err: wrk is not known at the top, did you mean work?
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { helpOf, type Operand, type Spec, type SpecCheck, suggest } from "./args.ts";

/** An example of a verb: the words after the verb, and what it does. */
export type Example = { readonly args: readonly string[]; readonly says: string };

/** A verb: a leaf of the tree, with the options and arguments it takes. */
export type Verb<S extends Spec = Spec> = {
  readonly kind: "verb";
  readonly name: string;
  readonly summary: string;
  readonly options: S;
  readonly operands: readonly Operand[];
  readonly examples: readonly Example[];
};

/** A group: a word that names more words, groups or verbs. */
export type Group = {
  readonly kind: "group";
  readonly name: string;
  readonly summary: string;
  readonly children: readonly CommandNode[];
};

/** One node of a command tree. */
export type CommandNode = Group | Verb;

/** A verb, declared with its options checked as `parseArgs` checks them. */
export function verb<S extends Spec>(v: {
  readonly name: string;
  readonly summary: string;
  readonly options: S & SpecCheck<S>;
  readonly operands?: readonly Operand[];
  readonly examples?: readonly Example[];
}): Verb<S> {
  return { kind: "verb", name: v.name, summary: v.summary, options: v.options, operands: v.operands ?? [], examples: v.examples ?? [] };
}

/** A group of nodes. */
export function group(g: { readonly name: string; readonly summary: string; readonly children: readonly CommandNode[] }): Group {
  return { kind: "group", name: g.name, summary: g.summary, children: g.children };
}

/** Whether a name is one a command may have: lower case letters, digits and dashes, beginning with a letter. */
export function validCommandName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name);
}

/** What is wrong with a declared tree: a name that may not be one, or two children of a group with the same name. */
export type TreeProblem =
  | { readonly kind: "bad-name"; readonly path: readonly string[]; readonly name: string }
  | { readonly kind: "duplicate"; readonly path: readonly string[]; readonly name: string };

/** Every problem of a tree, in the order of its nodes; none where it is well formed. */
export function treeProblems(root: CommandNode, path: readonly string[] = []): readonly TreeProblem[] {
  const here = [...path, root.name];
  const own: TreeProblem[] = validCommandName(root.name) ? [] : [{ kind: "bad-name", path, name: root.name }];
  switch (root.kind) {
    case "verb":
      return own;
    case "group": {
      const seen = new Set<string>();
      const dups: TreeProblem[] = [];
      for (const c of root.children) {
        if (seen.has(c.name)) dups.push({ kind: "duplicate", path: here, name: c.name });
        seen.add(c.name);
      }
      return [...own, ...dups, ...root.children.flatMap((c) => treeProblems(c, here))];
    }
    default:
      return absurd(root);
  }
}

/** What an argument vector names: a verb with the arguments left for it, or the help of a node. */
export type Resolved =
  | { readonly kind: "verb"; readonly path: readonly string[]; readonly verb: Verb; readonly args: readonly string[] }
  | { readonly kind: "help"; readonly path: readonly string[]; readonly node: CommandNode };

/** Why an argument vector names nothing: a word not known below `path`, the words known there, and the nearest. */
export type CommandError = {
  readonly kind: "unknown-command";
  readonly path: readonly string[];
  readonly word: string;
  readonly known: readonly string[];
  readonly suggestion: string | undefined;
};

/** Whether a word asks for help. */
export function asksForHelp(word: string): boolean {
  return word === "--help" || word === "-h";
}

/** Resolves an argument vector (the words after the program's name) against a tree whose root is the program. */
export function resolveCommand(root: Group, argv: readonly string[]): Result<Resolved, CommandError> {
  let node: CommandNode = root;
  const path: string[] = [root.name];
  let i = 0;
  while (node.kind === "group") {
    const word = argv[i];
    if (word === undefined || asksForHelp(word)) return ok({ kind: "help", path, node });
    const known: readonly string[] = node.children.map((c) => c.name);
    const next: CommandNode | undefined = node.children.find((c) => c.name === word);
    if (next === undefined) {
      const candidates = word.startsWith("-") ? ["--help"] : known;
      return err({ kind: "unknown-command", path: [...path], word, known, suggestion: suggest(word, candidates) });
    }
    node = next;
    path.push(next.name);
    i += 1;
  }
  const args = argv.slice(i);
  const end = args.indexOf("--");
  const before = end < 0 ? args : args.slice(0, end);
  if (before.some(asksForHelp)) return ok({ kind: "help", path, node });
  return ok({ kind: "verb", path, verb: node, args });
}

/** A command error as one sentence, with the help to run next. */
export function formatCommandError(e: CommandError): string {
  const at = e.path.join(" ");
  const what = e.word.startsWith("-") ? "an option" : "a command";
  const near = e.suggestion === undefined ? "" : `; did you mean ${e.suggestion}?`;
  return `${e.word} is not ${what} of ${at}${near} Run ${at} --help to see what it takes.`;
}

/** Lines of two columns, the second aligned two spaces after the widest first. */
function columns(rows: readonly (readonly [string, string])[]): readonly string[] {
  const width = Math.max(0, ...rows.map(([l]) => l.length));
  return rows.map(([l, r]) => `  ${l.padEnd(width)}  ${r}`.trimEnd());
}

/** The help of a node at `path` (the words that name it, the program's first), from its declaration alone. */
export function commandHelp(path: readonly string[], node: CommandNode): string {
  const at = path.join(" ");
  switch (node.kind) {
    case "group": {
      const rows = node.children.map((c): readonly [string, string] => [c.name, c.summary]);
      return [
        `${at}: ${node.summary}`,
        "",
        `Usage: ${at} COMMAND [OPTIONS] [ARGUMENTS]`,
        "",
        "Commands:",
        ...columns(rows),
        "",
        `Run ${at} COMMAND --help for a command's help.`,
      ].join("\n");
    }
    case "verb": {
      const body = helpOf(at, node.summary, node.options, node.operands);
      const examples = node.examples.map((x): readonly [string, string] => [[at, ...x.args].join(" "), x.says]);
      return examples.length === 0 ? body : [body, "", "Examples:", ...columns(examples)].join("\n");
    }
    default:
      return absurd(node);
  }
}
