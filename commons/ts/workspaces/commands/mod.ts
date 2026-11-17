/**
 * The typed built-in modules of `ifws` (commons 0025-ifws FR-001, FR-004, FR-007): `BUILTIN_MODULES` is the one registry, a documented array of `IfwsModule` values whose every entry the compiler
 * checks, in the order `ifws list` shows them. `setup` and `tools` wrap the plain functions of `setup/host/apply.ts` and `tools/host/tools.ts` and are the two modules of this array that
 * may install or probe a tool; the registry stays open to more.
 *
 * @module
 */
import type { IfwsModule } from "../modules/types.ts";
import { applyModule, planModule } from "./plan.ts";
import { doctorModule } from "./doctor.ts";
import { helpModule, listModule } from "./list.ts";
import { hookModule } from "./hook.ts";
import { initModule } from "./init.ts";
import { setupModule } from "./setup.ts";
import { shellModule } from "./shell.ts";
import { statusModule } from "./status.ts";
import { toolsModule } from "./tools.ts";
import { renderModule, verifyModule } from "./verify.ts";
import { worktreeModule } from "./worktree.ts";

/** The modules `ifws` holds, built in, in the order `ifws list` names them. `setup` is the only one that changes the host (0025-ifws FR-017). */
export const BUILTIN_MODULES: readonly IfwsModule[] = [
  initModule,
  planModule,
  applyModule,
  statusModule,
  doctorModule,
  verifyModule,
  renderModule,
  worktreeModule,
  listModule,
  helpModule,
  shellModule,
  setupModule,
  toolsModule,
  hookModule,
];
