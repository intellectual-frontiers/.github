/**
 * The typed way to define a lint rule in the ESLint plugin format that `bun lint --plugin` loads (commons 0005-typescript-runtime
 * FR-061): the few ESTree nodes the rules of `./rules/` read (as typescript-estree gives them to a plugin, written here, without
 * `@types/eslint`), a rule's context, its visitor, `defineRule`, which decodes a rule's options once with the kernel's decoders and
 * reports options that do not decode instead of running, and what the rules share: a list of files, each with its reason, by glob
 * (`allowList`), the file being linted relative to the working folder (`fileOf`), and the names a node gives (`nameOf`, `stringOf`).
 *
 * A rule takes one options object, the second element of its setting: `"ifc/no-vendor-api" = ["error", { allow = [...] }]` in
 * `bunfig.toml`'s `[lint.rules]`, or `--rule '{"ifc/no-vendor-api": ["error", {...}]}'`. Rules never get types: a JavaScript rule of
 * `bun lint` has no `parserServices.program`.
 *
 * @example
 * ```ts
 * import { boolean } from "../kernel/decode.ts";
 * import { defineRule } from "./rule.ts";
 * export const noDebugger = defineRule({ description: "no debugger statement", options: { strict: boolean } }, (context, options) => ({
 *   DebuggerStatement: (node) => context.report({ node, message: options.strict === true ? "remove it" : "remove it, please" }),
 * }));
 * ```
 *
 * @module
 */
import { relative } from "node:path";
import { array, type Decoded, type Decoder, type DecodeError, type Fields, formatDecodeError, object, string } from "../kernel/decode.ts";
import { formatGlobError, globToRegExp } from "../kernel/glob.ts";
import { err, ok } from "../kernel/result.ts";

// ---------------------------------------------------------------------------------------------------------------------------- ESTree

/** Any node: its type, its offsets in the source (`range`), and its parent where the linter links them. */
export type Node = { readonly type: string; readonly range?: readonly [number, number]; readonly parent?: Node };

/** A name: `Deno`, `kind`. */
export type Identifier = Node & { readonly type: "Identifier"; readonly name: string };

/** A literal: a string, a number, a boolean, `null` or a regular expression. */
export type Literal = Node & { readonly type: "Literal"; readonly value: unknown };

/** `a.b` or `a[b]`. */
export type MemberExpression = Node & {
  readonly type: "MemberExpression";
  readonly object: Node;
  readonly property: Node;
  readonly computed: boolean;
};

/** `f(x)`. */
export type CallExpression = Node & { readonly type: "CallExpression"; readonly callee: Node; readonly arguments: readonly Node[] };

/** `import ... from "x"`. */
export type ImportDeclaration = Node & {
  readonly type: "ImportDeclaration";
  readonly source: Literal;
  readonly specifiers: readonly Node[];
};

/** `export * from "x"`. */
export type ExportAllDeclaration = Node & { readonly type: "ExportAllDeclaration"; readonly source: Literal };

/** `export { a } from "x"`, or `export { a }` (no source). */
export type ExportNamedDeclaration = Node & { readonly type: "ExportNamedDeclaration"; readonly source: Literal | null };

/** `import("x")`. */
export type ImportExpression = Node & { readonly type: "ImportExpression"; readonly source: Node };

/** `typeof import("x")` in a type. */
export type TSImportType = Node & { readonly type: "TSImportType"; readonly source?: Node; readonly argument?: Node };

/** `import x = require("x")`'s reference. */
export type TSExternalModuleReference = Node & { readonly type: "TSExternalModuleReference"; readonly expression: Node };

/** `A.B` in a type. */
export type TSQualifiedName = Node & { readonly type: "TSQualifiedName"; readonly left: Node; readonly right: Node };

/** One `case` (or `default`, whose `test` is null) of a switch. */
export type SwitchCase = Node & { readonly type: "SwitchCase"; readonly test: Node | null; readonly consequent: readonly Node[] };

/** `switch (d) { ... }`. */
export type SwitchStatement = Node & {
  readonly type: "SwitchStatement";
  readonly discriminant: Node;
  readonly cases: readonly SwitchCase[];
};

