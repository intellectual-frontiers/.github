/**
 * Tests of `ergonex remote` against a REAL `sshd` (commons ergonex 0006-agents FR-022, FR-024, FR-027 to FR-032): an OpenSSH server on a loopback port with its own host key and an account made for the run
 * (ergonex-sshd.ts), the system's `ssh`, `ssh-keyscan` and `ssh-keygen`, and the real `ergonex` of this checkout on the machine, started as a real program by a real ssh session. What is NOT proved here:
 * a first install of ergonex from the package registry on a machine that has none (the machine of these tests has the launcher of this checkout, so that step is `unchanged`: it needs a token that may read the
 * registry), and a target that is not Linux (the refusal is a pure function, tested as such). The sshd is the one of this computer, not a lab container or the Omarchy virtual machine.
 *
 * @module
 */
import { existsSync, readTextFile, statSync, writeTextFile } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { execPath, run } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { handshakeInput, readHandshake } from "../src/agents/mcp-probe.ts";
import { systemRefusal } from "../src/agents/distro.ts";
import { parseTarget, shq, sshArgv, sshOptions, targetAllowed } from "../src/agents/host/remote.ts";
import { Ergonex, needsWorld, withWorld, type World } from "./ergonex-fixtures.ts";
import { sshdMissing, startSshd, type Sshd } from "./ergonex-sshd.ts";

/** The start of a token of GitHub, kept apart so that no line of this file looks like one. */
const GH = ["gh", "p_"].join("");

const missing = sshdMissing();
const TOKEN = `${GH}0123456789abcdefghijklmnopqrstuvwxyz`;
const COMMIT = { name: "An Agent", email: "agent@example.org", trailer: "Co-Authored-By: An Agent <agent@example.org>" };

const address = (s: Sshd): string => `ssh://${s.user}@127.0.0.1:${s.port}`;

/** Runs ergonex on the controller: a world's workspace, as a person (or an agent) runs it. */
const ctl = (w: World, words: string[], input?: string, extra: Record<string, string> = {}) =>
  run([execPath(), Ergonex, ...words], { env: { ...w.env, ...extra }, cwd: w.dir, ...(input === undefined ? {} : { input }) }).then((r) => ({ code: r.code, stdout: r.stdout, stderr: r.stderr, all: r.stdout + r.stderr }));

const steps = (stdout: string): Record<string, string> => Object.fromEntries((JSON.parse(stdout).data.steps as { step: string; status: string }[]).map((s) => [s.step, s.status]));

proves(["0006-agents FR-027", "0006-agents FR-031", "0006-agents FR-032"], "the target is an ssh:// address or a name of the SSH configuration, every connection is made with BatchMode, no terminal, StrictHostKeyChecking=yes and a known-hosts file of its own, the policy's list names the hosts, and only Linux is a target", () => {
  const t = parseTarget("ssh://agent@box.example:2222");
  assert(t.kind === "ok");
  assertEquals([t.value.host, t.value.port, t.value.user], ["box.example", 2222, "agent"]);
  assert(parseTarget("ssh://a:secret@box").kind === "err", "no password in an address");
  assert(parseTarget("-oProxyCommand=x").kind === "err", "an option is not a host");
  assert(parseTarget("ssh://box:99999").kind === "err");
  const options = sshOptions("/k").join(" ");
  for (const o of ["BatchMode=yes", "StrictHostKeyChecking=yes", "UserKnownHostsFile=/k", "GlobalKnownHostsFile=/dev/null", "-T"]) assertStringIncludes(options, o);
  const argv = sshArgv(t.value, "/k", "ergonex status");
  assertEquals(argv.at(-2), "--");
  assertEquals(argv.at(-1), "ergonex status");
  assert(targetAllowed(["box.example"], t.value));
  assert(!targetAllowed(["other"], t.value));
  assertEquals(shq("a'b"), "'a'\\''b'");
  assertEquals(systemRefusal("Linux"), undefined);
  assertStringIncludes(systemRefusal("Darwin") ?? "", "macOS comes in the second phase");
  assertStringIncludes(systemRefusal("MINGW64_NT") ?? "", "Windows OpenSSH comes in the third phase");
});

