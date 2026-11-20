/**
 * The families of libraries and the names held for them (commons 0027-commons-libraries FR-023, FR-024; libraries 0001-libraries FR-013): the manifest's `family` field is decoded, the reserved names are
 * found from data with no folder, and each side of a family held against the host's table is found by the check of the manifests.
 *
 * @module
 */
import { decodeTable, type Table } from "@intellectual-frontiers/kanon";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { decodeFamily, type Entry, familyFindings, matches, RESERVED, reservationFindings } from "../src/family.ts";
import { decodeLibrarySource } from "../src/libraries.ts";

const SCOPE = "@intellectual-frontiers/";

function table(form: unknown): Table {
  const r = decodeTable(form);
  assert(r.kind === "ok", r.kind === "err" ? r.error : "");
  return r.value;
}

const HOST = table({
  package: `${SCOPE}archon`,
  family: { dialect: "{host}-dialect-{name}", plugin: "{host}-{name}", contract: "./plugin" },
  units: [
    { folder: "src/governance/", layer: "governance" },
    { folder: "src/physical/dialect/", layer: "physical" },
  ],
  instances: [{ name: "ansible", instanceOf: "src/physical/dialect/", placement: "package" }],
  plugins: [{ noun: "server" }],
});
const extension = (name: string, host = `${SCOPE}archon`): Table =>
  table({ package: `${SCOPE}${name}`, extends: host, units: [{ folder: "src/", layer: "physical" }] });

const GOOD: readonly Entry[] = [
  { name: "archon", family: { host: "archon", role: "host" }, kanon: HOST },
  { name: "archon-dialect-ansible", family: { host: "archon", role: "dialect" }, kanon: extension("archon-dialect-ansible") },
  { name: "archon-server", family: { host: "archon", role: "plugin" }, kanon: extension("archon-server") },
  { name: "core" },
];

const manifest = (o: Readonly<Record<string, unknown>>): string =>
  `export const library = ${JSON.stringify({ name: "archon", verify: "bun run verify", version: "0.1.0", exports: ["."], ...o })};\n`;

proves(["0001-libraries FR-013"], "a manifest's family is decoded and refused where it is not a host and a role", () => {
  const r = decodeLibrarySource(manifest({ family: { host: "archon", role: "dialect" } }));
  assert(r.kind === "ok");
  assertEquals(r.value.family, { host: "archon", role: "dialect" });
  assertEquals(decodeLibrarySource(manifest({})).kind, "ok");
  const bad = decodeLibrarySource(manifest({ family: { host: "archon", role: "driver" } }));
  assert(bad.kind === "err");
  assertStringIncludes(bad.error, "family");
  assert(decodeLibrarySource(manifest({ family: { host: "Not A Name", role: "host" } })).kind === "err");
  assertEquals(decodeFamily({ host: "x", role: "host" }).kind, "ok");
});

proves(["0001-libraries FR-013"], "a host, a dialect and a plugin of one family that declare each other have no finding", () => {
  assertEquals(familyFindings(GOOD), []);
  assertEquals(reservationFindings(GOOD), []);
});

proves(["0001-libraries FR-013"], "a name the host's rule does not read as the role, a member nobody declared and a declared member nobody registered are found", () => {
  const swapped = GOOD.map((l) => (l.name === "archon-server" ? { ...l, family: { host: "archon", role: "dialect" as const } } : l));
  assert(familyFindings(swapped).some((s) => s.includes("does not read the name as a dialect")));
  const undeclared: readonly Entry[] = [
    ...GOOD,
    { name: "archon-device", family: { host: "archon", role: "plugin" }, kanon: extension("archon-device") },
  ];
  assert(familyFindings(undeclared).some((s) => s.includes("does not declare it as a plugin")));
  assert(familyFindings(GOOD.filter((l) => l.name !== "archon-dialect-ansible")).some((s) => s.includes("no library of that name")));
});

proves(["0001-libraries FR-013"], "a member whose table does not extend the host, a host that is not a host and a member with no family are found", () => {
  const stray = GOOD.map((l) => (l.name === "archon-server" ? { ...l, kanon: extension("archon-server", `${SCOPE}other`) } : l));
  assert(familyFindings(stray).some((s) => s.includes("extends:")));
  const noTable = GOOD.map((l) => (l.name === "archon-server" ? { name: l.name, ...(l.family === undefined ? {} : { family: l.family }) } : l));
  assert(familyFindings(noTable).some((s) => s.includes("extends:")));
  const noHost = GOOD.filter((l) => l.name !== "archon");
  assert(familyFindings(noHost).some((s) => s.includes("is not a library that declares family role host")));
  const wrongName = GOOD.map((l) => (l.name === "archon" ? { ...l, name: "arch", family: { host: "archon", role: "host" as const } } : l));
  assert(familyFindings(wrongName).some((s) => s.includes("a host is named as its family")));
  const bare = GOOD.map((l) => (l.name === "archon-server" ? { name: l.name } : l));
  assert(familyFindings(bare).some((s) => s.includes("declares no family")));
});

proves(["0001-libraries FR-013"], "the names held are data, and a library of the family may hold them and no other", () => {
  const names = (n: string): readonly string[] => reservationFindings([{ name: n }]);
  for (const held of ["archon", "archon-dialect-x", "archon-server", "signing", "gitops", "estate"]) assertEquals(names(held).length, 1, held);
  for (const free of ["archonic", "signing-tools", "gitops2", "estates", "data", "arch"]) assertEquals(names(free), [], free);
  assertEquals(reservationFindings([{ name: "archon-server", family: { host: "archon", role: "plugin" } }]), []);
  assertEquals(reservationFindings([{ name: "signing", family: { host: "signing", role: "host" } }]), []);
  assertEquals(names("signing").length, 1);
  assertEquals(reservationFindings([{ name: "archon", family: { host: "other", role: "host" } }]).length, 1);
  assert(matches({ kind: "prefix", prefix: "a-" }, "a-b") && !matches({ kind: "exact", name: "a" }, "a-b"));
  assertEquals(
    RESERVED.map((r) => (r.match.kind === "exact" ? r.match.name : `${r.match.prefix}*`)),
    ["archon", "archon-*", "signing", "gitops", "estate"],
  );
});
