/**
 * Tests of the typed documents of AnyFS (commons anyfs 0006-anyfs-documents FR-001 to FR-012): the codecs and their canonical bytes, the schema with its migrations and the refusal of a newer version, the
 * layouts and the law that a path gives its key back, collections over a store in memory and a store in a folder (a document with its revision, a put that states what it expects, a listing that finds the
 * bad objects beside the good ones, an update that retries where another writer got there first), what a collection may do in its type, and the codecs of the file formats.
 *
 * @module
 */
import fc from "fast-check";
import { number, object, string } from "@intellectual-frontiers/core";
import { fs, path as osPath } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  byDate,
  byId,
  bytesCodec,
  canonicalJson,
  collection,
  describeDocProblem,
  describeFinding,
  defineSchema,
  type DocId,
  jsonTree,
  layoutFindings,
  type Migration,
  parseDocId,
  parseExtension,
  parseIsoDate,
  sharded,
  textCodec,
  toJsonValue,
  VERSION_FIELD,
  versioned,
} from "../src/docs/mod.ts";
import { json5Tree, yamlTree } from "../src/docs/formats/mod.ts";
import { expectAbsent, expectAny, expectRev, type Path, parsePath, parsePrefix, type Prefix, ROOT } from "../src/governance/mod.ts";
import { only } from "../src/logical/mod.ts";
import { localStore } from "../src/physical/local/mod.ts";
import { memoryStore } from "../src/physical/memory/mod.ts";

const ok = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const p = (text: string): Path => ok(parsePath(text));
const prefix = (text: string): Prefix => ok(parsePrefix(text));
const id = (text: string): DocId => ok(parseDocId(text));
const ext = ok(parseExtension(".json"));
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

type Asset = { readonly name: string; readonly cores: number };
const assetDecoder = object({ name: string, cores: number });
const schemaV1 = ok(defineSchema({ current: 1, decoder: assetDecoder }));
const codecV1 = versioned(jsonTree, schemaV1);

proves(["0006-anyfs-documents FR-001"], "JSON is written canonically (keys in order, one newline) so that one value is one set of bytes, and anything that is not JSON is refused with its reason", () => {
  assertEquals(canonicalJson({ b: 1, a: [true, null], c: {} }), '{\n  "a": [\n    true,\n    null\n  ],\n  "b": 1,\n  "c": {}\n}\n');
  assertEquals(jsonTree.encode({ b: 1, a: 2 }), jsonTree.encode({ a: 2, b: 1 }));
  assertEquals(toJsonValue(undefined).kind, "err");
  assertEquals(toJsonValue(Number.NaN).kind, "err");
  assertEquals(toJsonValue(new Date(0)).kind, "err");
  assertEquals(toJsonValue(new Map()).kind, "err");
  assertEquals(toJsonValue({ a: 1n }).kind, "err");
  const deep = Array.from({ length: 80 }).reduce<unknown>((inner) => [inner], 1);
  assertEquals(toJsonValue(deep).kind, "err");
  assertEquals(toJsonValue({ a: [1, "x", null, { b: false }] }).kind, "ok");
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      const tree = toJsonValue(value);
      if (tree.kind === "err") return true;
      const written = jsonTree.encode(tree.value);
      if (written.kind === "err") return false;
      const read = jsonTree.decode(written.value);
      return read.kind === "ok" && canonicalJson(read.value.value) === canonicalJson(tree.value);
    }),
    { numRuns: 200 },
  );
});

proves(["0006-anyfs-documents FR-002"], "the bytes codec keeps the bytes, the text codec refuses what is not UTF-8, and a codec that cannot read ends with a malformed result and not an exception", () => {
  const raw = new Uint8Array([1, 2, 3]);
  const kept = bytesCodec.decode(raw);
  assert(kept.kind === "ok" && kept.value.value === raw && !kept.value.stale);
  const t = textCodec.decode(new Uint8Array([0xff, 0xfe]));
  assert(t.kind === "err" && t.error.reason === "malformed");
  const text = textCodec.decode(bytes("héllo"));
  assert(text.kind === "ok" && text.value.value === "héllo");
  const j = jsonTree.decode(bytes("{not json"));
  assert(j.kind === "err" && j.error.reason === "malformed");
  assertEquals(textCodec.encode("\ud800").kind, "err");
});

