/**
 * What the generator's tests share: the checkout's root, a build of it, the fixture area, and the comparison with committed HTML that
 * `IFCDOCS_UPDATE_GOLDEN=1` writes again (commons 0011-documentation FR-019).
 *
 * @module
 */
import type { About } from "../../ts/kernel/mod.ts";
import { fs, path, proc } from "../../ts/runtime/mod.ts";
import { assertEquals } from "../../ts/runtime/test.ts";
import { Build } from "../build.ts";
import { readSpecKit } from "../extract/specs.ts";
import type { Area, Package } from "../sources.ts";

/** The checkout's root. */
export const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");

/** A build of the checkout, with nothing made yet. */
export const freshBuild = (): Build => new Build(ROOT, readSpecKit(path.join(ROOT, "commons/spec-kit")));

const ABOUT: About = { title: "Fixture", summary: "A fixture package.", spec: { repo: "commons", id: "0011-documentation" } };

/** The package the fixture areas are in. */
export const FIXTURE_PACKAGE: Package = { dir: "commons/docs", slug: "fixture", about: ABOUT };

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
