/**
 * Tests of the persona, the policy, the brief and the files of a harness (commons ergonex 0006-agents FR-001 to FR-019, FR-033, FR-034): the pure parts are called directly, and everything else runs the
 * REAL program on a real workspace of real Git repositories in a temporary folder, as a harness would. The Claude Code tests use the real `claude` command (`claude mcp get`, `claude mcp list`, which
 * perform the handshake) where it is installed and say so where it is not. `codex` and `herdr` are not installed on every machine: their files are tested as files, and a test never says a harness ran
 * where it did not.
 *
 * @module
 */
import { chmod, mkdir, readTextFile, writeTextFile, existsSync } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { execPath, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { BRIEF_MAX_BYTES, type BriefInput, checkLines, renderBrief } from "../src/agents/brief.ts";
import { distroOf, isMiseShim, parseMiseInstalled, parseOsRelease } from "../src/agents/distro.ts";
import { removeBlock, setBlock, setClaudeSettings, setCodexServer, setMcpServer } from "../src/agents/files.ts";
import { identityAttributes, resolveIdentity } from "../src/agents/persona.ts";
import { decideAgent, decodeAgentsPolicy, mayChangeRepo, lowerTier } from "../src/agents/policy.ts";
import { describeTokenError, findToken, modeIsPrivate, redact } from "../src/agents/host/token-source.ts";
import { agentWords } from "../src/ergonex.ts";
import { Ergonex, evidenceFiles, needsWorld, ONE_REPOSITORY, REMOTE, withWorld, type World } from "./ergonex-fixtures.ts";

/** The start of a token of GitHub, kept apart so that no line of this file looks like one. */
const GH = ["gh", "p_"].join("");

const POLICY = { allow: ["apply"], repos: "all", commit: { name: "An Agent", email: "agent@example.org", trailer: "Co-Authored-By: An Agent <agent@example.org>" } };

/** Runs ergonex as the persona agent with the variables given. */
const asAgent = (w: World, words: string[], extra: Record<string, string> = {}) => w.ergonexOn(execPath(), Ergonex, words, { ERGONEX_PERSONA: "agent", ...extra });

proves(["0006-agents FR-001", "0006-agents FR-002", "0006-agents FR-037"], "the persona and the harness resolve from the option, the variable, the manifest and the default, in that order; a word outside the sets is refused naming both; herdr as the runtime is named beside the harness", () => {
  assertEquals(resolveIdentity({ env: {} }), { kind: "ok", value: { persona: "human", harness: "other" } });
  const manifest = resolveIdentity({ env: {}, manifestPersona: "agent" });
  assertEquals(manifest.kind === "ok" && manifest.value.persona, "agent");
  const variable = resolveIdentity({ env: { ERGONEX_PERSONA: "human" }, manifestPersona: "agent" });
  assertEquals(variable.kind === "ok" && variable.value.persona, "human");
  const option = resolveIdentity({ persona: "agent", env: { ERGONEX_PERSONA: "human" } });
  assertEquals(option.kind === "ok" && option.value.persona, "agent");
  const bad = resolveIdentity({ persona: "robot", env: {} });
  assert(bad.kind === "err" && bad.error.includes("human") && bad.error.includes("agent"));
  assert(resolveIdentity({ harness: "emacs", env: {} }).kind === "err");
  const both = resolveIdentity({ persona: "agent", harness: "claude-code", session: "s-1", env: { HERDR_ENV: "1" } });
  assert(both.kind === "ok");
  assertEquals(identityAttributes(both.value), { "ergonex.persona": "agent", "ergonex.harness": "claude-code", "ergonex.runtime": "herdr", "ergonex.session": "s-1" });
  assertEquals(identityAttributes({ persona: "human", harness: "other" }), {});
  assert(resolveIdentity({ session: "x".repeat(129), env: {} }).kind === "err");
  assert(resolveIdentity({ session: "a\u0007b", env: {} }).kind === "err");
});

proves(["0006-agents FR-003"], "an agent is given the JSON envelope and no prompt unless it asks for the text form, a format or a document", () => {
  assertEquals(agentWords(["status"]), ["status", "--non-interactive", "--json"]);
  assertEquals(agentWords(["status", "--text"]), ["status", "--text", "--non-interactive"]);
  assertEquals(agentWords(["agent", "brief", "--format", "md"]), ["agent", "brief", "--format", "md", "--non-interactive"]);
  assertEquals(agentWords(["remote", "run", "box", "--", "status"]), ["remote", "run", "box", "--non-interactive", "--json", "--", "status"]);
  assertEquals(agentWords(["help"]), ["help"]);
  assertEquals(agentWords(["mcp"]), ["mcp"]);
});

proves(["0006-agents FR-004", "0006-agents FR-005"], "the agents policy is typed: an unknown key and a value outside its set are refused naming the key, an absent policy allows nothing that changes, and a command that only reads is always allowed", () => {
  const ok = decodeAgentsPolicy({ allow: ["apply", "repos add"], repos: ["team/tool"], tier: "operator", disposable: true, remote: ["box"] });
  assert(ok.kind === "ok");
  assertEquals(ok.value.tier, "operator");
  const unknown = decodeAgentsPolicy({ allwo: [] });
  assert(unknown.kind === "err" && unknown.error[0]?.path === "$.agents.allwo");
  const badCommand = decodeAgentsPolicy({ allow: ["reboot"] });
  assert(badCommand.kind === "err" && badCommand.error[0]?.path === "$.agents.allow[0]");
  assert(decodeAgentsPolicy({ tier: "root" }).kind === "err");
  assert(decodeAgentsPolicy({ commit: { name: "A", email: "nope", trailer: "x" } }).kind === "err");
  assertEquals(decideAgent(undefined, "apply", "apply"), { allowed: false, command: "apply" });
  assertEquals(decideAgent(undefined, "status", "apply"), { allowed: true });
  assertEquals(decideAgent(undefined, "render", "check"), { allowed: true });
  assertEquals(decideAgent(undefined, "render", "apply"), { allowed: false, command: "render" });
  assertEquals(decideAgent(undefined, "repos add", "dry-run"), { allowed: true });
  assertEquals(decideAgent(ok.value, "repos add", "apply"), { allowed: true });
  assertEquals(decideAgent(ok.value, "setup", "apply"), { allowed: false, command: "setup" });
  assert(mayChangeRepo(ok.value, "https://github.com/team/tool.git"));
  assert(!mayChangeRepo(ok.value, "https://github.com/team/other"));
  assertEquals(lowerTier("operator", "public"), "public");
});

needsWorld.skip === undefined
  ? proves(["0006-agents FR-004", "0006-agents FR-006", "0006-agents FR-003"], "run as the persona agent, apply is refused with E-AGENT-DENIED and the status of findings, changes nothing and is recorded with the persona, harness and session; with the policy it runs; the JSON envelope is the default and --text gives text", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY });
        const denied = await asAgent(w, ["apply"], { ERGONEX_HARNESS: "claude-code", ERGONEX_SESSION: "session-42" });
        assertEquals(denied.code, 1, denied.all);
        const envelope = JSON.parse(denied.stdout);
        assertEquals(envelope.schema, "headless.envelope/1");
        assertEquals(envelope.problems[0].code, "E-AGENT-DENIED");
        assert(!existsSync(w.repo), "a refused apply cloned nothing");
        const record = (await readTextFile(evidenceFiles(w.state).at(-1) ?? "")).toString();
        for (const word of ["ergonex.persona", "agent", "ergonex.harness", "claude-code", "ergonex.session", "session-42"]) assertStringIncludes(record, word);
        // a human run is not named so
        const human = await w.ergonex("status");
        assertEquals(human.code === 0 || human.code === 1, true);
        assert(!(await readTextFile(evidenceFiles(w.state).at(-1) ?? "")).includes("ergonex.persona"));
        // allowed by the policy of the manifest: the run proceeds, and the text form is had with --text
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        const allowed = await asAgent(w, ["apply", "--text"]);
        assertEquals(allowed.code, 0, allowed.all);
        assert(existsSync(w.repo), "the policy let apply clone");
        assert(!allowed.stdout.trimStart().startsWith("{"), "--text gives text");
        // the manifest's own persona makes a run an agent's without a variable
        await w.manifest({ ...ONE_REPOSITORY, persona: "agent" });
        const viaManifest = await w.ergonex("render");
        assertEquals(viaManifest.code, 1, viaManifest.all);
        assertStringIncludes(viaManifest.stdout, "E-AGENT-DENIED");
        // a persona that is none of the two ends with a usage failure naming both
        const bad = await w.ergonex("status", "--persona", "robot");
        assertEquals(bad.code, 2, bad.all);
        assertStringIncludes(bad.all, "human");
        // a policy with a key it does not know is refused by the manifest's decoder, naming the key
        await w.manifest({ ...ONE_REPOSITORY, agents: { allwo: [] } });
        const broken = await w.ergonex("status");
        assertStringIncludes(broken.all, "allwo");
      });
    })
  : undefined;

