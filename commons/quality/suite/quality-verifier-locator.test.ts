/**
 * Where the assessor finds the verifier's two source files (commons 0001-quality-evidence FR-069): beside its own module in the source layout, and in the `src/assessor/` of the package from
 * its compiled `dist/assessor/` in the per-library layout and in the `src/assessor/` of the library's folder from `dist/src/assessor/` in the layout of the one package of commons (where only `.js` and `.d.ts` are beside it); a file in none of the places is a typed error naming the places. The packed and installed
 * package makes a pack on Node 26 and on Bun in `tests/release/quality-assessor-package.test.ts`.
 *
 * @module
 */
import { formatVerifierError, verifierCandidates, verifierSources } from "../src/assessor/host.ts";
import { makeTempDir, mkdir, readTextFile, remove, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SOURCES = join(dirname(fromFileUrl(import.meta.url)), "..", "src", "assessor");

proves(
  ["0001-quality-evidence FR-069"],
  "the verifier's files are found beside the module, in the src/assessor of the package from dist/assessor and in the src/assessor of the library folder from dist/src/assessor, and a file in none of the places is a typed error naming the places",
  async () => {
    const tmp = await makeTempDir({ prefix: "ifc-verifier-locator-" });
    try {
      // the source layout: beside the module
      const own = await verifierSources(SOURCES);
      assert(own.kind === "ok");
      assertEquals(own.value.pack, await readTextFile(join(SOURCES, "verify-pack.ts")));
      assertEquals(own.value.main, await readTextFile(join(SOURCES, "verify.ts")));
      // the published layout: dist/assessor holds no .ts, the package ships src/assessor
      const dist = join(tmp, "pkg", "dist", "assessor");
      const shipped = join(tmp, "pkg", "src", "assessor");
      await mkdir(dist, { recursive: true });
      await mkdir(shipped, { recursive: true });
      await writeTextFile(join(dist, "host.js"), "export {};\n");
      await writeTextFile(join(shipped, "verify-pack.ts"), "// pack\n");
      await writeTextFile(join(shipped, "verify.ts"), "// main\n");
      const published = await verifierSources(dist);
      assert(published.kind === "ok");
      assertEquals(published.value, { pack: "// pack\n", main: "// main\n" });
      // the layout of the one package of commons: <library>/dist/src/assessor holds no .ts, <library>/src/assessor does
      const single = join(tmp, "single", "quality");
      await mkdir(join(single, "dist", "src", "assessor"), { recursive: true });
      await mkdir(join(single, "src", "assessor"), { recursive: true });
      await writeTextFile(join(single, "src", "assessor", "verify-pack.ts"), "// single pack\n");
      await writeTextFile(join(single, "src", "assessor", "verify.ts"), "// single main\n");
      const inSingle = await verifierSources(join(single, "dist", "src", "assessor"));
      assert(inSingle.kind === "ok");
      assertEquals(inSingle.value, { pack: "// single pack\n", main: "// single main\n" });
      // a package without them: the error names the file and where it was looked for
      const bare = join(tmp, "bare", "dist", "assessor");
      await mkdir(bare, { recursive: true });
      const missing = await verifierSources(bare);
      assert(missing.kind === "err");
      assertEquals(missing.error.file, "verify-pack.ts");
      assertEquals(missing.error.tried, verifierCandidates(bare, "verify-pack.ts"));
      assertStringIncludes(formatVerifierError(missing.error), join(bare, "verify-pack.ts"));
    } finally {
      await remove(tmp, { recursive: true });
    }
  },
);
