// Spec: 0004-workload-projections FR-005, FR-008
/**
 * The dialect of Claude Code: the index of skills, a skill for each workload, whatever its form, and the permissions of its settings, derived from the effects: a rule `Bash(<command> *)` in `allow` for each verb whose
 * nodes are all `agent-autonomous` or `agent-acts-human-reviews`, in `ask` for `agent-proposes` and in `deny` for `human-only`. The same autonomy for each node as in every dialect, and the same bytes for the same workloads.
 *
 * @module
 */
import { DIALECTS } from "@intellectual-frontiers/workload/governance";
import { type DialectImpl, rulesOf, skillMd, skillsIndex } from "@intellectual-frontiers/workload/logical";

const info = DIALECTS.get("claude-code");
if (info === undefined) throw new Error("the dialect claude-code is registered by the core");

/** The dialect. */
export const dialect: DialectImpl = {
  info,
  render: (views, options = {}) => {
    const r = rulesOf(views, options);
    return [
      { path: "SKILLS.md", text: skillsIndex(views) },
      ...[...views].sort((a, b) => (a.id < b.id ? -1 : 1)).map((v) => ({ path: `.claude/skills/${v.id}/SKILL.md`, text: skillMd(v, undefined, options) })),
      { path: ".claude/workload.settings.json", text: `${JSON.stringify({ permissions: { allow: r.allow, ask: r.ask, deny: r.deny } }, null, 2)}\n` },
    ];
  },
};