proves(["0006-agents FR-007"], "the token is read from the variable, then the file the variable names, then the file of the configuration folder; a file others can read is refused; nothing is ever shown but [secret]", async () => {
  const { makeTempDir, remove } = await import("../src/platform/r-fs.ts");
  const dir = await makeTempDir({ prefix: "ergonex-token-" });
  try {
    const file = join(dir, "t");
    await writeTextFile(file, `${GH}secretvalue1234567890\n`);
    await chmod(file, 0o644);
    const wide = await findToken({ env: { ERGONEX_GITHUB_TOKEN_FILE: file }, configHome: undefined });
    assert(wide.kind === "err" && wide.error.kind === "mode");
    assert(!describeTokenError(wide.error).includes(`${GH}secretvalue`));
    await chmod(file, 0o600);
    const viaFile = await findToken({ env: { ERGONEX_GITHUB_TOKEN_FILE: file }, configHome: undefined });
    assert(viaFile.kind === "ok" && viaFile.value?.origin === "file-variable" && viaFile.value.value === `${GH}secretvalue1234567890`);
    const first = await findToken({ env: { ERGONEX_GITHUB_TOKEN: "from-env", ERGONEX_GITHUB_TOKEN_FILE: file }, configHome: undefined });
    assert(first.kind === "ok" && first.value?.origin === "environment");
    await mkdir(join(dir, "cfg", "ergonex"), { recursive: true });
    await writeTextFile(join(dir, "cfg", "ergonex", "token"), "from-config\n");
    await chmod(join(dir, "cfg", "ergonex", "token"), 0o600);
    const config = await findToken({ env: {}, configHome: join(dir, "cfg") });
    assert(config.kind === "ok" && config.value?.origin === "config-file");
    // a link to a file of another mode takes the mode of the target
    await symlinkTo(join(dir, "cfg", "ergonex", "link"), file);
    await chmod(file, 0o644);
    const linked = await findToken({ env: { ERGONEX_GITHUB_TOKEN_FILE: join(dir, "cfg", "ergonex", "link") }, configHome: undefined });
    assert(linked.kind === "err" && linked.error.kind === "mode");
    assert(modeIsPrivate(0o600) && !modeIsPrivate(0o640));
    assertEquals(redact(`a ${GH}secretvalue1234567890 b ${GH}secretvalue1234567890`, [`${GH}secretvalue1234567890`, ""]), "a [secret] b [secret]");
  } finally {
    await remove(dir, { recursive: true });
  }
});

