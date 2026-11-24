// Spec: 0003-anyfs-serve-logical FR-008
/**
 * The `If` header: lists of conditions, each a lock token or an entity tag that may be negated, optionally for a named resource. A list holds when all of its conditions do, the header holds for a resource when
 * any list that names it, or names none, holds. The tokens a header submits are the ones a lock check needs. The reader takes the grammar of RFC 4918 and nothing else; text it cannot read is refused whole.
 *
 * @example
 * ```ts
 * import { parseIf, submittedTokens } from "./ifheader.ts";
 * const h = parseIf('(<opaquelocktoken:abc> ["etag"])');
 * submittedTokens(h.kind === "ok" ? h.value : []); // Set { "opaquelocktoken:abc" }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** One condition: a lock token or an entity tag, possibly negated. */
export type Condition = { readonly not: boolean; readonly kind: "token" | "etag"; readonly value: string };
/** One list of conditions, for a resource it names or for the one the request is about. */
export type IfList = { readonly resource?: string; readonly conditions: readonly Condition[] };

/** The lists of an `If` header, or why it is not read. */
export function parseIf(header: string): Result<readonly IfList[], string> {
  const lists: IfList[] = [];
  let i = 0;
  let resource: string | undefined;
  const skip = (): void => {
    while (i < header.length && /\s/u.test(header.charAt(i))) i++;
  };
  for (;;) {
    skip();
    if (i >= header.length) break;
    const c = header.charAt(i);
    if (c === "<") {
      const end = header.indexOf(">", i);
      if (end < 0) return err("a resource tag is not closed");
      resource = header.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (c !== "(") return err(`an If header holds lists in parentheses, not ${JSON.stringify(c)}`);
    i++;
    const conditions: Condition[] = [];
    for (;;) {
      skip();
      if (i >= header.length) return err("a list is not closed");
      let not = false;
      if (header.startsWith("Not", i) && /\s|<|\[/u.test(header.charAt(i + 3))) {
        not = true;
        i += 3;
        skip();
      }
      const d = header.charAt(i);
      if (d === ")") {
        i++;
        break;
      }
      if (d === "<") {
        const end = header.indexOf(">", i);
        if (end < 0) return err("a token is not closed");
        conditions.push({ not, kind: "token", value: header.slice(i + 1, end) });
        i = end + 1;
      } else if (d === "[") {
        const end = header.indexOf("]", i);
        if (end < 0) return err("an entity tag is not closed");
        conditions.push({ not, kind: "etag", value: header.slice(i + 1, end).replace(/^W\//u, "") });
        i = end + 1;
      } else return err(`a condition is a token or an entity tag, not ${JSON.stringify(d)}`);
    }
    if (conditions.length === 0) return err("a list holds at least one condition");
    lists.push(resource === undefined ? { conditions } : { resource, conditions });
  }
  if (lists.length === 0) return err("an If header holds at least one list");
  return ok(lists);
}

/** The lock tokens a header submits: those that are not negated. */
export function submittedTokens(lists: readonly IfList[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const l of lists) for (const c of l.conditions) if (c.kind === "token" && !c.not) out.add(c.value);
  return out;
}

/** What the server knows of the resource a header is evaluated for. */
export type IfFacts = { readonly etag: string | undefined; readonly tokens: ReadonlySet<string>; readonly names: (resource: string) => boolean };

/** Whether the header holds for the resource: any list that applies to it holds, and a header with no list that applies does not constrain it. */
export function ifHolds(lists: readonly IfList[], facts: IfFacts): boolean {
  const applicable = lists.filter((l) => l.resource === undefined || facts.names(l.resource));
  if (applicable.length === 0) return true;
  return applicable.some((l) =>
    l.conditions.every((c) => {
      const holds = c.kind === "token" ? facts.tokens.has(c.value) : facts.etag !== undefined && facts.etag === c.value.replace(/^"|"$/gu, "");
      return c.not ? !holds : holds;
    }),
  );
}
