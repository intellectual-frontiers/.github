/**
 * The events of Tier 2 of the quality system (commons 0021-ifqs FR-038 to FR-041), kept in the ledger beside those of Tier 1 as append-only,
 * chained files on the `quality` branch: a test plan registered before the run it governs, a sample drawn by a rule and a seed, a person's
 * attestation of that sample, and a mutation run.
 *
 * - A **plan** (`plan-registered`) names its cases and the acceptance criterion of each; a run that follows it records the plan's hash.
 * - A **sample** (`sample-drawn`) is chosen from a population by a named rule and a recorded seed, so that anyone can draw it again and get the
 *   same items; a person's **attestation** (`sample-attested`) gives the verdict on each item, with the person's name and role.
 * - A **mutation run** (`mutation-run`) is the record of a run made by a tool the record names; this system does not run it.
 *
 * @remarks
 * Only decoders and types here, so that `pure/ledger.ts` can take them into its union of events without a cycle: the rules that judge them are
 * in the files beside this one. The person in a record is data: a name and, where stated, a role, never inferred from anything else.
 *
 * @module
 */
import { array, type Decoded, integer, literal, object, refine, string } from "../../kernel/decode.ts";
import { dayDecoder } from "./time.ts";

const requirement = refine(string, "RequirementId", (s) => /^\S+ (?:FR|SC)-\d{3}[a-z]?$/.test(s));
const digest = refine(string, "Sha256", (s) => /^[0-9a-f]{64}$/.test(s));

/** A named person and, where stated, the role they act in: what a record says of who, and nothing more. */
export const personDecoder = object({ name: string }, { role: string });

/** A person as a record names them. */
export type PersonRef = Decoded<typeof personDecoder>;

/** One case of a test plan: its name, the requirements it proves and the criterion that makes it pass (FR-039). */
export const planCaseDecoder = object({ name: string, requirements: array(requirement), acceptance: string }, { file: string });

/** A test plan: what will be run, written down before it is run (FR-039). */
export const planDecoder = object({ title: string, cases: array(planCaseDecoder) });

/** A test plan as the record holds it. */
export type TestPlan = Decoded<typeof planDecoder>;

/** What a sample is drawn from. */
export const SAMPLE_SUBJECTS = ["runs", "records", "agent-reviews"] as const;

/** What a sample is drawn from: the runs kept as evidence, the files of the ledger, or the reviews that agents made (FR-041). */
export type SampleSubject = (typeof SAMPLE_SUBJECTS)[number];

/** The rule that chooses a sample: the items ranked by the SHA-256 of the seed and the item, the first of them taken. */
export const SAMPLE_RULE = "hash-ranked/1";

/** One row of a mutation run: the mutants made for a requirement's tests and what became of each (FR-040). */
export const mutationRowDecoder = object(
  { requirement, mutants: integer, killed: integer, survived: integer },
  { timeout: integer, noCoverage: integer, equivalent: integer },
);

/** A row of a mutation run. */
export type MutationRow = Decoded<typeof mutationRowDecoder>;

/** The events of Tier 2, as decoders by kind: the ledger puts them in its union. */
export const TIER2_EVENTS = {
  "plan-registered": object({ kind: literal("plan-registered"), id: string, plan: planDecoder, by: personDecoder, day: dayDecoder }),
  "sample-drawn": object(
    {
      kind: literal("sample-drawn"),
      id: string,
      subject: literal(...SAMPLE_SUBJECTS),
      rule: literal(SAMPLE_RULE),
      seed: string,
      population: object({ count: integer, sha256: digest }),
      size: integer,
      items: array(string),
      by: personDecoder,
      day: dayDecoder,
    },
    { ratePermille: integer },
  ),
  "sample-attested": object(
    {
      kind: literal("sample-attested"),
      sample: string,
      results: array(object({ item: string, verdict: literal("pass", "fail") }, { note: string })),
      person: personDecoder,
      day: dayDecoder,
    },
    {},
  ),
  "mutation-run": object({
    kind: literal("mutation-run"),
    id: string,
    tool: object({ name: string }, { version: string }),
    revision: string,
    results: array(mutationRowDecoder),
    day: dayDecoder,
  }),
} as const;
