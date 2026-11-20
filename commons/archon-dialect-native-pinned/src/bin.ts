// Spec: 0004-native-pinned-dialect FR-004, FR-005, FR-006, FR-007
/**
 * The program of the dialect, which the steps of the dialect run: `check PLAN` changes nothing and says, tool by tool, whether it is as pinned, would be installed or would be replaced, ending with the
 * status 2 where something would change; `apply PLAN` does it, and a second `apply` of the same plan changes nothing; `clean [--programs]` removes what can be got again. Before it acts it says,
 * for each tool, where it was found or that it was not; every failure names the tool, the step, what it saw and the one action that is next.
 *
 * ```sh
 * bun bin.ts check .archon/<digest>/native-pinned/plan.json
 * bun bin.ts apply .archon/<digest>/native-pinned/plan.json
 * bun bin.ts clean --programs
 * ```
 *
 * @module
 */
import process from "node:process";
import { Retries } from "@intellectual-frontiers/net/net";
import { sha256Of } from "@intellectual-frontiers/crypto/sha256";
import * as fs from "@intellectual-frontiers/system/fs";
import * as proc from "@intellectual-frontiers/system/proc";
import { actionFor } from "@intellectual-frontiers/toolchain/logical";
import { askWithin, observeJob, type Ask } from "./observe.ts";
import { readPlanFile, type PlanFile, type ToolJob } from "./plan-file.ts";
import { cleanStore, describeFailure, installTool, osHere, storeOf, type Store } from "./store.ts";

/** What the program reads from and says to the world; a test passes its own. */
export type Io = {
  readonly out: (line: string) => void;
  readonly env: (name: string) => string | undefined;
  /** The PATH to look in. */
  readonly path: string | undefined;
  readonly ask: Ask;
  readonly retries?: Retries;
};

function usage(io: Io): number {
  io.out("usage: bin check PLAN | bin apply PLAN | bin clean [--programs]");
  return 64;
}

async function observe(job: ToolJob, store: Store, plan: PlanFile, io: Io) {
  const o = await observeJob(job, store, { path: io.path, ask: io.ask });
  const action = actionFor({ seen: o.seen, version: job.version ?? undefined, minimum: job.minimum ?? undefined, systemCopy: plan.policy.systemCopy, integrity: plan.policy.integrity });
  return { o, action };
}

function where(job: ToolJob, o: { readonly seen: { readonly version: string; readonly from: string } | undefined; readonly location: string | undefined; readonly unreadable: string | undefined }): string {
  if (o.seen !== undefined) return `found ${o.seen.version} ${o.seen.from === "store" ? "in the store" : "on the path"} at ${o.location ?? "?"}`;
  if (o.unreadable !== undefined) return `found at ${o.location ?? "?"} but unreadable: ${o.unreadable}`;
  return `not found (${job.program})`;
}

/** Runs the program with its arguments and returns its exit status. */
export async function main(argv: readonly string[], io: Io): Promise<number> {
  const [command, arg] = argv;
  const store = storeOf(io.env, osHere());
  if (store === undefined) {
    io.out("❌ no home folder was found, so there is no store to put tools in. Next: set HOME (or USERPROFILE on Windows) and run again");
    return 1;
  }
  if (command === "clean") {
    const done = await cleanStore(store, { programs: arg === "--programs" });
    if (done.length === 0) io.out("✅ nothing to clean");
    for (const c of done) io.out(`🧹 removed ${c.what} (${c.bytes} bytes): ${c.path}`);
    return 0;
  }
  if ((command !== "check" && command !== "apply") || arg === undefined) return usage(io);

  const text = await fs.readTextOr(arg);
  if (text === undefined) {
    io.out(`❌ the plan file ${arg} could not be read. Next: run the render again and use the path it gives`);
    return 1;
  }
  const plan = readPlanFile(text);
  if (plan.kind === "err") {
    io.out(`❌ ${arg} is not a plan of this dialect: ${plan.error}. Next: render it again`);
    return 1;
  }

  let changes = 0;
  let failures = 0;
  for (const job of plan.value.jobs) {
    const label = `${job.tool}${job.version === null ? "" : ` ${job.version}`}`;
    const { o, action } = await observe(job, store, plan.value, io);
    io.out(`${label}: ${where(job, o)}`);
    if (action === "none") {
      io.out(`✅ ${label}: as pinned, nothing to do`);
      continue;
    }
    if (job.source.kind === "unpinned") {
      failures++;
      io.out(`⚠️ ${label}: the pin ${job.source.pin} has no download here: ${job.source.reason}. Next: add the publisher's address and checksum to the packaging ontology`);
      continue;
    }
    changes++;
    if (command === "check") {
      io.out(`⚡ ${label}: would ${action}`);
      continue;
    }
    const sum = sha256Of(job.source.sha256);
    if (sum === undefined) {
      failures++;
      io.out(`❌ ${label}: the SHA-256 in the plan is not a SHA-256. Next: render the plan again`);
      continue;
    }
    const retries = io.retries ?? new Retries({ tries: 4, base: 2, cap: 30 }, (line) => io.out(line));
    const done = await installTool(store, { tool: job.tool, version: job.source.version, platform: plan.value.platform, os: store.os, program: job.program, downloadUrl: job.source.downloadUrl, sha256: sum, archiveFormat: job.source.archiveFormat, binPath: job.source.binPath }, { retries });
    if (done.kind === "err") {
      failures++;
      io.out(`❌ ${describeFailure(done.error)}`);
    } else io.out(`✅ ${label}: ${action === "install" ? "installed" : "replaced"} at ${done.value.program}`);
  }
  if (failures > 0) return 1;
  return command === "check" && changes > 0 ? 2 : 0;
}

if (import.meta.main) {
  process.exitCode = await main(proc.args, {
    out: (line) => process.stdout.write(`${line}\n`),
    env: (name) => process.env[name],
    path: process.env["PATH"],
    ask: askWithin(5000),
  });
}
