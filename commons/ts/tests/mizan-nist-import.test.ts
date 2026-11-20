/**
 * The import of the NIST SP 800-53 Rev. 5.2.0 controls that the specifications cite (commons 0019-mizan-integrations FR-030): the committed module says which controls it holds,
 * with the titles of the pinned catalog, and the import command's offline check finds it current. The fetch of the real catalog is CI's step (`--check --fetch`), not a test's.
 *
 * @module
 */
import { controls } from "../../ontology/standards/nist-sp-800-53/controls.auto.ts";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { execPath, run } from "@intellectual-frontiers/system/proc";
import { assertEquals, proves } from "../runtime/test.ts";
import { manifest } from "../mizan/imports/nist-sp-800-53.import.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const IMPORT = resolve(HERE, "..", "mizan", "integrations", "host", "import.ts");
const MANIFEST = resolve(HERE, "..", "mizan", "imports", "nist-sp-800-53.import.ts");

proves(
  ["0019-mizan-integrations FR-030"],
  "the committed module holds the configuration management controls the specifications cite, with the titles of the pinned catalog, and the import's offline check finds it current",
  async () => {
    assertEquals(Object.keys(controls).sort(), [...manifest.slice].sort());
    assertEquals(controls["cm-2"].title, "Baseline Configuration");
    assertEquals(controls["cm-3"].title, "Configuration Change Control");
    assertEquals(controls["cm-4"].title, "Impact Analyses");
    assertEquals(controls["cm-5"].title, "Access Restrictions for Change");
    assertEquals(controls["cm-9"].title, "Configuration Management Plan");
    assertEquals(manifest.standard.version, "5.2.0");
    const o = await run([execPath(), IMPORT, MANIFEST, "--check"]);
    assertEquals([o.code, o.stderr], [0, ""]);
  },
);
