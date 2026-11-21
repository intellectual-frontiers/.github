/**
 * The configuration of a repository (commons repoctl 0009-repoctl-config FR-001, FR-006): `parseConfig` makes the identities, fills the defaults and lists every reason a configuration is wrong at once, and the doctor policy and the names of the
 * variables are the configuration's.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { type ConfigInput, defineConfig, DEFAULT_READ_ONLY_VARIABLE, DEFAULT_TIER_VARIABLE, enabledVerbs, parseConfig } from "@intellectual-frontiers/repoctl/governance";
import { heldTier } from "@intellectual-frontiers/repoctl/physical";

const base: ConfigInput = defineConfig({ repo: "acme/app", commit: { identity: { name: "A B", email: "a@example.test" } } });

const reasons = (input: ConfigInput): readonly string[] => {
  const r = parseConfig(input);
  return r.kind === "err" ? r.error : [];
};

proves(["0009-repoctl-config FR-001"], "a minimal configuration is read with its defaults, and every reason a configuration is wrong is listed at once", () => {
  const ok = parseConfig(base);
  assert(ok.kind === "ok");
  assertEquals([ok.value.generators.length, ok.value.checks.length, ok.value.capabilities.release, ok.value.docs, ok.value.hygiene], [0, 0, false, undefined, undefined]);
  assertEquals(ok.value.commit.trailers, ["impact", "co-author", "session"]);
  const bad = reasons({
    ...base,
    generators: [
      { id: "a", command: ["x"], outputs: ["a.txt"], after: ["nothing"] },
      { id: "a", command: ["y"], outputs: [] },
      { id: "Not An Id", command: ["z"], outputs: ["z"] },
      { id: "fn", command: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }), outputs: ["f"] },
    ],
    checks: [{ id: "c", command: ["x"], code: "E-NOT-A-CODE" as never }],
    capabilities: { release: true },
    tierVariable: "lower",
    commit: { identity: { name: "", email: "nope" }, trailers: ["issue", "issue"], forbidden: { secrets: [{ pattern: "(", label: "broken" }] } },
    docs: { out: "../outside" },
  });
  for (const part of ["is not a generator", "used twice", "not an id", "gives its check as well", "is not a problem code", "need libraries", "not the name of an environment variable", "name and an email", "names a trailer twice", "not a regular expression", "inside the repository"])
    assert(bad.join("\n").includes(part), `${part}: ${bad.join(" | ")}`);
});

proves(["0009-repoctl-config FR-001"], "an issue prefix is required to name the issue trailer, and the verbs a configuration turns on are the capabilities, the hygiene policy and the docs settings", () => {
  assertStringIncludes(reasons({ ...base, commit: { ...base.commit, trailers: ["issue"] } }).join(" "), "gives no prefix");
  const on = parseConfig({ ...base, capabilities: { status: true, prove: true }, libraries: { folder: "libs" }, hygiene: { scope: "@acme/" }, docs: {} });
  assert(on.kind === "ok");
  assertEquals(enabledVerbs(on.value), ["status", "prove", "hygiene", "docs build", "docs serve", "docs check"]);
  assertEquals(enabledVerbs((parseConfig(base) as { value: Parameters<typeof enabledVerbs>[0] }).value), []);
  assertStringIncludes(reasons({ ...base, hygiene: { scope: "acme" } }).join(" "), "npm scope");
});

proves(["0009-repoctl-config FR-006"], "the doctor policy defaults to the install command alone, and the tier variable is the configuration's", () => {
  const ok = parseConfig({ ...base, tierVariable: "ACME_TIER", readOnlyVariable: "ACME_RO", doctor: { minNode: 22 } });
  assert(ok.kind === "ok");
  assertEquals([ok.value.tierVariable, ok.value.readOnlyVariable], ["ACME_TIER", "ACME_RO"]);
  assertEquals([ok.value.doctor.minNode, ok.value.doctor.bunPin, ok.value.doctor.links, ok.value.doctor.install], [22, undefined, undefined, "bun install --frozen-lockfile"]);
  const dflt = parseConfig(base);
  assert(dflt.kind === "ok");
  assertEquals([dflt.value.tierVariable, dflt.value.readOnlyVariable], [DEFAULT_TIER_VARIABLE, DEFAULT_READ_ONLY_VARIABLE]);
  const held = (name: string, value: string) => heldTier((n) => (n === name ? value : undefined), ok.value);
  assertEquals("tier" in held("ACME_TIER", "releaser"), true);
  assertEquals("unknown" in held("ACME_TIER", "admin"), true);
  assertEquals("tier" in held("REPOCTL_TIER", "admin"), true, "the default variable is not read where the configuration names another");
});
