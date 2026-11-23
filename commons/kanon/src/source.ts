// Spec: 0001-kanon-checker FR-003, FR-007
/**
 * Reads module references and exported manifest constants from a TypeScript syntax tree.
 * The parser reads source without evaluating it. Layer rules depend on the typed references.
 *
 * @module
 */
import { parse } from "@babel/parser";
import { traverseFast, type File, type Node } from "@babel/types";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Literal, parseTsLiteral } from "@intellectual-frontiers/formats/ts-literal";

/** A literal module target and its one-based source line. */
export type Specifier = { readonly line: number; readonly specifier: string };
/** A syntactic module reference with a literal or computed target. */
export type ModuleReference =
  (Specifier & { readonly kind: "static" | "side-effect" | "re-export" | "type" | "dynamic" }) | { readonly kind: "computed-dynamic"; readonly line: number };
/** The first syntax error returned by the source parser. */
export type SourceDiagnostic = { readonly line: number; readonly message: string };

function parseSource(text: string): Result<File, SourceDiagnostic> {
  try {
    return ok(parse(text, { sourceType: "unambiguous", plugins: ["typescript"], attachComment: false }));
  } catch (error) {
    const loc = error instanceof SyntaxError && "loc" in error ? error.loc : undefined;
    const line = typeof loc === "object" && loc !== null && "line" in loc && typeof loc.line === "number" ? loc.line : 1;
    return err({ line, message: error instanceof Error ? error.message : String(error) });
  }
}

/** A literal reference with the offsets of the contents between its delimiters. */
export type ModuleReferenceSpan = Extract<ModuleReference, Specifier> & { readonly start: number; readonly end: number };

type ParsedReference = ModuleReferenceSpan | Extract<ModuleReference, { kind: "computed-dynamic" }>;

function literalReference(kind: ModuleReferenceSpan["kind"], node: Node, specifier: string): ModuleReferenceSpan | undefined {
  if (typeof node.start !== "number" || typeof node.end !== "number") return undefined;
  return { kind, line: node.loc?.start.line ?? 1, specifier, start: node.start + 1, end: node.end - 1 };
}

function referenceOf(node: Node): ParsedReference | undefined {
  switch (node.type) {
    case "ImportDeclaration": {
      const kind =
        node.importKind === "type" || (node.specifiers.length > 0 && node.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type"))
          ? "type"
          : node.specifiers.length === 0
            ? "side-effect"
            : "static";
      return literalReference(kind, node.source, node.source.value);
    }
    case "ExportNamedDeclaration":
    case "ExportAllDeclaration":
      if (node.source === undefined || node.source === null) return undefined;
      return literalReference(node.exportKind === "type" ? "type" : "re-export", node.source, node.source.value);
    case "TSImportType":
      return literalReference("type", node.source, node.source.value);
    case "TSImportEqualsDeclaration": {
      if (node.moduleReference.type !== "TSExternalModuleReference") return undefined;
      const source = node.moduleReference.expression;
      return literalReference(node.importKind === "type" ? "type" : "static", source, source.value);
    }
    case "ImportExpression": {
      const source = node.source;
      const line = source.loc?.start.line ?? node.loc?.start.line ?? 1;
      if (source.type === "StringLiteral") return literalReference("dynamic", source, source.value);
      if (source.type === "TemplateLiteral" && source.expressions.length === 0) {
        const cooked = source.quasis[0]?.value.cooked;
        if (typeof cooked === "string") return literalReference("dynamic", source, cooked);
      }
      return { kind: "computed-dynamic", line };
    }
    default:
      return undefined;
  }
}

/** The module references in source order, or the first parser diagnostic. */
export function readModuleReferences(text: string): Result<readonly ModuleReference[], SourceDiagnostic> {
  const parsed = readModuleReferencesWithSpans(text);
  if (parsed.kind === "err") return parsed;
  return ok(parsed.value.map((r) => r.kind === "computed-dynamic" ? r : { kind: r.kind, line: r.line, specifier: r.specifier }));
}

/** The module references and their literal spans in source order, or the first parser diagnostic. */
export function readModuleReferencesWithSpans(text: string): Result<readonly ParsedReference[], SourceDiagnostic> {
  const parsed = parseSource(text);
  if (parsed.kind === "err") return parsed;
  const references: ParsedReference[] = [];
  traverseFast(parsed.value, (node) => {
    const reference = referenceOf(node);
    if (reference !== undefined) references.push(reference);
  });
  return ok(references);
}

/** Read a manifest's top-level exported constant using the restricted TypeScript literal decoder. */
export function readManifestLiteral(text: string, name: string): Result<Literal, string> {
  const parsed = parseSource(text);
  if (parsed.kind === "err") return err(parsed.error.message);
  for (const statement of parsed.value.program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration" || statement.declaration.kind !== "const")
      continue;
    for (const declaration of statement.declaration.declarations) {
      if (declaration.id.type !== "Identifier" || declaration.id.name !== name) continue;
      let init = declaration.init;
      while (init?.type === "TSAsExpression" || init?.type === "TSSatisfiesExpression") init = init.expression;
      if (typeof init?.start !== "number" || typeof init.end !== "number") return err(`expected a literal initializer for ${name}`);
      const literal = parseTsLiteral(text, init.start);
      if (literal.kind === "err") return err(literal.error.expected);
      return literal.value.end === init.end ? ok(literal.value.value) : err(`expected a literal initializer for ${name}`);
    }
  }
  return err(`expected export const ${name}`);
}
