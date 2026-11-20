// Spec: 0007-grc-surface FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The headless verbs of GRC (0007-grc-surface): a branch `grc` with `check`, `assess`, `explain` and `evidence`, made with Headless (commons headless 0002-headless-governance,
 * 0003-headless-output) from a host that gives the governance documents, the registries of runners, serializers and the evidence store, and the clock. The branch names no runner and no store.
 *
 * @example
 * ```ts
 * import { grcBranch } from "@intellectual-frontiers/grc/surfaces/headless";
 * // programOf({ name: "tool", summary: "A tool.", version: "1", children: [grcBranch(host)] })
 * ```
 *
 * @module
 */
import { branch, command, type Node, outcomeOf } from "@intellectual-frontiers/headless/logical";
import { defineReach, problem } from "@intellectual-frontiers/headless/governance";
import { value } from "@intellectual-frontiers/terminal/args";
import { fs } from "@intellectual-frontiers/system";
import { type Check, controlUrns, type Crosswalk, type Exception, type Framework, mappedControls, type Policy, type Requirement } from "@intellectual-frontiers/grc/governance";
import { assess, type Evidence, newestResults, rollup, type Result, type Serializers, verifyManifest, makeManifest } from "@intellectual-frontiers/grc/logical";
import { applyExceptions } from "@intellectual-frontiers/grc/logical";
import { type EvidenceStore, runChecks, type Runners, type Subject } from "@intellectual-frontiers/grc/physical";

/** What the program gives the branch. */
export type GrcHost = {
  readonly frameworks: readonly Framework[];
  readonly crosswalks: readonly Crosswalk[];
  readonly policies: readonly Policy[];
  readonly checks: readonly Check[];
  readonly requirements: readonly Requirement[];
  readonly exceptions: readonly Exception[];
  readonly subjects: readonly Subject[];
  readonly runners: Runners;
  readonly serializers: Serializers;
  readonly store?: EvidenceStore;
  readonly now: () => string;
  readonly timeoutMs?: number;
};

const READ = defineReach({ channels: ["local", "ssh", "mcp", "rest"], readOnly: true, idempotent: true });
const WRITE = defineReach({ channels: ["local"], idempotent: true });

async function run(host: GrcHost, ids: readonly string[]): Promise<{ readonly results: readonly Result[]; readonly unknown: readonly string[] }> {
  const known = new Set(host.checks.map((c) => c.id));
  const unknown = ids.filter((i) => !known.has(i));
  const checks = ids.length === 0 ? host.checks : host.checks.filter((c) => ids.includes(c.id));
  const raw = await runChecks(host.runners, checks, host.subjects, { now: host.now, timeoutMs: host.timeoutMs ?? 30_000 });
  return { results: applyExceptions(newestResults(raw), host.exceptions, host.now()), unknown };
}

function nearest(id: string, ids: readonly string[]): string {
  const near = ids.filter((i) => i.includes(id) || id.includes(i)).slice(0, 3);
  return near.length === 0 ? `the known ids start ${ids.slice(0, 3).join(", ")}` : `did you mean ${near.join(", ")}?`;
}