async function symlinkTo(link: string, target: string): Promise<void> {
  const { symlink } = await import("../src/platform/r-fs.ts");
  await symlink(target, link);
}

needsWorld.skip === undefined
  ? proves(["0006-agents FR-007", "0006-agents FR-018", "0006-agents FR-019"], "agent doctor warns of a token in the environment of an agent, says what the machine lacks, and neither its report, its problems nor the evidence record holds the value of a token", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        const secret = `${GH}abcdefghijklmnopqrstuvwxyz0123456789`;
        const r = await asAgent(w, ["agent", "doctor", "--offline"], { ERGONEX_GITHUB_TOKEN: secret });
        assert(!r.all.includes(secret), "the report holds the token");
        const envelope = JSON.parse(r.stdout);
        const messages: string = JSON.stringify(envelope.problems);
        assertStringIncludes(messages, "ambient secret");
        for (const f of evidenceFiles(w.state)) assert(!(await readTextFile(f)).includes(secret), `${f} holds the token`);
        const none = await asAgent(w, ["agent", "doctor", "--offline"]);
        assertStringIncludes(none.stdout, "no token is set");
        assertStringIncludes(none.stdout, "ergonex mcp answers a handshake");
        // the disposable machine: here neither a container nor a virtual machine may be declared, so the finding is informational
        assertStringIncludes(none.stdout, "disposable");
      });
    })
  : undefined;

