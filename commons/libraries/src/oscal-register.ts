/**
 * The proof register of a Mizan folder as OSCAL (commons 0003-mizan FR-011, FR-016, FR-021 to FR-023): its `enforcement.tsv` (and the `reviewed.tsv` of a specification, read as
 * `review` rows) as an OSCAL `component-definition`, each requirement an `implemented-requirement`, and the proofs the tests name (`proves([...])`, `// Proves:`) as OSCAL
 * `assessment-results`.
 *
 *     bun commons/libraries/src/oscal-register.ts             write commons/generated/mizan-register.auto.oscal.json and mizan-register-results.auto.oscal.json
 *     bun commons/libraries/src/oscal-register.ts --check     write nothing; exit 1 naming each file that is not what the folder makes
 *     --root DIR      the folder (default commons/spec-kit)     --repo DIR   the repository the tests are searched in (default commons' repository)
 *     --register DIR  the folder of `enforcement.tsv` (default: the folder of --root)     --enforcement FILE   the register's file itself (default: enforcement.tsv of the register folder)
 *     --tests A,B     the folders of tests, from the repository (default tests,commons)     --out DIR   where the files go (default commons/generated)
 *     --label TEXT    the name the documents give the folder (default `Intellectual Frontiers commons`)
 *
 * @remarks
 * The two documents are written here, as OSCAL 1.2.3, so that the same bytes come for the same folder: every `uuid` is a version 5 UUID of a
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
 * Spec: 0001-libraries FR-008
 *
 * @module
 */
