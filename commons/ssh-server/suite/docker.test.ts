/**
 * The script for sh run on a real Debian 13 container against a server on the host: the facts the container reports are asserted, the typed plan installs the pinned osquery from its official release after its SHA-256 is verified, and the installed program runs.
 * Skipped cleanly where no container engine answers (or `SKIP_DOCKER=1`). The image is made once with the proxy certificate of this sandbox where one exists (`/root/.ccr/ca-bundle.crt`).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Facts, InstallPlan } from "@intellectual-frontiers/ssh-server/governance";
import { defaultPlan } from "@intellectual-frontiers/ssh-server/logical";
import { confirm } from "../src/physical/mod.ts";
import { fixture, ssh, SSH_BASE } from "./helpers.ts";

const engine = process.env["SKIP_DOCKER"] !== "1" && spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
const CA = "/root/.ccr/ca-bundle.crt";

type Device = { readonly image: string; readonly packages: string };
const WITH_CURL: Device = { image: "ssh-server-test-debian13:1", packages: "openssh-client curl ca-certificates" };
const BARE: Device = { image: "ssh-server-test-debian13-bare:1", packages: "openssh-client" };

/** Enroll a container of Debian 13 with the given packages against a server on the host, approving with the plan `planOf` makes from its facts. */
async function enroll(device: Device, planOf: (facts: Facts) => InstallPlan) {
  const f = await fixture();
  try {
    const have = spawnSync("docker", ["image", "inspect", device.image], { stdio: "ignore" }).status === 0;
    if (!have) {
      if (existsSync(CA)) copyFileSync(CA, join(f.dir, "ca.crt"));
      else writeFileSync(join(f.dir, "ca.crt"), "");
      writeFileSync(join(f.dir, "Dockerfile"), [
        "FROM debian:trixie",
        "ARG HTTP_PROXY",
        "COPY ca.crt /usr/local/share/ca.crt",
        `RUN if [ -n "$HTTP_PROXY" ]; then printf 'Acquire::http::Proxy "%s";\\n' "$HTTP_PROXY" > /etc/apt/apt.conf.d/99proxy; fi && apt-get update && apt-get install -y --no-install-recommends ${device.packages} && rm -rf /var/lib/apt/lists/*`,
        "",
      ].join("\n"));
      const built = spawnSync("docker", ["build", "--network", "host", "--build-arg", `HTTP_PROXY=${process.env["HTTP_PROXY"] ?? ""}`, "-t", device.image, f.dir], { encoding: "utf8" });
      assertEquals(built.status, 0, built.stdout + built.stderr);
    }
    const boot = await ssh(f.port, ["bootstrap"], "", "s-enroll", [...SSH_BASE, "-o", "BatchMode=no"]);
    assertEquals(boot.code, 0, boot.stderr);
    const args = ["run", "--rm", "-i", "--network", "host", "-e", `SYNTH_HOST=127.0.0.1`, "-e", `SYNTH_PORT=${f.port}`, "-e", "SYNTH_CONSENT=yes", "-e", "SYNTH_POLL=1", "-e", "SYNTH_SSH_OPTS=-F none -o LogLevel=ERROR", "-e", `HTTPS_PROXY=${process.env["HTTPS_PROXY"] ?? ""}`, "-e", "CURL_CA_BUNDLE=/usr/local/share/ca.crt", device.image, "sh"];
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d));
    child.stderr.on("data", (d: Buffer) => (stderr += d));
    const done = new Promise<number | null>((r) => child.on("close", r));
    child.stdin.end(boot.stdout);
    let code: string | undefined;
    for (let i = 0; i < 600 && code === undefined; i++) {
      code = /Your pairing code is: (\S+)/.exec(stdout)?.[1];
      if (code === undefined) await new Promise((r) => setTimeout(r, 100));
    }
    assert(code !== undefined, `no code: ${stdout}${stderr}`);
    let id: string | undefined;
    for (let i = 0; i < 200 && id === undefined; i++) {
      id = (await f.store.listSessions()).find((s) => s.state === "interrogated")?.id;
      if (id === undefined) await new Promise((r) => setTimeout(r, 100));
    }
    assert(id !== undefined);
    const facts = (await f.store.getSession(id as string))?.facts;
    assert(facts !== undefined);
    const r = await confirm(f.store, id as string, code as string, "synthetic-person-01", planOf(facts), f.server.policy.pairing);
    assert(r.kind === "ok" && r.value.kind === "approved");
    const status = await Promise.race([done, new Promise<"timeout">((res) => setTimeout(() => res("timeout"), 240_000))]);
    return { facts, status, stdout, stderr, session: await f.store.getSession(id as string) };
  } finally {
    await f.done();
  }
}

proves(["0004-scripts FR-009"], engine ? "the sh script on a real Debian 13 container: facts asserted, osquery installed from its pin" : "SKIPPED: no container engine answers (docker info failed or SKIP_DOCKER=1)", async () => {
  if (!engine) return;
  const r = await enroll(WITH_CURL, (facts) => ({ steps: [...defaultPlan(facts).steps, { kind: "run" as const, argv: ["/usr/bin/osqueryi", "--version"], as: "user" as const, expect: [0], optional: true as const }] }));
  const facts = r.facts;
  assertEquals(facts.os.family, "linux");
  assert(facts.os.name.includes("Debian"), facts.os.name);
  assertEquals(facts.os.version, "13");
  assertEquals(facts.packageManager, "apt");
  assertEquals(facts.sudo, "root");
  assert(facts.cpus > 0 && facts.memoryBytes > 0 && facts.disks.length > 0 && facts.nics.length > 0, JSON.stringify(facts));
  assert(facts.kernel.startsWith("Linux"), facts.kernel);
  assertEquals(r.status, 0, `${r.stdout}${r.stderr}`);
  assert(r.stdout.includes("sha256 verified"), r.stdout);
  assert(r.stdout.includes("osquery 5.24.1"), r.stdout);
  assertEquals(r.session?.state, "enrolled");
  assert(r.session?.outcome?.steps.every((x) => x.ok), JSON.stringify(r.session?.outcome));
});

proves(["0004-scripts FR-011", "0004-scripts FR-012"], engine ? "a Debian 13 container with no curl, wget or python3 enrolls: the optional osquery step is reported as not done, with the reason and what to install" : "SKIPPED: no container engine answers (docker info failed or SKIP_DOCKER=1)", async () => {
  if (!engine) return;
  const r = await enroll(BARE, (facts) => defaultPlan(facts));
  assertEquals(r.status, 0, `${r.stdout}${r.stderr}`);
  assert(r.stdout.includes("this machine is enrolled"), r.stdout);
  assertEquals(r.session?.state, "enrolled");
  const osquery = r.session?.outcome?.steps.find((x) => x.optional === true);
  assert(osquery !== undefined && !osquery.ok, JSON.stringify(r.session?.outcome));
  assert(osquery.detail.includes("no-downloader") && osquery.detail.includes("apt-get install curl"), osquery.detail);
  assert(r.stdout.includes("not done (optional, the enrollment goes on)"), r.stdout);
});
