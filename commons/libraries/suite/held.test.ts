/**
 * The held library (0001-libraries FR-024): a manifest field that keeps a library out of the release entirely, the decoder's refusals, its absence from every set, and its flag in the README table.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { decodeLibrarySource, type Library } from "../src/libraries.ts";
import { isConsumerFacing } from "../src/metapackages.ts";

const SPEC = "0001-libraries";

const manifest = (name: string, extra: Record<string, unknown> = {}): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: ["."], distribution: ["github"], ...extra })};\n`;
const lib = (name: string, extra: Record<string, unknown> = {}): Library => {
  const r = decodeLibrarySource(manifest(name, extra));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves([`${SPEC} FR-024`], "held is a non-empty line, allows any distribution, and is refused with publishes or bundle; without it a distribution of no registry is still refused", () => {
  assertEquals(lib("archon", { held: "not published yet" }).held, "not published yet");
  assertEquals(lib("archon", { held: "not published yet", distribution: [] }).distribution, []);
  assertEquals(lib("archon", { held: "not published yet", distribution: ["npm"] }).distribution, ["npm"]);
  assertEquals(lib("archon").held, undefined);
  assertEquals(decodeLibrarySource(manifest("archon", { held: "" })).kind, "err");
  assertEquals(decodeLibrarySource(manifest("archon", { held: " padded " })).kind, "err");
  const both = decodeLibrarySource(manifest("archon", { held: "x", publishes: "@intellectual-frontiers/other" }));
  assert(both.kind === "err");
  assertStringIncludes(both.error, "library.held");
  assertEquals(decodeLibrarySource(manifest("foundation", { held: "x", bundle: "foundation" })).kind, "err");
  assertEquals(decodeLibrarySource(manifest("archon", { distribution: [] })).kind, "err");
});

proves([`${SPEC} FR-024`], "a held library is in no set even where it declares npm", () => {
  assertEquals(isConsumerFacing(lib("archon", { held: "not published yet", distribution: ["github", "npm"] })), false);
  assertEquals(isConsumerFacing(lib("widget", { distribution: ["github", "npm"] })), true);
});
