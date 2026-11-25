// Spec: 0006-planning-poam FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * The plan of action and milestones and the work orders of Planning (0006-planning-poam), as two views over the items that add no kind of item and no kind of link. A POA&M entry is an item of kind `finding` that is not
 * closed; its milestones are the items of kind `task` it is the parent of, each with the day it is due (`due`, the field the kind `task` adds) and its owners (its assignees); its controls are the labels `control:<reference>`,
 * kept as written, because the reference belongs to the library that writes it. A work order is a task that carries a label `runbook:<id>` and is linked `relates-to` to what it serves. The views are pure functions of the
 * items and of a day that is an argument: the same items and day give the same rows in any order.
 *
 * @example
 * ```ts
 * import { poam } from "./poam.ts";
 * // poam(items, today).map((row) => [row.title, row.status, row.scheduledCompletion])
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Day, isCounted, type Instant, type Item, type ItemId, type Severity, type StateKind } from "@intellectual-frontiers/planning/governance";

/** Whether work is open, behind its day, or done. */
export type PoamStatus = "open" | "delayed" | "completed";

/** A milestone of a finding: a task it is the parent of. */
export type PoamMilestone = {
  readonly id: ItemId;
  readonly title: string;
  /** Its assignees. */
  readonly owners: readonly string[];
  readonly due?: Day;
  readonly state: StateKind;
  /** When it was closed as completed. */
  readonly completedAt?: Instant;
  readonly status: PoamStatus;
};

/** A row of the plan: a finding that is not closed with its milestones. */
export type PoamRow = {
  readonly id: ItemId;
  readonly title: string;
  readonly severity?: Severity;
  readonly state: StateKind;
  /** The control references of its labels `control:<reference>`, as written, sorted, each once. */
  readonly controls: readonly string[];
  /** The assignees of the finding. */
  readonly owners: readonly string[];
  readonly milestones: readonly PoamMilestone[];
  /** The latest `due` among its milestones; none where none has one. */
  readonly scheduledCompletion?: Day;
  readonly status: PoamStatus;
};

/** A work order: a task that runs a runbook for what it serves. */
export type WorkOrderRow = {
  readonly id: ItemId;
  readonly title: string;
  /** The ids after the labels `runbook:`, sorted. */
  readonly runbooks: readonly string[];
  /** The items it is linked to by `relates-to`, in either direction, sorted by id. */
  readonly serves: readonly ItemId[];
  readonly owners: readonly string[];
  readonly due?: Day;
  readonly state: StateKind;
  readonly status: PoamStatus;
};

/** The label prefix of a control reference. */
export const CONTROL_LABEL = "control:";
/** The label prefix of the runbook a work order runs. */
export const RUNBOOK_LABEL = "runbook:";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

type Dated = { readonly due?: Day; readonly id: ItemId };

/** The order of days with none last, then of ids. */
const byDueThenId = (a: Dated, b: Dated): number => {
  if (a.due === undefined && b.due !== undefined) return 1;
  if (a.due !== undefined && b.due === undefined) return -1;
  return (a.due === undefined || b.due === undefined ? 0 : byText(a.due, b.due)) || byText(a.id, b.id);
};

const withPrefix = (item: Item, prefix: string): readonly string[] => [...new Set(item.labels.filter((l) => l.startsWith(prefix) && l.length > prefix.length).map((l) => l.slice(prefix.length)))].sort(byText);

/** Whether an item is closed as it will not be done (the reason `not-planned` or `duplicate`): it is no longer part of a plan. */
const cancelled = (item: Item): boolean => item.state.kind === "closed" && item.state.reason !== "completed";

/** The status of a task from its state, its day due and the day given. */
function statusOf(item: Item, today: Day): PoamStatus {
  if (item.state.kind === "closed") return "completed";
  return item.due !== undefined && item.due < today ? "delayed" : "open";
}

const milestoneOf = (item: Item, today: Day): PoamMilestone => ({
  id: item.id,
  title: item.title,
  owners: item.assignees,
  ...(item.due === undefined ? {} : { due: item.due }),
  state: item.state.kind,
  ...(item.state.kind === "closed" ? { completedAt: item.state.at } : {}),
  status: statusOf(item, today),
});

function findingStatus(milestones: readonly PoamMilestone[]): PoamStatus {
  if (milestones.length > 0 && milestones.every((m) => m.status === "completed")) return "completed";
  if (milestones.some((m) => m.status === "delayed")) return "delayed";
  return "open";
}

/** The plan of action and milestones: a row for each counted finding that is not closed, with its milestones, at a day. */
export function poam(items: readonly Item[], today: Day): readonly PoamRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows = items
    .filter((i) => i.kind === "finding" && isCounted(i) && i.state.kind !== "closed")
    .map((finding): PoamRow => {
      const children = [...new Set(finding.links.filter((l) => l.kind === "parent-of" && l.from === finding.id).map((l) => l.to))]
        .map((id) => byId.get(id))
        .filter((i): i is Item => i !== undefined && i.kind === "task" && isCounted(i) && !cancelled(i));
      const milestones = children.map((c) => milestoneOf(c, today)).sort(byDueThenId);
      const scheduled = milestones.flatMap((m) => (m.due === undefined ? [] : [m.due])).sort(byText).at(-1);
      return {
        id: finding.id,
        title: finding.title,
        ...(finding.severity === undefined ? {} : { severity: finding.severity }),
        state: finding.state.kind,
        controls: withPrefix(finding, CONTROL_LABEL),
        owners: finding.assignees,
        milestones,
        ...(scheduled === undefined ? {} : { scheduledCompletion: scheduled }),
        status: findingStatus(milestones),
      };
    });
  const key = (r: PoamRow): Dated => ({ id: r.id, ...(r.scheduledCompletion === undefined ? {} : { due: r.scheduledCompletion }) });
  return rows.sort((a, b) => byDueThenId(key(a), key(b)));
}

/** The work orders: the counted tasks that carry a label `runbook:<id>` and are not cancelled, with what they serve, at a day. */
export function workOrders(items: readonly Item[], today: Day): readonly WorkOrderRow[] {
  const known = new Set(items.map((i) => i.id));
  return items
    .filter((i) => i.kind === "task" && isCounted(i) && !cancelled(i) && withPrefix(i, RUNBOOK_LABEL).length > 0)
    .map((wo): WorkOrderRow => {
      const out = wo.links.filter((l) => l.kind === "relates-to" && l.from === wo.id).map((l) => l.to);
      const into = items.flatMap((i) => i.links.filter((l) => l.kind === "relates-to" && l.to === wo.id).map((l) => l.from));
      const serves = [...new Set([...out, ...into])].filter((id) => known.has(id) && id !== wo.id).sort(byText);
      return { id: wo.id, title: wo.title, runbooks: withPrefix(wo, RUNBOOK_LABEL), serves, owners: wo.assignees, ...(wo.due === undefined ? {} : { due: wo.due }), state: wo.state.kind, status: statusOf(wo, today) };
    })
    .sort(byDueThenId);
}

/** A sentence for a status, for a person. */
export function describePoamStatus(s: PoamStatus): string {
  switch (s) {
    case "open":
      return "open";
    case "delayed":
      return "delayed: past its day due";
    case "completed":
      return "completed";
    default:
      return absurd(s);
  }
}
