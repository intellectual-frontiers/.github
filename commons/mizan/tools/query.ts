// Spec: 0002-mizan-query FR-004
/**
 * Ask the trace of a library in SQL (commons mizan 0002-mizan-query):
 *
 * ```sh
 * bun tools/query.ts "SELECT rule, count(*) AS n FROM findings GROUP BY rule"
 * bun tools/query.ts --root ../quality "SELECT id FROM requirements WHERE NOT reviewed LIMIT 5"
 * ```
 *
 * @module
 */
import { path } from "@intellectual-frontiers/system";
import { main } from "@intellectual-frontiers/mizan/host/query";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

if (import.meta.main) {
  const r = await main(process.argv.slice(2), ROOT);
  for (const line of r.lines) console.log(line);
  process.exit(r.code);
}
