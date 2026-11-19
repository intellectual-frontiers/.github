// Spec: 0044-issues FR-007
/**
 * The notes of the table of enforcement (commons data 0044-issues FR-007): each is the tests that carry the requirement's tag, so none names a test that is not there or that does not prove it.
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { noteOf, type Proof, proofsOf, staleRows } from "../tools/enforcement.ts";
import { same } from "./governance-fixture.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

proves(["0044-issues FR-007"], "the notes of the table of enforcement are the tests that carry the requirement's tag, and a note that names a test that is not there or does not prove it is found", () => {
  const proofs = proofsOf(ROOT);
  assert(proofs.length > 250, `${proofs.length} tests read`);
  same(staleRows(readFileSync(join(ROOT, "spec-kit/enforcement.tsv"), "utf8"), proofs), []);
  const fake: readonly Proof[] = [{ file: "suite/a.test.ts", title: "t one", tags: ["0001-x FR-001"] }, { file: "suite/b.test.ts", title: "t two", tags: ["0001-x FR-001", "0001-x FR-002"] }];
  same(noteOf(fake, "0001-x FR-001"), "suite/a.test.ts: t one; suite/b.test.ts: t two");
  same(noteOf(fake, "0001-x FR-003"), undefined);
  const row = (note: string) => `requirement\tmechanism\tby\tnote\n0001-x FR-001\tcheck\tx\t${note}\n0001-x FR-009\tcheck\tx\tsuite/z.test.ts: gone\n0001-x FR-002\tnone\t-\tplanned`;
  same(staleRows(row("suite/a.test.ts: t one; suite/b.test.ts: t two"), fake).length, 1, "only the requirement with no test is found");
  same(staleRows(row("suite/a.test.ts: t one"), fake).length, 2, "and a note that names fewer than the tests that carry the tag");
});

proves(["0044-issues FR-008"], "every specification of the library is in force, so the trace holds each requirement to a test", () => {
  const specs = readdirSync(join(ROOT, "spec-kit/specs")).filter((d) => /^\d{4}-/.test(d));
  assert(specs.length >= 45, `${specs.length} specifications`);
  const draft = specs.filter((d) => /^\*\*Status:\*\*\s+Draft\b/m.test(readFileSync(join(ROOT, "spec-kit/specs", d, "spec.md"), "utf8")));
  same(draft, []);
});
