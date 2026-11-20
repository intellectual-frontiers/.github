// Spec: 0007-grc-surface FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
// Spec: 0011-grc-bundles FR-010, FR-011, FR-012
/**
 * The headless verbs of GRC (0007-grc-surface, 0011-grc-bundles): a branch `grc` with `check`, `assess`, `explain`, `evidence` and `bundle verify`, made with Headless (commons headless 0002-headless-governance,
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
import { branch, type Catalogue, catalogueProblems, command, explainText, type Node, outcomeOf } from "@intellectual-frontiers/headless/logical";
import { defineReach, isProblemCode, problem } from "@intellectual-frontiers/headless/governance";
import { value } from "@intellectual-frontiers/terminal/args";
import { fs } from "@intellectual-frontiers/system";
import { type Check, controlUrns, type Crosswalk, type Exception, type Framework, mappedControls, type Policy, type Requirement } from "@intellectual-frontiers/grc/governance";
import { assess, type Evidence, newestResults, rollup, type Result, type Serializers, verifyManifest, makeManifest } from "@intellectual-frontiers/grc/logical";
import { applyExceptions } from "@intellectual-frontiers/grc/logical";
import {
  type BundleFinding,
  bundleOk,
  codeOfFinding,
  codeOfKind,
  describeFinding,
  type EvidenceStore,
  FINDING_KINDS,
  readBundle,
  readTrust,
  runChecks,
  type Runners,
  type Signers,
  type Subject,
  verifyBundle,
} from "@intellectual-frontiers/grc/physical";
import { instantMs } from "@intellectual-frontiers/grc/governance";

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
  /** The signers that verify a bundle's signature, by id (`bundle verify --signer`, `dsse` by default). */
  readonly signers?: Signers;
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


const WHAT: Readonly<Record<(typeof FINDING_KINDS)[number], readonly [title: string, what: string, why: string, fix: string]>> = {
  "document-invalid": ["A file of the bundle is not a valid document", "A file is absent, is not JSON or does not decode as its kind.", "The bundle was cut, edited or made by another release.", "Make the bundle again from its source; do not edit its files."],
  "kind-unknown": ["A document is of a kind no reader knows", "A file holds a document whose kind this release does not register.", "The bundle was made by software that has other kinds.", "Verify it with the release that made it, or make it again."],
  "schema-unknown": ["A document is of a schema this release does not read", "A file holds a document of another schema than this release reads.", "The bundle was made by another release of the library.", "Verify it with the release that made it."],
  "not-canonical": ["A file is not in canonical form", "A file does not equal the RFC 8785 canonical form of its content.", "It was edited, reformatted or written by a tool that does not canonicalize.", "Write the manifest, ledger and evidence list in canonical form, then sign again."],
  "item-missing": ["An item the manifest lists is missing", "The manifest names an item that items/<digest> does not hold.", "The item was removed or never copied.", "Restore the item from the evidence store."],
  "item-hash-mismatch": ["An item does not have its digest", "The SHA-256 of an item's bytes is not the digest it is named by.", "The item was changed after it was kept.", "Restore the item from the store; treat the bundle as tampered with until then."],
  "item-size-mismatch": ["An item has another size than the manifest says", "The length of an item is not the size in the manifest.", "The item was truncated or the manifest was written wrongly.", "Restore the item and make the manifest again."],
  "item-extra": ["The bundle holds an item the manifest does not list", "An object of items/ is not in the manifest.", "An item was added after signing.", "Remove it, or make and sign a new manifest that lists it."],
  "chain-broken": ["The ledger's hash chain is broken", "An entry was changed, removed, inserted or reordered, or the ledger ends before the head the manifest names.", "The ledger was edited or cut off.", "Restore the ledger from its source; the entry named is the first at fault."],
  "evidence-expired": ["Evidence is past its retention", "An item of evidence was observed longer ago than the evidence policy keeps it.", "The bundle is old, or the policy's retention is short.", "Collect the evidence again, or verify at an instant inside the retention with --at."],
  "signature-absent": ["The bundle has no signature", "There is no signature.json, or it holds no signature.", "The bundle was never signed.", "Sign the canonical manifest with a trusted key."],
  "signature-bad": ["A signature does not verify", "A signature fails with the key the verifier trusts, or signs something other than the manifest.", "The manifest changed after signing, or the key is not the signer's.", "Sign the manifest again with the right key."],
  "signer-unallowed": ["The signer is not allowed", "The key is not trusted, its role may not attest by the evidence policy, or the signer's custody is weaker than the policy needs.", "The keys file or the policy of the verifier does not allow this signer.", "Sign with an allowed key, or correct the keys file and the policy if the verifier is wrong."],
};

/**
 * The explanation of every problem code `grc bundle verify` gives, for `grc explain <code>`.
 *
 * @example
 * ```ts
 * BUNDLE_CATALOGUE["E-BUNDLE-ITEM-MISSING"]?.title; // "An item the manifest lists is missing"
 * ```
 */
