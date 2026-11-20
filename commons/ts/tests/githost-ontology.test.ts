/**
 * Test that the table of what each kind of Git host offers, in the library `githost` (`@intellectual-frontiers/githost`), is the ontology's (commons 0020-ifccm FR-027, FR-041): the code list `ifccm:GitManagerKind` and its
 * `ifccm:supports`. It lives here and not in the library because a library imports nothing outside its own folder (commons 0027-commons-libraries FR-004), and the ontology of change control is outside it.
 *
 * @module
 */
import { CAPABILITIES, supports } from "@intellectual-frontiers/githost/capabilities";
import type { Capability } from "@intellectual-frontiers/githost/types";
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { gitCapabilities, gitManagerKinds } from "../../ontology/ifccm/mod.ts";

proves(
  ["0020-ifccm FR-027", "0020-ifccm FR-041"],
  "the table of what each kind of Git host offers, in the library githost, is the ontology's",
  () => {
    const all = Object.keys(gitCapabilities) as Capability[];
    for (const kind of ["Github", "Gitlab", "Git"] as const) {
      const listed = (gitManagerKinds[kind].values.supports ?? []).map((c) => c.iri.replace(/^.*[#/]/, ""));
      assertEquals([...CAPABILITIES[kind]].sort(), [...listed].sort(), kind);
      for (const c of all) assertEquals(supports(kind, c), listed.includes(c), `${kind} ${c}`);
    }
  },
);
