/**
 * The `versions` tool as a rule plugin of Mizan (commons 0026-works-versioning FR-032), for what a folder can judge offline: that every `release.ts` under the root decodes, that each version matches
 * the pattern of its kind's scheme, that a specification has none and that the revision of a controlled document has its approval. The comparison with a base is the command's (`../versions.ts`).
 *
 * @remarks
 * A plugin runs once for each specification and the records belong to the harness, so the plugin reports them only for the specification it is anchored to (the first of the folder), as the
 * `changes` plugin does, and `holdHarness` anchors it. A controlled document with no approval is in the gate phase: it fails whatever the baseline holds (FR-013); the other findings are held by
 * the baseline like any of Mizan's.
 *
 * @limits
 * It reads no Git and no clock.
 *
 * @example
 * ```ts
 * import { versionsPlugin } from "./plugin.ts";
 * versionsPlugin([{ path: "lib/release.ts", text: "export const release = 1;" }], "0001-x").check({ slug: "0001-x", spec: "" }).length; // 1
 * ```
 *
 * @module
 */
import type { MizanFinding, RulePlugin } from "../rules.ts";
import { recordFindings } from "./judge.ts";
import { folderOf } from "./works.ts";

/** A record found under the root: its path from the root, with `/`, and its text. */
export type WorkFile = { readonly path: string; readonly text: string };

/** The plugin that judges the records under a root, reporting them for the specification named `anchor` only. */
export function versionsPlugin(works: readonly WorkFile[], anchor: string | undefined): RulePlugin {
  return {
    id: "versions/record-invalid",
    check: (s) => {
      if (s.slug !== (anchor ?? "")) return [];
      const out: MizanFinding[] = [];
      const slugs = new Map<string, string>();
      for (const w of [...works].sort((a, b) => (a.path < b.path ? -1 : 1))) {
        const r = recordFindings(folderOf(w.path), w.text);
        for (const f of r.found)
          out.push({
            file: f.file,
            line: 1,
            rule: f.rule,
            message: f.message,
            key: `${f.rule} ${f.file} ${f.message}`,
            ...(f.rule === "versions/approval-missing" ? { severity: "gate" as const } : {}),
          });
        if (r.record !== undefined) {
          const slug: string = r.record.release.slug;
          const other = slugs.get(slug);
          if (other !== undefined)
            out.push({
              file: r.record.file,
              line: 1,
              rule: "versions/record-invalid",
              message: `the slug ${slug} is also the slug of ${other}: a slug names one work`,
              key: `versions/record-invalid ${r.record.file} slug ${slug}`,
            });
          else slugs.set(slug, r.record.file);
        }
      }
      return out;
    },
  };
}