proves(["0006-anyfs-documents FR-003"], "a schema is refused whose migrations do not step from 1 to the version before the current one, in order, with none missing", () => {
  const up = (value: Record<string, unknown>) => ({ kind: "ok" as const, value: value as never });
  assertEquals(defineSchema({ current: 0, decoder: assetDecoder }).kind, "err");
  assertEquals(defineSchema({ current: 1.5, decoder: assetDecoder }).kind, "err");
  assertEquals(defineSchema({ current: 2, decoder: assetDecoder }).kind, "err");
  assertEquals(defineSchema({ current: 3, decoder: assetDecoder, migrations: [{ from: 2, up }, { from: 1, up }] }).kind, "err");
  assertEquals(defineSchema({ current: 3, decoder: assetDecoder, migrations: [{ from: 1, up }, { from: 2, up }] }).kind, "ok");
});

const v2Migrations: readonly Migration[] = [
  { from: 1, up: (v) => ({ kind: "ok", value: typeof v["label"] === "string" ? { name: v["label"], cores: 1 } : v }) },
];
const schemaV2 = ok(defineSchema({ current: 2, decoder: assetDecoder, migrations: v2Migrations }));
const codecV2 = versioned(jsonTree, schemaV2);

proves(["0006-anyfs-documents FR-004"], "a document is written at the current version and read at any older one through the migrations (and said to be stale), and one of a newer version or a bad shape is refused with its reason", () => {
  const written = ok(codecV2.encode({ name: "olympia", cores: 8 }));
  assertEquals(new TextDecoder().decode(written), `{\n  "$version": 2,\n  "cores": 8,\n  "name": "olympia"\n}\n`);
  const current = ok(codecV2.decode(written));
  assertEquals(current.value, { name: "olympia", cores: 8 });
  assertEquals(current.stale, false);
  const old = ok(codecV2.decode(bytes('{ "label": "lab" }')));
  assertEquals(old.value, { name: "lab", cores: 1 });
  assertEquals(old.stale, true);
  const v1 = ok(codecV2.decode(bytes(`{ "${VERSION_FIELD}": 1, "label": "lab" }`)));
  assertEquals(v1.stale, true);
  const newer = codecV2.decode(bytes(`{ "${VERSION_FIELD}": 3, "name": "x", "cores": 1 }`));
  assert(newer.kind === "err" && newer.error.reason === "newer-version");
  const bad = codecV2.decode(bytes(`{ "${VERSION_FIELD}": 2, "name": "x" }`));
  assert(bad.kind === "err" && bad.error.reason === "invalid");
  assertEquals(codecV2.decode(bytes(`{ "${VERSION_FIELD}": "two" }`)).kind, "err");
  assertEquals(codecV2.decode(bytes("[1]")).kind, "err");
  const refusing = ok(defineSchema({ current: 2, decoder: assetDecoder, migrations: [{ from: 1, up: () => ({ kind: "err", error: "cannot" }) }] }));
  assertStringIncludes(JSON.stringify(versioned(jsonTree, refusing).decode(bytes('{ "x": 1 }'))), "cannot");
  assertEquals(codecV2.encode({ name: "x", cores: Number.NaN }).kind, "err");
});

const same = <K>(a: K, b: K): boolean => JSON.stringify(a) === JSON.stringify(b);
const idArb = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._~@+=-]{0,40}$/);

