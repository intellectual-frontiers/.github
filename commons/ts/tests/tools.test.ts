/**
 * Tests of the tools' own helpers (commons 0005-typescript-runtime FR-026): commons' pins read as the Bun installer reads them, with a
 * pinned checksum of Bun for every platform Bun builds for.
 *
 * @module
 */
import { sha256Of } from "@intellectual-frontiers/crypto/sha256";
import { readTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "../runtime/test.ts";
import { bunTarget, readEnvFile } from "../tools/pins.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..", "..", "..");

proves(
  ["0005-typescript-runtime FR-026"],
  "commons pins Bun with a checksum for each platform Bun builds for, and the installer finds it",
  async () => {
    const pins = readEnvFile(await readTextFile(join(ROOT, "commons", "generated", "pins.auto.env")));
    assert(/^\d+\.\d+\.\d+$/.test(pins.get("BUN_VERSION") ?? ""), "BUN_VERSION is pinned exactly");
    for (const [os, arch] of [
      ["linux", "x86_64"],
      ["linux", "aarch64"],
      ["darwin", "x86_64"],
      ["darwin", "aarch64"],
      ["windows", "x86_64"],
    ] as const) {
      const t = bunTarget(os, arch);
      assert(t !== undefined, `${os}/${arch}`);
      assert(sha256Of(pins.get(`BUN_SHA256_${t.key}`) ?? "") !== undefined, `a checksum of Bun for ${t.key}`);
    }
    assertEquals(
      [bunTarget("windows", "aarch64"), bunTarget("plan9", "x86_64"), bunTarget("toString", "")],
      [undefined, undefined, undefined],
    );
    assertEquals(
      [...readEnvFile("# c\nA=1\n\nB_2=x=y\nlower=no\r\nC=\n").entries()],
      [
        ["A", "1"],
        ["B_2", "x=y"],
        ["C", ""],
      ],
    );
  },
);
