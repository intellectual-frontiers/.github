/**
 * The proof register of a Mizan folder as OSCAL (commons 0003-mizan FR-011, FR-016, FR-021 to FR-023): its `enforcement.tsv` (and the `reviewed.tsv` of a specification, read as
 * `review` rows) as an OSCAL `component-definition`, each requirement an `implemented-requirement`, and the proofs the tests name (`proves([...])`, `// Proves:`) as OSCAL
 * `assessment-results`.
 *
 *     bun commons/ts/mizan/oscal-register.ts             write commons/generated/mizan-register.auto.oscal.json and mizan-register-results.auto.oscal.json
 *     bun commons/ts/mizan/oscal-register.ts --check     write nothing; exit 1 naming each file that is not what the folder makes
 *     --root DIR      the folder (default commons/spec-kit)     --repo DIR   the repository the tests are searched in (default commons' repository)
 *     --tests A,B     the folders of tests, from the repository (default tests,commons)     --out DIR   where the files go (default commons/generated)
 *     --label TEXT    the name the documents give the folder (default `Intellectual Frontiers commons`)
 *
 * @remarks
 * The two documents are written by the kernel's OSCAL writers (`kernel/oscal.ts`, OSCAL 1.2.3), so that the same bytes come for the same folder: every `uuid` is a version 5 UUID of a
 * stable name, every list is in an order of its own, and no clock is read (`last-modified` is `1970-01-01T00:00:00Z`; the `version` is the first 12 characters of the SHA-256 of the
 * register's rows). A requirement's control id is `spec-<slug>.<fr>` in lower case. A requirement a test proves has one passing observation for each test file, with the SHA-256 of
 * the file as evidence; one that is only reviewed is `accepted` (it has no test); one that has no proof, whatever its row says, is a `gap`. What OSCAL does not say, the command that
 * proves a requirement and its note, stays in `enforcement.tsv`, so that no proof is written twice.
 *
 * @limits
 * It reads which tests name a requirement, never whether they pass (that is the test run's evidence, 0008-test-evidence), and it counts a proof wherever a `proves(` call or a
 * `// Proves:` line is, a fixture string included, as the trace check does. It does not write a POA&M: a `gap` is a finding of the results.
 *
 * @example
 * ```ts
 * import { registerRows } from "./oscal-register.ts";
 * registerRows({
 *   label: "x",
 *   specs: [{ slug: "0001-x", spec: "**Status:** Active\n- **FR-001**: It MUST work.\n" }],
 *   reviewed: new Map(),
 *   enforcement: "0001-x FR-001\tcheck\trepo: bun test\tproved\n",
 *   tests: [{ path: "tests/x.test.ts", text: 'proves(["0001-x FR-001"], "it works", () => {});' }],
 * }).map((r) => [r.requirement, r.mechanism, r.files]); // [["0001-x FR-001", "check", ["tests/x.test.ts"]]]
 * ```
 *
 * @module
 */
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assessmentResults,
  componentDefinition,
  type OscalAssessmentResults,
  type OscalComponentDefinition,
  type OscalOptions,
  renderOscal,
} from "../kernel/oscal.ts";
import {
  type Assessment,
  type ControlSummary,
  type Finding,
  type Instant,
  instantOf,
  type Status,
  type SubjectRef,
} from "../kernel/grc.ts";
import { sha256 } from "../kernel/sha256.ts";
import { type Cited, parseSpec, proofsOf, type SourceFile } from "../kernel/trace.ts";
import { NAMESPACE_URL, uuidV5 } from "../kernel/uuid.ts";
import { existsSync, mkdirSync, readDirSync, readTextFileSync, writeTextFileSync } from "../runtime/fs.ts";
import { stdio } from "../runtime/mod.ts";
import { readSources } from "../runtime/trace.ts";
import { sentenceOf, type SpecText } from "./rules.ts";

/** What the register says enforces a requirement (0003-mizan FR-005): a check, a gate, a person's review, or nothing. */
export type Mechanism = "check" | "gate" | "review" | "none";

/** A requirement as the register holds it. */
export type RegisterRow = {
  /** The requirement, `NNNN-slug FR-nnn`. */
  readonly requirement: string;
  readonly spec: string;
  readonly id: string;
  /** The OSCAL `control-id`, `spec-<slug>.<fr>` in lower case. */
  readonly controlId: string;
  /** The first sentence of the requirement, cut to 160 characters. */
  readonly title: string;
  /** The status of its specification (Draft, Active, ...), or `unknown`. */
  readonly status: string;
  readonly mechanism: Mechanism;
  /** Who enforces it, as `enforcement.tsv` says (`-` for none, `reviewed.tsv` for a row of that file). */
  readonly by: string;
  readonly note: string;
  /** The test files that prove it, sorted. */
  readonly files: readonly string[];
};

