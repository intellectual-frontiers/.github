/**
 * The fleet as it is meant to run (commons estate 0006-estate-fleet-store FR-010): the store of a real ssh server is the primary of a fleet store and a branch of a Git repository and a folder are its replicas.
 * Two operators change one asset over the real server and are one winner and one conflict; the writes of a settlement are one commit of the branch; and when the host is lost the Git replica is opened as the
 * primary with the data intact and the estate's truth unchanged. The server is a real OpenSSH server made for the run, and where none can be made the test is skipped. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";
import { expectAbsent } from "../commons/anyfs/src/governance/mod.ts";
import { localStore } from "../commons/anyfs/src/physical/local/mod.ts";
import { gitRefStore, parseIdentity } from "../commons/anyfs-git/src/mod.ts";
import { openSshStore } from "../commons/anyfs-ssh/src/mod.ts";
import { fs, path, proc } from "../commons/system/src/mod.ts";
import { assessSnapshot, openFleetStore } from "../commons/estate/src/physical/mod.ts";
import { executorOf, placeOf, withSshd } from "../commons/anyfs-ssh/tools/sshd-test.ts";
import { adopted, managed, named, ticking } from "../commons/estate/suite/support.ts";

const gitEnv = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const gitOut = async (repo: string, ...args: string[]): Promise<string> => {
  const r = await proc.run(["git", "-C", repo, ...args], { env: gitEnv });
  if (!r.success) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.trim();
};
const identity = (() => {
  const r = parseIdentity("Fleet Collector", "collector@example.test");
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
})();
const AT = Date.UTC(2026, 10, 20, 10, 0, 0);
const at = (minutes: number): string => new Date(AT + minutes * 60_000).toISOString();

proves(
  ["0006-estate-fleet-store FR-010"],
  "over a real ssh server, two operators who change an asset are one winner and one conflict, a settlement is one commit of the Git branch, and a lost host leaves the Git replica to be opened as the primary with the data and the truth unchanged",
  async (t) => {
    if (proc.which("git") === undefined) {
      t.skip("this computer has no git");
      return;
    }
    const started = Date.now();
    const ran = await withSshd(async (host) => {
      const tmp = await fs.realPath(await fs.makeTempDir({ prefix: "estate-fleet-ssh-" }));
      try {
        const repo = path.join(tmp, "fleet-history.git");
        const folder = path.join(tmp, "copy");
        await fs.mkdir(folder);
        await gitOut(tmp, "init", "-q", "--bare", "-b", "main", repo);
        const opened = await openSshStore(executorOf(host), { place: placeOf(host), root: `${host.root}/fleet`, create: true });
        if (opened.kind === "err") throw new Error(opened.error);
        const ssh = opened.value.store;
        const git = await gitRefStore({ repo, branch: "fleet", commit: { author: identity, clock: () => Date.UTC(2026, 0, 1) } });
        if (git.kind === "err") throw new Error(git.error);
        const copy = await localStore(folder);
        if (copy.kind === "err") throw new Error(copy.error);

        const one = await openFleetStore({
          primary: { name: named("record"), store: ssh },
          replicas: [
            { name: named("history"), store: git.value.store },
            { name: named("copy"), store: copy.value },
          ],
          create: true,
          identity: "example-fleet",
          actor: "operator-1",
          clock: ticking(AT),
        });
        assert(one.kind === "ok", `the first operator opens: ${one.kind === "err" ? JSON.stringify(one.error) : ""}`);
        const two = await openFleetStore({
          primary: { name: named("record"), store: ssh },
          identity: "example-fleet",
          actor: "operator-2",
          clock: ticking(AT),
        });
        assert(two.kind === "ok", "the second operator opens the same host");

        for (const a of [adopted("olympia"), managed("athens"), adopted("sparta")])
          assert((await one.value.putAsset(a, expectAbsent)).kind === "ok");
        assert((await one.value.declare("olympia", { os: "linux" }, expectAbsent)).kind === "ok");
        for (const [m, state] of [
          [0, { os: "linux" }],
          [5, { os: "bsd" }],
        ] as const) {
          assert(
            (
              await one.value.recordObservation({
                asset: "olympia",
                at: at(m),
                source: "probe",
                state,
                results: [{ id: "disk-encryption", status: m === 0 ? "pass" : "fail", controls: ["CRY-05"] }],
              })
            ).kind === "ok",
          );
        }
        assert(
          (
            await one.value.acceptRisk("olympia", {
              policy: "disk-encryption",
              reason: "holds only open-source code",
              by: "an owner",
              until: "2027-03-01",
            })
          ).kind === "ok",
        );

        // two operators over the real server: one wins, the other begins again with what the first wrote
        let calls = 0;
        const raced = await two.value.updateAsset("sparta", async (current) => {
          calls += 1;
          assert(current !== undefined);
          if (calls === 1) {
            const other = await one.value.updateAsset("sparta", (c) => (c === undefined ? undefined : managed(c.id)));
            assert(other.kind === "ok");
          }
          return current;
        });
        assert(raced.kind === "ok" && raced.value.attempts === 2 && calls === 2, "the second operator lost once and began again");
        const sparta = await two.value.getAsset("sparta");
        assert(sparta.kind === "ok");
        assertEquals(sparta.value.value.state, "managed", "what the first operator wrote was kept");

        // a settlement is one commit of the branch
        const settled = await one.value.settle();
        assert(settled.kind === "ok");
        assertEquals(
          settled.value.map((s) => [s.replica, s.state.kind]),
          [
            ["history", "in-sync"],
            ["copy", "in-sync"],
          ],
        );
        assertEquals(await gitOut(repo, "rev-list", "--count", "fleet"), "1", "all the documents of a settlement are one commit");
        const files = (await gitOut(repo, "ls-tree", "-r", "--name-only", "fleet")).split("\n");
        assert(
          files.includes("fleet.json") && files.includes("assets/o/olympia.json") && files.every((f) => !f.startsWith("_mirror-ledger")),
          "the documents are in the branch and the ledgers are not",
        );
        assertEquals((await one.value.settle()).kind, "ok");
        assertEquals(await gitOut(repo, "rev-list", "--count", "fleet"), "1", "a second settlement makes no commit");

        // the host is lost: the Git replica is opened as the primary
        const before = await two.value.snapshot({ observations: "all" });
        assert(before.kind === "ok" && before.value.stable);
        const gitAgain = await gitRefStore({ repo, branch: "fleet", commit: { author: identity, clock: () => Date.UTC(2026, 0, 2) } });
        if (gitAgain.kind === "err") throw new Error(gitAgain.error);
        const survivor = await openFleetStore({
          primary: { name: named("history"), store: gitAgain.value.store },
          identity: "example-fleet",
          actor: "operator-3",
          clock: ticking(AT),
        });
        assert(
          survivor.kind === "ok",
          `the Git replica opens as a fleet store: ${survivor.kind === "err" ? JSON.stringify(survivor.error) : ""}`,
        );
        const after = await survivor.value.snapshot({ observations: "all" });
        assert(after.kind === "ok" && after.value.stable);
        assertEquals(after.value.assets.map((a) => a.id).sort(), before.value.assets.map((a) => a.id).sort());
        assertEquals(after.value.declared, before.value.declared);
        assertEquals(after.value.observations, before.value.observations);
        assertEquals(after.value.acceptances, before.value.acceptances);
        const a = assessSnapshot(before.value, "2026-11-20T10:30:00Z", "PT1H");
        const b = assessSnapshot(after.value, "2026-11-20T10:30:00Z", "PT1H");
        assert(a.kind === "ok" && b.kind === "ok");
        assertEquals(b.value, a.value, "the estate's truth is unchanged");
        assert(
          (await survivor.value.putAsset(adopted("corinth"), expectAbsent)).kind === "ok",
          "the survivor takes writes as the new system of record",
        );
        await one.value.close();
        await two.value.close();
        await survivor.value.close();
        return Date.now() - started;
      } finally {
        await fs.remove(tmp, { recursive: true }).catch(() => undefined);
      }
    });
    if (ran.kind === "skipped") {
      t.skip(ran.reason);
      return;
    }
    console.log(`fleet store over a real sshd: ${ran.value} ms`);
  },
);
