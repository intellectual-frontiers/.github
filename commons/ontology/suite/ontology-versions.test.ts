/**
 * The versions of commons' own ontologies (commons 0026-works-versioning FR-015): each is a Semantic Version, its version IRI is the ontology's IRI, a slash and that version, and the
 * generated Turtle, the DCAT catalog and (where Python with rdflib is present) an independent reader say the same. Pure over the typed ontologies and the generated files.
 *
 * @module
 */
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ifccmOntology } from "@intellectual-frontiers/ontology/ifccm";
import { ifqsOntology } from "@intellectual-frontiers/ontology/ifqs";
import { ifrOntology, versionSchemes } from "@intellectual-frontiers/ontology/ifr";
import { kanonOntology } from "@intellectual-frontiers/ontology/kanon";
import { mizanOntology } from "@intellectual-frontiers/ontology/mizan";
import { packagingOntology } from "@intellectual-frontiers/ontology/supply-chain/packaging";

const COMMONS = resolve(dirname(fromFileUrl(import.meta.url)), "..", "..");
const text = (rel: string): string => readTextFileSync(resolve(COMMONS, rel)).replaceAll("\r\n", "\n");
const SEMVER = new RegExp(versionSchemes.SemVer.values.versionPattern ?? "^$");

/** Commons' ontologies, by the name their generated files carry and the IRI of their version namespace's prefix in the Turtle. */
const ONTOLOGIES = [
  { name: "mizan", ontology: mizanOntology, prefix: "mzv" },
  { name: "ifccm", ontology: ifccmOntology, prefix: "ifccmv" },
  { name: "ifqs", ontology: ifqsOntology, prefix: "ifqsv" },
  { name: "ifr", ontology: ifrOntology, prefix: "ifrv" },
  { name: "kanon", ontology: kanonOntology, prefix: "kanonv" },
  { name: "packaging", ontology: packagingOntology, prefix: "pmv" },
] as const;

proves(
  ["0026-works-versioning FR-015"],
  "every ontology of commons is at the Semantic Version 1.0.0 and its version IRI is its IRI, a slash and that version",
  () => {
    for (const { name, ontology } of ONTOLOGIES) {
      const v = ontology.values.versionInfo;
      assertEquals(v, "1.0.0", name);
      assert(v !== undefined && SEMVER.test(v), `${name}: ${v} is a Semantic Version`);
      assertEquals(ontology.values.versionIri?.iri, `${ontology.iri}/${v}`, name);
      // a Semantic Version, not the integer it was
      assert(!/^[0-9]+$/.test(v), name);
    }
  },
);

proves(
  ["0026-works-versioning FR-015"],
  "the generated Turtle names the Semantic Version and its version IRI, and the DCAT catalog gives each dataset's version",
  () => {
    for (const { name, prefix } of ONTOLOGIES) {
      const ttl = text(`generated/${name}.auto.ttl`);
      assert(ttl.includes(`owl:versionIRI ${prefix}:1.0.0`), `${name}: the version IRI`);
      assert(ttl.includes('owl:versionInfo "1.0.0"'), `${name}: the version`);
      assert(!/owl:versionInfo "[0-9]+"/.test(ttl), `${name}: no integer version`);
    }
    // the catalog lists the five published ontologies, each at 1.0.0
    const catalog = text("generated/mizan-catalog.auto.ttl");
    assertEquals((catalog.match(/dcat:version "1\.0\.0"/g) ?? []).length, 5);
    assert(!/dcat:version "[0-9]+"/.test(catalog));
  },
);

proves(
  ["0026-works-versioning FR-015"],
  "an independent reader (rdflib) reads the version IRI of each ontology back, where Python with rdflib is present",
  async (t) => {
    const python = proc.which("python3");
    const have = python === undefined ? undefined : await proc.run([python, "-c", "import rdflib"]);
    if (python === undefined || have === undefined || have.code !== 0) {
      t.skip("python3 with rdflib is not installed");
      return;
    }
    const script = [
      "import sys, rdflib",
      "from rdflib.namespace import OWL",
      "root = sys.argv[1]",
      "for name in ['mizan', 'ifccm', 'ifqs', 'ifr', 'packaging']:",
      "    g = rdflib.Graph()",
      "    g.parse(root + '/generated/' + name + '.auto.ttl', format='turtle')",
      "    iri = rdflib.URIRef('https://www.intellectualfrontiers.com/ontology/' + name)",
      "    assert list(g.objects(iri, OWL.versionIRI)) == [rdflib.URIRef(str(iri) + '/1.0.0')], name",
      "    assert [str(v) for v in g.objects(iri, OWL.versionInfo)] == ['1.0.0'], name",
      "print('ok')",
    ].join("\n");
    const o = await proc.run([python, "-c", script, COMMONS]);
    assertEquals([o.code, o.stdout.trim()], [0, "ok"], o.stderr);
  },
);