import process from "node:process";
import { fileURLToPath } from "node:url";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Cited, parseSpec, proofsOf, type SourceFile } from "@intellectual-frontiers/mizan/trace";
import { NAMESPACE_URL, type Uuid, uuidV5, uuidV5Of } from "@intellectual-frontiers/crypto/uuid";
import { existsSync, mkdirSync, readDirSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { stdio } from "@intellectual-frontiers/system";
import { readSources } from "@intellectual-frontiers/mizan/host/trace";
import { sentenceOf, type SpecText } from "@intellectual-frontiers/mizan/rules";

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
export const RUN = "bun commons/libraries/src/oscal-register.ts";

/** The instant the documents give as their `last-modified`: the register reads no clock (0003-mizan FR-022). */
const NO_CLOCK = "1970-01-01T00:00:00.000Z";

/** The version of OSCAL the documents are written as. */
const OSCAL_VERSION = "1.2.3";

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

/** What one observation of the results says. */
type Observation = {
  readonly row: RegisterRow;
  readonly status: "pass" | "warn" | "gap";
  readonly outcome: "pass" | "accepted" | "gap";
  readonly title: string;
  readonly detail: string;
  readonly evidence?: string;
  readonly waiver?: string;
};

/** What a requirement's observations say: a passing observation for each test file that proves it, else `accepted` where a person reviewed it, else a `gap`. */
async function observationsOf(row: RegisterRow, tests: ReadonlyMap<string, string>): Promise<readonly Observation[]> {
  if (row.files.length > 0)
    return Promise.all(
      row.files.map(
        async (file): Promise<Observation> => ({
          row,
          status: "pass",
          outcome: "pass",
          title: `proved by ${file}`,
          detail: `${row.requirement} is named by a proof in ${file}.`,
          evidence: await sha256(tests.get(file) ?? ""),
        }),
      ),
    );
  if (row.mechanism === "review")
    return [
      { row, status: "warn", outcome: "accepted", waiver: row.by, title: "reviewed by a person", detail: `${row.requirement} has no test; a person reviews it (${row.by}): ${row.note}` },
    ];
  return [
    {
      row,
      status: "gap",
      outcome: "gap",
      title: "no test proves it",
      detail: `${row.requirement} is ${row.mechanism === "none" ? "not enforced" : `enforced by ${row.mechanism} (${row.by})`}, and no proof in the tests names it: ${row.note}`,
    },
  ];
}

/** The two documents, as the text of their files. */
export type RegisterDocuments = { readonly componentDefinition: string; readonly assessmentResults: string };

/**
 * The register as OSCAL 1.2.3: the component definition and the assessment results, rendered (0003-mizan FR-021, FR-022). Where `register.enforcement` names a file, its text is the register
 * and `input.enforcement` is not read (FR-043); the same bytes come for the same register wherever its file is. Both are written here, from the rows, and not by a library of exchange formats:
 * the register's own vocabulary (a mechanism, a proof, a waiver) is Mizan's.
 */
export async function registerDocuments(input: RegisterInput, register: RegisterOptions = {}): Promise<RegisterDocuments> {
  const rows = registerRows(register.enforcement === undefined ? input : { ...input, enforcement: enforcementAt(register.enforcement) });
  const catalog = "the specifications of its Mizan folder";
  const tests = new Map(input.tests.map((t) => [t.path, t.text]));
  const version = (await sha256(JSON.stringify(rows.map((r) => [r.requirement, r.mechanism, r.by, r.note, r.title, r.files])))).slice(0, 12);
  const namespace: Uuid = await uuidV5(NAMESPACE_URL, REGISTER_IRI);
  const id = (...parts: readonly string[]): Promise<string> => uuidV5Of(namespace, parts);
  const ns = `${REGISTER_IRI}#`;
  const prop = (name: string, value: string): { readonly name: string; readonly ns: string; readonly value: string } => ({ name, ns, value });
  const metadata = (what: string): Record<string, string> => ({
    title: `Mizan register of ${input.label}: ${what} (generated by ${RUN}; do not edit)`,
    "last-modified": NO_CLOCK,
    version,
    "oscal-version": OSCAL_VERSION,
  });
  const catalogId = await id("catalog", input.label);
  const implemented = await Promise.all(
    rows.map(async (row) => ({
      uuid: await id("implemented-requirement", input.label, row.controlId),
      "control-id": row.controlId,
      description: `${row.requirement} (${row.title})`,
      props: [prop("control", row.requirement), prop("mechanism", row.mechanism), prop("proofs", String(row.files.length))],
    })),
  );
  const componentDefinition = {
    "component-definition": {
      uuid: await id("component-definition", input.label),
      metadata: metadata("component definition"),
      components: [
        {
          uuid: await id("component", input.label),
          type: "software",
          title: input.label,
          description: `${input.label}, whose requirements are written in ${catalog}.`,
          "control-implementations": [
            {
              uuid: await id("control-implementation", input.label),
              source: `#${catalogId}`,
              description: `The controls of ${catalog} that ${input.label} implements.`,
              "implemented-requirements": implemented,
            },
          ],
        },
      ],
      "back-matter": { resources: [{ uuid: catalogId, title: `The controls of ${catalog}` }] },
    },
  };
  const specs = [...new Set(rows.map((r) => r.spec))].sort(byText);
  const inventory = await Promise.all(
    specs.map(async (spec) => ({
      uuid: await id("inventory-item", input.label, spec),
      description: `specification ${spec}`,
      props: [{ name: "asset-id", value: spec }, prop("subject-kind", "specification")],
    })),
  );
  const inventoryOf = new Map(specs.map((spec, i) => [spec, inventory[i]?.uuid ?? ""]));
  const observed = (await Promise.all(rows.map((row) => observationsOf(row, tests)))).flat();
  const observations = await Promise.all(
    observed.map(async (o, i) => {
      const title = `${o.row.requirement} on specification ${o.row.spec}: ${o.title}`;
      return {
        uuid: await id("observation", input.label, String(i), title),
        title,
        description: o.detail,
        props: [
          prop("control", o.row.requirement),
          prop("outcome", o.outcome),
          prop("status", o.status),
          prop("severity", "info"),
          ...(o.waiver === undefined ? [] : [prop("waiver", o.waiver)]),
        ],
        methods: ["TEST"],
        types: ["finding"],
        subjects: [{ "subject-uuid": inventoryOf.get(o.row.spec) ?? "", type: "inventory-item", title: `specification ${o.row.spec}` }],
        ...(o.evidence === undefined
          ? {}
          : { "relevant-evidence": [{ description: `evidence of SHA-256 ${o.evidence}`, props: [prop("sha256", o.evidence)] }] }),
        collected: NO_CLOCK,
      };
    }),
  );
  const findings = await Promise.all(
    rows.map(async (row) => {
      const own = observed.flatMap((o, i) => (o.row === row ? [{ o, uuid: observations[i]?.uuid ?? "" }] : []));
      const outcome = own.some((x) => x.o.outcome === "gap") ? "gap" : own.some((x) => x.o.outcome === "accepted") ? "accepted" : "pass";
      return {
        uuid: await id("finding", input.label, row.controlId),
        title: row.controlId,
        description: `${row.controlId}: ${outcome}, by ${row.requirement}.`,
        props: [prop("outcome", outcome), prop("control", row.requirement)],
        target: { type: "objective-id", "target-id": row.controlId, status: { state: outcome === "gap" ? "not-satisfied" : "satisfied" } },
        "related-observations": own.map((x) => ({ "observation-uuid": x.uuid })),
      };
    }),
  );
  const plan = await id("assessment-plan", input.label);
  const assessmentResults = {
    "assessment-results": {
      uuid: await id("assessment-results", input.label),
      metadata: metadata("assessment results"),
      "import-ap": { href: `#${plan}` },
      results: [
        {
          uuid: await id("result", input.label),
          title: `Mizan register of ${input.label} as of ${NO_CLOCK}`,
          description: `The findings of Mizan register of ${input.label}, assessed at ${NO_CLOCK}.`,
          start: NO_CLOCK,
          "local-definitions": { "inventory-items": inventory },
          "reviewed-controls": { "control-selections": [{ "include-controls": rows.map((r) => ({ "control-id": r.controlId })) }] },
          observations,
          findings,
        },
      ],
      "back-matter": { resources: [{ uuid: plan, title: `The assessment plan of Mizan register of ${input.label}` }] },
    },
  };
  return { componentDefinition: `${JSON.stringify(componentDefinition, null, 2)}\n`, assessmentResults: `${JSON.stringify(assessmentResults, null, 2)}\n` };
}

/** What the register may be told besides its folder (0003-mizan FR-043): where its `enforcement.tsv` is, where it is not `enforcement.tsv` of the folder. */
export type RegisterOptions = {
  /** The path of the proof register's file, where it is not `<root>/enforcement.tsv`. A file that is not there is an error, not an empty register. */
  readonly enforcement?: string;
};

/** The text of the register at an explicit path, with LF line ends; an error that names the file where it is not there. */
function enforcementAt(path: string): string {
  if (!existsSync(path)) throw new Error(`the proof register ${path} does not exist`);
  return readTextFileSync(path).replaceAll("\r\n", "\n");
}

/**
 * The specifications of a folder, the text of each `reviewed.tsv`, and the proof register, read from disk, with the tests of the given folders of a repository (by path from it). The register is
 * `<root>/enforcement.tsv` unless `options.enforcement` names another file (0003-mizan FR-043).
 */
export async function readRegisterInput(
  root: string,
  repo: string,
  testFolders: readonly string[],
  label: string,
  options: RegisterOptions = {},
): Promise<RegisterInput> {
  const specs: SpecText[] = [];
  const reviewed = new Map<string, string>();
  const folder = `${root.replace(/[\\/]$/, "")}/specs`;
  if (existsSync(folder))
    for (const e of readDirSync(folder).sort((a, b) => byText(a.name, b.name))) {
      if (!e.isDirectory || !existsSync(`${folder}/${e.name}/spec.md`)) continue;
      specs.push({ slug: e.name, spec: readTextFileSync(`${folder}/${e.name}/spec.md`).replaceAll("\r\n", "\n") });
      if (existsSync(`${folder}/${e.name}/reviewed.tsv`))
        reviewed.set(e.name, readTextFileSync(`${folder}/${e.name}/reviewed.tsv`).replaceAll("\r\n", "\n"));
    }
  const enforcement = options.enforcement ?? `${root.replace(/[\\/]$/, "")}/enforcement.tsv`;
  const tests = await readSources(
    repo,
    testFolders.filter((t) => existsSync(`${repo.replace(/[\\/]$/, "")}/${t}`)),
    [".test.ts"],
  );
  return {
    label,
    specs,
    reviewed,
    enforcement:
      options.enforcement !== undefined
        ? enforcementAt(enforcement)
        : existsSync(enforcement)
          ? readTextFileSync(enforcement).replaceAll("\r\n", "\n")
          : "",
    tests: [...tests].map((t) => ({ ...t, text: t.text.replaceAll("\r\n", "\n") })).sort((a, b) => byText(a.path, b.path)),
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
  const register = arg("--register") ?? root;
  const enforcement =
    arg("--enforcement") ?? (arg("--register") === undefined ? undefined : `${register.replace(/[\\/]$/, "")}/enforcement.tsv`);
  const repo = arg("--repo") ?? fileURLToPath(new URL("../../..", import.meta.url)).replace(/[\\/]$/, "");
  const out = (arg("--out") ?? `${commons}/generated`).replace(/[\\/]$/, "");
  const tests = (arg("--tests") ?? "tests,commons").split(",");
  if (enforcement !== undefined && !existsSync(enforcement)) {
    stdio.stderr.writeSync(`oscal-register: the proof register ${enforcement} does not exist\n`);
    return 2;
  }
  const made = await registerDocuments(
    await readRegisterInput(
      root,
      repo,
      tests,
      arg("--label") ?? "Intellectual Frontiers commons",
      enforcement === undefined ? {} : { enforcement },
    ),
  );
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
