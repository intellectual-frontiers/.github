/**
 * Tests of the tool server, the key line, the jobs and the registration (commons ergonex 0006-agents FR-020 to FR-026, FR-038): the REAL program, started as a process and spoken to over its standard input and
 * output as a client does, with a real key made by `ssh-keygen`, real detached processes for the jobs, and a real folder of a tenant. The tool server is also proved by a client Ergonex did not write: the real
 * `claude mcp list` (FR-023) in ergonex-agents.test.ts, where Claude Code is installed.
 *
 * @module
 */
import { chmod, existsSync, mkdir, readTextFile, writeTextFile } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { execPath, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { handshakeInput, readHandshake } from "../src/agents/mcp-probe.ts";
import { serverTier } from "../src/commands/mcp.ts";
import { Ergonex, needsWorld, ONE_REPOSITORY, withWorld, type World } from "./ergonex-fixtures.ts";

const POLICY = { allow: ["apply"], repos: "all" };

/** Speaks to `ergonex mcp` as a client: the lines, then the end of the input; each answer by its id. */
async function speak(w: World, lines: readonly object[], extra: Record<string, string> = {}, args: readonly string[] = []): Promise<{ readonly code: number; readonly answers: Map<number, { result?: Record<string, unknown>; error?: unknown }>; readonly stdout: string; readonly stderr: string }> {
  const input = `${[{ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } }, { jsonrpc: "2.0", method: "notifications/initialized" }, ...lines].map((l) => JSON.stringify(l)).join("\n")}\n`;
  const r = await run([execPath(), Ergonex, "mcp", ...args], { env: { ...w.env, ...extra }, input, cwd: w.dir });
  const answers = new Map<number, { result?: Record<string, unknown>; error?: unknown }>();
  for (const l of r.stdout.split("\n")) {
    if (l.trim() === "") continue;
    const m = JSON.parse(l);
    if (typeof m.id === "number") answers.set(m.id, m);
  }
  return { code: r.code, answers, stdout: r.stdout, stderr: r.stderr };
}

const toolNames = (r: { answers: Map<number, { result?: Record<string, unknown> }> }, id: number): string[] => {
  const tools = r.answers.get(id)?.result?.["tools"];
  return Array.isArray(tools) ? tools.map((t: { name: string }) => t.name) : [];
};

/** The word of a tier (a brand of the ladder), or `unknown:` and the word that is none. */
const tierWord = (t: ReturnType<typeof serverTier>): string => ("unknown" in t ? `unknown:${t.unknown}` : String(t.tier));

proves(["0006-agents FR-021"], "the tier of the tool server is the lower of the policy's and ERGONEX_TIER, and a word that is no tier is refused", () => {
  assertEquals(tierWord(serverTier(undefined, undefined)), "public");
  assertEquals(tierWord(serverTier("operator", undefined)), "operator");
  assertEquals(tierWord(serverTier("operator", "public")), "public");
  assertEquals(tierWord(serverTier("public", "administrator")), "public");
  assertEquals(tierWord(serverTier("administrator", "operator")), "operator");
  assertEquals(tierWord(serverTier(undefined, "root")), "unknown:root");
});

needsWorld.skip === undefined
  ? proves(["0006-agents FR-020", "0006-agents FR-021", "0006-agents FR-023"], "the real tool server writes only the protocol on standard output, serves the reading verbs of the program from their declarations (no second list), answers a read, does not offer a verb that changes, refuses one called all the same and refuses a tier that is no tier", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        const r = await speak(w, [{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "ergonex_agent_brief", arguments: {} } }, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "ergonex_apply", arguments: {} } }]);
        assertEquals(r.code, 0, r.stderr);
        const hs = readHandshake(r.stdout);
        assert(hs.kind === "ok", hs.kind === "err" ? hs.error : "");
        assertEquals(hs.value.protocolVersion, "2025-06-18");
        assertEquals(hs.value.serverName, "ergonex");
        for (const name of ["ergonex_status", "ergonex_plan", "ergonex_doctor", "ergonex_agent_brief"]) assert(hs.value.tools.includes(name), `${name} is a tool`);
        for (const name of ["ergonex_apply", "ergonex_setup", "ergonex_mcp", "ergonex_remote_bootstrap"]) assert(!hs.value.tools.includes(name), `${name} is not offered`);
        const brief = r.answers.get(3);
        assert(brief?.result !== undefined && brief.result["isError"] !== true, JSON.stringify(brief));
        assertStringIncludes(JSON.stringify(brief.result), "git.example.org/team/tool");
        const called = r.answers.get(4);
        assert(called?.error !== undefined || called?.result?.["isError"] === true, `a verb that changes is not reached: ${JSON.stringify(called)}`);
        assert(!(await readTextFile(join(w.dir, "never")).catch(() => "")).includes("x"));
        assert(!existsSync(w.repo), "apply was not run through the tool server");
        // read only: a key that may only read serves only the verbs that read
        const only = await speak(w, [{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }], {}, ["--read-only"]);
        assert(toolNames(only, 2).includes("ergonex_status"));
        const viaEnv = await speak(w, [{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }], { ERGONEX_READ_ONLY: "1" });
        assertEquals(toolNames(viaEnv, 2), toolNames(only, 2));
        // a tier that is none ends the run with usage
        const bad = await speak(w, [], { ERGONEX_TIER: "root" });
        assertEquals(bad.code, 2, bad.stderr);
        // the handshake the doctor and `remote bootstrap` make reads the same answers
        const probe = await run([execPath(), Ergonex, "mcp"], { env: w.env, input: handshakeInput("test") });
        assert(readHandshake(probe.stdout).kind === "ok");
      });
    })
  : undefined;

