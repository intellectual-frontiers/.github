// Spec: 0003-governance FR-007, FR-008, FR-009
/**
 * Annotations, vocabularies and lint (commons data 0003-governance FR-007 to FR-009): a kind types its value and says where it may be, vocabularies reach a project through the engine, and lint
 * returns findings as data, the core rules first and then each vocabulary's.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { compose, type Extension } from "@intellectual-frontiers/data/engine";
import {
  annotate,
  annotationKind,
  annotationsOf,
  attribute,
  concept,
  defaultVocabularies,
  domain,
  domainId,
  finding,
  identifier,
  lint,
  type Vocabulary,
  vocabulariesFrom,
  vocabularyExtension,
} from "@intellectual-frontiers/data/governance";
import { arca, same } from "./governance-fixture.ts";

proves(["0003-governance FR-007"], "an annotation is typed by its kind, says where it may be, and is read back typed", () => {
  const weight = annotationKind<{ readonly grams: number }>("physics.weight", ["attribute"]);
  const a = annotate(weight, { grams: 3 });
  same([a.kind, a.about, a.value], ["physics.weight", ["attribute"], { grams: 3 }]);
  assert(Object.isFrozen(a) && Object.isFrozen(weight));
  const c = concept("thing", {
    attributes: { id: attribute(identifier(), { annotations: [a, annotate(weight, { grams: 5 })] }) },
    identifiedBy: ["id"],
  });
  const read: readonly { readonly grams: number }[] = annotationsOf(c.attributes.id, weight);
  same(read, [{ grams: 3 }, { grams: 5 }]);
  same(annotationsOf(c, weight), []);
  // @ts-expect-error a number is not a weight
  const wrong = annotate(weight, 3);
  same(wrong.kind, "physics.weight");
  // @ts-expect-error a name with no vocabulary does not compile
  annotationKind<string>("weight", ["attribute"]);
});

proves(
  ["0003-governance FR-008"],
  "an extension contributes a vocabulary through the engine, and the composition gives them in its order",
  () => {
    const extra: Vocabulary = { id: "extra", kinds: [], rules: [] };
    const made = [defaultVocabularies[0], extra].flatMap((v) => (v === undefined ? [] : [vocabularyExtension(v)]));
    const extensions: Extension[] = [];
    for (const m of made) {
      assert(m.kind === "ok");
      if (m.kind === "ok") extensions.push(m.value);
    }
    same(
      extensions.map((e) => e.id),
      ["governance.docs", "governance.extra"],
    );
    const c = compose(extensions);
    assert(c.kind === "ok");
    if (c.kind === "ok")
      same(
        vocabulariesFrom(c.value).map((v) => v.id),
        ["docs", "extra"],
      );
    assert(vocabularyExtension({ id: "Bad Id", kinds: [], rules: [] }).kind === "err", "an identifier that is not one is an error value");
  },
);

proves(
  ["0003-governance FR-009"],
  "lint returns data: the core rules find a missing definition and an unknown kind, in the order of the elements",
  () => {
    const stray = annotationKind<string>("nobody.knows", ["concept"]);
    const c = concept("thing", { attributes: { id: attribute(identifier()) }, identifiedBy: ["id"], annotations: [annotate(stray, "x")] });
    const r = domain("d", { concepts: [c] });
    assert(r.kind === "ok");
    if (r.kind !== "ok") return;
    same(
      lint(r.value).map((f) => `${f.rule} ${f.element} ${f.severity}`),
      [
        "core/definition-missing d error",
        "core/definition-missing d/thing error",
        "core/definition-missing d/thing.id error",
        "core/annotation-unknown d/thing warning",
      ],
    );
    same(lint(r.value)[0]?.message, "the domain d has no definition");
    const known: Vocabulary = { id: "nobody", kinds: [stray], rules: [] };
    same(
      lint(r.value, [known]).map((f) => f.rule),
      ["core/definition-missing", "core/definition-missing", "core/definition-missing"],
    );
    same(lint(arca()), [], "the fixture has a definition everywhere");
  },
);

proves(["0003-governance FR-009"], "a vocabulary's rules run after the core rules, in the order of the vocabularies given", () => {
  const rule = (id: string) => ({ id, describe: id, check: () => [finding(id, domainId("arca"), id)] });
  const one: Vocabulary = { id: "one", kinds: [], rules: [rule("one/a"), rule("one/b")] };
  const two: Vocabulary = { id: "two", kinds: [], rules: [rule("two/a")] };
  same(
    lint(arca(), [one, two]).map((f) => f.rule),
    ["one/a", "one/b", "two/a"],
  );
  same(
    lint(arca(), [two, one]).map((f) => f.rule),
    ["two/a", "one/a", "one/b"],
  );
  same(finding("r", domainId("arca"), "m").severity, "warning");
});
