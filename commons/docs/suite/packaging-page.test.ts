/**
 * The page of the packaging (docs 0001-docs FR-034): the guide's words, and what the evidence adds to them: the release now with the versions the registry holds, the package against its budget, the kinds, the largest libraries and the peers; nothing measured where no report is kept, and no trend.
 *
 * @module
 */
import { assert, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { packagingBlocks } from "../src/pages/packaging.ts";
import type { Evidence } from "../src/evidence.ts";
import { NONE } from "../src/evidence.ts";
import type { PackageReport } from "../src/package.ts";
import { buildSite } from "../src/site.ts";
import { CONFIG, freshBuild } from "./helpers.ts";

const kinds = { compiled: { files: 2, bytes: 3_000_000 }, source: { files: 2, bytes: 4_000_000 }, declaration: { files: 2, bytes: 1_000_000 }, data: { files: 1, bytes: 500_000 }, documentation: { files: 1, bytes: 10_000 }, package: { files: 1, bytes: 5_000 } };
const report: PackageReport = {
  name: "@intellectual-frontiers/commons",
  version: "9.9.9",
  total: { files: 9, bytes: 8_515_000, byKind: kinds },
  tarballBytes: 2_000_000,
  libraries: [
    { name: "small", files: 1, bytes: 10, byKind: {} },
    { name: "big", files: 8, bytes: 8_000_000, byKind: { compiled: { files: 1, bytes: 8_000_000 } } },
  ],
  dependencies: {},
  peerDependencies: { pg: ">=8" },
  optionalPeers: ["pg"],
  budget: { files: 10, apparentBytes: 10_000_000, tarballBytes: 4_000_000 },
};

const blocksWith = (evidence: Evidence): string => {
  const b = freshBuild();
  b.evidence = evidence;
  return JSON.stringify(packagingBlocks(b));
};

proves(["0001-docs FR-034"], "with a report and the registry the page has the versions, the budget, the kinds, the largest library first and the peers, and no trend", () => {
  const text = blocksWith({ ...NONE, packageReport: report, registry: { kind: "versions", versions: [{ version: "9.9.8", date: "2026-11-01" }, { version: "9.9.9", date: "2026-11-02" }] } });
  assertStringIncludes(text, "9.9.9");
  assert(text.indexOf("9.9.9") < text.indexOf("9.9.8"), "the newest version is first");
  assertStringIncludes(text, "90.0% of the budget");
  assertStringIncludes(text, "optional peer");
  assert(text.indexOf('"big"') < text.indexOf('"small"'), "the largest library is first");
  assertStringIncludes(text, "no trend is shown");
  assert(!text.includes('"kind":"trend"'), "no trend block");
});

proves(["0001-docs FR-034"], "without a report nothing is shown as measured and the page says how to make one; an unreadable registry is said, not guessed", () => {
  const none = blocksWith(NONE);
  assertStringIncludes(none, "No report of the package is kept");
  assertStringIncludes(none, "pack.ts --size");
  assert(!none.includes("of the budget"), "no share is shown");
  assertStringIncludes(none, "not confirmed");
  assertStringIncludes(blocksWith({ ...NONE, registry: { kind: "unreadable", why: "HTTP 403" } }), "HTTP 403");
});

proves(["0001-docs FR-034"], "the site of commons has the page under Repo Ops with the strategy of the guide, its generated part and its place in the section's map", async () => {
  const built = await buildSite(CONFIG);
  const page = built.pages.find((p) => p.path === "repo-ops/packaging.html");
  assert(page !== undefined && page.section === "repoops", "the page is in the section");
  const text = JSON.stringify(page?.blocks);
  for (const word of ["single", "npm.pkg.github.com", "ifcOptionalPeers", "package-clean", "The release now"]) assertStringIncludes(text, word);
  assertStringIncludes(JSON.stringify(built.pages.find((p) => p.path === "repo-ops/index.html")?.blocks), "packaging.html");
});
