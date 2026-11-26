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
import { defaultPlan } from "@intellectual-frontiers/ssh-server/logical";
import { confirm } from "../src/physical/mod.ts";
import { fixture, ssh, SSH_BASE } from "./helpers.ts";

const engine = process.env["SKIP_DOCKER"] !== "1" && spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
const IMAGE = "ssh-server-test-debian13:1";
const CA = "/root/.ccr/ca-bundle.crt";

proves(["0004-scripts FR-009"], engine ? "the sh script on a real Debian 13 container: facts asserted, osquery installed from its pin" : "SKIPPED: no container engine answers (docker info failed or SKIP_DOCKER=1)", async () => {
  if (!engine) return;
  const f = await fixture();
  try {
    const have = spawnSync("docker", ["image", "inspect", IMAGE], { stdio: "ignore" }).status === 0;
    if (!have) {
      if (existsSync(CA)) copyFileSync(CA, join(f.dir, "ca.crt"));
      else writeFileSync(join(f.dir, "ca.crt"), "");
      writeFileSync(join(f.dir, "Dockerfile"), [
        "FROM debian:trixie",
        "ARG HTTP_PROXY",
        "COPY ca.crt /usr/local/share/ca.crt",
        "RUN if [ -n \"$HTTP_PROXY\" ]; then printf 'Acquire::http::Proxy \"%s\";\\n' \"$HTTP_PROXY\" > /etc/apt/apt.conf.d/99proxy; fi && apt-get update && apt-get install -y --no-install-recommends openssh-client curl ca-certificates && rm -rf /var/lib/apt/lists/*",
        "",
      ].join("\n"));
      const built = spawnSync("docker", ["build", "--network", "host", "--build-arg", `HTTP_PROXY=${process.env["HTTP_PROXY"] ?? ""}`, "-t", IMAGE, f.dir], { encoding: "utf8" });
      assertEquals(built.status, 0, built.stdout + built.stderr);
    }
    const boot = await ssh(f.port, ["bootstrap"], "", "s-enroll", [...SSH_BASE, "-o", "BatchMode=no"]);
    assertEquals(boot.code, 0, boot.stderr);
    const args = ["run", "--rm", "-i", "--network", "host", "-e", `OPSFOLIO_HOST=127.0.0.1`, "-e", `OPSFOLIO_PORT=${f.port}`, "-e", "OPSFOLIO_CONSENT=yes", "-e", "OPSFOLIO_POLL=1", "-e", "OPSFOLIO_SSH_OPTS=-F none -o LogLevel=ERROR", "-e", `HTTPS_PROXY=${process.env["HTTPS_PROXY"] ?? ""}`, "-e", "CURL_CA_BUNDLE=/usr/local/share/ca.crt", IMAGE, "sh"];
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
    const session = await f.store.getSession(id as string);
    const facts = session?.facts;
    assert(facts !== undefined);
    assertEquals(facts.os.family, "linux");
    assert(facts.os.name.includes("Debian"), facts.os.name);
    assertEquals(facts.os.version, "13");
    assertEquals(facts.packageManager, "apt");
    assertEquals(facts.sudo, "root");
    assert(facts.cpus > 0 && facts.memoryBytes > 0 && facts.disks.length > 0 && facts.nics.length > 0, JSON.stringify(facts));
    assert(facts.kernel.startsWith("Linux"), facts.kernel);
    const plan = { steps: [...defaultPlan(facts).steps, { kind: "run" as const, argv: ["/usr/bin/osqueryi", "--version"], as: "user" as const, expect: [0] }] };
    assertEquals(plan.steps[0]?.kind, "install-package");
    const r = await confirm(f.store, id as string, code as string, "synthetic-person-01", plan, f.server.policy.pairing);
    assert(r.kind === "ok" && r.value.kind === "approved");
    const status = await Promise.race([done, new Promise<"timeout">((res) => setTimeout(() => res("timeout"), 240_000))]);
    assertEquals(status, 0, `${stdout}${stderr}`);
    assert(stdout.includes("sha256 verified"), stdout);
    assert(stdout.includes("osquery 5.24.1"), stdout);
    assertEquals((await f.store.getSession(id as string))?.state, "enrolled");
  } finally {
    await f.done();
  }
});