needsWorld.skip === undefined
  ? proves(["0006-agents FR-008"], "apply sets the identity of the policy in each repository the persona may change, and the commit-msg hook of an agent refuses a message without the trailer and takes one with it", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        const applied = await w.ergonex("apply");
        assertEquals(applied.code, 0, applied.all);
        assertEquals(await w.git(w.repo, "config", "--local", "user.email"), "agent@example.org");
        assertEquals(await w.git(w.repo, "config", "--local", "user.name"), "An Agent");
        const msg = join(w.dir, "msg");
        await writeTextFile(msg, "work\n\nRefs #25\n");
        const hook = join(w.home, ".ergonex", "hooks", "commit-msg");
        const asAnAgent = { ...w.env, ERGONEX_PERSONA: "agent", PATH: `${join(w.dir, "bin")}:${process.env["PATH"] ?? ""}` };
        await mkdir(join(w.dir, "bin"), { recursive: true });
        await writeTextFile(join(w.dir, "bin", "ergonex"), `#!/bin/sh\nexec ${execPath()} ${Ergonex} "$@"\n`);
        await chmod(join(w.dir, "bin", "ergonex"), 0o755);
        const refused = await run([hook, msg], { env: asAnAgent });
        assertEquals(refused.code, 1, refused.stderr);
        assertStringIncludes(refused.stderr, "Co-Authored-By: An Agent");
        await writeTextFile(msg, `work\n\nRefs #25\n${POLICY.commit.trailer}\n`);
        assertEquals((await run([hook, msg], { env: asAnAgent })).code, 0);
        // a person's commit is not asked for the trailer
        await writeTextFile(msg, "work\n\nRefs #25\n");
        assertEquals((await run([hook, msg], { env: { ...asAnAgent, ERGONEX_PERSONA: "human" } })).code, 0);
        // a repository the policy does not name keeps no such identity
        await w.manifest({ ...ONE_REPOSITORY, agents: { ...POLICY, repos: ["someone/else"] } });
        await w.git(w.repo, "config", "--local", "--unset", "user.email");
        await w.ergonex("apply");
        const email = await run(["git", "-C", w.repo, "config", "--local", "user.email"], { env: w.env });
        assertEquals(email.stdout.trim(), "");
      });
    })
  : undefined;

const brief = (n: number, extra: Partial<BriefInput> = {}): BriefInput => ({
  root: "/ws",
  area: "/ws/.ergonex",
  repos: Array.from({ length: n }, (_, i) => ({ path: `host/team/repo-${String(i).padStart(4, "0")}`, remote: `https://host/team/repo-${i}`, branch: "main", state: "Clean", worktrees: [], changed: 1_700_000_000 + i, checks: ["Run `bun run verify` before you push."] })),
  tools: [{ name: "git", version: "2.50.0", present: true }],
  hooks: [".ergonex/hooks/commit-msg"],
  regulatedDomain: [],
  requiresSignedCommits: false,
  agents: undefined,
  persona: "agent",
  harness: "claude-code",
  ...extra,
});

proves(["0006-agents FR-009", "0006-agents FR-010"], "the brief gives the same bytes for the same state, holds no token, names what the persona may run and may not, and is at most 32 KiB: where the map is larger the newest repositories are kept and the number omitted is named", () => {
  const decoded = decodeAgentsPolicy(POLICY);
  assert(decoded.kind === "ok");
  const a = renderBrief(brief(3, { agents: decoded.value }));
  const b = renderBrief(brief(3, { agents: decoded.value }));
  assertEquals(a.markdown, b.markdown);
  assertStringIncludes(a.markdown, "Co-Authored-By: An Agent");
  assertStringIncludes(a.markdown, "`apply`");
  assertStringIncludes(a.markdown, "E-AGENT-DENIED");
  const big = renderBrief(brief(2000));
  assert(new TextEncoder().encode(big.markdown).length <= BRIEF_MAX_BYTES, "over 32 KiB");
  assert(big.brief.omitted > 0);
  assertStringIncludes(big.markdown, `${big.brief.omitted} more repositories are omitted`);
  assertStringIncludes(big.markdown, "repo-1999", "the newest repository is kept");
  assert(!big.markdown.includes("repo-0000"), "the oldest is the one omitted");
  assertEquals(checkLines("# x\nRun `bun run verify` before you push.\nnothing here\nA line with `no` words.\n"), ["Run `bun run verify` before you push."]);
  assertEquals(checkLines(`use ${GH}abcdefghijklmnopqrstuvwxyz0123 with \`bun test\``), ["use [secret] with `bun test`"]);
});

