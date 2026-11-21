// Spec: 0002-telemetry-query FR-005
/**
 * Ask a journal of signals in SQL (commons telemetry 0002-telemetry-query):
 *
 * ```sh
 * bun tools/query.ts journal.jsonl -- "SELECT name, duration_ms FROM spans ORDER BY duration_ms DESC LIMIT 5"
 * ```
 *
 * @module
 */
import { main } from "@intellectual-frontiers/telemetry/host/query";

if (import.meta.main) {
  const r = await main(process.argv.slice(2));
  for (const line of r.lines) console.log(line);
  process.exit(r.code);
}