const keygen = async (dir: string): Promise<string> => {
  const file = join(dir, "key");
  const r = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "agent@box", "-f", file]);
  assert(r.success, r.stderr);
  return file;
};

needsWorld.skip === undefined && which("ssh-keygen") !== undefined
  ? proves(["0006-agents FR-022"], "agent keys line prints the authorized_keys line that forces the key to ergonex mcp (read-only for the role read-only) and the Match block, writes no file, and refuses a text that is not one public key line without naming any part of it", async () => {
      await withWorld(async (w) => {
        const key = await keygen(w.dir);
        const before = await w.userDigest();
        const full = await w.ergonex("agent", "keys", "line", "--public-key", `${key}.pub`, "--role", "full", "--user", "agentbox", "--ergonex-path", "/home/agentbox/.local/bin/ergonex");
        assertEquals(full.code, 0, full.all);
        assertStringIncludes(full.stdout, 'restrict,command="/home/agentbox/.local/bin/ergonex mcp" ssh-ed25519 ');
        assertStringIncludes(full.stdout, "Match User agentbox");
        const ro = await w.ergonex("agent", "keys", "line", "--public-key", `${key}.pub`, "--role", "read-only", "--user", "agentbox", "--ergonex-path", "ergonex");
        assertStringIncludes(ro.stdout, 'command="ergonex mcp --read-only"');
        assertEquals(await w.userDigest(), before, "no file was written");
        // a private key is refused, and the refusal names no part of it
        const priv = await readTextFile(key);
        const refused = await w.ergonex("agent", "keys", "line", "--public-key", key, "--role", "full");
        assertEquals(refused.code, 2, refused.all);
        for (const piece of priv.split("\n").filter((l) => l.length > 20)) assert(!refused.all.includes(piece), "the refusal names a part of the private key");
        const two = join(w.dir, "two.pub");
        await writeTextFile(two, `${await readTextFile(`${key}.pub`)}${await readTextFile(`${key}.pub`)}`);
        assertEquals((await w.ergonex("agent", "keys", "line", "--public-key", two, "--role", "full")).code, 2);
        assertEquals((await w.ergonex("agent", "keys", "line", "--public-key", `${key}.pub`, "--role", "root")).code, 2);
      });
    })
  : undefined;

