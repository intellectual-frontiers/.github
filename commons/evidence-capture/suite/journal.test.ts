/**
 * Tests of the journal and the due assets (commons evidence-capture 0002-evidence-capture-journal FR-001 to FR-005): the paths, the lines and their reading, the digest, the kind of entry of a look under each granularity, and which assets are due.
 * Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { defineCapturePolicy, type CapturePolicy } from "@intellectual-frontiers/estate/governance";
import { appendEntry } from "@intellectual-frontiers/grc/logical";
import { JOURNAL_TYPES } from "../src/governance/mod.ts";
import { decodeEntries, dueAssets, encodeEntry, entryTypeFor, journalPath, statePath, textDigest } from "../src/logical/mod.ts";

const policy = (input = {}): CapturePolicy => {
  const r = defineCapturePolicy(input);
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
};

proves(["0002-evidence-capture-journal FR-001"], "the journal has its seven kinds of entry", () => {
  assertEquals([...JOURNAL_TYPES], ["capture.changed", "capture.unchanged", "capture.unreachable", "capture.refused", "capture.unreadable", "push.failed", "seal"]);
});

proves(["0002-evidence-capture-journal FR-002"], "a day's file is by the day in UTC, a bad instant is refused, and the state of an asset has its path", () => {
  assertEquals(journalPath("2026-12-01T10:00:00Z"), "journal/2026/12/01.jsonl");
  assertEquals(journalPath("2026-12-01T23:30:00-05:00"), "journal/2026/12/02.jsonl");
  let threw = false;
  try { journalPath("yesterday"); } catch { threw = true; }
  assert(threw);
  assertEquals(statePath("olympia"), "state/olympia.json");
});

proves(["0002-evidence-capture-journal FR-003"], "an entry is a line, lines are read back in order, and the line that is not an entry is named", async () => {
  const e1 = await appendEntry(undefined, { at: "2026-12-01T10:00:00Z", type: "capture.changed", subject: "sparta", evidence: "ab".repeat(32) });
  const e2 = await appendEntry(e1, { at: "2026-12-01T10:15:00Z", type: "capture.unchanged", subject: "sparta", evidence: "ab".repeat(32) });
  const text = `${encodeEntry(e1)}\n${encodeEntry(e2)}`;
  assert(encodeEntry(e1).endsWith("}\n") && !encodeEntry(e1).slice(0, -1).includes("\n"));
  assertEquals(decodeEntries(text), { kind: "ok", value: [e1, e2] });
  assertEquals(decodeEntries(""), { kind: "ok", value: [] });
  const bad = decodeEntries(`${encodeEntry(e1)}not json\n`);
  assert(bad.kind === "err" && bad.error === "line 2 is not JSON");
  const wrong = decodeEntries('{"kind":"x"}\n');
  assert(wrong.kind === "err" && wrong.error === "line 1 is not an entry of the journal");
  assertEquals(await textDigest("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

proves(["0002-evidence-capture-journal FR-004"], "a changed state is an entry, the same state is one where every capture is journaled and only on the heartbeat otherwise, and a failure always is", () => {
  const every = policy();
  const beat = policy({ journal: { granularity: "changes-and-heartbeat", heartbeat: "PT30M" } });
  const same = { kind: "state", digest: "d1" } as const;
  const at = (before: Partial<{ digest: string; lastJournaledAt: string }>) => ({ digest: before.digest, lastJournaledAt: before.lastJournaledAt });
  assertEquals(entryTypeFor(same, at({}), every, "2026-12-01T10:00:00Z"), "capture.changed", "none kept yet");
  assertEquals(entryTypeFor(same, at({ digest: "d0" }), every, "2026-12-01T10:00:00Z"), "capture.changed");
  assertEquals(entryTypeFor(same, at({ digest: "d1" }), every, "2026-12-01T10:00:00Z"), "capture.unchanged");
  assertEquals(entryTypeFor(same, at({ digest: "d1", lastJournaledAt: "2026-12-01T09:45:00Z" }), beat, "2026-12-01T10:00:00Z"), undefined);
  assertEquals(entryTypeFor(same, at({ digest: "d1", lastJournaledAt: "2026-12-01T09:30:00Z" }), beat, "2026-12-01T10:00:00Z"), "capture.unchanged");
  assertEquals(entryTypeFor(same, at({ digest: "d1", lastJournaledAt: "2026-12-01T09:30:01Z" }), beat, "2026-12-01T10:00:00Z"), "capture.unchanged", "within a second");
  assertEquals(entryTypeFor(same, at({ digest: "d0" }), beat, "2026-12-01T10:00:00Z"), "capture.changed", "a change is always an entry");
  assertEquals(entryTypeFor(same, at({ digest: "d1" }), beat, "2026-12-01T10:00:00Z"), "capture.unchanged", "never journaled: a heartbeat now");
  for (const kind of ["unreachable", "refused", "unreadable"] as const) {
    assertEquals(entryTypeFor({ kind: "failure", failure: { kind, message: "x" } }, at({ digest: "d1", lastJournaledAt: "2026-12-01T09:59:00Z" }), beat, "2026-12-01T10:00:00Z"), `capture.${kind}`);
  }
});

proves(["0002-evidence-capture-journal FR-005"], "the assets due are those whose cadence has run or never looked at, in order, and a bad instant gives none", () => {
  const p = policy({ cadence: { perAsset: { olympia: "PT5M" } } });
  const assets = [{ id: "sparta", state: "adopted" }, { id: "athens", state: "managed" }, { id: "olympia", state: "managed" }] as const;
  const last: Record<string, string> = { sparta: "2026-12-01T09:45:00Z", athens: "2026-12-01T09:45:00Z", olympia: "2026-12-01T09:56:00Z" };
  assertEquals(dueAssets(p, assets, (id) => last[id], "2026-12-01T10:00:00Z"), ["athens"], "15 minutes for managed, a day for adopted, 5 for olympia");
  assertEquals(dueAssets(p, assets, (id) => last[id], "2026-12-01T10:01:00Z"), ["athens", "olympia"]);
  assertEquals(dueAssets(p, assets, () => undefined, "2026-12-01T10:00:00Z"), ["athens", "olympia", "sparta"], "never looked at");
  assertEquals(dueAssets(p, assets, (id) => last[id], "2026-12-02T09:45:00Z"), ["athens", "olympia", "sparta"]);
  assertEquals(dueAssets(p, assets, () => undefined, "now"), []);
  assertEquals(dueAssets(p, [{ id: "printer", state: "discovered" } as never], () => undefined, "2026-12-01T10:00:00Z"), [], "a discovered asset has no cadence");
});
