/**
 * What the generator's tests share: the checkout's root, commons' configuration checked, a build of it, the fixture area, and the
 * comparison with committed HTML that `IFCDOCS_UPDATE_GOLDEN=1` writes again (commons 0011-documentation FR-019).
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assertEquals } from "@intellectual-frontiers/test";
import { Build } from "../src/build.ts";
import { type About, type Config, resolveConfig } from "../src/config.ts";
import { readSpecKits } from "../src/extract/specs.ts";
import { type Built, buildSite } from "../src/site.ts";
import type { Area, Package } from "../src/sources.ts";

/** The checkout's root. */
export const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");

/** Commons' configuration file. */
export const COMMONS_CONFIG = path.join(ROOT, "commons/docs.config.ts");

/** A configuration checked, or the test fails with what is wrong with it. */
export function resolved(value: unknown, file: string): Config {
  const r = resolveConfig(value, file);
  if (r.kind === "err") throw new Error(r.error.join("\n"));
  return r.value;
}

/**
 * Commons' configuration, checked. The generator's tests document a real repository, commons itself, as their corpus (a library, a spec kit, a program, a data model of each kind): its configuration is read by a path built here at run time, so
 * that the library keeps no import of a file outside its folder, and the tests that need it are the ones that need a repository to document.
 */
export const CONFIG: Config = resolved((await import(path.toFileUrl(COMMONS_CONFIG).href) as { config: unknown }).config, COMMONS_CONFIG);

let site: Promise<Built> | undefined;
/** The site of commons built from CONFIG, made once for every test file of a run (a build of 2,500 pages takes some twenty seconds, and nineteen files each made one); a test copies what it changes. */
export const siteOnce = (): Promise<Built> => (site ??= buildSite(CONFIG));

/** A build of the checkout, with nothing made yet. */
export const freshBuild = (): Build => new Build(CONFIG, readSpecKits(ROOT, CONFIG.specKits));

const ABOUT: About = { title: "Fixture", summary: "A fixture package.", spec: { repo: "commons", id: "0011-documentation" } };

/** The package the fixture areas are in. */
export const FIXTURE_PACKAGE: Package = { dir: "commons/docs", slug: "fixture", about: ABOUT, file: "commons/docs/about.ts" };

/** A fixture area of the generator's tests, by its entry point in `suite/fixture/`. */
export function fixtureArea(slug: string, entry: string, title = "Fixture"): Area {
  return { title, slug, entryPoints: [`suite/fixture/${entry}`], pkg: FIXTURE_PACKAGE, dir: "commons/docs/suite/fixture" };
}

/**
 * Text compared with a committed file, or the file written again where `IFCDOCS_UPDATE_GOLDEN=1`.
 *
 * @param name - the file's name in `suite/golden/`
 * @param text - the text
 */
export async function golden(name: string, text: string): Promise<void> {
  const file = path.join(ROOT, "commons/docs/suite/golden", name);
  if (proc.env.get("IFCDOCS_UPDATE_GOLDEN") === "1") {
    await fs.writeTextFile(file, text);
    return;
  }
  assertEquals(text, await fs.readTextFile(file), `${name} is not what the generator makes; read the diff and run IFCDOCS_UPDATE_GOLDEN=1 bun test suite/`);
}
