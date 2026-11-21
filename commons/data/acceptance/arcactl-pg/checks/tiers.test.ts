// Spec: 0001-arcactl-pg-kit FR-008
/**
 * The check of the acceptance kits (commons data 0001-arcactl-pg-kit FR-008): it passes on this repository, and it finds an acceptance specification or a kit named by a specification or a test of the library, which the three tiers
 * of specifications (the repository's, the library's, the acceptance kits') never do.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { citations, kits, main, specIds } from "../../tools/check.ts";

proves(["0001-arcactl-pg-kit FR-008"], "the check of the acceptance kits passes here, and finds a specification or a test of the library that names an acceptance specification or a kit", async () => {
  const r = await main([]);
  assert(r.code === 0, r.lines.join("\n"));
  assert(kits().includes("arcactl-pg") && specIds().includes("0001-arcactl-pg-kit"), "the kit and its specification are found");
  assert(citations().length === 0, "nothing of the library's or the repository's names one");
  const planted = citations([
    { path: "commons/data/spec-kit/specs/0001-layers/spec.md", text: "See 0001-arcactl-pg-kit FR-001." },
    { path: "commons/data/suite/x.test.ts", text: 'import "../acceptance/arcactl-pg/models/crm.ts";' },
    { path: "commons/spec-kit/specs/x/spec.md", text: "Nothing of the kits is named here." },
  ]);
  assert(planted.length === 2 && planted[0]?.includes("0001-arcactl-pg-kit") && planted[1]?.includes("acceptance/arcactl-pg"), planted.join("\n"));
});