needsWorld.skip === undefined
  ? proves(["0006-agents FR-009"], "the real command gives the brief as Markdown with --format md and as the data of the envelope with --json, the same state giving the same bytes", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        await w.ergonex("apply");
        const md1 = await w.ergonex("agent", "brief", "--format", "md");
        const md2 = await w.ergonex("agent", "brief", "--format", "md");
        assertEquals(md1.code, 0, md1.all);
        assertEquals(md1.stdout, md2.stdout);
        assertStringIncludes(md1.stdout, "git.example.org/team/tool");
        assertStringIncludes(md1.stdout, REMOTE);
        const json = JSON.parse((await asAgent(w, ["agent", "brief"])).stdout);
        assertEquals(json.data.repos[0].path, "git.example.org/team/tool");
        assertEquals(json.data.commit.trailer, POLICY.commit.trailer);
      });
    })
  : undefined;

proves(["0006-agents FR-012"], "the files an adapter writes are merged: a block of its own, an entry of its own name, the keys it owns; another tool's hook, server and table are kept, and a second run changes nothing", () => {
  const md = setBlock("# mine\n\ntext\n", "ergonex-brief", "one");
  assertStringIncludes(md, "# mine");
  assertEquals(setBlock(md, "ergonex-brief", "one"), md);
  assertStringIncludes(setBlock(md, "ergonex-brief", "two"), "two");
  assert(!setBlock(md, "ergonex-brief", "two").includes("one\n<!--"));
  assertEquals(removeBlock(md, "ergonex-brief"), "# mine\n\ntext\n");
  // a settings file with a SessionStart hook that another tool wrote (the shape herdr's installer writes)
  const herdr = JSON.stringify({ model: "x", hooks: { SessionStart: [{ hooks: [{ type: "command", command: "herdr session start" }] }], Stop: [{ hooks: [] }] } });
  const own = (c: string): boolean => /agent brief --harness claude-code/.test(c);
  const once = setClaudeSettings(herdr, "settings.json", "ergonex", "/bin/ergonex agent brief --harness claude-code --format md", own, true);
  const parsed = JSON.parse(once);
  assertEquals(parsed.model, "x");
  assertEquals(parsed.hooks.SessionStart.length, 2);
  assertEquals(parsed.hooks.SessionStart[0].hooks[0].command, "herdr session start");
  assertEquals(parsed.enabledMcpjsonServers, ["ergonex"]);
  assertEquals(setClaudeSettings(once, "settings.json", "ergonex", "/bin/ergonex agent brief --harness claude-code --format md", own, true), once);
  const moved = setClaudeSettings(once, "settings.json", "ergonex", "/other/ergonex agent brief --harness claude-code --format md", own, true);
  assertEquals(JSON.parse(moved).hooks.SessionStart.length, 2);
  const servers = setMcpServer(JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } }), ".mcp.json", "ergonex", { command: "/bin/ergonex", args: ["mcp"] });
  assertEquals(Object.keys(JSON.parse(servers).mcpServers).sort(), ["ergonex", "other"]);
  let refused = false;
  try {
    setMcpServer("{ not json", ".mcp.json", "ergonex", { command: "/bin/ergonex", args: ["mcp"] });
  } catch {
    refused = true;
  }
  assert(refused, "a file that is not JSON is left as it is");
  // the table of Codex, which `codex mcp add` wrote with a sub-table of its own, is replaced whole and the others kept
  const toml = 'model = "o"\n\n[mcp_servers.ergonex]\ncommand = "/old"\nargs = ["mcp"]\n\n[mcp_servers.ergonex.env]\nX = "1"\n\n[mcp_servers.other]\ncommand = "o"\n';
  const next = setCodexServer(toml, "ergonex", "/new/ergonex", ["mcp"], 30);
  assertStringIncludes(next, 'command = "/new/ergonex"');
  assertStringIncludes(next, "startup_timeout_sec = 30");
  assertStringIncludes(next, "[mcp_servers.other]");
  assertStringIncludes(next, 'model = "o"');
  assertStringIncludes(next, "[mcp_servers.ergonex.env]");
  assert(!next.includes("/old"));
  assertEquals(setCodexServer(next, "ergonex", "/new/ergonex", ["mcp"], 30), next);
});

