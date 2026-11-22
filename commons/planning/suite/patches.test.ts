/**
 * Tests of patches, capabilities, the outbox, previews and duplicates (commons planning 0003-planning-reconcile FR-007 to FR-010).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CAPABILITIES, capabilityFor, type Capability, makePatch, mayApply, opOf, PATCH_OPS, type Patch } from "@intellectual-frontiers/planning/governance";
import { decide, findDuplicates, previewOf, redeliver, route, similarity, type Plan } from "@intellectual-frontiers/planning/logical";
import { ADA, event, eventIds, itemId, must, SAMPLES } from "./support.ts";
import { emptyWorld, instant, itemsOf, observe, step } from "./world.ts";

const [E1] = eventIds(1);
const patchOf = (data: (typeof SAMPLES)[keyof typeof SAMPLES], place = "a.md", fingerprint?: string): Patch => {
  assert(E1 !== undefined, "an id");
  return must(makePatch("markdown", place, event(itemId(), E1, 1, ADA, data), fingerprint));
};

proves(["0003-planning-reconcile FR-008"], "a patch is made around one event for one explicit source and place, with the operation the event's type says, and is refused with no target", () => {
  const expected = {
    opened: "add-item", commented: "add-event", edited: "add-event", labeled: "add-event", assigned: "add-event", "severity-set": "add-event", "blocker-set": "add-event",
    started: "change-state", deferred: "change-state", closed: "change-state", reopened: "change-state", decided: "add-event", linked: "link", confirmed: "confirm",
  } as const;
  for (const [type, data] of Object.entries(SAMPLES)) {
    assertEquals(opOf(data), expected[type as keyof typeof expected]);
    assert(PATCH_OPS.includes(opOf(data)), "a member of the closed union");
  }
  assertEquals(patchOf(SAMPLES.closed).op, "change-state");
  assert(E1 !== undefined, "an id");
  const e = event(itemId(), E1, 1, ADA, SAMPLES.closed);
  assertEquals(makePatch("", "a.md", e).kind, "err");
  assertEquals(makePatch("markdown", "", e).kind, "err");
});

proves(["0003-planning-reconcile FR-009"], "a patch needs the capability of its kind, a source that appends events holds every type it can express, and any other source puts it in the outbox naming the capability", () => {
  const need: Record<string, Capability> = { opened: "create", closed: "close", reopened: "close", assigned: "assign", commented: "append-event", confirmed: "append-event", edited: "edit", linked: "edit" };
  for (const [type, cap] of Object.entries(need)) assertEquals(capabilityFor(patchOf(SAMPLES[type as keyof typeof SAMPLES])), cap);
  const closer = patchOf(SAMPLES.closed);
  assert(mayApply(closer, new Set<Capability>(["close"])), "close is enough");
  assert(mayApply(closer, new Set<Capability>(["append-event"])), "append event holds every type but create");
  assert(!mayApply(patchOf(SAMPLES.opened), new Set<Capability>(["append-event"])), "append event does not create");
  const routed = route(closer, { name: "sarif", capabilities: new Set<Capability>(["read"]) }, instant(1));
  assert(routed.kind === "outbox", "the outbox");
  assertEquals(routed.entry.waiting, { kind: "capability", capability: "close" });
  assertEquals(route(closer, { name: "md", capabilities: new Set<Capability>(["read", "close"]) }, instant(1)).kind, "apply");
  for (const c of CAPABILITIES) assert(typeof c === "string", "a closed list");
});

proves(["0003-planning-reconcile FR-009"], "an outbox entry is offered again to a source that can apply it, retargeted to that source and place, and the rest wait", () => {
  const closer = patchOf(SAMPLES.closed);
  const edit = patchOf(SAMPLES.edited);
  const a = route(closer, { name: "sarif", capabilities: new Set<Capability>(["read"]) }, instant(1));
  const b = route(edit, { name: "sarif", capabilities: new Set<Capability>(["read"]) }, instant(1));
  assert(a.kind === "outbox" && b.kind === "outbox", "both wait");
  const r = redeliver([a.entry, b.entry], { name: "md", capabilities: new Set<Capability>(["read", "close"]) }, "b.md");
  assertEquals(r.patches.map((p) => [p.source, p.place, p.op]), [["md", "b.md", "change-state"]]);
  assertEquals(r.waiting.length, 1);
});

proves(["0003-planning-reconcile FR-010"], "a write with no hash is a dry run, the hash of the preview applies it and any other is refused", async () => {
  const plan: Plan = { source: "markdown", place: "a.md", patch: patchOf(SAMPLES.closed), effects: [{ target: "a.md", expect: "sha256:1", after: "- [x] a\n", summary: "close a" }] };
  const dry = await decide(plan, undefined);
  assert(dry.kind === "dry-run", "dry run");
  const hash = dry.preview.hash;
  assertEquals((await decide(plan, hash)).kind, "apply");
  const stale = await decide(plan, "0".repeat(64));
  assert(stale.kind === "stale", "stale");
  const other: Plan = { ...plan, effects: [{ ...(plan.effects[0] ?? { target: "", expect: null, after: "", summary: "" }), after: "- [x] b\n" }] };
  assert((await previewOf(other)).hash !== hash, "another text is another hash");
  assertEquals((await decide(other, hash)).kind, "stale");
});

proves(["0003-planning-reconcile FR-007"], "likely duplicates are proposed as links of kind same as in a fixed order, nothing is merged, and a pair already linked is not proposed again", async () => {
  const obs = [
    await observe("md", "1", "Fix the login page redirect", { line: 1 }),
    await observe("md", "2", "Fix login page redirect loop", { line: 2 }),
    await observe("md", "3", "Write the book chapter", { line: 3 }),
  ];
  const { world } = await step(emptyWorld(), "md", obs);
  const items = itemsOf(world);
  const found = findDuplicates(items, 0.5);
  assertEquals(found.length, 1);
  assertEquals(found[0]?.link.kind, "same-as");
  assertEquals(found[0]?.state, "proposed");
  assertEquals(findDuplicates([...items].reverse(), 0.5), found);
  assertEquals(findDuplicates(items, 0.99).length, 0);
  assert(items.every((i) => i.state.kind === "open"), "both stay open");
  assertEquals(similarity("a b c", "a b c"), 1);
  assertEquals(similarity("", ""), 0);
});
