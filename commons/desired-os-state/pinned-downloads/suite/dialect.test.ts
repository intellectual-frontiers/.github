/**
 * Tests of the dialect (commons desired-os-state-pinned-downloads 0004-pinned-downloads-dialect FR-001 to FR-007): its guarantees as data and that it meets the strictest control, the observation of a
 * store, of a program on the path (asked its version, with a limit, and a program that hangs), the plan file rendered from Desired OS State's order and plan with the real pins of the ontology, the steps
 * that name the digest, and the program: `check` changes nothing and says so by its status, `apply` installs with a real local server, a second `apply` changes nothing and fetches nothing, a wrong
 * hash and a pin with no download are told with the step and the next action, and the program runs as a program. Every name and byte is made up but the pins of the ontology.
 *
 * @module
 */
import { applyPermit } from "./permit.ts";
import { createServer, type Server } from "node:http";
import { Retries } from "@intellectual-frontiers/net/net";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { gzip, tar } from "@intellectual-frontiers/formats/archive";
import { buildOrder, planOf as planOfOrder } from "@intellectual-frontiers/desired-os-state/logical";
import { isGenerated, executionPlanOf, matrixOf } from "@intellectual-frontiers/desired-os-state/dialect";
import { defineRequirement, parseSubjectName, type RequirementId, type JsonValue } from "@intellectual-frontiers/desired-os-state/governance";
import { defineCatalog, defineTool, meetsIntegrity, requirementsFor, resolveTools, parseManagerId } from "@intellectual-frontiers/toolchain";
import { pinSourceFromOntology } from "@intellectual-frontiers/toolchain/ontology";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { DIALECT_ID, TOOL_DIALECT, jobOf, nativePinned, observeRequirements } from "../src/dialect.ts";
import { main, type Io } from "../src/bin.ts";
import { askWithin, observeJob, versionOf } from "../src/observe.ts";
import { planFileText, readPlanFile, type PlanFile, type Policy, type ToolJob } from "../src/plan-file.ts";
import { installTool, osHere, platformHere, storeOf, toolFolder, type Store } from "../src/store.ts";

const text = (s: string) => new TextEncoder().encode(s);
const ARCHIVE = (() => {
  const r = tar(new Map([["bin/jq", text("#!/bin/sh\necho jq-1.7.1\n")]]));
  if (r.kind === "err") throw new Error("tar");
  return gzip(r.value);
})();
const POLICY: Policy = { systemCopy: "never", integrity: "exact-hashed" };
const posix = proc.build.os !== "windows";