needsWorld.skip === undefined
  ? proves(["0006-agents FR-011", "0006-agents FR-012", "0006-agents FR-013", "0006-agents FR-014", "0006-agents FR-016"], "agent init writes the files of claude-code with the real claude command (which then connects to the tool server), of codex as files and of other as one block; a preview writes nothing; a second run changes nothing and says so; a harness outside the set is refused", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        await w.ergonex("apply");
        const bin = join(w.dir, "bin");
        await mkdir(bin, { recursive: true });
        await writeTextFile(join(bin, "ergonex"), `#!/bin/sh\nexec ${execPath()} ${Ergonex} "$@"\n`);
        await chmod(join(bin, "ergonex"), 0o755);
        const project = join(w.dir, "project");
        await mkdir(project, { recursive: true });
        // another tool's setting that must survive
        await mkdir(join(w.user, ".claude"), { recursive: true });
        await writeTextFile(join(w.user, ".claude", "settings.json"), JSON.stringify({ theme: "dark", hooks: { SessionStart: [{ hooks: [{ type: "command", command: "herdr session start" }] }] } }));
        const go = (words: string[]) => w.ergonexOn(execPath(), Ergonex, words, { PATH: `${bin}:${process.env["PATH"] ?? ""}`, ERGONEX_HOME: w.home, PWD: project });
        const inProject = async (words: string[]) => {
          const r = await run([execPath(), Ergonex, ...words], { env: { ...w.env, PATH: `${bin}:${process.env["PATH"] ?? ""}` }, cwd: project });
          return { code: r.code, stdout: r.stdout, all: r.stdout + r.stderr };
        };
        void go;
        const preview = await inProject(["agent", "init", "--harness", "claude-code", "--dry-run", "--ergonex-path", join(bin, "ergonex")]);
        assertEquals(preview.code, 0, preview.all);
        assertStringIncludes(preview.all, "would-change");
        assert(!existsSync(join(project, "AGENTS.md")), "a preview writes nothing");
        const first = await inProject(["agent", "init", "--harness", "claude-code", "--ergonex-path", join(bin, "ergonex")]);
        assertEquals(first.code, 0, first.all);
        const agentsMd = await readTextFile(join(project, "AGENTS.md"));
        assertStringIncludes(agentsMd, "ergonex:begin ergonex-brief");
        assertStringIncludes(await readTextFile(join(project, "CLAUDE.md")), "@AGENTS.md");
        const user = JSON.parse(await readTextFile(join(w.user, ".claude", "settings.json")));
        assertEquals(user.theme, "dark");
        assertEquals(user.enabledMcpjsonServers, ["ergonex"]);
        assertEquals(user.hooks.SessionStart[0].hooks[0].command, "herdr session start");
        const second = await inProject(["agent", "init", "--harness", "claude-code", "--ergonex-path", join(bin, "ergonex")]);
        assertStringIncludes(second.all, "unchanged: nothing needed to change");
        assertEquals(await readTextFile(join(project, "AGENTS.md")), agentsMd);
        if (which("claude") === undefined) {
          console.log("claude is not installed: its registration and handshake were not tested here");
        } else {
          const reg = JSON.parse(await readTextFile(join(project, ".mcp.json")));
          assertEquals(reg.mcpServers.ergonex.command, join(bin, "ergonex"));
          const listed = await run(["claude", "mcp", "list"], { env: { ...w.env, PATH: `${bin}:${process.env["PATH"] ?? ""}` }, cwd: project, signal: AbortSignal.timeout(120_000) });
          assertStringIncludes(listed.stdout, "Connected", `claude mcp list: ${listed.stdout}${listed.stderr}`);
        }
        // codex: the files; `codex mcp list` reads the configuration and does not connect, so no claim is made of the server
        await mkdir(join(w.user, ".codex"), { recursive: true });
        await writeTextFile(join(w.user, ".codex", "config.toml"), 'model = "o"\n\n[mcp_servers.other]\ncommand = "o"\n');
        const codex = await inProject(["agent", "init", "--harness", "codex", "--scope", "user", "--ergonex-path", join(bin, "ergonex")]);
        assertEquals(codex.code, 0, codex.all);
        const toml = await readTextFile(join(w.user, ".codex", "config.toml"));
        assertStringIncludes(toml, "[mcp_servers.other]");
        assertStringIncludes(toml, `command = "${join(bin, "ergonex")}"`);
        assertStringIncludes(toml, "startup_timeout_sec = 30");
        // other: one block of AGENTS.md and nothing else
        const other = join(w.dir, "other");
        await mkdir(other, { recursive: true });
        const o = await run([execPath(), Ergonex, "agent", "init", "--harness", "other", "--ergonex-path", join(bin, "ergonex")], { env: { ...w.env, PATH: `${bin}:${process.env["PATH"] ?? ""}` }, cwd: other });
        assertEquals(o.code, 0, o.stderr);
        assertEquals(existsSync(join(other, "AGENTS.md")), true);
        assertEquals(existsSync(join(other, "CLAUDE.md")), false);
        assertEquals(existsSync(join(other, ".mcp.json")), false);
        const bad = await inProject(["agent", "init", "--harness", "emacs"]);
        assertEquals(bad.code, 2, bad.all);
      });
    })
  : undefined;

