/**
 * The ids of records read from another scheme (commons planning 0002-planning-core FR-010): a valid ULID gives its item or event id by a pure function, an id that is not a ULID gives its id from the time of its
 * event and the SHA-256 of the external id, so that two stores that read one file make the same ids; and the actors of a file by the rule of the configuration.
 *
 * @module
 */
import fc from "fast-check";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import * as records from "@intellectual-frontiers/planning/records";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { eventIdOfExternal, itemIdOfExternal, parseUlid, uuid7OfExternal, uuid7OfUlid, uuid7Text } from "@intellectual-frontiers/planning/logical";
import { idTime, parseEventId } from "@intellectual-frontiers/planning/governance";
import { ADA, must } from "./support.ts";
import { issueText, ULIDS, ulidOf } from "./erga-fixtures.ts";

const { DEFAULT_KNOWN_AGENTS, decodeIssueFile, describeReadFinding, readIssueFile } = records;

/** The fields of a UUID as RFC 9562 section 5.7 draws them. */
function fieldsOf(id: string) {
  const bits = BigInt(`0x${id.replaceAll("-", "")}`);
  return { ms: Number(bits >> 80n), version: Number((bits >> 76n) & 0xfn), randA: (bits >> 64n) & 0xfffn, variant: Number((bits >> 62n) & 0x3n), randB: bits & ((1n << 62n) - 1n) };
}

proves(["0002-planning-core FR-010"], "a ULID is read by the layout of the ULID text: 26 characters of Crockford's base 32 in either case, 48 bits of time and 80 of chance, and nothing above 7ZZZZZZZZZZZZZZZZZZZZZZZZZ", () => {
  const u = must(parseUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV"));
  // The time of the example of the ULID text, worked out here by the layout: ten characters of five bits each, most significant first.
  assertEquals(u.ms, [..."01ARZ3NDEK"].reduce((n, c) => n * 32 + "0123456789ABCDEFGHJKMNPQRSTVWXYZ".indexOf(c), 0));
  assertEquals(must(parseUlid("01arz3ndektsv4rrffq69g5fav")), u);
  assertEquals(must(parseUlid("7ZZZZZZZZZZZZZZZZZZZZZZZZZ")), { ms: 2 ** 48 - 1, random: (1n << 80n) - 1n });
  assertEquals(must(parseUlid("00000000000000000000000000")), { ms: 0, random: 0n });
  for (const bad of ["", "8ZZZZZZZZZZZZZZZZZZZZZZZZZ", "01ARZ3NDEKTSV4RRFFQ69G5FA", "01ARZ3NDEKTSV4RRFFQ69G5FAVV", "01ARZ3NDEKTSV4RRFFQ69G5FAI", "01ARZ3NDEKTSV4RRFFQ69G5FAL", "01ARZ3NDEKTSV4RRFFQ69G5FAO", "01ARZ3NDEKTSV4RRFFQ69G5FAU", "01ARZ3NDEKTSV4RRFFQ69G5FA-"]) {
    assert(parseUlid(bad).kind === "err", bad);
  }
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 2 ** 48 - 1 }), fc.bigInt({ min: 0n, max: (1n << 80n) - 1n }), (ms, random) => {
      const parsed = must(parseUlid(ulidOf(ms, random)));
      return parsed.ms === ms && parsed.random === random;
    }),
    { numRuns: 300 },
  );
});

proves(["0002-planning-core FR-010"], "the UUID version 7 of a ULID has the ULID's 48 bits of time as unix_ts_ms and the first 74 of its 80 random bits as rand_a and rand_b, with the version and the variant set", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 2 ** 48 - 1 }), fc.bigInt({ min: 0n, max: (1n << 80n) - 1n }), (ms, random) => {
      const id = must(uuid7OfUlid(ulidOf(ms, random)));
      assert(parseEventId(id).kind === "ok", id);
      const f = fieldsOf(id);
      const top74 = random >> 6n;
      return f.ms === ms && f.version === 7 && f.variant === 0b10 && f.randA === top74 >> 62n && f.randB === (top74 & ((1n << 62n) - 1n));
    }),
    { numRuns: 400 },
  );
  assertEquals(uuid7Text(0, 0n), "00000000-0000-7000-8000-000000000000");
  assertEquals(must(uuid7OfUlid("7ZZZZZZZZZZZZZZZZZZZZZZZZZ")), "ffffffff-ffff-7fff-bfff-ffffffffffff");
  assertEquals(must(uuid7OfUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV")), must(uuid7OfUlid("01arz3ndektsv4rrffq69g5fav")));
});

proves(["0002-planning-core FR-010"], "ULIDs of different times give ids in the order of their time, so that a history read from a file folds in the order the file's ids give", () => {
  fc.assert(
    fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 2 ** 48 - 1 }), fc.bigInt({ min: 0n, max: (1n << 80n) - 1n })), { minLength: 2, maxLength: 12 }), (parts) => {
      const ulids = parts.map(([ms, random]) => ulidOf(ms, random));
      const byUlid = [...ulids].sort();
      const ids = byUlid.map((u) => must(uuid7OfUlid(u)));
      return ids.every((id, i) => i === 0 || (ids[i - 1] ?? "") <= id);
    }),
    { numRuns: 200 },
  );
});