/** What the register is made from: the specifications, the text of each `reviewed.tsv`, the text of `enforcement.tsv` and the tests. */
export type RegisterInput = {
  /** The name the documents give the folder. */
  readonly label: string;
  readonly specs: readonly SpecText[];
  /** The text of a specification's `reviewed.tsv`, by its slug. */
  readonly reviewed: ReadonlyMap<string, string>;
  readonly enforcement: string;
  readonly tests: readonly SourceFile[];
};

/** The file of the component definition, from the folder it is written in. */
export const COMPONENT_FILE = "mizan-register.auto.oscal.json";

/** The file of the assessment results, from the folder it is written in. */
export const RESULTS_FILE = "mizan-register-results.auto.oscal.json";

/** The command that writes the files again. */
export const RUN = "bun commons/ts/mizan/oscal-register.ts";

/** The instant the documents give as their `last-modified`: the register reads no clock (0003-mizan FR-022). */
const NO_CLOCK: Instant = instantOf("1970-01-01T00:00:00Z") ?? absurdInstant();

/** Never returns: the epoch is an instant, so `instantOf` has no reason to refuse it. */
function absurdInstant(): never {
  throw new Error("1970-01-01T00:00:00Z is an instant");
}

const REGISTER_IRI = "https://www.intellectualfrontiers.com/ontology/mizan-register";
const isMechanism = (x: string): x is Mechanism => x === "check" || x === "gate" || x === "review" || x === "none";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const numberOf = (id: string): number => Number(/^FR-(\d+)/.exec(id)?.[1] ?? "NaN");

/** The OSCAL `control-id` of a requirement: a token that starts with a letter (`spec-0003-mizan.fr-011`). */
export function controlIdOf(spec: string, id: string): string {
  return `spec-${spec}.${id.toLowerCase()}`;
}

/** The rows of `enforcement.tsv` by requirement: its four columns; comment lines, blank lines and the header are not rows. */
function enforcementRows(text: string): ReadonlyMap<string, { readonly mechanism: Mechanism; readonly by: string; readonly note: string }> {
  const out = new Map<string, { readonly mechanism: Mechanism; readonly by: string; readonly note: string }>();
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [req = "", mechanism = "", by = "", ...note] = line.split("\t");
    if (req === "requirement" || !isMechanism(mechanism)) continue;
    out.set(req.trim(), { mechanism, by: by.trim(), note: note.join("\t").trim() });
  }
  return out;
}

/** The rows of a `reviewed.tsv` as requirement ids and reasons (`slug FR-nnn<TAB>reason`), for the specification named `slug`. */
function reviewedRows(slug: string, text: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [req = "", ...reason] = line.split("\t");
    const m = /^(\S+)\s+(FR-\d{3}[a-z]?)$/.exec(req.trim());
    if (m?.[1] === slug && m[2] !== undefined) out.set(m[2], reason.join("\t").trim());
  }
  return out;
}

/** The ids of a specification's requirements that a citation names, ranges expanded; an id the specification lacks names nothing. */
function idsOf(have: readonly string[], c: Cited): readonly string[] {
  if (c.kind === "one") return have.includes(c.id) ? [c.id] : [];
  if (!have.includes(c.from) || !have.includes(c.to)) return [];
  const [lo, hi] = [numberOf(c.from), numberOf(c.to)];
  return have.filter((id) => numberOf(id) >= lo && numberOf(id) <= hi);
}

/** The first sentence of a requirement's text, white space collapsed and cut to 160 characters. */
function titleOf(sentence: string): string {
  const one = sentence.replace(/\s+/g, " ").trim();
  const end = one.search(/[.;:] /);
  const first = end > 20 ? one.slice(0, end + 1) : one;
  return first.length > 160 ? `${first.slice(0, 157)}...` : first;
}

