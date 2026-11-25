// Spec: 0005-workbench-resolution FR-004
/**
 * The entry of the command `workbench`: `bun commons/workbench/src/physical/main.ts ready ...`. It passes the real folder, environment and day to `main`.
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import { main } from "./cli.ts";

if (import.meta.main) {
  const code = await main(proc.args, {
    cwd: proc.cwd(),
    env: proc.env.toObject(),
    today: new Date().toISOString().slice(0, 10),
    out: (t) => void console.log(t.replace(/\n$/u, "")),
    err: (t) => void console.error(t.replace(/\n$/u, "")),
  });
  proc.exit(code);
}