proves(["0006-agents FR-033", "0006-agents FR-034", "0006-agents FR-017", "0006-agents FR-019"], "the distribution is a value behind one interface: Omarchy is recognized by ID=omarchy and not by a variable, puts ergonex in ~/.local/bin, installs with mise, keeps its shared AGENTS.md and names the way in; a shim is no proof of a tool", () => {
  const omarchy = distroOf('NAME="Omarchy"\nID=omarchy\nID_LIKE=arch\nVERSION_ID=4.5.0\n');
  assertEquals(omarchy.id, "omarchy");
  assertEquals(omarchy.installDir("/home/a"), "/home/a/.local/bin");
  assertEquals(omarchy.toolManager, "mise");
  assertEquals(omarchy.sharedInstructions("/home/a"), "/home/a/.agents/AGENTS.md");
  assertEquals(omarchy.sshEnable("KEY"), "omarchy-setup-security-sshd --key=KEY");
  assertEquals(distroOf("ID=arch\n").id, "generic");
  assertEquals(distroOf("ID=ubuntu\n").toolManager, "pinned");
  assertEquals(distroOf(undefined).id, "generic");
  assertEquals(parseOsRelease('# c\nID="omarchy"\nID_LIKE=arch\n')["ID"], "omarchy");
  assertEquals(parseMiseInstalled(JSON.stringify({ node: [{ version: "26", installed: true }], gh: [{ version: "2", installed: false }], claude: [] })), ["node"]);
  assert(isMiseShim("/home/a/.local/share/mise/shims/node"));
  assert(!isMiseShim("/home/a/.local/bin/ergonex"));
  assertEquals(parseMiseInstalled("not json"), []);
});

needsWorld.skip === undefined
  ? proves(["0006-agents FR-017"], "on Omarchy the persona's rules go into the shared ~/.agents/AGENTS.md, and no folder is made for a harness that was never used", async () => {
      const { adapterOf } = await import("../src/agents/host/adapters/index.ts");
      const { runSteps } = await import("../src/agents/host/adapters/port.ts");
      const { makeTempDir, remove } = await import("../src/platform/r-fs.ts");
      const dir = await makeTempDir({ prefix: "ergonex-omarchy-" });
      try {
        const home = join(dir, "home");
        await mkdir(join(home, ".agents"), { recursive: true });
        const site = { scope: "user" as const, home, folder: join(dir, "p"), ergonexPath: "/bin/ergonex", brief: "the brief\n", distro: distroOf("ID=omarchy\n"), which: () => undefined, run: () => Promise.resolve({ success: true, stdout: "", stderr: "" }) };
        for (const h of ["claude-code", "codex", "other"] as const) {
          const results = await runSteps(site, await adapterOf(h).steps(site), true);
          assert(results.every((r) => r.outcome !== "failed"), JSON.stringify(results));
        }
        assertStringIncludes(await readTextFile(join(home, ".agents", "AGENTS.md")), "the brief");
        assert(!existsSync(join(home, ".codex")), "no folder for a harness that was never used");
        assert(!existsSync(join(home, ".claude")), "no folder for a harness that was never used");
      } finally {
        await remove(dir, { recursive: true });
      }
    })
  : undefined;