proves(["0006-anyfs-documents FR-005"], "an identifier, an extension and a day are made only by their parsers, and each layout gives the key back from its path and names the paths that are none of its own", () => {
  assertEquals(parseDocId("a/b").kind, "err");
  assertEquals(parseDocId(".hidden").kind, "err");
  assertEquals(parseDocId("").kind, "err");
  assertEquals(parseDocId("x".repeat(129)).kind, "err");
  assertEquals(parseExtension("json").kind, "err");
  assertEquals(parseExtension(".JSON").kind, "err");
  assertEquals(parseIsoDate("2026-02-30").kind, "err");
  assertEquals(parseIsoDate("2026-13-01").kind, "err");
  assertEquals(parseIsoDate("2024-02-29").kind, "ok");
  assertEquals(parseIsoDate("2026-2-3").kind, "err");
  const flat = byId(ext);
  assertEquals(ok(flat.path(id("olympia"))), "olympia.json");
  assertEquals(flat.key(p("sub/olympia.json")).kind, "err");
  assertEquals(flat.key(p("olympia.txt")).kind, "err");
  assertEquals(flat.key(p(".json")).kind, "err");
  const shard = ok(sharded(ext, 2));
  assertEquals(ok(shard.path(id("olympia"))), "ol/olympia.json");
  assertEquals(shard.path(id("a")).kind, "err");
  assertEquals(shard.key(p("zz/olympia.json")).kind, "err");
  assertEquals(shard.key(p("olympia.json")).kind, "err");
  assertEquals(sharded(ext, 0).kind, "err");
  assertEquals(sharded(ext, 5).kind, "err");
  const day = byDate(ext);
  const key = { date: ok(parseIsoDate("2026-11-21")), id: id("run-1") };
  assertEquals(ok(day.path(key)), "2026/11/21/run-1.json");
  assertEquals(day.key(p("2026/13/21/run-1.json")).kind, "err");
  assertEquals(day.key(p("2026/11/run-1.json")).kind, "err");
  fc.assert(
    fc.property(fc.array(idArb, { maxLength: 20 }), (names) => {
      const keys = names.map(id);
      return layoutFindings(flat, keys, same).length === 0 && layoutFindings(ok(sharded(ext, 2)), keys.filter((k) => k.length >= 2), same).length === 0;
    }),
    { numRuns: 100 },
  );
  fc.assert(
    fc.property(fc.date({ min: new Date("1971-01-01"), max: new Date("2200-01-01"), noInvalidDate: true }), idArb, (d, name) => {
      const date = ok(parseIsoDate(d.toISOString().slice(0, 10)));
      return layoutFindings(day, [{ date, id: id(name) }], same).length === 0;
    }),
    { numRuns: 100 },
  );
  assertEquals(layoutFindings(shard, [id("a")], same).length, 1);
});

const assets = (store: ReturnType<typeof memoryStore>) => collection(store, { prefix: prefix("fleet/assets"), layout: byId(ext), codec: codecV1 });

proves(["0006-anyfs-documents FR-007"], "a document is put with what the put expects and read back with the revision it was written at, and a put over what is not as expected is the store's conflict", async () => {
  const store = memoryStore({ name: "fleet" });
  const docs = assets(store);
  const key = id("olympia");
  assertEquals(ok(docs.pathOf(key)), "fleet/assets/olympia.json");
  const created = ok(await docs.put(key, { name: "olympia", cores: 8 }, expectAbsent));
  assertEquals(created.created, true);
  const got = ok(await docs.get(key));
  assertEquals(got.value, { name: "olympia", cores: 8 });
  assertEquals(got.rev, created.rev);
  assertEquals(got.stale, false);
  const again = await docs.put(key, { name: "olympia", cores: 16 }, expectAbsent);
  assert(again.kind === "err" && again.error.kind === "store" && again.error.problem.kind === "conflict");
  const moved = ok(await docs.put(key, { name: "olympia", cores: 16 }, expectRev(created.rev)));
  assert(moved.rev !== created.rev);
  const stale = await docs.put(key, { name: "olympia", cores: 4 }, expectRev(created.rev));
  assert(stale.kind === "err" && stale.error.kind === "store");
  const same1 = ok(await docs.put(key, { name: "olympia", cores: 16 }, expectAny));
  assertEquals(same1.rev, moved.rev);
  const missing = await docs.get(id("nobody"));
  assert(missing.kind === "err" && missing.error.kind === "store" && missing.error.problem.kind === "missing");
  assertStringIncludes(describeDocProblem(missing.error), "nobody.json");
  assertEquals(ok(await docs.delete(key, expectRev(moved.rev))).existed, true);
  assertEquals(ok(await docs.delete(key, expectAny)).existed, false);
  const badKey = docs.pathOf("x" as unknown as DocId);
  assert(badKey.kind === "ok");
  const long = docs.put(id("a".repeat(128)), { name: "n", cores: 1 }, expectAny);
  assert((await long).kind === "ok");
  const unencodable = await docs.put(key, { name: "x", cores: Number.NaN }, expectAny);
  assert(unencodable.kind === "err" && unencodable.error.kind === "unencodable");
});

