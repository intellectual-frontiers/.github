// Spec: 0003-repoctl-sync FR-007
/**
 * `repoctl check`, `repoctl status` and `repoctl doctor` on Headless (commons repoctl 0003-repoctl-sync FR-007, FR-009; 0004-repoctl-status-release FR-001 to FR-003; 0005-repoctl-library-commit-doctor FR-008): the verbs that only read. `check`
 * runs every check of the repository and ends in one calm report whose findings carry a code that `repoctl explain <code>` explains; `status` tells each library's version in the repository, on npm and in its tag, as a table or as JSON, without
 * the network with `--offline`; `doctor` says what is wrong with the checkout and what to do.
 *
 * @example
 * ```ts
 * import { checkVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof checkVerb; // "function"
 * ```
 *
 * @module
 */
import { diagnose, findingsOfStatus, gatherFacts, reportOk, runCheck, runStatus, type CheckReport, tableOf } from "@intellectual-frontiers/repoctl/logical";
import { flag } from "@intellectual-frontiers/terminal/args";
import { defineVerb, generatorsOf, outcomeOfDone, outcomeOfEnvironment } from "../define.ts";

/** The lines of a check report for a person: one for each section, its mark and its title. */
export function checkText(r: CheckReport): string {
  const lines = r.sections.map((s) => {
    const failed = s.findings.filter((f) => f.level === "fail").length;
    const warned = s.findings.length - failed;
    return `${failed > 0 ? "FAIL" : warned > 0 ? "warn" : "ok  "}  ${s.title}${failed + warned > 0 ? ` (${failed + warned})` : ""}`;
  });
  const bad = r.sections.flatMap((s) => s.findings).length;
  return [...lines, ...(bad === 0 ? [] : ["explain a code: repoctl explain <code>"])].join("\n");
}

/** `repoctl check`. */
export const checkVerb = defineVerb({
  name: "check",
  id: "check",
  options: {},
  examples: [
    { args: [], says: "Run every check: the generated files, the specification kits, the rules of Mizan, the versions and the constants that say a version." },
    { args: ["--json"], says: "The same, as one JSON document: each section with its findings, their codes and their fixes." },
  ],
  run: async (_args, _ctx, w, host) => {
    const report = await runCheck(w, generatorsOf(host));
    const findings = report.sections.flatMap((s) => s.findings);
    const first = findings.find((f) => f.level === "fail");
    return outcomeOfDone({
      data: { ok: reportOk(report), sections: report.sections.map((s) => ({ id: s.id, title: s.title, findings: s.findings })) },
      text: checkText(report),
      findings,
      next: first === undefined ? [] : [first.fix, `repoctl explain ${first.code}`],
      title: "Every check passes",
    });
  },
});

/** `repoctl status`. */
export const statusVerb = defineVerb({
  name: "status",
  id: "status",
  options: { offline: flag({ help: "Ask no network: npm is not asked, and the tags are those of the local clone." }) },
  examples: [
    { args: [], says: "The version of each library in the repository, on npm and in its tag." },
    { args: ["--offline"], says: "The same without the network: npm is not asked and the tags are the local ones." },
    { args: ["--json"], says: "The rows as one JSON document." },
  ],
  run: async (args, _ctx, w) => {
    const r = await runStatus(w, { offline: args.options.offline });
    if (r.kind === "err") return outcomeOfEnvironment(r.error);
    return outcomeOfDone({ data: r.value, text: tableOf(r.value), findings: findingsOfStatus(r.value), title: "Status" });
  },
});

/** `repoctl doctor`. */
export const doctorVerb = defineVerb({
  name: "doctor",
  id: "doctor",
  options: {},
  examples: [{ args: [], says: "What is wrong with this checkout, in the order to fix it, and the command for each." }],
  run: async (_args, _ctx, w, host) => {
    const facts = await gatherFacts(w, generatorsOf(host));
    const findings = diagnose(facts);
    const first = findings.find((f) => f.level === "fail");
    const lines = [
      `git      ${facts.git.works ? (facts.git.inside ? "a working tree" : "not a working tree") : "not available"}`,
      `install  ${facts.installed ? "node_modules present" : "node_modules missing"}`,
      `links    ${facts.unlinked.length === 0 ? "every library linked" : `${facts.unlinked.length} not linked`}`,
      `node     ${facts.node ?? "not available"}`,
      `bun      ${facts.bun ?? "not available"} (pinned ${facts.pinnedBun ?? "unknown"})`,
      `files    ${facts.stale.length === 0 ? "generated files current" : `${facts.stale.length} stale`}`,
    ];
    return outcomeOfDone({
      data: { git: facts.git, installed: facts.installed, unlinked: facts.unlinked, node: facts.node ?? null, bun: facts.bun ?? null, pinnedBun: facts.pinnedBun ?? null, stale: facts.stale.map((f) => f.message) },
      text: lines.join("\n"),
      findings,
      next: first === undefined ? [] : [first.fix],
      title: "This checkout is in order",
    });
  },
});