needsWorld.skip === undefined && which("herdr") !== undefined && which("claude") !== undefined
  ? proves(["0006-agents FR-015", "0006-agents FR-012"], "the adapter herdr runs herdr's own integration installer for each coding agent on the PATH and writes none of herdr's files; the hook herdr wrote and the one of ergonex stay side by side in settings.json, in either order, and a second run changes nothing (the real herdr and the real claude)", async () => {
      await withWorld(async (w) => {
        await w.manifest({ ...ONE_REPOSITORY, agents: POLICY });
        const bin = join(w.dir, "bin");
        await mkdir(bin, { recursive: true });
        await writeTextFile(join(bin, "ergonex"), `#!/bin/sh\nexec ${execPath()} ${Ergonex} "$@"\n`);
        await chmod(join(bin, "ergonex"), 0o755);
        const env = { ...w.env, PATH: `${bin}:${process.env["PATH"] ?? ""}` };
        await mkdir(join(w.user, ".claude"), { recursive: true });
        await writeTextFile(join(w.user, ".claude", "settings.json"), JSON.stringify({ theme: "dark" }));
        const init = (harness: string) => run([execPath(), Ergonex, "agent", "init", "--harness", harness, "--scope", "user", "--ergonex-path", join(bin, "ergonex")], { env, cwd: w.dir });
        const first = await init("herdr");
        assertEquals(first.code, 0, first.stdout + first.stderr);
        assertStringIncludes(first.stdout, "herdr integration for claude");
        const afterHerdr = JSON.parse(await readTextFile(join(w.user, ".claude", "settings.json")));
        assertEquals(afterHerdr.theme, "dark");
        assertEquals(afterHerdr.hooks.SessionStart.length, 1, "herdr wrote its hook");
        const second = await init("claude-code");
        assertEquals(second.code, 0, second.stdout + second.stderr);
        const both = JSON.parse(await readTextFile(join(w.user, ".claude", "settings.json")));
        assertEquals(both.hooks.SessionStart.length, 2, "ergonex's hook is beside herdr's");
        assert(JSON.stringify(both.hooks.SessionStart).includes("herdr-agent-state.sh"), "herdr's hook is kept");
        assert(JSON.stringify(both.hooks.SessionStart).includes("agent brief --harness claude-code"));
        // herdr run again: its own status says current, so ergonex runs nothing and herdr's hook is untouched
        const third = await init("herdr");
        assertStringIncludes(third.stdout, "unchanged");
        assertEquals(JSON.parse(await readTextFile(join(w.user, ".claude", "settings.json"))).hooks.SessionStart.length, 2);
        const fourth = await init("claude-code");
        assertEquals(await readTextFile(join(w.user, ".claude", "settings.json")), JSON.stringify(both, null, 2) + "\n");
        assertStringIncludes(fourth.stdout, "unchanged");
      });
    })
  : proves(["0006-agents FR-015"], "the adapter herdr: skipped here because herdr or claude is not on the PATH; nothing is claimed of it", () => {
      console.log("herdr or claude is not installed on this machine: the herdr adapter was not run against the real herdr here");
    });

proves(["0006-agents FR-035", "0006-agents FR-039"], "the how-to page and the AI guide exist, are in the site's list of pages, link to the specification and do not copy it; the alignment table of the specification names a basis and a status for every row", async () => {
  const { dirname, fromFileUrl } = await import("../src/platform/r-path.ts");
  const root = join(dirname(fromFileUrl(import.meta.url)), "..", "..");
  const how = await readTextFile(join(root, "docs", "guides", "give-an-agent-a-machine.md"));
  const ai = await readTextFile(join(root, "docs", "guides", "ai-give-an-agent-a-machine.md"));
  for (const page of [how, ai]) {
    assertStringIncludes(page, "ergonex/spec-kit/specs/0006-agents/spec.md");
    assert(!/\*\*FR-0\d\d\*\*/.test(page), "a page copies a requirement");
  }
  assertStringIncludes(how, "disposable Omarchy virtual machine or a spare machine, not on a machine you live in");
  for (const word of ["fingerprint", "policy", "tier", "forced"]) assertStringIncludes(how.toLowerCase(), word);
  const config = await readTextFile(join(root, "docs.config.ts"));
  assertStringIncludes(config, "give-an-agent-a-machine.md");
  assertStringIncludes(config, "ai-give-an-agent-a-machine.md");
  assertStringIncludes(await readTextFile(join(root, "docs", "guides", "how-to-index.md")), "give-an-agent-a-machine.md");
  const spec = await readTextFile(join(root, "ergonex", "spec-kit", "specs", "0006-agents", "spec.md"));
  const table = spec.slice(spec.indexOf("## The alignment to standards"), spec.indexOf("## Verification plan"));
  const rows = table.split("\n").filter((l) => l.startsWith("  | ") && !l.includes("---") && !l.includes("| Term |"));
  assert(rows.length >= 8, `the table has ${rows.length} rows`);
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim()).filter((c) => c !== "");
    assert(cells.length >= 4, `a row of the table has no basis, status and note: ${row.slice(0, 80)}`);
    assert(["closeMatch", "exactMatch", "narrowMatch", "broadMatch", "relatedMatch", "unaligned"].some((s) => (cells[2] ?? "").includes(s)), `a row has no status: ${row.slice(0, 80)}`);
  }
});
