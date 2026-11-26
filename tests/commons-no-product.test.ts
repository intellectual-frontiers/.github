/**
 * IF Commons holds no product code (commons 0027-commons-libraries FR-028): no tracked file of `commons/` names a product built on it, in any letter case. A product gives
 * commons a brand or an identity by parameter (a typed `Brand`), and everything a command line, an MCP server, a REST API, a terminal or a GUI shows comes from the product's
 * own repository. The few files that may name the product are listed here, one by one, with the reason.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertEquals, proves } from "../commons/test/src/test.ts";

const ROOT = new URL("..", import.meta.url).pathname;
/** The word the rule bans, built so that this file does not name the product in one piece. */
const WORD = ["ops", "folio"].join("");
/** Generated and vendored files are not hand-written commons: the ontology tables, the OSCAL registers and the lockfiles. */
const SKIPPED = [/(^|\/)node_modules\//, /(^|\/)dist\//, /(^|\/)generated\//, /oscal/i, /(^|\/)(bun\.lockb?|package-lock\.json|[a-z.-]*\.lock)$/];
/** A file that may name the product, with the reason. None today: commons is used by products, and says so without naming one. */
export const ALLOWED: Readonly<Record<string, string>> = {};

/** The tracked files of commons that name the product and are not allowed to. */
export function offenders(root: string): readonly string[] {
  const listed = spawnSync("git", ["ls-files", "-z", "commons"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  const out: string[] = [];
  for (const file of listed.stdout.split("\0").filter((f) => f !== "")) {
    if (SKIPPED.some((r) => r.test(file)) || file in ALLOWED) continue;
    let text: string;
    try {
      text = readFileSync(`${root}${file}`, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue;
    if (text.toLowerCase().includes(WORD) || file.toLowerCase().includes(WORD)) out.push(file);
  }
  return out;
}

proves(["0027-commons-libraries FR-028"], "no tracked file of commons names a product: products pass a Brand to commons", () => {
  assertEquals(offenders(ROOT), [], "IF Commons holds no product code: a product passes a Brand (a typed identity) to the library and keeps its names in its own repository; these files name one");
});
