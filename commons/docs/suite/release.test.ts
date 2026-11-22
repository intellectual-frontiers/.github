/**
 * The release a build of the site describes (docs 0001-docs FR-033): the newest stable version of the registry is the version of every page's heading, title and footer; without a registry the version of package.json is shown and said to be unconfirmed; the commits since the release are counted only for the version the record names; a registry that could not be read is a finding and stops nothing.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import type { Finding } from "../src/check.ts";
import { document } from "../src/emit/html.ts";
import { readEvidence } from "../src/evidence.ts";
import type { Page } from "../src/model.ts";
import { compareVersions, parseRegistry, releaseSentence, resolveRelease } from "../src/published.ts";
import { buildSite } from "../src/site.ts";
import { CONFIG } from "./helpers.ts";

const reg = (...v: string[]) => ({ kind: "versions" as const, versions: v.map((version, i) => ({ version, date: `2026-11-${10 + i}` })) });

proves(["0001-docs FR-033"], "the newest stable version of the registry is the release, by the rules of semantic versioning, and a pre-release is never newer than its version", () => {
  assertEquals(resolveRelease({ registry: reg("0.4.0", "0.4.10", "0.4.2"), local: "0.9.9", commit: undefined, recorded: undefined, ahead: undefined })?.version, "0.4.10");
  assertEquals(resolveRelease({ registry: reg("0.5.0-beta.1", "0.4.2"), local: undefined, commit: undefined, recorded: undefined, ahead: undefined })?.version, "0.4.2");
  assert(compareVersions("1.0.0-rc.1", "1.0.0") < 0 && compareVersions("1.0.0-alpha", "1.0.0-alpha.1") < 0 && compareVersions("1.0.0-2", "1.0.0-10") < 0);
  const r = resolveRelease({ registry: reg("0.4.1", "0.4.2"), local: "0.4.3", commit: "abc", recorded: undefined, ahead: undefined });
  assertEquals(r?.source, "registry");
  assertEquals(r?.published.map((v) => v.version), ["0.4.2", "0.4.1"]);
});

proves(["0001-docs FR-033"], "without a registry the version of package.json is shown and said to be unconfirmed, never as the registry's, and a version ahead of the registry is not shown", () => {
  const none = resolveRelease({ registry: undefined, local: "0.4.2", commit: "abc12345", recorded: "0.4.2", ahead: 5 });
  assertEquals(none?.source, "package.json");
  assertEquals(none?.ahead, undefined);
  assertStringIncludes(releaseSentence("IF Commons", none ?? (undefined as never)), "not confirmed on the package registry");
  const failed = resolveRelease({ registry: { kind: "unreadable", why: "403" }, local: "0.4.2", commit: undefined, recorded: undefined, ahead: undefined });
  assertEquals(failed?.source, "package.json");
  const ahead = resolveRelease({ registry: reg("0.4.2"), local: "0.5.0", commit: undefined, recorded: undefined, ahead: undefined });
  assertEquals(ahead?.version, "0.4.2");
  assertEquals(resolveRelease({ registry: undefined, local: "not a version", commit: undefined, recorded: undefined, ahead: undefined }), undefined);
});

proves(["0001-docs FR-033"], "the commits since the release are counted only where the record names the version shown, and not for none", () => {
  assertEquals(resolveRelease({ registry: reg("0.4.2"), local: undefined, commit: "c", recorded: "0.4.2", ahead: 7 })?.ahead, 7);
  assertEquals(resolveRelease({ registry: reg("0.4.2"), local: undefined, commit: "c", recorded: "0.4.1", ahead: 7 })?.ahead, undefined);
  assertEquals(resolveRelease({ registry: reg("0.4.2"), local: undefined, commit: "c", recorded: "0.4.2", ahead: 0 })?.ahead, undefined);
  assertEquals(resolveRelease({ registry: reg("0.4.2"), local: undefined, commit: "c", recorded: "0.4.2", ahead: undefined })?.ahead, undefined);
});

proves(["0001-docs FR-033"], "registry.json is read as versions with their days, or as the reason the registry could not be read, and anything else is an error", () => {
  const ok = parseRegistry('{"versions":[{"version":"0.4.2","createdAt":"2026-11-21T20:10:00Z"},{"version":3},{"nope":1}]}');
  assertEquals("value" in ok && ok.value.kind === "versions" && ok.value.versions, [{ version: "0.4.2", date: "2026-11-21" }]);
  const bad = parseRegistry('{"error":"HTTP 403"}');
  assertEquals("value" in bad && bad.value, { kind: "unreadable", why: "HTTP 403" });
  for (const text of ["not json", "[]", '{"x":1}']) assert("error" in parseRegistry(text), text);
});

const page: Page = { path: "x/y.html", title: "T", description: "D", section: "overview", group: "G", order: 0, blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "x" }] }] };

proves(["0001-docs FR-033"], "every page has the version in its heading, its title and its footer, with the commit and a badge of the commits since the release", () => {
  const release = resolveRelease({ registry: reg("0.4.2"), local: "0.4.2", commit: "abc12345", recorded: "0.4.2", ahead: 3 });
  const html = document(page, { name: "IF Commons", repository: "https://example.test/r", pages: [page], ...(release === undefined ? {} : { release }) });
  assertStringIncludes(html, "<title>T · IF Commons v0.4.2</title>");
  assertStringIncludes(html, '<span data-version title="The newest version on the package registry, published 2026-11-10">v0.4.2</span>');
  assertStringIncludes(html, 'IF Commons <span data-version');
  assertStringIncludes(html, '<strong class="font-medium text-fd-foreground">IF Commons v0.4.2</strong> · published 2026-11-10');
  assertStringIncludes(html, '<code class="font-mono">abc12345</code>');
  assertStringIncludes(html, "3 commits since the release");
  const bare = resolveRelease({ registry: undefined, local: "0.4.2", commit: undefined, recorded: undefined, ahead: undefined });
  const unconfirmed = document(page, { name: "IF Commons", repository: "r", pages: [page], ...(bare === undefined ? {} : { release: bare }) });
  assertStringIncludes(unconfirmed, 'data-version title="The version of package.json: not confirmed on the package registry" class="text-fd-muted-foreground"');
  assertStringIncludes(unconfirmed, "not confirmed on the package registry");
  assert(!document(page, { name: "N", repository: "r", pages: [page] }).includes("data-version"), "a site with no package has no version");
});

proves(["0001-docs FR-033"], "an evidence file that says the registry could not be read is a typed finding with its reason, and the evidence is still read", async () => {
  const dir = await fs.makeTempDir({ prefix: "docs-registry-" });
  try {
    await fs.writeTextFile(path.join(dir, "registry.json"), '{"error":"HTTP 403: the token may not read packages"}\n');
    const found: Finding[] = [];
    const ev = readEvidence(dir, { results: "." }, found);
    assertEquals(ev.registry, { kind: "unreadable", why: "HTTP 403: the token may not read packages" });
    assertEquals(found.map((f) => f.problem.kind), ["registry-unreadable"]);
    assertStringIncludes(JSON.stringify(found), "HTTP 403");
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0001-docs FR-033"], "the site of commons names its package and has a version", async () => {
  const built = await buildSite(CONFIG);
  assert(built.release !== undefined, "the configuration names the package");
  assert(/^\d+\.\d+\.\d+/.test(built.release?.version ?? ""), "a version");
  assert(built.pages.length > 100, "the pages are made");
});