needsWorld.skip === undefined && which("setsid") !== undefined
  ? proves(["0006-agents FR-024", "0006-agents FR-025", "0006-agents FR-026"], "a command run with --job is a detached process of its own whose record is under jobs/<id>/ and whose identifier is printed at once; wait, show, list and cancel read and act on it; a job that changes the workspace needs the hash of its plan and a hash that is not the plan's changes nothing; a job whose process is gone is abandoned and its record stays", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        const started = await w.ergonexOn(execPath(), Ergonex, ["status", "--job"], { ERGONEX_PERSONA: "agent" });
        assertEquals(started.code, 0, started.all);
        const id: string = JSON.parse(started.stdout).job;
        assert(/^\d{8}T\d{9}Z-[0-9a-f]{8}$/.test(id), id);
        const waited = await w.ergonexOn(execPath(), Ergonex, ["agent", "jobs", "wait", id, "--timeout", "60", "--json"], { ERGONEX_PERSONA: "agent" });
        const job = JSON.parse(waited.stdout).data.job;
        assert(job.state === "succeeded" || job.state === "failed", JSON.stringify(job));
        assert(typeof job.exit === "number");
        assert(existsSync(join(w.home, ".ergonex", "jobs", id, "job.json")));
        assert(existsSync(join(w.home, ".ergonex", "jobs", id, "output.log")));
        const shown = await w.ergonex("agent", "jobs", "show", id);
        assertStringIncludes(shown.stdout, id);
        assertStringIncludes((await w.ergonex("agent", "jobs", "list")).stdout, id);
        // apply as a job: the hash of the plan is needed, and only the plan's is taken
        const none = await w.ergonexOn(execPath(), Ergonex, ["apply", "--job"], { ERGONEX_PERSONA: "agent" });
        assertEquals(none.code, 2, none.all);
        assertStringIncludes(none.all, "hash of the plan");
        const wrong = await w.ergonexOn(execPath(), Ergonex, ["apply", "--job", "--plan-hash", "0".repeat(64)], { ERGONEX_PERSONA: "agent" });
        assertEquals(wrong.code, 2, wrong.all);
        assert(!existsSync(w.repo), "a hash that is not the plan's changed nothing");
        const plan = JSON.parse((await w.ergonex("plan", "--json")).stdout).data.planSha256;
        const right = await w.ergonexOn(execPath(), Ergonex, ["apply", "--job", "--plan-hash", plan], { ERGONEX_PERSONA: "agent" });
        assertEquals(right.code, 0, right.all);
        const applied = JSON.parse(right.stdout).job;
        const done = await w.ergonexOn(execPath(), Ergonex, ["agent", "jobs", "wait", applied, "--timeout", "120", "--json"], { ERGONEX_PERSONA: "agent" });
        assertEquals(JSON.parse(done.stdout).data.job.state, "succeeded", done.all);
        assert(existsSync(w.repo), "the plan whose hash was given was carried out");
        // a command that changes the host is not carried as a job at all
        const setup = await w.ergonexOn(execPath(), Ergonex, ["setup", "--job"], { ERGONEX_PERSONA: "agent" });
        assertEquals(setup.code, 2, setup.all);
        // a job whose process is gone, with no end written, is abandoned; its record and evidence stay
        const dead = "20260101T000000000Z-deadbeef";
        await mkdir(join(w.home, ".ergonex", "jobs", dead), { recursive: true });
        const record = JSON.stringify({ id: dead, argv: ["status"], state: "running", pid: 2_000_000_000 }, null, 2);
        await writeTextFile(join(w.home, ".ergonex", "jobs", dead, "job.json"), record);
        const listed = JSON.parse((await w.ergonex("agent", "jobs", "list", "--json")).stdout).data.jobs;
        assertEquals(listed.find((j: { id: string }) => j.id === dead).state, "abandoned");
        assertEquals(await readTextFile(join(w.home, ".ergonex", "jobs", dead, "job.json")), record, "the record was not rewritten");
        const doctor = await w.ergonexOn(execPath(), Ergonex, ["agent", "doctor", "--offline", "--json"], { ERGONEX_PERSONA: "agent" });
        assertStringIncludes(doctor.stdout, "abandoned or failed");
        // wait ends with the status of a job not done: pending
        await mkdir(join(w.home, ".ergonex", "jobs", "20260101T000001000Z-aaaaaaaa"), { recursive: true });
        await writeTextFile(join(w.home, ".ergonex", "jobs", "20260101T000001000Z-aaaaaaaa", "job.json"), JSON.stringify({ id: "20260101T000001000Z-aaaaaaaa", argv: ["sleep"], state: "running", pid: process.pid }));
        const pending = await w.ergonex("agent", "jobs", "wait", "20260101T000001000Z-aaaaaaaa", "--timeout", "1");
        assertEquals(pending.code, 4, pending.all);
      });
    })
  : undefined;

needsWorld.skip === undefined
  ? proves(["0006-agents FR-038"], "agent register writes the declaration of this machine as a workstation of origin self into the tenant's fleet, whole and idempotently, and never over a file with other content", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        const tenant = join(w.dir, "tenant");
        await mkdir(tenant, { recursive: true });
        const words = ["agent", "register", "--tenant", tenant, "--fleet", "lab", "--id", "agentbox"];
        const preview = await w.ergonex(...words, "--dry-run");
        assertEquals(preview.code, 0, preview.all);
        assert(!existsSync(join(tenant, "fleets")), "a preview writes nothing");
        const first = await w.ergonexOn(execPath(), Ergonex, words, { ERGONEX_PERSONA: "agent" });
        assertEquals(first.code, 0, first.all);
        const file = join(tenant, "fleets", "lab", "hosts", "agentbox.ts");
        const text = await readTextFile(file);
        for (const part of ['"kind": "workstation"', '"origin": "self"', '"state": "adopted"', '"persona": "agent"', '"coordinator": "0.5.7"', '"agents-policy": "sha256:', '"os-family"', '"distro"']) assertStringIncludes(text, part);
        const again = await w.ergonexOn(execPath(), Ergonex, words, { ERGONEX_PERSONA: "agent" });
        assertEquals(JSON.parse(again.stdout).data.changed, false, again.all);
        assertEquals(await readTextFile(file), text);
        await writeTextFile(file, "// someone's own declaration\nexport const agentbox = {};\n");
        const refused = await w.ergonex(...words);
        assertEquals(refused.code, 3, refused.all);
        assertStringIncludes(await readTextFile(file), "someone's own");
        assertEquals((await w.ergonex("agent", "register", "--tenant", tenant, "--fleet", "Bad Fleet", "--id", "x")).code, 2);
      });
    })
  : undefined;

void chmod;
