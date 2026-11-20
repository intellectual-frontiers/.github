/**
 * The license of the repository (commons 0035-licensing FR-007): the real command `bun commons/libraries/src/license.ts --check` runs on this checkout and finds nothing, so that CI fails on a missing or a wrong
 * `LICENSE`, and no `LICENSE` of a library folder or the root is anything but the official PolyForm Noncommercial text. The cases of the check itself are proved in `commons/libraries/suite/license.test.ts`.
 *
 * @module
 */
import { fs, path, proc } from "../commons/system/src/mod.ts";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0035-licensing FR-007"], "license.ts --check finds nothing on this repository and writes nothing", async () => {
  const bun = proc.which("bun") ?? "bun";
  const r = await proc.run([bun, "commons/libraries/src/license.ts", "--check"], { cwd: ROOT });
  assertEquals(r.code, 0, `${r.stdout}${r.stderr}`);
  assertEquals(r.stderr.trim(), "");
});

proves(
  ["0035-licensing FR-001", "0035-licensing FR-005"],
  "every LICENSE of the root and of a library folder is the PolyForm Noncommercial text and none is the MIT license",
  async () => {
    const folders = ["."];
    for await (const e of fs.readDir(path.join(ROOT, "commons")))
      if (e.isDirectory && fs.existsSync(path.join(ROOT, "commons", e.name, "library.ts"))) folders.push(`commons/${e.name}`);
    for (const f of folders) {
      const text = await fs.readTextFile(path.join(ROOT, f, "LICENSE"));
      assert(text.includes("# PolyForm Noncommercial License 1.0.0"), f);
      assert(!text.includes("MIT License") && !text.includes("Permission is hereby granted"), f);
    }
  },
);
