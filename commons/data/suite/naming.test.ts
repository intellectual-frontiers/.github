// Spec: 0005-naming FR-001, FR-002
/**
 * Names (commons data 0005-naming FR-001, FR-002): a name of governance is lower camel case, `domain` refuses one that is not, and `words` splits a valid name into lower-case words in one
 * way only, so that every layer below reads the same words.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { attribute, codeList, concept, domain, identifier, NAME, words } from "@intellectual-frontiers/data/governance";
import { same } from "./governance-fixture.ts";

proves(["0005-naming FR-001"], "a name is lower camel case: a letter first and then letters and digits, with no underscore", () => {
  for (const ok of ["a", "party", "givenName", "line1", "x2", "iso3166Code", "aB", "partyRoleKind", "httpServer", "a1B2"])
    assert(NAME.test(ok), ok);
  for (const bad of ["", "Party", "PartyRole", "party_role", "given_name", "1a", "a-b", "a b", "a.b", "é", "_a", "a_"])
    assert(!NAME.test(bad), bad);
});

proves(
  ["0005-naming FR-001"],
  "domain returns a name that holds an underscore or begins with a capital as an error, for every kind of element",
  () => {
    const bad = concept("party_role", { attributes: { Id: attribute(identifier()) }, identifiedBy: ["Id"] });
    const r = domain("my_domain", { concepts: [bad], codeLists: [codeList("Kinds", { codes: { employed_by: { label: "E" } } })] });
    assert(r.kind === "err");
    const text = r.kind === "err" ? JSON.stringify(r.error) : "";
    for (const element of [
      '"element":"my_domain"',
      '"element":"my_domain/party_role"',
      '"element":"my_domain/party_role.Id"',
      '"element":"my_domain/list:Kinds"',
      '"element":"my_domain/list:Kinds.employed_by"',
    ]) {
      assert(text.includes(`{"kind":"name",${element}`), `${element} in ${text}`);
    }
    assert(
      domain("myDomain", { concepts: [concept("partyRole", { attributes: { id: attribute(identifier()) }, identifiedBy: ["id"] })] })
        .kind === "ok",
    );
  },
);

proves(["0005-naming FR-002"], "words splits at lower to upper, around digits and at the end of a run of capitals, in lower case", () => {
  same(words("givenName"), ["given", "name"]);
  same(words("partyRoleKind"), ["party", "role", "kind"]);
  same(words("line1"), ["line", "1"]);
  same(words("iso3166Code"), ["iso", "3166", "code"]);
  same(words("x2y"), ["x", "2", "y"]);
  same(words("HTTPServer"), ["http", "server"]);
  same(words("getHTTPResponseCode"), ["get", "http", "response", "code"]);
  same(words("ulid"), ["ulid"]);
  same(words("a"), ["a"]);
  same(words("aB"), ["a", "b"]);
  same(words(""), []);
});

proves(
  ["0005-naming FR-002"],
  "for every valid name the words are at least one, the same every time, and make the name again when joined",
  () => {
    // a fixed generator, so the names are the same on every run
    let seed = 20261118;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const pieces = ["a", "party", "role", "kind", "id", "iso", "http", "x", "line", "name", "2", "3166", "url", "api"];
    let checked = 0;
    for (let i = 0; i < 500; i++) {
      const parts = Array.from({ length: 1 + next(4) }, () => pieces[next(pieces.length)] ?? "a");
      const name = parts.map((p, j) => (j === 0 || /^[0-9]/.test(p) ? p : (p[0] ?? "").toUpperCase() + p.slice(1))).join("");
      if (!NAME.test(name)) continue;
      const w = words(name);
      assert(w.length >= 1, name);
      same(words(name), w);
      same(w.join(""), name.toLowerCase(), name);
      assert(
        w.every((x) => /^([a-z]+|[0-9]+)$/.test(x)),
        `${name}: ${w.join(",")}`,
      );
      checked++;
    }
    assert(checked > 400, `${checked} names checked`);
  },
);