/** The whole file. */
export type Program = Node & { readonly type: "Program"; readonly body: readonly Node[] };

/** `debugger;`. */
export type DebuggerStatement = Node & { readonly type: "DebuggerStatement" };

/** The nodes a visitor may name, by type. */
export type Nodes = {
  readonly Program: Program;
  readonly Identifier: Identifier;
  readonly MemberExpression: MemberExpression;
  readonly CallExpression: CallExpression;
  readonly ImportDeclaration: ImportDeclaration;
  readonly ExportAllDeclaration: ExportAllDeclaration;
  readonly ExportNamedDeclaration: ExportNamedDeclaration;
  readonly ImportExpression: ImportExpression;
  readonly TSImportType: TSImportType;
  readonly TSExternalModuleReference: TSExternalModuleReference;
  readonly TSQualifiedName: TSQualifiedName;
  readonly SwitchStatement: SwitchStatement;
  readonly DebuggerStatement: DebuggerStatement;
};

/** What a rule does on each node of a type, as the linter walks the file. */
export type Visitor = { readonly [K in keyof Nodes]?: (node: Nodes[K]) => void };

/** A comment: `Line` (`//`), `Block` (between `/*` and its end; its `value` starts with `*` for a JSDoc block) or the file's `Shebang`. */
export type Comment = { readonly type: "Line" | "Block" | "Shebang"; readonly value: string; readonly range: readonly [number, number] };

/** A place in the source: the line from 1 and the column from 0. */
export type Position = { readonly line: number; readonly column: number };

/** A problem a rule reports: at a node, or at a place. */
export type Report = { readonly node: Node; readonly message: string } | { readonly loc: Position; readonly message: string };

/** What a rule is given for each file, as ESLint gives it. */
export type RuleContext = {
  /** The rule's id with its plugin's prefix: `ifc/no-vendor-api`. */
  readonly id: string;
  /** The file's absolute path. */
  readonly filename: string;
  /** The linter's working folder. */
  readonly cwd: string;
  /** The rule's options: what follows the severity in its setting. */
  readonly options: readonly unknown[];
  readonly sourceCode: { readonly text: string; readonly getAllComments: () => readonly Comment[] };
  readonly report: (report: Report) => void;
};

/** A rule in ESLint's format. */
export type Rule = {
  readonly meta: {
    readonly type: "problem" | "suggestion";
    readonly docs: { readonly description: string };
    /** `false`: the options are decoded by the rule itself (`defineRule`), not by a JSON schema. */
    readonly schema: false;
  };
  readonly create: (context: RuleContext) => Visitor;
};

/** A plugin in ESLint's format: its name, which is the prefix of its rules' ids, and its rules. */
export type Plugin = {
  readonly meta: { readonly name: string; readonly version?: string };
  readonly rules: Readonly<Record<string, Rule>>;
};

// ---------------------------------------------------------------------------------------------------------------------------- defining a rule

/** A rule's options as decoded: each of the decoders' fields, absent where it was not given. */
export type OptionsOf<O extends Fields> = { readonly [K in keyof O]?: Decoded<O[K]> };

/**
 * A rule in ESLint's format from its description and the decoders of its optional options, and what it does with the options decoded
 * (FR-061). The options are the first after the severity, an object (absent is `{}`); options that do not decode are reported once, at
 * the top of each file, and the rule does nothing else.
 */
