// Spec: 0005-runbooks-runners FR-008
/**
 * The entry of the command `runbooks`: `bun commons/runbooks/src/physical/main.ts check`.
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import { main } from "./cli.ts";

if (import.meta.main) {
  const code = await main(proc.args, { out: (t) => void console.log(t.replace(/\n$/u, "")), err: (t) => void console.error(t.replace(/\n$/u, "")) });
  proc.exit(code);
}