/** The branch `grc`. */
export function grcBranch(host: GrcHost): Node {
  const check = command({
    name: "check",
    summary: "Run the checks over the subjects and report each result.",
    options: {},
    operands: [{ name: "ID", help: "A check to run; all where none is given.", arity: "many" }],
    examples: [{ args: [], says: "Run every check." }],
    action: { kind: "report", reach: READ },
    run: async (args) => {
      const { results, unknown } = await run(host, args.positionals);
      if (unknown.length > 0) return outcomeOf(null, { problems: unknown.map((u) => problem("fail", `${u} is not a check; ${nearest(u, host.checks.map((c) => c.id))}`, { code: "E000-USAGE-CHECK" })) });
      const problems = results.flatMap((r) =>
        r.status === "fail" || r.status === "error" || r.status === "gap"
          ? [problem("fail", `${r.check} on ${r.subject}: ${r.status}: ${r.reason}`, { code: "E-CHECK-FAILED" })]
          : r.status === "warn" || r.status === "pending"
            ? [problem("warn", `${r.check} on ${r.subject}: ${r.status}: ${r.reason}`, { code: "P-CHECK-ATTENTION" })]
            : [],
      );
      const hints = host.checks.length === 0 ? [{ id: "grc-no-checks", message: "no checks are loaded: nothing was run" }] : [];
      const r = rollup(results);
      return outcomeOf({ results, rollup: r }, { problems, hints, text: `${results.length} results; worst ${r.worst}` });
    },
  });

  const assessCmd = command({
    name: "assess",
    summary: "Run the checks, assemble the assessment and write it in a format.",
    options: { format: value({ short: "f", help: "The id of a registered serializer; the assessment document itself where none is given.", valueName: "ID" }), out: value({ short: "o", help: "Write to this file.", valueName: "FILE" }) },
    examples: [{ args: ["--format", "oscal"], says: "The assessment as OSCAL." }],
    action: { kind: "action", effect: "mutate", idempotent: true, dryRun: true, reach: WRITE },
    run: async (args, ctx) => {
      const id = args.options.format;
      const serializer = id === undefined ? undefined : host.serializers.get(id);
      if (id !== undefined && serializer === undefined) {
        return outcomeOf(null, { problems: [problem("fail", `${id} is not a format; registered: ${host.serializers.list().map((s) => s.id).join(", ") || "none"}`, { code: "E000-USAGE-FORMAT" })] });
      }
      const { results } = await run(host, []);
      const at = host.now();
      const evidence: readonly Evidence[] = host.store === undefined ? [] : await host.store.list();
      const a = assess({ id: `assessment:${at}`, title: "Assessment", at, frameworks: host.frameworks, results, evidence, exceptions: host.exceptions, checks: host.checks, policies: host.policies });
      let text: string;
      if (serializer === undefined) text = `${JSON.stringify(a, null, 2)}\n`;
      else {
        const w = await serializer.serialize(a, { crosswalks: host.crosswalks });
        if (w.kind === "err") return outcomeOf(null, { problems: [problem("fail", `${serializer.id}: ${w.error.message}`, { code: "E-ASSESS-SERIALIZE" })] });
        text = w.value;
      }
      const out = args.options.out;
      if (out === undefined) return outcomeOf(a, { text });
      if (ctx.mode === "dry-run") return outcomeOf(a, { outcomes: [`would write ${text.length} characters to ${out}`] });
      await fs.writeTextFile(out, text);
      return outcomeOf(a, { outcomes: [`wrote ${out}`] });
    },
  });

  const explain = command({
    name: "explain",
    summary: "Say what a control, policy, check or requirement is, what it maps to and what shows it.",
    options: {},
    operands: [{ name: "ID", help: "A control URN, or the id of a policy, a check or a requirement.", arity: "one" }],
    examples: [{ args: ["urn:grc:example:1:A-1"], says: "Explain a control." }],
    action: { kind: "report", reach: READ },
    run: (args) => {
      const [id] = args.positionals;
      const urns = controlUrns(host.frameworks);
      const all = [...urns, ...host.policies.map((p) => p.id), ...host.checks.map((c) => c.id), ...host.requirements.map((r) => r.id)];
      if (id === undefined || !all.includes(id)) return Promise.resolve(outcomeOf(null, { problems: [problem("fail", `${id ?? ""} is not known; ${nearest(id ?? "", all)}`, { code: "E000-USAGE-ID" })] }));
      const lines: string[] = [];
      if (urns.includes(id)) {
        const control = host.frameworks.flatMap((f) => f.controls.map((c) => ({ urn: `urn:grc:${f.id}:${f.version}:${c.id}`, c }))).find((x) => x.urn === id);
        lines.push(`${id}: ${control?.c.title ?? ""}`, control?.c.statement ?? "");
        lines.push(`shown by: ${host.checks.filter((c) => c.controls.includes(id)).map((c) => c.id).join(", ") || "no check"}`);
        lines.push(`mapped to: ${mappedControls(host.crosswalks, id).map((m) => `${m.urn} (${m.relationship}, ${m.strength})`).join(", ") || "nothing"}`);
        lines.push(`required by policies: ${host.policies.filter((p) => p.controls.includes(id)).map((p) => p.id).join(", ") || "none"}`);
      } else {
        const p = host.policies.find((x) => x.id === id);
        const c = host.checks.find((x) => x.id === id);
        const r = host.requirements.find((x) => x.id === id);
        if (p !== undefined) lines.push(`policy ${p.id}: ${p.title}`, p.rationale, `owner ${p.owner}; severity ${p.severity}; maps to ${p.controls.join(", ")}; shown by ${p.checks.join(", ") || "no check"}`);
        if (c !== undefined) lines.push(`check ${c.id}: ${c.ask}`, `runner ${c.runner.kind}; fresh for ${c.freshness}; shows ${c.controls.join(", ")}`);
        if (r !== undefined) lines.push(`requirement ${r.id} (${r.level}): ${r.statement}`, `verified by ${r.verification.mechanism}: ${r.verification.by}`);
      }
      return Promise.resolve(outcomeOf({ id, lines }, { text: lines.join("\n") }));
    },
  });

  const evidence = command({
    name: "evidence",
    summary: "List the evidence of the store, or verify that every object still has its digest.",
    options: {},
    operands: [{ name: "WHAT", help: "list (the default) or verify.", arity: "optional" }],
    examples: [{ args: ["verify"], says: "Read every object back and check its digest." }],
    action: { kind: "report", reach: READ },
    run: async (args) => {
      const store = host.store;
      if (store === undefined) return outcomeOf(null, { problems: [problem("fail", "no evidence store is configured", { code: "E-EVIDENCE-NO-STORE" })] });
      const what = args.positionals[0] ?? "list";
      if (what !== "list" && what !== "verify") return outcomeOf(null, { problems: [problem("fail", `${what} is not list or verify`, { code: "E000-USAGE-WHAT" })] });
      const items = await store.list();
      if (what === "list") return outcomeOf(items, { text: items.map((e) => `${e.digest}  ${e.observedAt}  ${e.subject}  ${e.type}`).join("\n") });
      const bad: string[] = [];
      for (const e of items) if ((await store.get(e.digest)).kind === "err") bad.push(e.digest);
      const faults = verifyManifest(makeManifest(items, "0".repeat(64), host.now()), items);
      return outcomeOf({ checked: items.length, bad, faults }, { problems: bad.map((d) => problem("fail", `the object ${d} does not have its digest`, { code: "E-EVIDENCE-DIGEST" })), text: `${items.length} objects, ${bad.length} do not match` });
    },
  });

  return branch({ name: "grc", summary: "Governance, risk and compliance: run checks, assess, explain and keep evidence.", children: [check, assessCmd, explain, evidence] });
}
