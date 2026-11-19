// Spec: 0049-sql-assertions FR-004
/**
 * The Test Anything Protocol, version 14, as typed values (commons data 0049-sql-assertions FR-004): the one format the results of assertions are reported in. Results are data first; `tapText` writes them.
 * Ported from SQL Aide, which this library replaces.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";

/** Why a test was not counted as it ran. */
export type Directive = { readonly kind: "skip"; readonly reason: string } | { readonly kind: "todo"; readonly reason: string };

/** A value a diagnostic block may hold. */
export type Diagnostic = string | number | boolean | null | readonly Diagnostic[] | { readonly [key: string]: Diagnostic };

/** One line of a TAP document. */
export type TapNode =
  | {
      readonly kind: "test";
      readonly ok: boolean;
      readonly description: string;
      readonly directive?: Directive;
      readonly diagnostics?: { readonly [key: string]: Diagnostic };
      readonly subtests?: readonly TapNode[];
    }
  | { readonly kind: "comment"; readonly text: string }
  | { readonly kind: "bail"; readonly reason: string };

/** A passing test. */
export const pass = (description: string, subtests?: readonly TapNode[]): TapNode =>
  subtests === undefined ? { kind: "test", ok: true, description } : { kind: "test", ok: true, description, subtests };

/** A failing test, with what was found. */
export const failed = (description: string, diagnostics?: { readonly [key: string]: Diagnostic }): TapNode =>
  diagnostics === undefined ? { kind: "test", ok: false, description } : { kind: "test", ok: false, description, diagnostics };

/** A test that was not run, and why. */
export const skipped = (description: string, reason: string): TapNode => ({
  kind: "test",
  ok: true,
  description,
  directive: { kind: "skip", reason },
});

/** How many tests of a document passed, failed and were skipped: a test with a directive is not a failure. */
export function tally(nodes: readonly TapNode[]): { readonly passed: number; readonly failed: number; readonly skipped: number } {
  let passed = 0,
    bad = 0,
    skip = 0;
  for (const n of nodes) {
    if (n.kind !== "test") continue;
    if (n.directive !== undefined) skip++;
    else if (n.ok) passed++;
    else bad++;
  }
  return { passed, failed: bad, skipped: skip };
}

const escaped = (description: string): string => description.replaceAll("\\", "\\\\").replaceAll("#", "\\#").replaceAll("\n", " ");

function yaml(value: Diagnostic, indent: string): string[] {
  if (value === null || typeof value !== "object") return [JSON.stringify(value)];
  if (Array.isArray(value)) {
    if (value.length === 0) return ["[]"];
    return value.flatMap((v: Diagnostic) => {
      const lines = yaml(v, `${indent}  `);
      return lines.length === 1 ? [`${indent}- ${lines[0] ?? ""}`] : [`${indent}-`, ...lines];
    });
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return ["{}"];
  return entries.flatMap(([k, v]: [string, Diagnostic]) => {
    const lines = yaml(v, `${indent}  `);
    return lines.length === 1 && !(lines[0] ?? "").startsWith(indent + "  ")
      ? [`${indent}${k}: ${lines[0] ?? ""}`]
      : [`${indent}${k}:`, ...lines];
  });
}

function write(nodes: readonly TapNode[], indent: string, out: string[]): void {
  let n = 0;
  for (const node of nodes) {
    switch (node.kind) {
      case "comment":
        out.push(`${indent}# ${node.text.replaceAll("\n", " ")}`);
        break;
      case "bail":
        out.push(`${indent}Bail out! ${node.reason.replaceAll("\n", " ")}`);
        break;
      case "test": {
        n++;
        if (node.subtests !== undefined) {
          out.push(`${indent}# Subtest: ${escaped(node.description)}`);
          write(node.subtests, `${indent}    `, out);
        }
        const directive =
          node.directive === undefined ? "" : ` # ${node.directive.kind.toUpperCase()} ${node.directive.reason.replaceAll("\n", " ")}`;
        out.push(`${indent}${node.ok ? "ok" : "not ok"} ${n} - ${escaped(node.description)}${directive}`);
        if (node.diagnostics !== undefined) out.push(`${indent}  ---`, ...yaml(node.diagnostics, `${indent}  `), `${indent}  ...`);
        break;
      }
      default:
        absurd(node);
    }
  }
  out.push(`${indent}1..${n}`);
}

/**
 * Writes results as a TAP version 14 document.
 *
 * @param nodes - the results, in order
 * @example
 * tapText([pass("party exists"), failed("person has 5 columns", { found: 4 })]);
 */
export function tapText(nodes: readonly TapNode[]): string {
  const out = ["TAP version 14"];
  write(nodes, "", out);
  return `${out.join("\n")}\n`;
}

/**
 * Reads the test lines a database gave back (as the SQL that returns TAP lines does) into results.
 *
 * @param lines - lines such as `ok 1 - party exists` and `not ok 2 - ...`; others are kept as comments
 */
export function fromLines(lines: readonly string[]): readonly TapNode[] {
  return lines.flatMap((line): TapNode[] => {
    const m = /^(not ok|ok)\b(?:\s+\d+)?(?:\s+-\s+|\s+)?(.*?)(?:\s+#\s+(SKIP|TODO)\b\s*(.*))?$/i.exec(line.trim());
    if (m === null)
      return line.trim() === "" || /^1\.\.\d+/.test(line.trim()) || /^TAP version/.test(line.trim())
        ? []
        : [{ kind: "comment", text: line.trim().replace(/^#\s*/, "") }];
    const ok = (m[1] ?? "").toLowerCase() === "ok";
    const description = m[2] ?? "";
    const tag = m[3]?.toLowerCase();
    if (tag === "skip" || tag === "todo") return [{ kind: "test", ok, description, directive: { kind: tag, reason: m[4] ?? "" } }];
    return [{ kind: "test", ok, description }];
  });
}
