/**
 * A repository with no `about.ts` (commons 0011-documentation FR-019, FR-026, FR-027): the fixture repository under `fixture-repo/`,
 * configured by its own `docs.config.ts`, builds with no finding into its pages: the home and its package from the configuration, its
 * area's API, its plain spec kit and constitution, and no Models section, since it passes no lens.
 *
 * @module
 */
import { path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "../../ts/runtime/test.ts";
import { report } from "../check.ts";
import { loadConfig } from "../cli.ts";
import { document } from "../emit/html.ts";
import { buildSite } from "../site.ts";
import { ROOT } from "./helpers.ts";

proves(["0011-documentation FR-019", "0011-documentation FR-027", "0011-documentation FR-026"], "the fixture repository builds with no finding, from its configuration alone", async () => {
  const loaded = await loadConfig(path.join(ROOT, "commons/docs/suite/fixture-repo/docs.config.ts"));
  assert(loaded.kind === "ok", loaded.kind === "err" ? loaded.error.join("; ") : "");
  const built = await buildSite(loaded.value);
  assertEquals(report(built.found), []);
  assertEquals(built.pages.map((p) => p.path).sort(), [
    "api/greeting/index.html",
    "api/greeting/mod.html",
    "api/index.html",
    "index.html",
    "overview/fixture.html",
    "specs/001-greeting.html",
    "specs/002-farewell.html",
    "specs/constitution.html",
    "specs/index.html",
    "specs/matrix.html",
  ]);
  assert(!built.pages.some((p) => p.section === "models"), "no lens, no Models section");
  const mod = built.pages.find((p) => p.path === "api/greeting/mod.html");
  assert(mod !== undefined);
  const html = document(mod, { name: "Fixture", repository: "https://github.com/example/fixture", pages: built.pages, sections: ["overview", "specs", "api"] });
  assert(html.includes('href="https://intellectual-frontiers.github.io/.github/specs/0011-documentation.html#fr-027"'), "commons is linked to its site");
  assert(html.includes('href="../../specs/001-greeting.html#fr-001"'), "a bare FR in the area is its specification's");
  assert(html.includes("erga 009-machine-bootstrap") && !html.includes("009-machine-bootstrap.html"), "erga stays text");
  assert(!html.includes("models/index.html"), "the top bar has no Models");
  const farewell = built.pages.find((p) => p.path === "specs/002-farewell.html");
  assert(JSON.stringify(farewell?.blocks).includes('"path":"specs/001-greeting.html"'), "a specification cites another");
}, { timeout: 60_000 });
