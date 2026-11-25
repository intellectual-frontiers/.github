// Spec: 0004-workload-projections FR-003, FR-005
/**
 * The dialect of a person: the checklist of each workload, whatever its form, each node with its kind, its derived autonomy, who acts, what stops for a person and the evidence to keep.
 *
 * @module
 */
import { DIALECTS } from "@intellectual-frontiers/workload/governance";
import { checklist, type DialectImpl } from "@intellectual-frontiers/workload/logical";

const info = DIALECTS.get("human");
if (info === undefined) throw new Error("the dialect human is registered by the core");

/** The dialect. */
export const dialect: DialectImpl = { info, render: (views) => [...views].sort((a, b) => (a.id < b.id ? -1 : 1)).map((v) => ({ path: `workload/${v.id}.md`, text: checklist(v) })) };
