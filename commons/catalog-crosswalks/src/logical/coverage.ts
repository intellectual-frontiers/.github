// Spec: 0002-crosswalks FR-006
/**
 * The coverage of a framework through a crosswalk (0002-crosswalks FR-006): a pure view of what the standings of the controls of one framework say about the controls of another, in the six standings of an assessment and never as a percentage. A row that still carries the words
 * `person-decision-required` is not counted: it is shown as undecided. A decided row of relationship `equal` hands its source's standing to the target; any other relationship gives at most `supported`, because a partial overlap shows that part of a control is met and not the whole of it.
 *
 * @example
 * ```ts
 * import { coverageOf } from "./coverage.ts";
 * coverageOf({ targets: ["B1"], mappings: [], standings: new Map(), pending: "person-decision-required" }).controls[0]?.standing; // "no-evidence"
 * ```
 *
 * @module
 */

/** The six standings of a control, from the assessment: what it comes to, from the one that says most to the one that says least. */
export const STANDINGS = ["met", "not-met", "not-applicable", "supported", "stale", "no-evidence"] as const;
/** A standing. */
export type Standing = (typeof STANDINGS)[number];

/** A row of a crosswalk, as the coverage reads it. */
export type Row = { readonly from: string; readonly to: string; readonly relationship: string; readonly strength: number; readonly note: string };

/** What a control of the target comes to, and what it comes from. */
export type Covered = {
  readonly control: string;
  readonly standing: Standing;
  /** The decided rows that reach the control, each with the standing of its source and what it gave. */
  readonly counted: readonly { readonly from: string; readonly relationship: string; readonly source: Standing; readonly gave: Standing }[];
  /** The rows that reach the control and have not been decided: they are not counted. */
  readonly undecided: number;
};

/** The view: each control of the target, and how many controls have each standing (a count, never a share). */
export type Coverage = { readonly controls: readonly Covered[]; readonly tally: Readonly<Record<Standing, number>> };

/** What a decided row gives to its target from its source's standing. */
function gives(relationship: string, source: Standing): Standing {
  if (relationship === "equal") return source;
  if (source === "met" || source === "supported") return "supported";
  if (source === "not-applicable") return "no-evidence";
  return source;
}

/** The order the standings of the rows that reach one control are joined in: the first that occurs is the standing of the control, so that a failure or a stale source is never hidden by a good one. */
const WORST: readonly Standing[] = ["not-met", "stale", "no-evidence", "supported", "met", "not-applicable"];

/** The coverage of `targets` (their URNs) through `mappings`, given the standing of each source control by its URN: a source with no standing is `no-evidence`. */
export function coverageOf(input: { readonly targets: readonly string[]; readonly mappings: readonly Row[]; readonly standings: ReadonlyMap<string, Standing>; readonly pending: string }): Coverage {
  const controls: Covered[] = input.targets.map((control) => {
    const rows = input.mappings.filter((m) => m.to === control);
    const counted = rows
      .filter((m) => !m.note.startsWith(input.pending))
      .map((m) => {
        const source = input.standings.get(m.from) ?? "no-evidence";
        return { from: m.from, relationship: m.relationship, source, gave: gives(m.relationship, source) };
      });
    const undecided = rows.length - counted.length;
    const gave = counted.map((c) => c.gave);
    const standing = gave.length === 0 ? "no-evidence" : (WORST.find((s) => gave.includes(s)) ?? "no-evidence");
    return { control, standing, counted, undecided };
  });
  const tally = Object.fromEntries(STANDINGS.map((s) => [s, controls.filter((c) => c.standing === s).length])) as Record<Standing, number>;
  return { controls, tally };
}
