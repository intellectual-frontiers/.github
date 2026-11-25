// Spec: 0005-workload-runs FR-004
/**
 * What every fold of run events starts from: the events of one work order that are events of one form, taken once each, in the order of their ids, whatever the order they arrived in. An event of another item, of another kind
 * of comment, of another form or a repeat of one is left out; one that starts with the prefix of run events and is not decoded by the form is refused by the form, and the fold reports it. Pure.
 *
 * @example
 * ```ts
 * import { takeEvents } from "./fold.ts";
 * // takeEvents("runbook", item, events).taken: the events of the form, in order
 * ```
 *
 * @module
 */
import type { EventId, ItemEvent, ItemId } from "@intellectual-frontiers/planning/governance";
import { type BuiltFormId, decodeEnvelope, EVENT_PREFIX } from "@intellectual-frontiers/workload/governance";

/** An event the fold did not take, and why. */
export type Refusal = { readonly event: EventId; readonly reason: string };

/** An event of the form, with its payload still to be decoded by the form. */
export type Taken = { readonly event: ItemEvent; readonly payload: Readonly<Record<string, unknown>> };

/** The events of a form on a work order in the order of their ids, and the ones the envelope refused. */
export function takeEvents(form: BuiltFormId, item: ItemId, events: readonly ItemEvent[]): { readonly taken: readonly Taken[]; readonly refused: readonly Refusal[] } {
  const seen = new Set<string>();
  const ordered = events.filter((e) => e.item === item && !seen.has(e.id) && seen.add(e.id)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const taken: Taken[] = [];
  const refused: Refusal[] = [];
  for (const ev of ordered) {
    if (ev.data.type !== "commented" || !ev.data.body.startsWith(EVENT_PREFIX)) continue;
    const env = decodeEnvelope(ev.data.body);
    if (env.kind === "err") {
      refused.push({ event: ev.id, reason: env.error });
      continue;
    }
    if (env.value.form === form) taken.push({ event: ev, payload: env.value.payload });
  }
  return { taken, refused };
}