/** The register's rows: every requirement of every specification in the order of the specifications, with what enforces it and the test files that prove it (0003-mizan FR-021). */
export function registerRows(input: RegisterInput): readonly RegisterRow[] {
  const enforced = enforcementRows(input.enforcement);
  const slugs = new Map(input.specs.map((s) => [s.slug, parseSpec(s.slug, s.spec).requirements.map((r) => r.id)]));
  const proved = new Map<string, Set<string>>();
  for (const t of [...input.tests].sort((a, b) => byText(a.path, b.path))) {
    for (const p of proofsOf(t.text)) {
      const have = slugs.get(p.spec);
      if (have === undefined) continue;
      for (const id of idsOf(have, p.requirement)) {
        const key = `${p.spec} ${id}`;
        const files = proved.get(key) ?? new Set<string>();
        files.add(t.path);
        proved.set(key, files);
      }
    }
  }
  return input.specs.flatMap((s) => {
    const parsed = parseSpec(s.slug, s.spec);
    const lines = s.spec.split("\n");
    const reviewed = reviewedRows(s.slug, input.reviewed.get(s.slug) ?? "");
    return parsed.requirements.map((r): RegisterRow => {
      const requirement = `${s.slug} ${r.id}`;
      const row = enforced.get(requirement);
      const reason = reviewed.get(r.id);
      const [mechanism, by, note]: [Mechanism, string, string] =
        row !== undefined
          ? [row.mechanism, row.by, row.note]
          : reason !== undefined
            ? ["review", "reviewed.tsv", reason]
            : ["none", "-", "no row in enforcement.tsv"];
      return {
        requirement,
        spec: s.slug,
        id: r.id,
        controlId: controlIdOf(s.slug, r.id),
        title: titleOf(sentenceOf(lines, r.line - 1)),
        status: parsed.status ?? "unknown",
        mechanism,
        by,
        note,
        files: [...(proved.get(requirement) ?? [])].sort(byText),
      };
    });
  });
}

function summaryOf(row: RegisterRow, catalog: string): ControlSummary {
  return {
    id: row.requirement,
    title: row.title,
    implements: [{ catalog, id: row.controlId }],
    severity: "info",
    cadence: "on every commit",
  };
}

/** What a requirement's finding says: a passing observation for each test file that proves it, else `accepted` where a person reviewed it, else a `gap`. */
async function findingsOf(row: RegisterRow, control: ControlSummary, tests: ReadonlyMap<string, string>): Promise<readonly Finding[]> {
  const subject: SubjectRef = { kind: "specification", id: row.spec };
  const base = { control, subject, severity: "info" as const, at: NO_CLOCK };
  if (row.files.length > 0)
    return Promise.all(
      row.files.map(async (file): Promise<Finding> => ({
        ...base,
        status: "pass",
        outcome: "pass",
        title: `proved by ${file}`,
        detail: `${row.requirement} is named by a proof in ${file}.`,
        evidence: [await sha256(tests.get(file) ?? "")],
      })),
    );
  if (row.mechanism === "review")
    return [
      {
        ...base,
        status: "warn",
        outcome: "accepted",
        waiver: row.by,
        title: "reviewed by a person",
        detail: `${row.requirement} has no test; a person reviews it (${row.by}): ${row.note}`,
        evidence: [],
      },
    ];
  const status: Status = "gap";
  return [
    {
      ...base,
      status,
      outcome: status,
      title: "no test proves it",
      detail: `${row.requirement} is ${row.mechanism === "none" ? "not enforced" : `enforced by ${row.mechanism} (${row.by})`}, and no proof in the tests names it: ${row.note}`,
      evidence: [],
    },
  ];
}

/** The two documents, as the text of their files. */
export type RegisterDocuments = { readonly componentDefinition: string; readonly assessmentResults: string };

