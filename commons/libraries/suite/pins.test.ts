/**
 * Tests of the tools' own helpers (commons 0005-typescript-runtime FR-026): commons' pins read as the Bun installer reads them, with a
 * pinned checksum of Bun for every platform Bun builds for.
 *
 * @module
 */
import { sha256Of } from "@intellectual-frontiers/crypto/sha256";
import { readTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { describePinProblem, pinDownload, pinSuffix, readEnvFile } from "../src/pins.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..", "..", "..");

proves(
  ["0005-typescript-runtime FR-026", "0002-packaging FR-019"],
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
      const suffix = pinSuffix(os, arch);
      assert(suffix !== undefined, `${os}/${arch}`);
      const d = pinDownload(pins, "BUN", suffix);
      assert(d.kind === "ok", `a download of Bun for ${suffix}`);
      assert(sha256Of(d.value.sha256) !== undefined, `a checksum of Bun for ${suffix}`);
      assertEquals(d.value.format, "zip");
      assertEquals(d.value.url.startsWith("https://"), true);
      assert(d.value.url.includes(d.value.version), "the address carries the pinned version");
      assertEquals(d.value.url.endsWith(".zip"), true);
    }
    const none = pinDownload(pins, "MISE", "X86_64");
    assert(none.kind === "err" && none.error.kind === "not-pinned", "mise has no address: it is unpinned there");
    if (none.kind === "err") assertEquals(describePinProblem(none.error), "commons pins no download of MISE for X86_64");
    assertEquals(pinDownload(pins, "NOSUCH", "X86_64").kind, "err");
    assertEquals(
      pinDownload(new Map([["A_VERSION", "1"], ["A_URL_X", "https://e/x"], ["A_SHA256_X", "00"], ["A_FORMAT_X", "rar"], ["A_BINPATH_X", ""]]), "A", "X"),
      { kind: "err", error: { kind: "bad-format", key: "A", suffix: "X", format: "rar" } },
    );
    assertEquals(
      [pinSuffix("windows", "aarch64"), pinSuffix("plan9", "x86_64"), pinSuffix("toString", "")],
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