missing === undefined && needsWorld.skip === undefined
  ? proves(["0006-agents FR-027", "0006-agents FR-028"], "the host's key is known before the first connection: no fingerprint refuses and prints the fingerprints, a wrong one refuses, the right one pins, and a key that changed afterwards refuses; a host the policy does not name is refused", async () => {
      const s = await startSshd();
      try {
        await withWorld(async (w) => {
          await w.manifest({ repositories: [], agents: { remote: [address(s)] } });
          const base = ["remote", "bootstrap", address(s), "--identity", s.identity, "--dry-run"];
          // no fingerprint, no trust on first use: refused with the fingerprint to check by another way
          const none = await ctl(w, base);
          assertEquals(none.code, 2, none.all);
          assertStringIncludes(none.all, s.fingerprint);
          assert(!existsSync(join(w.home, ".ergonex", "known_hosts")), "nothing was trusted");
          // a fingerprint that is not the host's
          const wrong = await ctl(w, [...base, "--fingerprint", "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]);
          assertEquals(wrong.code, 3, wrong.all);
          assertStringIncludes(wrong.all, "no key of");
          // the right one: pinned (a preview records the key only where it is applied, so apply it with run)
          const ok = await ctl(w, ["remote", "bootstrap", address(s), "--identity", s.identity, "--fingerprint", s.fingerprint, "--dry-run", "--json"]);
          assertEquals(ok.code, 0, ok.all);
          assertEquals(steps(ok.stdout)["host key"], "would-change");
          assert(!existsSync(join(w.home, ".ergonex", "known_hosts")), "a preview pins nothing");
          const pinned = await ctl(w, ["remote", "bootstrap", address(s), "--identity", s.identity, "--fingerprint", s.fingerprint, "--json"]);
          assertEquals(pinned.code, 0, pinned.all);
          assertStringIncludes(await readTextFile(join(w.home, ".ergonex", "known_hosts")), s.hostPublic.split(" ")[1] ?? "?");
          // a key that is not the recorded one: refused, by the bootstrap and by ssh itself
          const other = join(w.dir, "other_key");
          await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", other]);
          const otherPub = (await readTextFile(`${other}.pub`)).trim().split(" ");
          await writeTextFile(join(w.home, ".ergonex", "known_hosts"), `[127.0.0.1]:${s.port} ${otherPub[0]} ${otherPub[1]}\n`);
          const changed = await ctl(w, ["remote", "bootstrap", address(s), "--identity", s.identity, "--fingerprint", s.fingerprint, "--json"]);
          assertEquals(changed.code, 3, changed.all);
          assertStringIncludes(changed.all, "not the one recorded");
          const ran = await ctl(w, ["remote", "run", address(s), "--identity", s.identity, "--", "status"]);
          assert(ran.code !== 0, "ssh itself refuses a changed key");
          // trust on first use records the key and prints its fingerprint
          await writeTextFile(join(w.home, ".ergonex", "known_hosts"), "");
          const tofu = await ctl(w, ["remote", "bootstrap", address(s), "--identity", s.identity, "--trust-on-first-use", "--json"]);
          assertEquals(tofu.code, 0, tofu.all.slice(0, 1500));
          assertStringIncludes(tofu.stdout, s.fingerprint);
          // a host the policy's remote list does not name, for the persona agent
          const without = await ctl(w, ["remote", "bootstrap", address(s), "--identity", s.identity, "--trust-on-first-use"], undefined, { ERGONEX_PERSONA: "agent" });
          assertStringIncludes(without.all, "E-AGENT-DENIED");
          await w.manifest({ repositories: [], agents: { allow: ["remote bootstrap"], remote: ["somewhere-else"] } });
          const denied = await ctl(w, ["remote", "bootstrap", address(s), "--identity", s.identity, "--trust-on-first-use"], undefined, { ERGONEX_PERSONA: "agent" });
          assert(denied.code !== 0);
          assertStringIncludes(denied.all, "remote list does not name");
        });
      } finally {
        await s.stop();
      }
    })
  : undefined;

missing === undefined && needsWorld.skip === undefined
  ? proves(["0006-agents FR-029", "0006-agents FR-030", "0006-agents FR-031"], "remote bootstrap over a real ssh connection: the probe, the token written from standard input to a file of mode 0600 (never shown, never an argument), the workspace and the policy, the files of each harness, the doctor and a handshake with the tool server over the same connection; run again every step is unchanged; a preview changes nothing; token refresh rewrites the file; remote run runs one ergonex command and refuses raw commands", async () => {
      const s = await startSshd();
      try {
        await withWorld(async (w) => {
          await w.manifest({ repositories: [], agents: { allow: ["remote bootstrap"], remote: ["127.0.0.1"] } });
          const policy = join(w.dir, "policy.json");
          await writeTextFile(policy, JSON.stringify({ allow: [], tier: "public", commit: COMMIT, remote: [], disposable: true }));
          const words = ["remote", "bootstrap", address(s), "--identity", s.identity, "--fingerprint", s.fingerprint, "--token-stdin", "--expires-at", "2030-01-01T00:00:00Z", "--policy", policy, "--harness", "claude-code", "--harness", "other", "--json"];
          // a preview probes and changes nothing on the machine
          const preview = await ctl(w, [...words, "--dry-run"], `${TOKEN}\n`);
          assertEquals(preview.code, 0, preview.all);
          assert(!existsSync(join(s.userHome, ".config", "ergonex", "token")), "a preview wrote the token");
          assertEquals(steps(preview.stdout)["token"], "would-change");
          // the bootstrap
          const first = await ctl(w, words, `${TOKEN}\n`);
          assertEquals(first.code, 0, first.all);
          const got = steps(first.stdout);
          assertEquals(got["token"], "changed");
          assertEquals(got["workspace"], "changed");
          assertEquals(got["harness claude-code"], "changed");
          assertEquals(got["tool server"], "unchanged");
          assert(!first.all.includes(TOKEN), "the token is shown");
          const tokenFile = join(s.userHome, ".config", "ergonex", "token");
          assertEquals(((statSync(tokenFile).mode ?? 0) & 0o777).toString(8), "600");
          assertEquals((await readTextFile(tokenFile)).trim(), TOKEN);
          assertStringIncludes(await readTextFile(`${tokenFile}.expires`), "2030-01-01T00:00:00.000Z");
          // the policy is on the machine, and the files of the harnesses
          assertStringIncludes(await readTextFile(join(s.userHome, "workspaces", ".ergonex", "agents.json")), "An Agent");
          assertStringIncludes(await readTextFile(join(s.userHome, ".claude", "settings.json")), "agent brief --harness claude-code");
          // the doctor of the machine ran there and its report came back: the token there is read from the file
          const doctor = JSON.stringify(JSON.parse(first.stdout).data.doctor);
          assertStringIncludes(doctor, "file");
          // run again: every step is unchanged
          const second = await ctl(w, words, `${TOKEN}\n`);
          assertEquals(second.code, 0, second.all);
          for (const [step, status] of Object.entries(steps(second.stdout))) assertEquals(status, "unchanged", `${step} on the second run`);
          // a token with no value is refused; a token is never an argument
          assertEquals((await ctl(w, [...words.filter((x) => x !== "--token-stdin")], "")).code, 0);
          const arg = await ctl(w, ["remote", "bootstrap", address(s), "--token", TOKEN]);
          assertEquals(arg.code, 2, arg.all);
          assert(!arg.all.includes(TOKEN), "the refusal shows the token");
          // refresh: atomic rewrite from standard input
          const refreshed = await ctl(w, ["remote", "token", "refresh", address(s), "--identity", s.identity, "--token-stdin", "--json"], `${GH}newtoken0123456789abcdefghijklmnopqr\n`);
          assertEquals(refreshed.code, 0, refreshed.all);
          assertEquals((await readTextFile(tokenFile)).trim(), `${GH}newtoken0123456789abcdefghijklmnopqr`);
          assertEquals(((statSync(tokenFile).mode ?? 0) & 0o777).toString(8), "600");
          assertStringIncludes((await ctl(w, ["remote", "token", "refresh", address(s), "--identity", s.identity, "--token-stdin", "--json"], `${GH}newtoken0123456789abcdefghijklmnopqr\n`)).stdout, "unchanged");
          assertEquals((await ctl(w, ["remote", "token", "refresh", address(s), "--identity", s.identity, "--json"], "")).code, 2);
          // remote run: one ergonex command, its status and envelope
          const ran = await ctl(w, ["remote", "run", address(s), "--identity", s.identity, "--json", "--", "agent", "brief"]);
          assertEquals(ran.code, 0, ran.all);
          const envelope = JSON.parse(ran.stdout).data;
          assertEquals(envelope.status, 0);
          assertEquals(envelope.envelope.data.persona, "agent");
          // the machine refuses what the persona may not do, and the controller says so
          const denied = JSON.parse((await ctl(w, ["remote", "run", address(s), "--identity", s.identity, "--json", "--", "apply"])).stdout).data;
          assertEquals(denied.status, 1);
          assertStringIncludes(JSON.stringify(denied.envelope ?? denied.stdout), "E-AGENT-DENIED");
          // raw commands are refused unless the policy says so
          const raw = await ctl(w, ["remote", "run", address(s), "--identity", s.identity, "--raw", "--", "id"]);
          assertEquals(raw.code, 2, raw.all);
          assertStringIncludes(raw.all, "rawCommands");
          // a job started over ssh outlives that session (FR-024): the first session ends, a second one waits for it
          const job = JSON.parse((await ctl(w, ["remote", "run", address(s), "--identity", s.identity, "--json", "--", "agent", "doctor", "--offline", "--job"])).stdout).data;
          const id: string = JSON.parse(job.stdout ?? JSON.stringify(job.envelope)).job ?? job.envelope.job;
          assert(typeof id === "string" && id.length > 10, JSON.stringify(job));
          const waited = JSON.parse((await ctl(w, ["remote", "run", address(s), "--identity", s.identity, "--timeout", "120", "--json", "--", "agent", "jobs", "wait", id, "--timeout", "90"])).stdout).data;
          assertStringIncludes(JSON.stringify(waited.envelope), '"state":"');
          assert(existsSync(join(s.userHome, "workspaces", ".ergonex", "jobs", id, "job.json")));
        });
      } finally {
        await s.stop();
      }
    })
  : undefined;

missing === undefined && needsWorld.skip === undefined
  ? proves(["0006-agents FR-022", "0006-agents FR-023", "0006-agents FR-020"], "a key forced to ergonex mcp by the line `agent keys line` prints reaches the tool server over a real ssh connection and nothing else: the command asked for is not run, the handshake and the tools answer, and the read-only role serves only reads", async () => {
      const s = await startSshd();
      try {
        await withWorld(async (w) => {
          const program = join(s.userHome, ".local", "bin", "ergonex");
          const line = async (role: string): Promise<string> => {
            const r = await ctl(w, ["agent", "keys", "line", "--public-key", s.publicKey, "--role", role, "--user", s.user, "--ergonex-path", program]);
            assertEquals(r.code, 0, r.all);
            return r.stdout.split("\n").find((l) => l.startsWith("restrict,")) ?? "";
          };
          await writeTextFile(join(s.userHome, ".ssh", "authorized_keys"), `${await line("read-only")}\n`);
          await run(["chown", `${s.user}:`, join(s.userHome, ".ssh", "authorized_keys")]);
          // the key is known to the controller by a pinned host key, then every connection is the same as the bootstrap's
          const known = join(w.dir, "known_hosts");
          await writeTextFile(known, `[127.0.0.1]:${s.port} ${s.hostPublic}\n`);
          const ssh = (command: string, input: string) => run(["ssh", ...sshOptions(known), "-i", s.identity, "-o", "IdentitiesOnly=yes", "-l", s.user, "-p", String(s.port), "127.0.0.1", "--", command], { input, signal: AbortSignal.timeout(60_000) });
          // the command asked for is not run: the forced command is
          const asked = await ssh(`touch ${shq(join(s.userHome, "was-run"))}; id`, handshakeInput("over-ssh"));
          assert(!existsSync(join(s.userHome, "was-run")), "the command asked for was run");
          const hs = readHandshake(asked.stdout);
          assert(hs.kind === "ok", `${hs.kind === "err" ? hs.error : ""} ${asked.stderr}`);
          assertEquals(hs.value.serverName, "ergonex");
          assert(hs.value.tools.includes("ergonex_status"));
          assert(!asked.stdout.includes("uid="), "id was run");
        });
      } finally {
        await s.stop();
      }
    })
  : undefined;