proves(["0006-anyfs-documents FR-006", "0006-anyfs-documents FR-008"], "a listing reads the documents of a prefix lazily, a page at a time, and names an object that is not a document as a finding beside the good ones, never as a failure", async () => {
  const store = memoryStore({ name: "fleet" });
  const docs = collection(store, { prefix: prefix("fleet/assets"), layout: byId(ext), codec: codecV1, pageSize: 3, readers: 2 });
  for (let i = 0; i < 8; i++) ok(await docs.put(id(`m${i}`), { name: `m${i}`, cores: i + 1 }, expectAbsent));
  ok(await store.write(p("fleet/assets/broken.json"), bytes("{nope"), expectAbsent));
  ok(await store.write(p("fleet/assets/wrong.json"), bytes('{"name":"x"}'), expectAbsent));
  ok(await store.write(p("fleet/assets/notes.txt"), bytes("hello"), expectAbsent));
  ok(await store.write(p("fleet/assets/sub/deep.json"), bytes("{}"), expectAbsent));
  ok(await store.write(p("fleet/other/x.json"), bytes("{}"), expectAbsent));
  const first = ok(await docs.list());
  assertEquals(first.docs.length + first.findings.length <= 3, true);
  assert(first.next !== undefined);
  const goodKeys: string[] = [];
  const findings: string[] = [];
  let pages = 0;
  for await (const item of docs.scan()) {
    pages++;
    if (item.kind === "doc") goodKeys.push(item.doc.key);
    else findings.push(`${item.finding.kind} ${item.finding.path}`);
  }
  assertEquals(pages, 12);
  assertEquals(goodKeys.sort(), ["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7"]);
  assertEquals(findings.sort(), ["foreign fleet/assets/notes.txt", "foreign fleet/assets/sub/deep.json", "undecodable fleet/assets/broken.json", "undecodable fleet/assets/wrong.json"]);
  const any = ok(await collection(store, { prefix: prefix("fleet/assets"), layout: byId(ext), codec: codecV1 }).list());
  assertStringIncludes(any.findings.map(describeFinding).join("\n"), "broken.json cannot be read as a document (malformed)");
  const fine = ok(await docs.list());
  assertEquals(fine.docs.every((d) => d.rev.startsWith("sha256:")), true);
  // every problem and every finding says itself in a sentence
  const at = p("a/b.json");
  const sentences = [
    describeDocProblem({ kind: "store", problem: { kind: "missing", path: at } }),
    describeDocProblem({ kind: "undecodable", path: at, reason: "invalid", detail: "x" }),
    describeDocProblem({ kind: "unencodable", detail: "x" }),
    describeDocProblem({ kind: "bad-key", detail: "x" }),
    describeDocProblem({ kind: "exhausted", path: at, attempts: 2 }),
    describeDocProblem({ kind: "refused", detail: "x" }),
    describeFinding({ kind: "foreign", path: at, detail: "x" }),
    describeFinding({ kind: "unreadable", path: at, problem: { kind: "missing", path: at } }),
  ];
  assertEquals(sentences.every((t) => t.length >= 10 && t.includes(" ")), true);
});

