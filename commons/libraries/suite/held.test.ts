/**
 * The policy of the release (0001-libraries FR-024): a library is released unless its manifest carries a typed reason not to, from a closed union of kinds with a required text; the decoder's acceptances and refusals, the library's absence from every set, the reason in the plan and in the README table.
 *
 * @module
 */
import { slugOf } from "@intellectual-frontiers/mizan/versions/record";
import { proc } from "@intellectual-frontiers/system";
import { mkdirSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { decodeHold, decodeLibrarySource, HOLD_KINDS, type Hold, holdSentence, type Library, readLibraries } from "../src/libraries.ts";
import { isConsumerFacing } from "../src/metapackages.ts";
import { type Facts, offlinePublishedExports, offlineRegistry, planLines, planRelease, releasePlan } from "../src/releasing.ts";
import { rowOf, tableOf } from "../src/readme.ts";

const SPEC = "0001-libraries";

const manifest = (name: string, extra: Record<string, unknown> = {}): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: ["."], distribution: ["github"], ...extra })};\n`;
const lib = (name: string, extra: Record<string, unknown> = {}): Library => {
  const r = decodeLibrarySource(manifest(name, extra));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const decodeHoldOf = (h: unknown): Hold => {
  const r = decodeHold(h);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const OWNER_INPUT = { kind: "owner-blocked", reason: "the owner publishes the fleet libraries together" } as const;
const UNFINISHED_INPUT = { kind: "unfinished", reason: "built, but nothing runs on it yet", missing: ["its first consumer"], liftedWhen: "the first consumer runs on it" } as const;
const TESTS_INPUT = { kind: "tests-only", reason: "disposable machines that nothing depends on at run time" } as const;
const OWNER = decodeHoldOf(OWNER_INPUT);
const UNFINISHED = decodeHoldOf(UNFINISHED_INPUT);
const TESTS = decodeHoldOf(TESTS_INPUT);

proves([`${SPEC} FR-024`], "a library with no hold is released; a hold is one of the closed kinds with its text, an unfinished one names what is missing and what lifts it, and any other shape is refused", () => {
  assertEquals(lib("desired-os-state").held, undefined);
  assertEquals([...HOLD_KINDS], ["tests-only", "unfinished", "owner-blocked"]);
  assertEquals(lib("desired-os-state", { held: OWNER_INPUT }).held, OWNER);
  assertEquals(lib("desired-os-state", { held: UNFINISHED_INPUT }).held, UNFINISHED);
  assertEquals(lib("desired-os-state", { held: TESTS_INPUT }).held, TESTS);
  // the text is one trimmed non-empty line, and the kind is one of the three
  const refused = (held: unknown): string => {
    const r = decodeLibrarySource(manifest("desired-os-state", { held }));
    assert(r.kind === "err", `${JSON.stringify(held)} is refused`);
    return r.error;
  };
  assertStringIncludes(refused("not published yet"), "library.held is");
  assertStringIncludes(refused({ kind: "later", reason: "x" }), "library.held is");
  assertStringIncludes(refused({ kind: "owner-blocked", reason: "" }), "library.held.reason");
  assertStringIncludes(refused({ kind: "owner-blocked", reason: " padded " }), "library.held.reason");
  assertStringIncludes(refused({ kind: "owner-blocked" }), "library.held.reason");
  assertStringIncludes(refused({ kind: "owner-blocked", reason: "x", liftedWhen: "y" }), "library.held.liftedWhen");
  assertStringIncludes(refused({ kind: "unfinished", reason: "x", missing: ["a"] }), "library.held.liftedWhen");
  assertStringIncludes(refused({ kind: "unfinished", reason: "x", liftedWhen: "y" }), "library.held.missing");
  assertStringIncludes(refused({ kind: "unfinished", reason: "x", liftedWhen: "y", missing: [] }), "library.held.missing");
  assertStringIncludes(refused({ kind: "unfinished", reason: "x", liftedWhen: "y", missing: [""] }), "library.held.missing[0]");
  assertEquals(decodeHold(null).kind, "err");
  assertEquals(decodeHold([]).kind, "err");
});

proves([`${SPEC} FR-024`], "a held library may declare any distribution and is refused with publishes or bundle; without a hold a distribution of no registry is still refused", () => {
  assertEquals(lib("desired-os-state", { held: OWNER_INPUT, distribution: [] }).distribution, []);
  assertEquals(lib("desired-os-state", { held: OWNER_INPUT, distribution: ["npm"] }).distribution, ["npm"]);
  const both = decodeLibrarySource(manifest("desired-os-state", { held: OWNER_INPUT, publishes: "@intellectual-frontiers/other" }));
  assert(both.kind === "err");
  assertStringIncludes(both.error, "library.held");
  assertEquals(decodeLibrarySource(manifest("foundation", { held: OWNER_INPUT, bundle: "foundation" })).kind, "err");
  assertEquals(decodeLibrarySource(manifest("desired-os-state", { distribution: [] })).kind, "err");
});

proves([`${SPEC} FR-024`], "a held library is in no set even where it declares npm, and every hold says itself in one sentence", () => {
  assertEquals(isConsumerFacing(lib("desired-os-state", { held: OWNER_INPUT, distribution: ["github", "npm"] })), false);
  assertEquals(isConsumerFacing(lib("widget", { distribution: ["github", "npm"] })), true);
  assertEquals(holdSentence(TESTS), "tests only: disposable machines that nothing depends on at run time");
  assertEquals(holdSentence(OWNER), "owner-blocked: the owner publishes the fleet libraries together");
  assertEquals(holdSentence(UNFINISHED), "unfinished (missing its first consumer): built, but nothing runs on it yet; lifted when the first consumer runs on it");
});

proves([`${SPEC} FR-024`, `${SPEC} FR-026`], "the plan says for each library that is not released the kind of its hold and its text, --raise of one says so, and the README row says not released with the kind", () => {
  const slug = slugOf(lib("widget", { distribution: ["github", "npm"] }).name);
  if (slug === undefined) throw new Error("widget is a slug");
  const facts: Facts = {
    slug,
    folder: "commons/widget",
    package: "@intellectual-frontiers/widget",
    version: "0.1.0",
    imports: [],
    last: undefined,
    changed: false,
    impact: "patch",
    publish: true,
    registry: "absent",
    sinceVersion: { changed: false, impact: "patch" },
    exportsChange: undefined,
  };
  const held = [
    { name: "desired-os-state", hold: OWNER },
    { name: "lab", hold: TESTS },
  ];
  const planned = planRelease([facts], new Map(), held);
  assert(planned.kind === "ok");
  assertEquals(planned.value.steps.map((s) => s.slug as string), ["widget"]);
  assertEquals(planned.value.held.map((h) => h.name), ["desired-os-state", "lab"]);
  const lines = planLines({ tty: false, colour: false, emoji: false, columns: 80 }, planned.value);
  assertEquals(lines.filter((l) => l.includes("not released")).length, 2);
  assert(lines.some((l) => l.includes("desired-os-state not released") && l.includes("owner-blocked: the owner publishes the fleet libraries together")));
  assert(lines.some((l) => l.includes("lab not released") && l.includes("tests only:")));
  const raised = planRelease([facts], new Map([["desired-os-state", undefined]]), held);
  assert(raised.kind === "err");
  assertStringIncludes(raised.error, "desired-os-state (not released: owner-blocked: the owner publishes the fleet libraries together)");
  const made = rowOf(lib("desired-os-state", { held: OWNER_INPUT }), "A program. More.");
  assert(made.kind === "ok");
  const row = tableOf([made.value]);
  assertStringIncludes(row, "not released (owner-blocked)");
});

proves([`${SPEC} FR-024`, `${SPEC} FR-026`], "on a real repository a library with a hold is left out of the facts and the record and is named in the plan with its reason, and one with none is released", async () => {
  const git = proc.which("git");
  if (git === undefined) return;
  await withTempDir(async (dir) => {
    const put = (file: string, text: string): void => {
      mkdirSync(join(dir, file, ".."), { recursive: true });
      writeTextFileSync(join(dir, file), text);
    };
    for (const [name, extra] of [["ready", {}], ["parked", { held: UNFINISHED_INPUT }]] as const) {
      put(`commons/${name}/library.ts`, manifest(name, { distribution: ["github", "npm"], ...extra }));
      put(`commons/${name}/package.json`, `${JSON.stringify({ name: `@x/${name}`, version: "0.1.0", exports: { ".": "./src/mod.ts" } }, null, 2)}\n`);
      put(`commons/${name}/src/mod.ts`, `export const ${name} = 1;\n`);
    }
    for (const a of [["init", "-q", "-b", "main"], ["add", "."], ["commit", "-q", "-m", "Start"]] as const) {
      const r = await proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
      assertEquals(r.code, 0, r.stderr);
    }
    const planned = await releasePlan(dir, { registry: offlineRegistry, published: offlinePublishedExports, mode: "per-library" });
    assert(planned.kind === "ok", planned.kind === "err" ? planned.error : "");
    assertEquals(planned.value.steps.map((s) => s.slug as string), ["ready"]);
    assertEquals(planned.value.held.map((h) => `${h.name} ${h.hold.kind}`), ["parked unfinished"]);
    assertEquals(readLibraries(dir).filter((f) => "library" in f && f.library.held !== undefined).length, 1);
  });
});
