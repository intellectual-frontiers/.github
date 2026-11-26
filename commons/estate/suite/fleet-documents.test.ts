/**
 * Tests of the documents of a fleet (commons estate 0005-estate-fleet-documents FR-001 to FR-007): each type of document written and read back, an asset read through the estate's rules, a newer version
 * refused, the layouts that give back the key of each path, an identity that is a path refused before any path is made, an observation with no source refused, and evidence that holds a digest and no bytes.
 * Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { expectAbsent, expectAny, refused as refusedProblem, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { makeStore, opCapabilitiesOf } from "@intellectual-frontiers/anyfs/logical";
import { err } from "@intellectual-frontiers/core";
import type { Json } from "@intellectual-frontiers/grc/governance";
import { parseDocId } from "@intellectual-frontiers/anyfs/docs";
import { path as fsPath, fs } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { assetCodec, declarationCodec, flatById, FLEET_LAYOUT, FLEET_SCHEMA, instantOf, manifestCodec, observationCodec, observationKey, shardedById, evidenceCodec, acceptancesCodec, inputOf, openFleetStore } from "../src/physical/mod.ts";
import { adopted, bytes, fleetOf, managed, named, path, ticking } from "./support.ts";

const HERE = fsPath.resolve(fsPath.dirname(fsPath.fromFileUrl(import.meta.url)), "..");
const AT = "2026-11-20T10:00:00Z";

proves(["0005-estate-fleet-documents FR-001"], "the physical layer does no input or output of its own: it imports no file, network or process module, only the libraries its row of the table names", async () => {
  const files = [...(await runtime.readSources(HERE, ["src/physical"]))];
  assert(files.length >= 6, "the sources are read");
  const io = /from "node:|\bBun\.|\bfetch\(|\bDeno\.|from "@intellectual-frontiers\/(system|net)/;
  for (const f of files) assertEquals(io.test(f.text), false, `${f.path} does input or output`);
  const text = await fs.readTextFile(fsPath.join(HERE, "package.json"));
  assert(text.includes('"./physical": "./src/physical/mod.ts"'), "the package exports the layer");
});

proves(["0005-estate-fleet-documents FR-002"], "an asset is kept as one document and read back as the same asset, and a stored asset that breaks a rule of the estate is a finding and not an asset", async () => {
  const { fleet, store } = await fleetOf();
  for (const a of [adopted("synthetic-server-01"), managed("synthetic-server-02")]) {
    const saved = await fleet.putAsset(a, expectAbsent);
    assert(saved.kind === "ok" && saved.value.created, `${a.id} is written`);
    const got = await fleet.getAsset(a.id);
    assert(got.kind === "ok");
    assertEquals(got.value.value, a);
    assertEquals(inputOf(got.value.value).id, a.id);
  }
  // an adopted asset that names an owner for a capability its state does not offer: written by hand below the layer
  const broken = JSON.stringify({ id: "synthetic-server-03", kind: "server", state: "adopted", origin: "paired", owners: { observe: "desired-os-state", verify: "desired-os-state", access: "desired-os-state", converge: "desired-os-state" }, $version: 1 });
  assert((await store.write(path("assets/s/synthetic-server-03.json"), bytes(broken), expectAny)).kind === "ok");
  const listed = await fleet.listAssets();
  assert(listed.kind === "ok");
  assertEquals(listed.value.docs.map((d) => d.value.id), ["synthetic-server-01", "synthetic-server-02"]);
  assertEquals(listed.value.findings.map((f) => `${f.kind} ${f.path}`), ["undecodable assets/s/synthetic-server-03.json"]);
});

proves(["0005-estate-fleet-documents FR-003"], "each type of document is written at version 1 with its version field, and one written at a newer version is refused as a newer version and never read as the current one", async () => {
  for (const [name, codec, value] of [
    ["asset", assetCodec, adopted("synthetic-server-01")],
    ["manifest", manifestCodec, { store: "example", schema: FLEET_SCHEMA, layout: FLEET_LAYOUT, created: AT }],
    ["declaration", declarationCodec, { asset: "synthetic-server-01", declared: { os: "linux" }, by: "operator", at: AT }],
    ["acceptances", acceptancesCodec, { asset: "synthetic-server-01", risks: [{ policy: "disk-encryption", reason: "holds only open-source code", by: "an owner", until: "2027-03-01" }] }],
    ["evidence", evidenceCodec, { subject: "synthetic-server-01", digest: "a".repeat(64), store: "evidence", type: "config", observedAt: AT }],
    ["observation", observationCodec, { asset: "synthetic-server-01", at: AT, source: "probe", state: { os: "linux" }, results: [] }],
  ] as const) {
    const encoded = (codec as { encode(v: unknown): { kind: string; value?: Uint8Array } }).encode(value);
    assert(encoded.kind === "ok" && encoded.value !== undefined, `${name} encodes`);
    assert(new TextDecoder().decode(encoded.value).includes('"$version": 1'), `${name} says its version`);
    const text = new TextDecoder().decode(encoded.value).replace('"$version": 1', '"$version": 9');
    const read = (codec as { decode(b: Uint8Array): { kind: string; error?: { reason: string } } }).decode(bytes(text));
    assert(read.kind === "err" && read.error?.reason === "newer-version", `${name} written at version 9 is refused as newer`);
  }
});

proves(["0005-estate-fleet-documents FR-004"], "the layouts name the documents: the shard is the first character, an observation is named by its instant so that the names sort as the instants do, and every layout gives back the key of each path it makes", () => {
  const key = parseDocId("synthetic-server-01");
  assert(key.kind === "ok");
  const p = shardedById.path(key.value);
  assert(p.kind === "ok");
  assertEquals(p.value, "s/synthetic-server-01.json");
  const back = shardedById.key(p.value);
  assert(back.kind === "ok");
  assertEquals(back.value, "synthetic-server-01");
  assertEquals(shardedById.key(path("z/synthetic-server-01.json")).kind, "err", "a file in the wrong shard is not a document");
  assertEquals(flatById.key(path("a/b.json")).kind, "err", "a file below a folder is not a document of a flat folder");
  const a = observationKey("2026-11-20T09:59:59Z");
  const b = observationKey("2026-11-20T10:00:00Z");
  const c = observationKey("2026-11-20T10:00:00.5Z");
  assert(a.kind === "ok" && b.kind === "ok" && c.kind === "ok");
  assertEquals([a.value, b.value, c.value], ["20261120T095959.000Z", "20261120T100000.000Z", "20261120T100000.500Z"]);
  assert(a.value < b.value && b.value < c.value, "the names sort as the instants do");
  assertEquals(instantOf(Date.UTC(2026, 10, 20, 10)), "2026-11-20T10:00:00.000Z");
});

proves(["0005-estate-fleet-documents FR-005"], "an identity that is a path, a dot-dot, a space or a control character is refused as a value before any path is made, for every operation that names a folder or a file", async () => {
  const { fleet, store } = await fleetOf();
  const count = async (): Promise<number> => {
    const listed = await store.list(ROOT, { limit: 1000 });
    assert(listed.kind === "ok");
    return listed.value.entries.length;
  };
  const before = await count();
  for (const bad of ["../x", "a/b", "A", "x y", "x\u0000", "..", "", "a".repeat(101), "-x"]) {
    assertEquals((await fleet.getAsset(bad)).kind, "err", `getAsset ${JSON.stringify(bad)}`);
    assertEquals((await fleet.observationsOf(bad)).kind, "err", `observationsOf ${JSON.stringify(bad)}`);
    assertEquals((await fleet.latestObservation(bad)).kind, "err");
    assertEquals((await fleet.declarationOf(bad)).kind, "err");
    assertEquals((await fleet.risksOf(bad)).kind, "err");
    assertEquals((await fleet.evidenceOf(bad)).kind, "err");
    assertEquals((await fleet.recordObservation({ asset: bad, at: AT, source: "probe", state: {} })).kind, "err");
    assertEquals((await fleet.declare(bad, {}, expectAbsent)).kind, "err");
    assertEquals((await fleet.recordEvidence({ subject: bad, digest: "a".repeat(64), store: "e", type: "t", observedAt: AT })).kind, "err");
  }
  assertEquals(await count(), before, "nothing was written");
});

proves(["0005-estate-fleet-documents FR-006"], "an observation names a source and a calendar instant and carries its results; one with no source, a false instant or a result that is no status is refused", async () => {
  const { fleet } = await fleetOf();
  assertEquals((await fleet.recordObservation({ asset: "synthetic-server-01", at: AT, source: " ", state: {} })).kind, "err", "no source");
  assertEquals((await fleet.recordObservation({ asset: "synthetic-server-01", at: "2026-13-40T10:00:00Z", source: "probe", state: {} })).kind, "err", "no such instant");
  assertEquals((await fleet.recordObservation({ asset: "synthetic-server-01", at: "yesterday", source: "probe", state: {} })).kind, "err");
  const good = await fleet.recordObservation({ asset: "synthetic-server-01", at: AT, source: "probe", state: { os: "linux" }, results: [{ id: "disk-encryption", status: "pass", controls: ["CRY-05"] }] });
  assert(good.kind === "ok" && good.value.created);
  const latest = await fleet.latestObservation("synthetic-server-01");
  assert(latest.kind === "ok" && latest.value !== undefined);
  assertEquals(latest.value.results, [{ id: "disk-encryption", status: "pass", controls: ["CRY-05"] }]);
  assertEquals(latest.value.source, "probe");
});

proves(["0005-estate-fleet-documents FR-007"], "a reference to evidence holds the digest, the store, the subject and the type and never the bytes; a digest that is not 64 hexadecimal digits is not a reference, and the manifest holds the fleet, the schema and the layout", async () => {
  const { fleet } = await fleetOf();
  const ref = { subject: "synthetic-server-01", digest: "b".repeat(64), store: "evidence", type: "config", observedAt: AT, mediaType: "application/json", size: 12 };
  const first = await fleet.recordEvidence(ref);
  assert(first.kind === "ok" && first.value.created);
  assertEquals(first.value.path, `evidence/synthetic-server-01/${"b".repeat(64)}.json`);
  const second = await fleet.recordEvidence(ref);
  assert(second.kind === "ok" && !second.value.created, "the same reference again is not made again");
  const listed = await fleet.evidenceOf("synthetic-server-01");
  assert(listed.kind === "ok");
  assertEquals(listed.value.refs, [ref]);
  const read = await fleet.store.read(path(`evidence/synthetic-server-01/${"b".repeat(64)}.json`));
  assert(read.kind === "ok");
  const text = new TextDecoder().decode(read.value.bytes);
  assert(!text.includes('"bytes"') && text.includes(ref.digest), "the document holds the digest and no bytes");
  assertEquals(fleet.manifest.store, "record");
  assertEquals([fleet.manifest.schema, fleet.manifest.layout], [FLEET_SCHEMA, FLEET_LAYOUT]);
  const refused = await fleet.recordEvidence({ ...ref, digest: "xyz" });
  assertEquals(refused.kind, "err", "a digest that is not 64 hexadecimal digits is not a reference");
});

proves(["0005-estate-fleet-documents FR-005", "0005-estate-fleet-documents FR-006"], "a document too deep to be read back is refused when it is written, a large one is kept whole, one the store finds too large is the store's refusal, and nothing is written for any of them", async () => {
  const { fleet, store } = await fleetOf();
  const deep = (n: number): Json => (n === 0 ? "leaf" : { next: deep(n - 1) });
  const refused = await fleet.recordObservation({ asset: "synthetic-server-01", at: AT, source: "probe", state: { deep: deep(40) } });
  assertEquals(refused.kind, "err", "nested deeper than 32 levels is refused");
  const fine = await fleet.recordObservation({ asset: "synthetic-server-01", at: AT, source: "probe", state: { deep: deep(20) } });
  assert(fine.kind === "ok" && fine.value.created);
  const big: Record<string, Json> = {};
  for (let i = 0; i < 20_000; i++) big[`key-${i}`] = "x".repeat(40);
  const kept = await fleet.recordObservation({ asset: "synthetic-server-01", at: "2026-11-20T11:00:00Z", source: "probe", state: big });
  assert(kept.kind === "ok", "a document of about a megabyte is kept whole");
  const back = await fleet.latestObservation("synthetic-server-01");
  assert(back.kind === "ok" && back.value !== undefined && Object.keys(back.value.state).length === 20_000);
  // a store that finds a write too large says no, and the fleet store passes the refusal on
  const small = makeStore({
    id: store.id,
    place: store.place,
    consistency: store.consistency,
    traits: { ...store.traits, maxObject: 400 },
    capabilities: opCapabilitiesOf(store),
    handle: async (op) => (op.op === "write" && op.bytes.length > 400 ? err(refusedProblem("too-large", "the object is more than 400 bytes", op.path)) : store.handle(op)),
  });
  const limited = await openFleetStore({ primary: { name: named("record"), store: small }, actor: "operator", clock: ticking(Date.UTC(2026, 10, 20)) });
  assert(limited.kind === "ok");
  const tooLarge = await limited.value.recordObservation({ asset: "synthetic-server-02", at: AT, source: "probe", state: { text: "y".repeat(1000) } });
  assert(tooLarge.kind === "err" && tooLarge.error.kind === "documents" && tooLarge.error.problem.kind === "store" && tooLarge.error.problem.problem.kind === "refused");
  const none = await limited.value.observationsOf("synthetic-server-02");
  assert(none.kind === "ok" && none.value.observations.length === 0, "nothing was written");
});
