/**
 * The store against a real ssh server (commons anyfs-ssh 0003-anyfs-ssh-store FR-001): the executor of Headless reaches a host by the system's OpenSSH client and the store passes the conformance
 * suite there. It runs only where a host is named by the environment, and is skipped where none is.
 *
 * ```sh
 * # a throwaway key and a server that accepts it, for instance an OpenSSH container with sshd on the port 2222:
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

const env = (name: string): string | undefined => proc.env.get(`ANYFS_SSH_TEST_${name}`);

proves(["0003-anyfs-ssh-store FR-001"], "against a real ssh server named by the environment, the store passes every case of the conformance suite (skipped where none is named)", async () => {
  const address = env("ADDRESS");
  const key = env("KEY");
  const known = env("KNOWN_HOSTS");
  const root = env("ROOT");
  if (address === undefined || key === undefined || known === undefined || root === undefined) return;
  const user = env("USER");
  const port = env("PORT");
  const t = target({ id: "fleet-test", class: "server", address, ...(user === undefined ? {} : { user }), ...(port === undefined ? {} : { port: Number(port) }), credential: "test-key" });
  if (t.kind === "err") throw new Error(t.error);
  const executor = sshExecutor(t.value, [t.value], { knownHostsRepository: known, knownHostsUser: known, identityFor: (name) => (name === "test-key" ? key : undefined) });
  let n = 0;
  const reports = await runConformance(async () => {
    n += 1;
    const opened = await openSshStore(executor, { place: { host: address, ...(user === undefined ? {} : { user }), ...(port === undefined ? {} : { port: Number(port) }) }, root: `${root}/run-${Date.now()}-${n}`, create: true });
    if (opened.kind === "err") throw new Error(opened.error);
    return opened.value.store;
  });
  assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
});