export const BUNDLE_CATALOGUE: Catalogue = {
  ...Object.fromEntries(FINDING_KINDS.map((k) => [codeOfKind(k), { title: WHAT[k][0], what: WHAT[k][1], why: WHAT[k][2], fix: WHAT[k][3] }])),
  "E-BUNDLE-UNREADABLE": {
    title: "The bundle, the keys or the policy could not be read",
    what: "A folder or a file the verification needs is missing or unreadable.",
    why: "The path is wrong, or the file is not there.",
    fix: "Check the paths given to bundle verify, --keys and --policy.",
  },
};

/**
 * The problems of `BUNDLE_CATALOGUE`, as data: none.
 *
 * @example
 * ```ts
 * bundleCatalogueProblems(); // []
 * ```
 */
export function bundleCatalogueProblems(): readonly string[] {
  return catalogueProblems(BUNDLE_CATALOGUE);
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
    summary: "Say what a control, policy, check or requirement is, what it maps to and what shows it, or what a problem code of `bundle verify` means.",
    options: {},
    operands: [{ name: "ID", help: "A control URN, the id of a policy, a check or a requirement, or a problem code (E-BUNDLE-...).", arity: "one" }],
    examples: [{ args: ["urn:grc:example:1:A-1"], says: "Explain a control." }],
    action: { kind: "report", reach: READ },
    run: (args) => {
      const [id] = args.positionals;
      if (id !== undefined && isProblemCode(id.toUpperCase()) && BUNDLE_CATALOGUE[id.toUpperCase()] !== undefined) {
        const text = explainText(BUNDLE_CATALOGUE, { program: "grc" }, id);
        return Promise.resolve(outcomeOf({ id, lines: text.split("\n") }, { text }));
      }
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


  const verify = command({
    name: "verify",
    summary: "Verify a whole evidence bundle offline: items, ledger chain, canonical form, signature and retention.",
    options: {
      keys: value({ short: "k", help: "The file of the public keys the verifier trusts: { \"keys\": [{ keyid, role, jwk }] }.", valueName: "FILE" }),
      policy: value({ short: "p", help: "The evidence policy file (a grc.evidence-policy document).", valueName: "FILE" }),
      at: value({ short: "t", help: "The instant to verify at (ISO 8601 with a zone); now where none is given.", valueName: "INSTANT" }),
      signer: value({ short: "s", help: "The id of the signer that verifies; dsse where none is given.", valueName: "ID" }),
    },
    operands: [{ name: "BUNDLE", help: "The folder of the bundle.", arity: "one" }],
    examples: [{ args: ["./bundle", "--keys", "keys.json", "--policy", "policy.json"], says: "Verify the bundle in ./bundle." }],
    action: { kind: "report", reach: READ },
    run: async (args) => {
      const usage = (message: string) => outcomeOf(null, { problems: [problem("fail", message, { code: "E000-USAGE-BUNDLE" })], exit: "usage" });
      const [dir] = args.positionals;
      const { keys, policy, at: asked, signer: signerId } = args.options;
      if (dir === undefined) return usage("a bundle folder is needed");
      if (keys === undefined || policy === undefined) return usage("--keys and --policy are needed: the verifier gives the trust, the bundle does not");
      const at = asked ?? host.now();
      if (instantMs(at) === undefined) return usage(`${at} is not an ISO 8601 instant with a zone`);
      const signer = host.signers?.get(signerId ?? "dsse");
      if (signer === undefined) return usage(`${signerId ?? "dsse"} is not a signer; registered: ${host.signers?.list().map((s) => s.id).join(", ") || "none"}`);
      const unreadable = (message: string) => outcomeOf(null, { problems: [problem("fail", message, { code: "E-BUNDLE-UNREADABLE" })], exit: "environment" });
      const contents = await readBundle(dir);
      if (contents.kind === "err") return unreadable(contents.error);
      const trust = await readTrust(policy, keys, signer);
      if (trust.kind === "err") return unreadable(trust.error);
      const report = await verifyBundle(contents.value, trust.value, at);
      const problems = report.findings.map((f: BundleFinding) => problem("fail", describeFinding(f), { code: codeOfFinding(f), fix: `grc explain ${codeOfFinding(f)}` }));
      const text = bundleOk(report) ? `${report.items} items, ${report.entries} ledger entries: the bundle verifies` : `${report.findings.length} findings in ${report.items} items and ${report.entries} ledger entries`;
      return outcomeOf(report, { problems, text });
    },
  });

  const bundle = branch({ name: "bundle", summary: "Evidence bundles: verify one offline.", children: [verify] });
  return branch({ name: "grc", summary: "Governance, risk and compliance: run checks, assess, explain and keep evidence.", children: [check, assessCmd, explain, evidence, bundle] });
}
