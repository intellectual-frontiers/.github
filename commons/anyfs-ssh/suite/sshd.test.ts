/**
 * The store against a real ssh server (commons anyfs-ssh 0003-anyfs-ssh-store FR-001; 0004-anyfs-ssh-sshd-test FR-007): the executor of Headless reaches a host by the system's OpenSSH client, the calls of a run share one
 * connection, and the store passes the conformance suite there.
 *
 * The server is the one named by the environment, and where none is named it is a throwaway server of OpenSSH made by `tools/sshd-test.ts` for the run. Where the computer has no OpenSSH server the test is
 * skipped, and says so.
 *
 * ```sh
 * bun test suite/sshd.test.ts                      a throwaway server, made and taken away by the test
 * bun tools/sshd-test.ts run -- bun test suite/    the same, for a whole command
 * # or a server of your own, for instance an OpenSSH container with sshd on the port 2222:
 * ANYFS_SSH_TEST_ADDRESS=127.0.0.1 ANYFS_SSH_TEST_PORT=2222 ANYFS_SSH_TEST_USER=fleet \
 * ANYFS_SSH_TEST_KEY=/path/to/key ANYFS_SSH_TEST_KNOWN_HOSTS=/path/to/known_hosts ANYFS_SSH_TEST_ROOT=/home/fleet/anyfs-test \
 * bun test suite/sshd.test.ts
 * ```
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { sshExecutor } from "@intellectual-frontiers/headless/targets/ssh";
import { target } from "@intellectual-frontiers/headless/logical";
import { proc } from "@intellectual-frontiers/system";
import { openSshStore } from "../src/mod.ts";
import { ENV_PREFIX, type SshdHost, withSshd } from "../tools/sshd-test.ts";

const env = (name: string): string | undefined => proc.env.get(`${ENV_PREFIX}${name}`);

/** The server named by the environment, if one is. */
function named(): SshdHost | undefined {
  const address = env("ADDRESS");
  const key = env("KEY");
  const knownHosts = env("KNOWN_HOSTS");
  const root = env("ROOT");
  if (address === undefined || key === undefined || knownHosts === undefined || root === undefined) return undefined;
  const port = env("PORT");
  return { address, port: port === undefined ? 22 : Number(port), user: env("USER") ?? "", key, knownHosts, root, controlDir: env("CONTROL_DIR") ?? "" };
}

async function conformance(host: SshdHost): Promise<readonly string[]> {
  const t = target({ id: "fleet-test", class: "server", address: host.address, ...(host.user === "" ? {} : { user: host.user }), port: host.port, credential: "test-key" });
  if (t.kind === "err") throw new Error(t.error);
  const executor = sshExecutor(t.value, [t.value], {
    knownHostsRepository: host.knownHosts,
    knownHostsUser: host.knownHosts,
    identityFor: (name) => (name === "test-key" ? host.key : undefined),
    ...(host.controlDir === "" ? {} : { controlDir: host.controlDir }),
  });
  let n = 0;
  const reports = await runConformance(async () => {
    n += 1;
    const opened = await openSshStore(executor, { place: { host: host.address, ...(host.user === "" ? {} : { user: host.user }), port: host.port }, root: `${host.root}/run-${Date.now()}-${n}`, create: true });
    if (opened.kind === "err") throw new Error(opened.error);
    return opened.value.store;
  });
  return reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);
}

proves(["0003-anyfs-ssh-store FR-001", "0004-anyfs-ssh-sshd-test FR-007"], "against a real ssh server, named by the environment or made for the run, the store passes every case of the conformance suite over one shared connection (skipped where no server can be had)", async (t) => {
  const given = named();
  if (given !== undefined) {
    assertEquals(await conformance(given), []);
    return;
  }
  const ran = await withSshd(conformance);
  if (ran.kind === "skipped") {
    t.skip(ran.reason);
    return;
  }
  assertEquals(ran.value, []);
});