async function serve(body: Uint8Array): Promise<{ readonly url: string; readonly requests: () => number; readonly stop: () => Promise<void> }> {
  let count = 0;
  const server: Server = createServer((_req, res) => {
    count++;
    res.writeHead(200, { "content-length": String(body.length) });
    res.end(body);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { url: `http://127.0.0.1:${port}/jq.tar.gz`, requests: () => count, stop: () => new Promise<void>((ok) => server.close(() => ok())) };
}

async function job(url: string, more: Partial<ToolJob> = {}, sha?: string): Promise<ToolJob> {
  return { tool: "jq", version: "1.7.1", program: "jq", alsoNamed: [], versionArgs: ["--version"], minimum: null, source: { kind: "download", pin: "jq", version: "1.7.1", downloadUrl: url, sha256: sha ?? (await sha256(ARCHIVE)), archiveFormat: "tar", binPath: "bin" }, ...more };
}

function planOf(jobs: readonly ToolJob[], policy: Policy = POLICY): PlanFile {
  return { format: "pinned-downloads-plan/1", platform: platformHere() ?? "linux-x64", policy, jobs };
}

async function withHome<T>(f: (home: string, store: Store) => Promise<T>): Promise<T> {
  return fs.withTempDir(async (home) => {
    const env = (n: string) => (n === "XDG_DATA_HOME" || n === "LOCALAPPDATA" ? home : n === "HOME" || n === "USERPROFILE" ? home : undefined);
    const store = storeOf(env, osHere());
    if (store === undefined) throw new Error("no store");
    return f(home, store);
  });
}

function io(home: string, out: string[], more: Partial<Io> = {}): Io {
  return {
    out: (l) => void out.push(l),
    env: (n) => (n === "XDG_DATA_HOME" || n === "LOCALAPPDATA" || n === "HOME" || n === "USERPROFILE" ? home : undefined),
    path: "",
    ask: askWithin(3000),
    retries: new Retries({ tries: 2, base: 0, cap: 0 }, () => undefined, () => 0, () => Promise.resolve()),
    ...more,
  };
}

proves(["0004-pinned-downloads-dialect FR-001"], "the dialect declares its guarantees as data, and as a dialect of tools meets the strictest control", () => {
  const d = nativePinned({ policy: POLICY });
  assertEquals(String(d.id), DIALECT_ID);
  assertEquals([d.guarantees.plan, d.guarantees.idempotence, d.guarantees.destroy, d.guarantees.subjects], ["faithful", "proven", true, ["machine", "workstation"]]);
  assertEquals(d.guarantees.kinds.map(String), ["tool"]);
  const g = TOOL_DIALECT.guarantees;
  assertEquals([g.pin, g.integrity, g.scopes, g.binds, g.sourceBuild, g.platforms.length], ["exact", "hash", ["user"], "pin", false, 5]);
  assertEquals(meetsIntegrity("exact-hashed", g), []);
  const manager = parseManagerId("manager-brew");
  assert(manager.kind === "ok");
});

proves(["0004-pinned-downloads-dialect FR-002"], "the observation finds a tool in the store, a program on the path under its names, and a program that cannot be asked is unreadable within the limit", async () => {
  assertEquals(versionOf("jq-1.7.1"), "1.7.1");
  assertEquals(versionOf("git version 2.43.0"), "2.43.0");
  assertEquals(versionOf("nothing"), undefined);
  const server = await serve(ARCHIVE);
  try {
    await withHome(async (home, store) => {
      const spec = { tool: "jq", version: "1.7.1", platform: "linux-x64", os: store.os, program: "jq", downloadUrl: server.url, sha256: await sha256(ARCHIVE), archiveFormat: "tar" as const, binPath: "bin" };
      const empty = await observeJob(await job(server.url), store, { path: "", ask: askWithin(1000) });
      assertEquals([empty.seen, empty.location, empty.unreadable], [undefined, undefined, undefined]);
      assert((await installTool(store, spec, { retries: io(home, []).retries ?? new Retries({ tries: 1, base: 0, cap: 0 }, () => undefined) })).kind === "ok");
      const stored = await observeJob(await job(server.url), store, { path: "", ask: askWithin(1000) });
      assertEquals(stored.seen, { version: "1.7.1", from: "store" });
      assertEquals(stored.location, path.join(toolFolder(store, "jq", "1.7.1"), "bin", store.os === "windows" ? "jq.exe" : "jq"));
      const older = await observeJob(await job(server.url, { version: "9.9.9" }), store, { path: "", ask: askWithin(1000) });
      assertEquals(older.seen, { version: "1.7.1", from: "store" }, "another version of the store is the one found where the pinned one is not");
      if (!posix) return;
      const bin = path.join(home, "pathbin");
      await fs.mkdir(bin, { recursive: true });
      const write = async (name: string, body: string) => {
        await fs.writeTextFile(path.join(bin, name), `#!/bin/sh\n${body}\n`);
        await fs.chmod(path.join(bin, name), 0o755);
      };
      await write("othertool", 'echo "othertool 3.2.1"');
      await write("hangs", "sleep 30 &\nwait");
      await write("silent", "echo hello");
      const fresh = storeOf((n) => (n === "XDG_DATA_HOME" ? path.join(home, "other") : undefined), "linux");
      assert(fresh !== undefined);
      const base = await job(server.url);
      const found = await observeJob({ ...base, tool: "other", program: "othertool", alsoNamed: [] }, fresh, { path: bin, ask: askWithin(3000) });
      assertEquals(found.seen, { version: "3.2.1", from: "path" });
      const named = await observeJob({ ...base, tool: "other", program: "missing-program", alsoNamed: ["othertool"] }, fresh, { path: bin, ask: askWithin(3000) });
      assertEquals(named.seen, { version: "3.2.1", from: "path" }, "another name of the program is found");
      const started = Date.now();
      const hung = await observeJob({ ...base, tool: "hung", program: "hangs", alsoNamed: [] }, fresh, { path: bin, ask: askWithin(300) });
      assert(hung.seen === undefined && hung.unreadable !== undefined && Date.now() - started < 5000, "a program that hangs is unreadable within the limit");
      const quiet = await observeJob({ ...base, tool: "quiet", program: "silent", alsoNamed: [] }, fresh, { path: bin, ask: askWithin(3000) });
      assert(quiet.seen === undefined && quiet.unreadable?.includes("did not say its version") === true);
      const noArgs = await observeJob({ ...base, tool: "noargs", program: "othertool", versionArgs: [] }, fresh, { path: bin, ask: askWithin(3000) });
      assert(noArgs.unreadable?.includes("cannot be asked") === true);
    });
  } finally {
    await server.stop();
  }
});

/** Whether data is an object (a read-only list does not narrow away with Array.isArray). */
function isRecord(v: JsonValue | undefined): v is { readonly [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toolRequirements(platform: string) {
  const bun = defineTool({ name: "bun", summary: "Bun.", pin: "exact", program: "bun", versionArgs: ["--version"], phases: ["core"], scope: "user", alsoNamed: ["bunx"], bindings: [{ kind: "pin", pin: "bun" }] });
  assert(bun.kind === "ok");
  const catalog = defineCatalog([bun.value]);
  assert(catalog.kind === "ok");
  const resolution = resolveTools(catalog.value, ["bun"], [TOOL_DIALECT], pinSourceFromOntology(), { platform: platform as "linux-x64", preference: [TOOL_DIALECT.id], integrity: "exact-hashed", systemCopy: "never" });
  assert(resolution.kind === "ok", JSON.stringify(resolution.kind === "err" ? resolution.error : ""));
  const reqs = requirementsFor(resolution.value, { by: "all" });
  assert(reqs.kind === "ok");
  return reqs.value;
}

proves(["0004-pinned-downloads-dialect FR-003"], "the plan file is rendered from Desired OS State's order and plan with the real pins, says it is generated, holds no secret, and the steps name its digest", async () => {
  const platform = platformHere() ?? "linux-x64";
  const requirements = toolRequirements(platform);
  const name = parseSubjectName("build-01.example.test");
  assert(name.kind === "ok");
  const order = buildOrder({ subject: { name: name.value, class: "workstation" }, assurance: "regulated", layers: [{ layer: "baseline", requirements }] });
  assert(order.kind === "ok");
  const plan = planOfOrder(order.value, new Map());
  assertEquals(plan.entries.map((e) => e.action), ["create"]);
  const dialect = nativePinned({ policy: POLICY, platform });
  const rendered = await dialect.render(order.value, plan);
  assert(rendered.kind === "ok");
  const planText = rendered.value.files.get("pinned-downloads/plan.json") ?? "";
  assert(isGenerated(planText));
  const file = readPlanFile(planText);
  assert(file.kind === "ok");
  assertEquals(file.value.jobs.map((j) => [j.tool, j.program, j.alsoNamed, j.version !== null]), [["bun", "bun", ["bunx"], true]]);
  const source = file.value.jobs[0]?.source;
  assert(source?.kind === "download" && source.downloadUrl.startsWith("https://") && /^[0-9a-f]{64}$/.test(source.sha256) && source.downloadUrl.includes(source.version));
  assertEquals(/-----BEGIN|password|token/i.test(planText), false);
  const steps = dialect.steps(plan, rendered.value);
  assertEquals(steps.length, 1);
  const step = steps[0];
  assert(step !== undefined && step.apply.some((a) => a.includes(rendered.value.digest)) && step.check?.some((a) => a.includes(rendered.value.digest)) === true);
  assertEquals([step.apply[2], step.check?.[2], step.changedExit], ["apply", "check", 2]);
  const exec = executionPlanOf(plan, rendered.value, steps, await applyPermit(plan.subject.name, "2026-06-01T00:00:00Z"), "2026-06-01T00:00:00Z");
  assert(exec.kind === "ok" && exec.value !== undefined && exec.value.steps.length === 1);
  const r0 = requirements[0];
  assert(r0 !== undefined);
  const none = planOfOrder(order.value, new Map<RequirementId, JsonValue>([[r0.id, r0.desired]]));
  assertEquals(none.entries.map((e) => e.action), ["none"]);
  assertEquals(dialect.steps(none, rendered.value), [], "a plan that changes nothing has no step");
  const m = matrixOf(requirements, [dialect]);
  assertEquals(m.rows[0]?.cells[0]?.expressions.every((e) => e.state !== "unexpressed"), true, "the dialect expresses every annotation of a tool requirement");
  assert(jobOf(r0) !== undefined);
  const foreign = defineRequirement({ id: "x.y", summary: "x", why: ["x"], subject: { by: "all" }, kind: "tool", desired: { dialect: "homebrew" }, change: "additive" });
  assert(foreign.kind === "ok" && jobOf(foreign.value) === undefined, "a requirement for another dialect is not this dialect's job");
});

proves(["0004-pinned-downloads-dialect FR-002", "0004-pinned-downloads-dialect FR-006"], "Desired OS State is given the desired state for a tool installed as pinned, a differing state for another version, and nothing for an absent one", async () => {
  const server = await serve(ARCHIVE);
  try {
    await withHome(async (_home, store) => {
      const platform = platformHere() ?? "linux-x64";
      const reqs = toolRequirements(platform);
      const r = reqs[0];
      assert(r !== undefined);
      const ask = askWithin(1000);
      assertEquals((await observeRequirements(reqs, store, { policy: POLICY, path: "", ask })).size, 0, "an absent tool is not observed");
      const j = jobOf(r);
      assert(j !== undefined && j.source.kind === "download");
      const spec = { tool: "bun", version: j.source.version, platform, os: store.os, program: "bun", downloadUrl: server.url, sha256: await sha256(ARCHIVE), archiveFormat: "tar" as const, binPath: "bin" };
      const older = { ...spec, tool: "bun", version: "0.0.1", program: "jq" };
      assert((await installTool(store, older, { retries: new Retries({ tries: 1, base: 0, cap: 0 }, () => undefined, () => 0, () => Promise.resolve()) })).kind === "ok");
      const seen = await observeRequirements(reqs, store, { policy: POLICY, path: "", ask });
      assertEquals(seen.size, 1);
      const state = seen.get(r.id);
      assert(isRecord(state) && state["installedFrom"] === "store" && state["version"] === "0.0.1");
    });
  } finally {
    await server.stop();
  }
});

proves(["0004-pinned-downloads-dialect FR-004", "0004-pinned-downloads-dialect FR-005", "0004-pinned-downloads-dialect FR-006"], "check changes nothing and says so by its status; apply installs; a second apply changes nothing and fetches nothing", async () => {
  const server = await serve(ARCHIVE);
  try {
    await withHome(async (home, store) => {
      const file = path.join(home, "plan.json");
      await fs.writeTextFile(file, planFileText(planOf([await job(server.url)])));
      const out: string[] = [];
      assertEquals(await main(["check", file], io(home, out)), 2);
      assert(out.some((l) => l.includes("not found")) && out.some((l) => l.startsWith("⚡ jq 1.7.1: would install")), out.join("\n"));
      assertEquals(await fs.exists(store.root), false, "check wrote nothing");
      assertEquals(server.requests(), 0);

      out.length = 0;
      assertEquals(await main(["apply", file], io(home, out)), 0, out.join("\n"));
      assert(out.some((l) => l.startsWith("✅ jq 1.7.1: installed at")), out.join("\n"));
      assertEquals(server.requests(), 1);
      assert(await fs.exists(toolFolder(store, "jq", "1.7.1")));

      out.length = 0;
      assertEquals(await main(["apply", file], io(home, out)), 0);
      assert(out.some((l) => l.includes("found 1.7.1 in the store")) && out.some((l) => l.includes("as pinned, nothing to do")), out.join("\n"));
      assertEquals(server.requests(), 1, "the second apply fetched nothing");
      out.length = 0;
      assertEquals(await main(["check", file], io(home, out)), 0);

      const other = await job(server.url, { version: "2.0.0" });
      other.source.kind === "download" && (await fs.writeTextFile(file, planFileText(planOf([{ ...other, source: { ...other.source, version: "2.0.0" } }]))));
      out.length = 0;
      assertEquals(await main(["check", file], io(home, out)), 2);
      assert(out.some((l) => l.includes("would replace")), out.join("\n"));
    });
  } finally {
    await server.stop();
  }
});

proves(["0004-pinned-downloads-dialect FR-005", "0004-pinned-downloads-dialect FR-007"], "a wrong hash, a pin with no download and a plan that is not one are told with the step and the next action, and nothing is installed", async () => {
  const server = await serve(ARCHIVE);
  try {
    await withHome(async (home, store) => {
      const file = path.join(home, "plan.json");
      await fs.writeTextFile(file, planFileText(planOf([await job(server.url, {}, "a".repeat(64))])));
      const out: string[] = [];
      assertEquals(await main(["apply", file], io(home, out)), 1);
      assert(out.some((l) => l.startsWith("❌ jq: checksum failed") && l.includes("Next:")), out.join("\n"));
      const fetched = server.requests();
      assertEquals(await fs.exists(toolFolder(store, "jq", "1.7.1")), false);

      const unpinned: ToolJob = { ...(await job(server.url)), source: { kind: "unpinned", pin: "jq", reason: "no address was found in the repository" } };
      await fs.writeTextFile(file, planFileText(planOf([unpinned])));
      out.length = 0;
      assertEquals(await main(["apply", file], io(home, out)), 1);
      assert(out.some((l) => l.startsWith("⚠️ jq 1.7.1: the pin jq has no download here: no address was found") && l.includes("Next:")), out.join("\n"));
      assertEquals(server.requests(), fetched, "a pin with no download is not fetched");

      await fs.writeTextFile(file, "{ not a plan");
      out.length = 0;
      assertEquals(await main(["apply", file], io(home, out)), 1);
      assert(out[0]?.includes("is not a plan of this dialect") === true);
      out.length = 0;
      assertEquals(await main(["apply", path.join(home, "missing.json")], io(home, out)), 1);
      assertEquals(await main(["frobnicate"], io(home, out)), 64);
      assertEquals(await main(["clean"], io(home, [])), 0);
      assertEquals(await main(["check", file], { ...io(home, []), env: () => undefined }), 1, "no home, no store");
    });
  } finally {
    await server.stop();
  }
});

proves(["0004-pinned-downloads-dialect FR-004"], "the program runs as a program: apply installs, and a second run changes nothing", async () => {
  const server = await serve(ARCHIVE);
  try {
    await withHome(async (home, store) => {
      const file = path.join(home, "plan.json");
      await fs.writeTextFile(file, planFileText(planOf([await job(server.url)])));
      const entry = path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
      const env = { XDG_DATA_HOME: home, LOCALAPPDATA: home, HOME: home, USERPROFILE: home };
      const first = await proc.run([proc.execPath(), entry, "apply", file], { env });
      assertEquals(first.code, 0, `${first.stdout}${first.stderr}`);
      assert(/(installed|replaced) at/.test(first.stdout), `[${first.stdout}] [${first.stderr}]`);
      assert(await fs.exists(toolFolder(store, "jq", "1.7.1")));
      const second = await proc.run([proc.execPath(), entry, "check", file], { env });
      assertEquals(second.code, 0, `${second.stdout}${second.stderr}`);
      assertEquals(server.requests(), 1);
    });
  } finally {
    await server.stop();
  }
});

proves(["0004-pinned-downloads-dialect FR-001"], "the plan file is read back, and what is not one is refused with the reason", async () => {
  const file = planOf([await job("https://example.test/jq")]);
  const text1 = planFileText(file);
  assert(text1.includes("GENERATED") && text1.endsWith("\n"));
  const back = readPlanFile(text1);
  assert(back.kind === "ok");
  assertEquals(back.value, file);
  for (const bad of ["", "[]", '{"format":"x"}', JSON.stringify({ format: "pinned-downloads-plan/1", platform: "p", policy: { systemCopy: "x", integrity: "rolling" }, jobs: [] }), JSON.stringify({ format: "pinned-downloads-plan/1", platform: "p", policy: { systemCopy: "never", integrity: "rolling" }, jobs: [{}] })]) {
    assertEquals(readPlanFile(bad).kind, "err", bad);
  }
});