proves(["0002-planning-core FR-010"], "an id that is not a ULID gives its id from the time of its event and the SHA-256 of the source's name, a zero byte and the value, the same on any machine", async () => {
  const at = Date.UTC(2026, 10, 7, 13, 20, 23);
  const id = await uuid7OfExternal("event-files", "f-0123456789abcdef", at);
  const f = fieldsOf(id);
  const digest = BigInt(`0x${(await sha256("event-files\u0000f-0123456789abcdef")).slice(0, 20)}`) >> 6n;
  assertEquals([f.ms, f.version, f.variant, f.randA, f.randB], [at, 7, 0b10, digest >> 62n, digest & ((1n << 62n) - 1n)]);
  assertEquals(await uuid7OfExternal("event-files", "f-0123456789abcdef", at), id);
  assert((await uuid7OfExternal("other", "f-0123456789abcdef", at)) !== id, "another source's name gives another id");
  assert((await uuid7OfExternal("event-files", "f-0123456789abcdee", at)) !== id);
  assert(parseEventId(id).kind === "ok");
  // A ULID is read as a ULID, whatever the source and the time; another text as another scheme.
  const u = "01M6V2NP7R2SC1VBG5TSAK9GJD";
  assertEquals(must(await eventIdOfExternal("a", u, 1)), must(await eventIdOfExternal("b", u, 2)));
  assertEquals(String(must(await itemIdOfExternal("a", u, 1))), must(uuid7OfUlid(u)));
  assert(String(must(await eventIdOfExternal("a", "ev-f-1-opened", at))) !== String(must(await eventIdOfExternal("b", "ev-f-1-opened", at))));
  assertEquals(idTime(must(await eventIdOfExternal("a", "ev-f-1-opened", at))).ms, at);
});

const OPTIONS = { source: "event-files", agents: {}, knownAgents: DEFAULT_KNOWN_AGENTS } as const;

proves(["0002-planning-core FR-010"], "two stores that read one issue file make the same item and event ids, each id of the file is carried as an external id, and no id's wording says where it came from", async () => {
  const text = issueText(ULIDS.item, [
    { id: ULIDS.first, at: "2026-11-07T13:20:23Z", actor: { type: "person", id: "ada@example.test", name: "Ada" }, type: "opened", data: { title: "T", body: "B", labels: [], severity: "note", type: "commenting", blocker: false } },
    { id: ULIDS.second, at: "2026-11-07T13:25:00Z", actor: { type: "person", id: "ada@example.test", name: "Ada" }, type: "commented", data: { body: "c" } },
  ]);
  const file = must(decodeIssueFile(text));
  const a = must(await readIssueFile(file, OPTIONS));
  const b = must(await readIssueFile(file, OPTIONS));
  assertEquals(a, b);
  assertEquals(String(a.item), must(uuid7OfUlid(ULIDS.item)));
  assertEquals(a.events.map((e) => String(e.id)), [must(uuid7OfUlid(ULIDS.first)), must(uuid7OfUlid(ULIDS.second))]);
  assertEquals(a.events[0]?.external, [{ source: "event-files", value: ULIDS.item }, { source: "event-files", value: ULIDS.first }]);
  assertEquals(a.events[1]?.external, [{ source: "event-files", value: ULIDS.second }]);
  for (const e of a.events) assert(!JSON.stringify(e.id).toLowerCase().includes("erga") && !String(e.id).includes(ULIDS.first.toLowerCase()), "no history in the id");
});

proves(["0002-planning-core FR-010"], "an agent that a file records as a person is read as the file says, with a finding for each event, and as an agent acting for a person where the configuration says so; an agent with no rule is refused", async () => {
  const claude = { type: "person", id: "claude", name: "claude" } as const;
  const text = issueText(ULIDS.item, [
    { id: ULIDS.first, at: "2026-11-07T13:20:23Z", actor: claude, type: "opened", data: { title: "T", body: "B" } },
    { id: ULIDS.second, at: "2026-11-07T13:25:00Z", actor: claude, type: "commented", data: { body: "c" } },
    { id: ULIDS.third, at: "2026-11-07T13:26:00Z", actor: { type: "person", id: "ada@example.test", name: "Ada" }, type: "commented", data: { body: "d" } },
  ]);
  const file = must(decodeIssueFile(text));
  const plain = must(await readIssueFile(file, OPTIONS));
  assertEquals(plain.events.map((e) => e.actor.kind), ["person", "person", "person"]);
  assertEquals(plain.findings, [
    { kind: "agent-recorded-as-a-person", event: ULIDS.first, actor: "claude" },
    { kind: "agent-recorded-as-a-person", event: ULIDS.second, actor: "claude" },
  ]);
  assert(describeReadFinding(plain.findings[0] ?? { kind: "unknown-key", event: "", key: "" }).includes("records the agent claude as a person"));
  const ruled = must(await readIssueFile(file, { ...OPTIONS, agents: { claude: { actsFor: ADA } } }));
  assertEquals(ruled.events.map((e) => e.actor.kind), ["agent", "agent", "person"]);
  const first = ruled.events[0]?.actor;
  assert(first?.kind === "agent" && first.principal.id === ADA.id && first.basis === "configuration");
  assertEquals(ruled.findings, []);
  // A file that records a type of agent has no principal in its schema: with no rule it is invalid when read.
  const typed = must(decodeIssueFile(issueText(ULIDS.item, [{ id: ULIDS.first, at: "2026-11-07T13:20:23Z", actor: { type: "agent", id: "claude", name: "claude" }, type: "opened", data: { title: "T" } }])));
  const refused = await readIssueFile(typed, OPTIONS);
  assert(refused.kind === "err" && refused.error.message.includes("no principal"));
  assert((await readIssueFile(typed, { ...OPTIONS, agents: { claude: { actsFor: ADA } } })).kind === "ok");
});