/** The register as OSCAL 1.2.3: the component definition and the assessment results, rendered (0003-mizan FR-021, FR-022). */
export async function registerDocuments(input: RegisterInput): Promise<RegisterDocuments> {
  const rows = registerRows(input);
  const catalog = "the specifications of its Mizan folder";
  const pairs = rows.map((row) => ({ row, control: summaryOf(row, catalog) }));
  const controls = pairs.map((p) => p.control);
  const tests = new Map(input.tests.map((t) => [t.path, t.text]));
  const version = (await sha256(JSON.stringify(rows.map((r) => [r.requirement, r.mechanism, r.by, r.note, r.title, r.files])))).slice(
    0,
    12,
  );
  const namespace = await uuidV5(NAMESPACE_URL, REGISTER_IRI);
  const options = (what: string): OscalOptions => ({
    namespace,
    lastModified: NO_CLOCK,
    version,
    propNamespace: `${REGISTER_IRI}#`,
    title: `Mizan register of ${input.label}: ${what} (generated by ${RUN}; do not edit)`,
    controlId: (ref) => ref.id,
  });
  const definition = await componentDefinition(
    controls,
    {
      id: input.label,
      title: input.label,
      description: `${input.label}, whose requirements are written in the specifications of its Mizan folder.`,
      type: "software",
    },
    options("component definition"),
  );
  const byControl = new Map(rows.map((r) => [r.controlId, r]));
  const inner = definition["component-definition"];
  const withMechanism: OscalComponentDefinition = {
    "component-definition": {
      ...inner,
      components: inner.components.map((c) => ({
        ...c,
        ...(c["control-implementations"] === undefined
          ? {}
          : {
              "control-implementations": c["control-implementations"].map((ci) => ({
                ...ci,
                "implemented-requirements": ci["implemented-requirements"].map((ir) => {
                  const row = byControl.get(ir["control-id"]);
                  return row === undefined
                    ? ir
                    : {
                        ...ir,
                        props: [
                          ...ir.props,
                          { name: "mechanism", ns: `${REGISTER_IRI}#`, value: row.mechanism },
                          { name: "proofs", ns: `${REGISTER_IRI}#`, value: String(row.files.length) },
                        ],
                      };
                }),
              })),
            }),
      })),
    },
  };
  const assessment: Assessment = {
    pack: { id: input.label, title: `Mizan register of ${input.label}` },
    at: NO_CLOCK,
    controls,
    subjects: [...new Set(rows.map((r) => r.spec))].sort(byText).map((id) => ({ kind: "specification", id })),
    findings: (await Promise.all(pairs.map((p) => findingsOf(p.row, p.control, tests)))).flat(),
  };
  const results: OscalAssessmentResults = await assessmentResults(assessment, options("assessment results"));
  return { componentDefinition: renderOscal(withMechanism), assessmentResults: renderOscal(results) };
}

/** The specifications of a folder, the text of each `reviewed.tsv`, and `enforcement.tsv`, read from disk, with the tests of the given folders of a repository (by path from it). */
export async function readRegisterInput(root: string, repo: string, testFolders: readonly string[], label: string): Promise<RegisterInput> {
  const specs: SpecText[] = [];
  const reviewed = new Map<string, string>();
  const folder = `${root.replace(/[\\/]$/, "")}/specs`;
  if (existsSync(folder))
    for (const e of readDirSync(folder).sort((a, b) => byText(a.name, b.name))) {
      if (!e.isDirectory || !existsSync(`${folder}/${e.name}/spec.md`)) continue;
      specs.push({ slug: e.name, spec: readTextFileSync(`${folder}/${e.name}/spec.md`).replaceAll("\r\n", "\n") });
      if (existsSync(`${folder}/${e.name}/reviewed.tsv`)) reviewed.set(e.name, readTextFileSync(`${folder}/${e.name}/reviewed.tsv`));
    }
  const enforcement = `${root.replace(/[\\/]$/, "")}/enforcement.tsv`;
  const tests = await readSources(
    repo,
    testFolders.filter((t) => existsSync(`${repo.replace(/[\\/]$/, "")}/${t}`)),
    [".test.ts"],
  );
  return {
    label,
    specs,
    reviewed,
    enforcement: existsSync(enforcement) ? readTextFileSync(enforcement).replaceAll("\r\n", "\n") : "",
    tests: [...tests].sort((a, b) => byText(a.path, b.path)),
  };
}

/** The command line. Returns the exit status: 0, or 1 with `--check` where a file is not what the folder makes. */
export async function main(argv: readonly string[]): Promise<number> {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const commons = fileURLToPath(new URL("../..", import.meta.url)).replace(/[\\/]$/, "");
  const root = arg("--root") ?? `${commons}/spec-kit`;
  const repo = arg("--repo") ?? fileURLToPath(new URL("../../..", import.meta.url)).replace(/[\\/]$/, "");
  const out = (arg("--out") ?? `${commons}/generated`).replace(/[\\/]$/, "");
  const tests = (arg("--tests") ?? "tests,commons").split(",");
  const made = await registerDocuments(await readRegisterInput(root, repo, tests, arg("--label") ?? "Intellectual Frontiers commons"));
  const files: readonly (readonly [string, string])[] = [
    [COMPONENT_FILE, made.componentDefinition],
    [RESULTS_FILE, made.assessmentResults],
  ];
  if (argv.includes("--check")) {
    const stale = files.filter(
      ([name, text]) => !existsSync(`${out}/${name}`) || readTextFileSync(`${out}/${name}`).replaceAll("\r\n", "\n") !== text,
    );
    for (const [name] of stale) stdio.stderr.writeSync(`${out}/${name} is not what the folder makes; run: ${RUN}\n`);
    return stale.length > 0 ? 1 : 0;
  }
  mkdirSync(out, { recursive: true });
  for (const [name, text] of files) {
    writeTextFileSync(`${out}/${name}`, text);
    stdio.stdout.writeSync(`wrote ${out}/${name}\n`);
  }
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