proves(["0006-anyfs-documents FR-009"], "an update reads, lets the caller decide and writes with the revision it read, and where another writer got there first it reads again and repeats, so that two concurrent updates both count", async () => {
  const store = memoryStore({ name: "fleet" });
  const counters = collection(store, { prefix: prefix("counters"), layout: byId(ext), codec: versioned(jsonTree, ok(defineSchema({ current: 1, decoder: object({ n: number }) }))), attempts: 10 });
  const key = id("visits");
  const bump = (c: { readonly n: number } | undefined) => ({ kind: "put" as const, value: { n: (c?.n ?? 0) + 1 } });
  const results = await Promise.all(Array.from({ length: 6 }, () => counters.update(key, (d) => bump(d?.value))));
  const done = results.map(ok);
  assertEquals(done.every((r) => r.kind === "put"), true);
  assertEquals(ok(await counters.get(key)).value, { n: 6 });
  assertEquals(Math.max(...done.map((r) => r.attempts)) > 1, true);
  const kept = ok(await counters.update(key, () => ({ kind: "keep" })));
  assertEquals(kept.kind, "kept");
  const removed = ok(await counters.update(key, () => ({ kind: "delete" })));
  assertEquals(removed.kind, "deleted");
  assertEquals(ok(await counters.update(key, () => ({ kind: "delete" }))).kind, "deleted");
  const made = ok(await counters.update(key, (d) => (d === undefined ? { kind: "put", value: { n: 100 } } : { kind: "keep" })));
  assert(made.kind === "put" && made.created);
  // a writer that always gets there first exhausts the attempts, and the problem says so
  let waits = 0;
  const hurried = collection(store, { prefix: prefix("counters"), layout: byId(ext), codec: codecV1ForCounter(), attempts: 3, pause: async () => void waits++ });
  const interfering = await hurried.update(key, async () => {
    ok(await store.write(p("counters/visits.json"), bytes(`{ "n": ${Math.random()} }`), expectAny));
    return { kind: "put", value: { n: 1 } };
  });
  assert(interfering.kind === "err" && interfering.error.kind === "exhausted" && interfering.error.attempts === 3);
  assertEquals(waits, 3);
  const failing = await hurried.update(id("x"), () => {
    throw new Error("the caller's function threw");
  }).catch((e: unknown) => String(e));
  assertStringIncludes(String(failing), "threw");
});
function codecV1ForCounter() {
  return versioned(jsonTree, ok(defineSchema({ current: 1, decoder: object({ n: number }) })));
}

proves(["0006-anyfs-documents FR-010"], "what a collection may do is in its type: no `put` without `write`, no `update` without `cas`, and no delete outcome of an update without `delete`; and an update on a store without `cas` refuses at run time, before it reads", async () => {
  const base = memoryStore({ name: "fleet" });
  const noCas = only(base, ["read", "write", "list", "stat", "delete"]);
  const docs = collection(noCas, { prefix: prefix("x"), layout: byId(ext), codec: codecV1 });
  // @ts-expect-error update needs a store with cas
  docs.update;
  const readOnlyDocs = collection(only(base, ["read", "list"]), { prefix: prefix("x"), layout: byId(ext), codec: codecV1 });
  // @ts-expect-error put needs a store that can write
  readOnlyDocs.put;
  // @ts-expect-error a store without cas takes no revision expectation
  docs.put(id("a"), { name: "a", cores: 1 }, expectRev("sha256:00" as never));
  ok(await docs.put(id("a"), { name: "a", cores: 1 }, expectAny));
  const cas = only(base, ["read", "write", "cas"]);
  const noDelete = collection(cas, { prefix: prefix("x"), layout: byId(ext), codec: codecV1 });
  // @ts-expect-error a store without delete has no delete outcome
  noDelete.update(id("a"), () => ({ kind: "delete" }));
  // the types are not the only guard: the object has every method at run time, and the checks of the store and of the collection answer in values
  const cheat = docs as unknown as { update(key: DocId, f: () => { kind: "keep" }): Promise<{ kind: string; error?: { kind: string } }> };
  const refused = await cheat.update(id("a"), () => ({ kind: "keep" }));
  assertEquals(refused.kind, "err");
  assertEquals(refused.error?.kind, "refused");
  const readerOnly = readOnlyDocs as unknown as { put(key: DocId, value: Asset, expect: typeof expectAny): Promise<{ kind: string; error?: { kind: string; problem?: { kind: string } } }> };
  const nope = await readerOnly.put(id("b"), { name: "b", cores: 1 }, expectAny);
  assertEquals(nope.kind, "err");
  assertEquals(nope.error?.problem?.kind, "refused");
});

