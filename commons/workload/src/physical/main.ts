// Spec: 0001-workload-layers FR-006
/**
 * The entry of the command `workload`: `bun commons/workload/src/physical/main.ts check`.
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import { main } from "./cli.ts";

if (import.meta.main) {
  const code = await main(proc.args, { out: (t) => void console.log(t.replace(/\n$/u, "")), err: (t) => void console.error(t.replace(/\n$/u, "")) });
  proc.exit(code);
}
