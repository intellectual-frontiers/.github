// Spec: 0004-planning-sources FR-004
/**
 * The laws of a lens as a check a source is given (0037-planning FR-023, FR-042): `checkLens` returns the laws a source breaks. (1) A patch that sets what the place already says has an empty plan and changes no
 * byte. (2) After a patch is written, `acquire` returns the observations it returned before with the change of that patch and no other, and only the file of the thing changed. (3) `acquire` of an unchanged place
 * twice returns the same observations in the same order with the same fingerprints. The harness makes a fresh place each time; a source that cannot write is held to the third law alone.
 *
 * @example
 * ```ts
 * import { checkLens } from "./conformance.ts";
 * // const broken = await checkLens(async () => ({ source, snapshot }), context);
 * ```
 *
 * @module
 */
import type { Actor, EventData, EventId, Instant, ItemId, Observation, ObservedState, Patch } from "@intellectual-frontiers/planning/governance";
import { makeEvent, makePatch } from "@intellectual-frontiers/planning/governance";
import { canonical } from "@intellectual-frontiers/planning/logical";
import { type Source } from "./source.ts";

/** A fresh place with its source, and a way to see every file of the place as text. */
export type LensHarness = { readonly source: Source; snapshot(): Promise<Readonly<Record<string, string>>> };

/** What the check needs to build a patch. */
export type LensContext = { readonly item: ItemId; readonly ids: () => EventId; readonly actor: Actor; readonly at: Instant; readonly maxObservations?: number };

/** The laws of a lens. */
export type LensLaw = "get-put" | "put-get" | "get-get";

/** A law a source breaks, and how. */
export type LawViolation = { readonly law: LensLaw; readonly message: string };

/** The event that says what a place already says of a state. */
function stateEvent(s: ObservedState): EventData {
  switch (s.kind) {
    case "open":
      return { type: "reopened" };
    case "in-progress":
      return { type: "started" };
    case "deferred":
      return { type: "deferred", ...(s.until === undefined ? {} : { until: s.until }), ...(s.untilText === undefined ? {} : { untilText: s.untilText }) };
    case "closed":
      return { type: "closed", reason: s.reason };
    default: {
      const never: never = s;
      return never;
    }
  }
}

/** The event that changes a state to another one a place can say: open things close, anything else reopens. */
function otherState(s: ObservedState): { readonly data: EventData; readonly state: ObservedState } {
  return s.kind === "closed" ? { data: { type: "reopened" }, state: { kind: "open" } } : { data: { type: "closed", reason: "completed" }, state: { kind: "closed", reason: "completed" } };
}

function patchOf(source: Source, ctx: LensContext, o: Observation, data: EventData): Patch | undefined {
  const event = makeEvent({ id: ctx.ids(), item: ctx.item, at: ctx.at, actor: ctx.actor }, data);
  if (event.kind === "err") return undefined;
  const patch = makePatch(source.name, source.place, event.value, o.fingerprint);
  return patch.kind === "ok" ? patch.value : undefined;
}

/** What the laws compare of an observation: its identity and its content, without the history a place keeps for itself (which grows with every write). */
const view = (os: readonly Observation[]): readonly string[] =>
  os.map((o) => {
    const { history: _history, ...content } = o.content;
    return canonical({ f: o.fingerprint, c: content });
  });

/** The laws a source breaks over the places the harness makes. Empty means the source keeps them on those places. */
export async function checkLens(make: () => Promise<LensHarness>, ctx: LensContext): Promise<readonly LawViolation[]> {
  const out: LawViolation[] = [];
  const first = await make();
  const a = await first.source.acquire();
  const b = await first.source.acquire();
  if (a.kind === "err" || b.kind === "err") return [{ law: "get-get", message: `acquire failed: ${a.kind === "err" ? JSON.stringify(a.error) : b.kind === "err" ? JSON.stringify(b.error) : ""}` }];
  if (canonical(a.value) !== canonical(b.value)) out.push({ law: "get-get", message: "acquire of an unchanged place twice gave different observations" });
  const writer = first.source.preview !== undefined && first.source.write !== undefined;
  if (!writer) return out;
  const limit = ctx.maxObservations ?? 6;
  for (const [i, o] of a.value.observations.slice(0, limit).entries()) {
    // law 1: setting what the place already says changes nothing
    {
      const h = await make();
      const before = await h.snapshot();
      const p = patchOf(h.source, ctx, o, stateEvent(o.content.state));
      const plan = p === undefined ? undefined : await h.source.preview?.(p);
      if (plan?.kind === "ok") {
        if (plan.value.effects.length > 0) out.push({ law: "get-put", message: `the plan of setting observation ${i + 1} to the state it has is not empty` });
        else {
          await h.source.write?.(plan.value);
          if (canonical(await h.snapshot()) !== canonical(before)) out.push({ law: "get-put", message: `writing the state observation ${i + 1} already has changed a byte` });
        }
      }
    }
    // law 2: a change is written and acquire shows it and no other change
    {
      const h = await make();
      const before = await h.snapshot();
      const read = await h.source.acquire();
      if (read.kind === "err") continue;
      const target = read.value.observations[i];
      if (target === undefined) continue;
      const change = otherState(target.content.state);
      const p = patchOf(h.source, ctx, target, change.data);
      if (p === undefined) continue;
      const plan = await h.source.preview?.(p);
      if (plan === undefined || plan.kind === "err") continue;
      if (plan.value.effects.length === 0) continue;
      const wrote = await h.source.write?.(plan.value);
      if (wrote === undefined || wrote.kind === "err") {
        out.push({ law: "put-get", message: `the write of the change to observation ${i + 1} failed` });
        continue;
      }
      const after = await h.source.acquire();
      if (after.kind === "err") continue;
      const expected = read.value.observations.map((x) => (x.fingerprint === target.fingerprint ? { ...x, content: { ...x.content, state: change.state } } : x));
      if (canonical(view(after.value.observations)) !== canonical(view(expected))) out.push({ law: "put-get", message: `after the change to observation ${i + 1} acquire did not return the observations with that change and no other` });
      const files = await h.snapshot();
      const touched = Object.keys({ ...before, ...files }).filter((k) => before[k] !== files[k]);
      const locatorPath = target.locator.kind === "file-span" ? target.locator.path : undefined;
      if (locatorPath !== undefined && touched.some((k) => k !== locatorPath)) out.push({ law: "put-get", message: `the change to observation ${i + 1} changed ${touched.filter((k) => k !== locatorPath).join(", ")}, which is not the file of the thing` });
    }
  }
  return out;
}