proves(["0006-anyfs-documents FR-011"], "migrate writes each stale document again at the current version and leaves the others, and a collection over a store in a folder keeps the same laws as over memory", async () => {
  await fs.withTempDir(async (dir) => {
    const made = await localStore(dir, { create: true });
    const store = ok(made);
    const old = collection(store, { prefix: prefix("assets"), layout: ok(sharded(ext, 2)), codec: codecV1 });
    ok(await old.put(id("alpha"), { name: "alpha", cores: 2 }, expectAbsent));
    const docs = collection(store, { prefix: prefix("assets"), layout: ok(sharded(ext, 2)), codec: codecV2 });
    ok(await docs.put(id("bravo"), { name: "bravo", cores: 4 }, expectAbsent));
    ok(await store.write(p("assets/ch/charlie.json"), bytes('{ "label": "charlie" }'), expectAbsent));
    const before = ok(await docs.get(id("charlie")));
    assertEquals(before.stale, true);
    assertEquals(before.value, { name: "charlie", cores: 1 });
    const alphaBefore = ok(await docs.get(id("alpha")));
    assertEquals(alphaBefore.stale, true);
    const report = ok(await docs.migrate());
    assertEquals(report.scanned, 3);
    assertEquals(report.rewritten, 2);
    assertEquals(report.failures, []);
    const after = ok(await docs.get(id("charlie")));
    assertEquals(after.stale, false);
    assertEquals(after.value, { name: "charlie", cores: 1 });
    assertEquals(ok(await docs.migrate()).rewritten, 0);
    const text = await fs.readTextFile(osPath.join(dir, "assets", "ch", "charlie.json"));
    assertStringIncludes(text, `"${VERSION_FIELD}": 2`);
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => docs.update(id("bravo"), (d) => ({ kind: "put", value: { name: "bravo", cores: (d?.value.cores ?? 0) + i } }))));
    assertEquals(results.every((r) => r.kind === "ok"), true);
    assertEquals(ok(await docs.get(id("bravo"))).value.cores, 4 + 0 + 1 + 2 + 3);
    const refused = collection(only(store, ["read", "write", "list", "cas"]), { prefix: prefix("assets"), layout: ok(sharded(ext, 2)), codec: codecV2 });
    assertEquals((await refused.migrate()).kind, "ok");
  });
  const noCas = collection(only(memoryStore({ name: "m" }), ["read", "write", "list"]), { prefix: ROOT, layout: byId(ext), codec: codecV2 }) as unknown as { migrate(): Promise<{ kind: string; error?: { kind: string } }> };
  const r = await noCas.migrate();
  assertEquals(r.kind, "err");
  assertEquals(r.error?.kind, "refused");
});

proves(["0006-anyfs-documents FR-012"], "the codecs of the file formats read a tree from JSON5 and from YAML and write it back, and the document over them has a version like any other", () => {
  const tree = { name: "olympia", cores: 8, tags: ["a", "b"], nested: { ok: true, none: null } };
  for (const codec of [json5Tree, yamlTree]) {
    const written = ok(codec.encode(tree));
    const read = ok(codec.decode(written));
    assertEquals(canonicalJson(read.value), canonicalJson(tree));
  }
  const commented = ok(json5Tree.decode(bytes("// the asset\n{ name: 'olympia', cores: 8, }\n")));
  assertEquals(commented.value, { name: "olympia", cores: 8 });
  assertEquals(json5Tree.decode(bytes("{ name: ")).kind, "err");
  assertEquals(yamlTree.decode(bytes("a: [1, 2")).kind, "err");
  const asYaml = versioned(yamlTree, schemaV2);
  const doc = ok(asYaml.decode(bytes("label: lab\n")));
  assertEquals(doc.value, { name: "lab", cores: 1 });
  assertEquals(doc.stale, true);
  assertStringIncludes(new TextDecoder().decode(ok(asYaml.encode({ name: "x", cores: 2 }))), "$version");
  assertEquals(yamlTree.mediaType, "application/yaml");
  assertEquals(json5Tree.mediaType, "application/json5");
});
