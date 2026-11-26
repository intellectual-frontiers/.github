/**
 * Made-up sources and lenses for the tests of Dossier: a run of tests, a set of findings, an incident of class `cui` and a public reading (commons dossier 0002-dossier-core).
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Declaration, Lens, Source } from "@intellectual-frontiers/dossier/governance";
import { cite, defineLens, emptyPlate, erase, freshness, plateOf, registryOf, sourceOf, text } from "@intellectual-frontiers/dossier/logical";

export const WHEN = "2026-11-26T12:00:00Z";

/** The made-up sources. */
export async function sources(): Promise<readonly Source[]> {
  const made = await Promise.all([
    sourceOf({ id: "quality/run-001", kind: "quality-run", observedAt: "2026-11-20T09:00:00Z", about: ["synthetic-boundary-01"], body: { cases: [{ id: "AC-001", result: "pass" }, { id: "AC-002", result: "fail" }] } }),
    sourceOf({ id: "quality/run-002", kind: "quality-run", observedAt: "2026-11-25T09:00:00Z", about: ["synthetic-boundary-01"], body: { cases: [{ id: "AC-001", result: "pass" }] }, signer: "SHA256:synthetic-key-01" }),
    sourceOf({ id: "findings/set-001", kind: "finding-set", observedAt: "2026-11-22T09:00:00Z", about: ["synthetic-boundary-01"], body: { open: 2 } }),
    sourceOf({ id: "incident/synthetic-incident-01", kind: "incident", observedAt: "2026-11-23T09:00:00Z", class: "cui", about: ["synthetic-boundary-01"], body: { summary: "a made-up incident" } }),
    sourceOf({ id: "reading/synthetic-reading-01", kind: "reading", observedAt: "2026-11-24T09:00:00Z", class: "public", body: { value: 7 } }),
  ]);
  return made.map((m) => {
    if (m.kind === "err") throw new Error(m.error);
    return m.value;
  });
}

type RunsParams = { readonly title: string };

const decodeTitle = (raw: unknown) => (typeof raw === "object" && raw !== null && "title" in raw && typeof raw.title === "string" ? ok<RunsParams>({ title: raw.title }) : err("the parameters are { title }"));

/** A lens of the runs of tests: the case results of each, with the age of each. */
export const runsLens: Lens<RunsParams> = defineLens<RunsParams>({
  id: "runs",
  version: "1.0.0",
  title: "Runs of tests",
  inputs: ["quality-run"],
  ceiling: "internal",
  decode: decodeTitle,
  plate: ({ sources: ss, params, asOf }) =>
    ss.length === 0
      ? ok(emptyPlate({ id: "runs", ceiling: "internal" }, params.title, "a run of tests"))
      : ok(
          plateOf({
            lens: { id: "runs", ceiling: "internal" },
            title: params.title,
            blocks: [
              { t: "table", head: ["Run", "Cases", "Evidence"], rows: ss.map((s) => [[cite(s.id)], [text(String((s.body as { cases: unknown[] }).cases.length))], [text(freshness(s.observedAt, asOf))]]) },
            ],
            cites: ss.map((s) => s.id),
          }),
        ),
});

/** A lens of the incidents, of class `cui`. */
export const incidentLens: Lens<RunsParams> = defineLens<RunsParams>({
  id: "incidents",
  version: "1.0.0",
  title: "Incidents",
  inputs: ["incident"],
  ceiling: "cui",
  decode: decodeTitle,
  plate: ({ sources: ss, params }) =>
    ok(plateOf({ lens: { id: "incidents", ceiling: "cui" }, title: params.title, blocks: ss.map((s) => ({ t: "para", inlines: [cite(s.id), text(` ${(s.body as { summary: string }).summary}`)] })), cites: ss.map((s) => s.id) })),
});

/** A lens of the readings, public. */
export const readingLens: Lens<RunsParams> = defineLens<RunsParams>({
  id: "readings",
  version: "1.0.0",
  title: "Readings",
  inputs: ["reading"],
  ceiling: "public",
  decode: decodeTitle,
  plate: ({ sources: ss, params }) => ok(plateOf({ lens: { id: "readings", ceiling: "public" }, title: params.title, blocks: ss.map((s) => ({ t: "para", inlines: [cite(s.id), text(` is ${String((s.body as { value: number }).value)}`)] })), cites: ss.map((s) => s.id) })),
});

export const registry = registryOf([erase(runsLens), erase(incidentLens), erase(readingLens)]);

/** A declaration of the three lenses, for a reader of a class. */
export const declaration = (audience: Declaration["audience"], asOf: Declaration["asOf"] = WHEN): Declaration => ({
  id: "synthetic-dossier-01",
  title: "A made-up dossier",
  audience,
  asOf,
  selection: { kinds: ["quality-run", "incident", "reading"] },
  lenses: [
    { lens: "runs", params: { title: "Runs" } },
    { lens: "incidents", params: { title: "Incidents" } },
    { lens: "readings", params: { title: "Readings" } },
  ],
  renditions: ["adoc"],
  triggers: ["a push that touches an input"],
});
