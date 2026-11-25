// Spec: 0004-workload-projections FR-005, FR-007
/**
 * The dialect of Codex: a block of `AGENTS.md`, which Codex reads, with the same autonomy for each node as every dialect and the rules in words. Its format of a skill file could not be verified, so it writes `AGENTS.md`
 * text and no skill file (0004-workload-projections FR-007).
 *
 * @module
 */
import { DIALECTS } from "@intellectual-frontiers/workload/governance";
import { type DialectImpl, nodeLines, rulesOf, verbCommandOf, VerbCommandError, WORKLOAD_MARKS } from "@intellectual-frontiers/workload/logical";

const info = DIALECTS.get("codex");
if (info === undefined) throw new Error("the dialect codex is registered by the core");

const word = (s: string): string => s.replace(/\s+/gu, " ").trim();

/** The dialect. */
export const dialect: DialectImpl = {
  info,
  render: (views, options = {}) => {
    const r = rulesOf(views, options);
    const command = verbCommandOf(options);
    if (command.kind === "err") throw new VerbCommandError(command.error);
    const sorted = [...views].sort((a, b) => (a.id < b.id ? -1 : 1));
    const bare = (xs: readonly string[]): string => (xs.length === 0 ? "none" : xs.map((x) => x.replace(/^Bash\(|\)$/gu, "")).join("; "));
    const text = [
      WORKLOAD_MARKS.begin,
      "## Workloads",
      "",
      `Generated from the workloads of the library; do not edit between the marks. You orchestrate; every effect is a verb of the pinned packages, called as \`${command.value} <id>\`. A judge only proposes. At an ask or a gate stop and hand back.`,
      "",
      `Verbs you may call: ${bare(r.allow)}.`,
      `Verbs you propose and a person applies: ${bare(r.ask)}.`,
      `Verbs a person alone calls: ${bare(r.deny)}.`,
      "",
      ...sorted.flatMap((v) => [`### ${v.id}`, "", word(v.summary), "", ...nodeLines(v), ""]),
      WORKLOAD_MARKS.end,
    ].join("\n");
    return [{ path: "AGENTS.md", text: `${text}\n` }];
  },
};
