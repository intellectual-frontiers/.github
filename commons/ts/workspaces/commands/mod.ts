/**
 * The typed built-in modules of `ifws` (commons 0025-ifws FR-001, FR-004, FR-007): `BUILTIN_MODULES` is the one registry, a documented array of `IfwsModule` values whose every entry the compiler
 * checks, in the order `ifws list` shows them. `ifws setup` and `ifws tools` are another milestone's modules and are registered nowhere here: they are added to this array (`BUILTIN_MODULES`), where
 * they are wired in, so that this registry stays open to them.
 *
 * @module
 */
import type { IfwsModule } from "../modules/types.ts";
import { applyModule, planModule } from "./plan.ts";
import { doctorModule } from "./doctor.ts";
import { helpModule, listModule } from "./list.ts";
import { hookModule } from "./hook.ts";
import { initModule } from "./init.ts";
import { shellModule } from "./shell.ts";
import { statusModule } from "./status.ts";
import { renderModule, verifyModule } from "./verify.ts";
import { worktreeModule } from "./worktree.ts";

/** The modules `ifws` holds, built in, in the order `ifws list` names them. `setupModule` and `toolsModule` (workspaces/setup/ and workspaces/tools/) are added to this array where they are wired in. */
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
  hookModule,
];
