// Spec: 0007-physical FR-001, FR-002
/**
 * Case styles and naming (commons data 0007-physical FR-001, FR-002): snake, camel and pascal write words as names, the words of a valid name written in camel are that name, a style is
 * added by an extension, and a code is stored by the style of the codes or as its name.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { compose, contribute, defineExtension, extensionId } from "@intellectual-frontiers/data/engine";
import { NAME, words } from "@intellectual-frontiers/data/governance";
import {
  camel,
  type CaseStyle,
  caseStylePoint,
  caseStylesFrom,
  naming,
  pascal,
  snake,
  writeCode,
} from "@intellectual-frontiers/data/sql/physical";
import { same } from "./governance-fixture.ts";

proves(["0007-physical FR-001"], "snake, camel and pascal write words as names, a digit joining without a capital", () => {
  const w = words("partyRoleKind");
  same([snake.write(w), camel.write(w), pascal.write(w)], ["party_role_kind", "partyRoleKind", "PartyRoleKind"]);
  const l = words("line1");
  same([snake.write(l), camel.write(l), pascal.write(l)], ["line_1", "line1", "Line1"]);
  const i = words("iso3166Code");
  same([snake.write(i), camel.write(i), pascal.write(i)], ["iso_3166_code", "iso3166Code", "Iso3166Code"]);
  same([snake.write(["a"]), camel.write(["a"]), pascal.write([])], ["a", "a", ""]);
  same([snake.name, camel.name, pascal.name], ["snake", "camel", "pascal"]);
});

proves(["0007-physical FR-001"], "the words of a valid name written in camel are that name, for generated names", () => {
  let seed = 424242;
  const next = (n: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const pieces = ["a", "party", "role", "kind", "id", "iso", "http", "x", "line", "name", "2", "3166", "url"];
  let checked = 0;
  for (let i = 0; i < 500; i++) {
    const parts = Array.from({ length: 1 + next(4) }, () => pieces[next(pieces.length)] ?? "a");
    const name = parts.map((p, j) => (j === 0 || /^[0-9]/.test(p) ? p : (p[0] ?? "").toUpperCase() + p.slice(1))).join("");
    if (!NAME.test(name)) continue;
    same(camel.write(words(name)), name, name);
    checked++;
  }
  assert(checked > 400, `${checked} names`);
});

proves(["0007-physical FR-001"], "an extension adds a case style through the engine, and snake case is the default naming", () => {
  const shout: CaseStyle = { name: "shout", write: (w) => w.join("_").toUpperCase() };
  const id = extensionId("sql.case.shout");
  assert(id.kind === "ok");
  if (id.kind !== "ok") return;
  const c = compose([defineExtension({ id: id.value, version: "1.0.0", contributes: [contribute(caseStylePoint, shout)] })]);
  assert(c.kind === "ok");
  if (c.kind === "ok") same(caseStylesFrom(c.value), [shout]);
  same(shout.write(words("givenName")), "GIVEN_NAME");
  same([naming().names, naming().codes], [snake, snake]);
  same([naming(camel).names, naming(camel).codes], [camel, camel]);
});

proves(["0007-physical FR-002"], "a code is stored by the style of the codes by default, by another style, or as its name", () => {
  same(writeCode(naming(), "employedBy"), "employed_by");
  same(writeCode(naming(camel), "employedBy"), "employedBy");
  same(writeCode(naming(snake, camel), "employedBy"), "employedBy");
  same(writeCode(naming(camel, snake), "employedBy"), "employed_by");
  same(writeCode(naming(snake, "name"), "employedBy"), "employedBy");
  same(writeCode(naming(), "email"), "email");
  same(writeCode(naming(), "taxNumber2"), "tax_number_2");
});