export function defineRule<const O extends Fields>(
  spec: { readonly description: string; readonly type?: "problem" | "suggestion"; readonly options: O },
  create: (context: RuleContext, options: OptionsOf<O>) => Visitor,
): Rule {
  const decode = object({}, spec.options);
  return {
    meta: { type: spec.type ?? "problem", docs: { description: spec.description }, schema: false },
    create: (context: RuleContext): Visitor => {
      const given: unknown = context.options[0] ?? {};
      const options = decode(given);
      if (options.kind === "err") {
        const message = `${context.id}: its options are not right: ${formatDecodeError(options.error)}`;
        return { Program: () => context.report({ loc: { line: 1, column: 0 }, message }) };
      }
      return create(context, options.value);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- what rules share

/** A file, or files by glob, allowed what a rule refuses elsewhere, with the reason. */
export type Allowed = { readonly files: string; readonly reason: string; readonly pattern: RegExp };

const allowedEntry = object({ files: string, reason: string });

/** One allowed entry: `{ files, reason }`, the glob read as `kernel/glob.ts` reads one, the reason not empty. */
export const allowed: Decoder<Allowed> = (input, path = "$") => {
  const e = allowedEntry(input, path);
  if (e.kind === "err") return e;
  const fail = (expected: string): ReturnType<Decoder<Allowed>> =>
    err<DecodeError>({ kind: "decode", path, expected, found: JSON.stringify(input) });
  if (e.value.reason.trim() === "") return fail("an entry with its reason (`reason` is empty)");
  const pattern = globToRegExp(e.value.files);
  if (pattern.kind === "err") return fail(`an entry whose files are a glob: ${formatGlobError(pattern.error)}`);
  return ok({ files: e.value.files, reason: e.value.reason, pattern: pattern.value });
};

/** A list of files, each with its reason, as a rule's option `allow` (FR-061). */
export const allowList: Decoder<readonly Allowed[]> = array(allowed);

/** The file being linted, relative to the linter's working folder, with `/`. */
export function fileOf(context: RuleContext): string {
  return relative(context.cwd, context.filename).replaceAll("\\", "/");
}

/** The entry of the list that allows the file, if any. */
export function allowedFor(list: readonly Allowed[] | undefined, file: string): Allowed | undefined {
  return list?.find((a) => a.pattern.test(file));
}

/** Whether the node is the identifier, or any identifier where no name is given. */
export function isIdentifier(node: Node | null | undefined, name?: string): node is Identifier {
  return (
    node !== null &&
    node !== undefined &&
    node.type === "Identifier" &&
    "name" in node &&
    typeof node.name === "string" &&
    (name === undefined || node.name === name)
  );
}

/** The string a node holds: a string literal, a template with no expression, or a type's string literal (`TSLiteralType`). */
export function stringOf(node: Node | null | undefined): string | undefined {
  if (node === null || node === undefined) return undefined;
  if (node.type === "Literal" && "value" in node) return typeof node.value === "string" ? node.value : undefined;
  if (node.type === "TSLiteralType" && "literal" in node && isNode(node.literal)) return stringOf(node.literal);
  if (node.type === "TemplateLiteral" && "quasis" in node && "expressions" in node && Array.isArray(node.expressions)) {
    const quasis: unknown = node.quasis;
    if (node.expressions.length !== 0 || !Array.isArray(quasis)) return undefined;
    const first: unknown = quasis[0];
    if (typeof first !== "object" || first === null || !("value" in first)) return undefined;
    const value: unknown = first.value;
    return typeof value === "object" && value !== null && "cooked" in value && typeof value.cooked === "string" ? value.cooked : undefined;
  }
  return undefined;
}

/** Whether a value is a node. */
export function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}

/**
 * The name a member expression's object and property give, `globalThis.` taken off the object: `Deno.readTextFile` is `["Deno",
 * "readTextFile"]`, `globalThis.console.log` is `["console", "log"]`, `a["b"]` is `["a", "b"]`; undefined where either is not a name.
 */
export function nameOf(node: MemberExpression): readonly [string, string] | undefined {
  const object = isIdentifier(node.object)
    ? node.object.name
    : isMember(node.object) && isIdentifier(node.object.object, "globalThis")
      ? propertyOf(node.object)
      : undefined;
  const property = propertyOf(node);
  return object === undefined || property === undefined ? undefined : [object, property];
}

/** The property a member expression names: `b` of `a.b` and of `a["b"]`. */
export function propertyOf(node: MemberExpression): string | undefined {
  return node.computed ? stringOf(node.property) : isIdentifier(node.property) ? node.property.name : undefined;
}

/** Whether a node is a member expression. */
export function isMember(node: Node | null | undefined): node is MemberExpression {
  return (
    node !== null && node !== undefined && node.type === "MemberExpression" && "object" in node && isNode(node.object) && "property" in node
  );
}
