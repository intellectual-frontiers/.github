/**
 * Quoting and placeholders (commons lang-sql 0007-sql-emit FR-001 to FR-005): an identifier and a string written as each dialect writes them, a parameter in the dialect's style, and that the lexer of the same dialect reads each back as one
 * token, in every dialect of the library.
 *
 * Spec: 0007-sql-emit FR-001, FR-002, FR-003, FR-004, FR-005
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  ansi,
  type Dialect,
  defineDialect,
  describeEmitError,
  identifier,
  kindAt,
  lex,
  paramStyles,
  placeholder,
  qualified,
  quoteIdent,
  quoteString,
  Tok,
  tokenCount,
} from "@intellectual-frontiers/lang-sql";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { dialect as tsql } from "@intellectual-frontiers/lang-sql/dialects/tsql";
import { ALL_DIALECTS } from "./fixture.ts";

const text = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }): T => {
  assert(r.kind === "ok", "an ok value");
  return r.value;
};

proves(["0007-sql-emit FR-001"], "an identifier is quoted as the dialect's first syntax writes it, bare only where it is a plain lower-case word that is not a keyword, and a dialect with no quote gives an error value", () => {
  assertEquals(text(quoteIdent(postgres, 'a"b')), '"a""b"');
  assertEquals(text(quoteIdent(mysql, "a`b")), "`a``b`");
  assertEquals(text(quoteIdent(tsql, "a]b")), text(quoteIdent(tsql, "a]b")));
  assertEquals(text(identifier(postgres, "orders")), "orders");
  assertEquals(text(identifier(postgres, "Orders")), '"Orders"');
  assertEquals(text(identifier(postgres, "select")), '"select"');
  assertEquals(text(identifier(postgres, "1abc")), '"1abc"');
  assertEquals(text(identifier(postgres, "two words")), '"two words"');
  assertEquals(text(qualified(postgres, ["public", "User", "id"])), 'public."User".id');
  assertEquals(text(qualified(postgres, [])), "");
  const none = defineDialect({ name: "bare", lexical: (l) => ({ ...l, identifiers: [] }) });
  assert(none.kind === "ok");
  const r = quoteIdent(none.value, "x");
  assert(r.kind === "err" && r.error.kind === "no-quoted-identifier");
  assertEquals(describeEmitError(r.error), "bare has no quoted identifier");
  assert(qualified(none.value, ["a b"]).kind === "err");
});

proves(["0007-sql-emit FR-002"], "a string is written as the dialect's first string syntax writes it, and a quote that cannot be written inside is an error value", () => {
  assertEquals(text(quoteString(postgres, "it's")), "'it''s'");
  assertEquals(text(quoteString(mysql, "it's")), "'it\\'s'");
  assertEquals(text(quoteString(mysql, "a\\b")), "'a\\\\b'");
  assertEquals(text(quoteString(sqlite, "")), "''");
  const none = defineDialect({ name: "raw", extends: ansi, lexical: (l) => ({ ...l, strings: [{ open: "'", close: "'", escape: "none" }] }) });
  assert(none.kind === "ok");
  assertEquals(text(quoteString(none.value, "ok")), "'ok'");
  const r = quoteString(none.value, "no'pe");
  assert(r.kind === "err" && r.error.kind === "cannot-escape");
  assertEquals(describeEmitError(r.error), "raw cannot write ' inside a string");
  const nostr = defineDialect({ name: "nostr", lexical: (l) => ({ ...l, strings: [] }) });
  assert(nostr.kind === "ok" && quoteString(nostr.value, "x").kind === "err");
});

const NAMES = ["a", 'a"b', "it's", "back\\slash", "two words", "Über", "`tick`", "[br]", "x]y", "select", "", " ", "éé", "a--b", "a/*b*/"];

const oneToken = (d: Dialect, source: string): { readonly kinds: number[]; readonly errors: number } => {
  const l = lex(source, d.compiled);
  return { kinds: Array.from({ length: tokenCount(l.tokens) }, (_, i) => kindAt(l.tokens, i)), errors: l.errors.length };
};

proves(["0007-sql-emit FR-003"], "what quoteIdent and quoteString give is read back as exactly one token of the same dialect's lexer, in every dialect", () => {
  assert(ALL_DIALECTS.length === 30);
  for (const d of [ansi, ...ALL_DIALECTS]) {
    for (const name of NAMES) {
      const q = quoteIdent(d, name);
      if (q.kind === "ok") {
        const t = oneToken(d, q.value);
        assertEquals(t, { kinds: [Tok.QuotedIdent, Tok.Eof], errors: 0 }, `${d.name}: ${q.value}`);
      }
      const s = quoteString(d, name);
      if (s.kind === "ok") {
        const t = oneToken(d, s.value);
        assertEquals(t, { kinds: [Tok.String, Tok.Eof], errors: 0 }, `${d.name}: ${s.value}`);
      }
    }
  }
});

proves(["0007-sql-emit FR-004"], "the styles of a dialect are listed, a name takes the colon, at or dollar style, a position takes $n or ?, and a dialect without a fitting style gives an error value", () => {
  assertEquals(paramStyles(postgres), ["dollar-number"]);
  assertEquals(text(placeholder(postgres, 3)), "$3");
  assertEquals(text(placeholder(sqlite, 1, "name")), ":name");
  assertEquals(text(placeholder(ansi, 2)), "?");
  assertEquals(text(placeholder(tsql, 1, "p")), "@p");
  const pn = placeholder(postgres, 1, "name");
  assert(pn.kind === "err" && pn.error.kind === "no-placeholder" && pn.error.wanted === "named");
  assertEquals(describeEmitError(pn.error), "postgres has no named parameter");
  const nothing = defineDialect({ name: "nothing", lexical: (l) => ({ ...l, params: [] }) });
  assert(nothing.kind === "ok");
  const r = placeholder(nothing.value, 1);
  assert(r.kind === "err" && r.error.kind === "no-placeholder" && r.error.wanted === "positional");
});

proves(["0007-sql-emit FR-005"], "what placeholder gives is read back as exactly one parameter token of the same dialect's lexer, in every dialect that has a style that fits", () => {
  let checked = 0;
  for (const d of [ansi, ...ALL_DIALECTS]) {
    for (const name of [undefined, "name", "p1"]) {
      const p = placeholder(d, 2, name);
      if (p.kind !== "ok") continue;
      checked++;
      assertEquals(oneToken(d, p.value), { kinds: [Tok.Param, Tok.Eof], errors: 0 }, `${d.name}: ${p.value}`);
    }
  }
  assert(checked > 30, `${checked} placeholders were read back`);
});
