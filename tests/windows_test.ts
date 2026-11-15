// Windows (009-machine-bootstrap FR-093): WSL 2 and Debian, the Linux user, then the Linux bootstrap inside; a stand-in for wsl.exe, the registry, sc.exe and the
// person, so that this runs on any computer (and on the Windows runner of the CI, with its real Deno).
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  closingWords,
  distroNames,
  findWindowsPostgres,
  type How,
  outcomeOf,
  prepareWindows,
  registryInstallations,
  registryPort,
  serviceMajors,
  type WindowsHost,
  type WindowsOptions,
} from "../bin/setup/windows.ts";

type Call = { readonly argv: readonly string[]; readonly how: How; readonly env: Readonly<Record<string, string>> };

/** A Windows with WSL; `distros` grows when wsl --install runs (unless a restart is needed), and each command answers by its words. */
function host(o: { distros?: string[]; installs?: "ok" | "restart" | "fails"; uid1000?: string; bootstrap?: number; answers?: string[]; pg?: boolean; wsl?: boolean } = {}) {
  const calls: Call[] = [];
  const said: string[] = [];
  const distros = [...(o.distros ?? [])];
  const answers = [...(o.answers ?? [])];
  const h: WindowsHost = {
    run: (argv, how, env = {}) => {
      calls.push({ argv, how, env });
      const line = argv.join(" ");
      if (line === "wsl.exe --list --quiet") return Promise.resolve({ code: 0, output: distros.map((d) => `${d.split("").join("\0")}\0\r\n`).join("") });
      if (line.startsWith("wsl.exe --install")) {
        if (o.installs === "fails") return Promise.resolve({ code: 1, output: "" });
        if (o.installs !== "restart") distros.push("Debian");
        return Promise.resolve({ code: 0, output: "" });
      }
      if (line.includes("getent passwd 1000")) return Promise.resolve({ code: 0, output: o.uid1000 ?? "" });
      if (line.includes("curl -fsSL")) return Promise.resolve({ code: o.bootstrap ?? 0, output: "" });
      if (line.startsWith("reg.exe query HKLM\\SOFTWARE\\PostgreSQL\\Installations")) {
        return Promise.resolve(
          o.pg
            ? {
              code: 0,
              output:
                "HKEY_LOCAL_MACHINE\\SOFTWARE\\PostgreSQL\\Installations\\postgresql-x64-18\r\n    Version    REG_SZ    18.1\r\n    Service ID    REG_SZ    postgresql-x64-18\r\n",
            }
            : { code: 1, output: "" },
        );
      }
      if (line.startsWith("reg.exe query HKLM\\SOFTWARE\\PostgreSQL\\Services")) return Promise.resolve({ code: 0, output: "    Port    REG_DWORD    0x1539\r\n" });
      if (line.startsWith("sc.exe")) return Promise.resolve({ code: 0, output: o.pg ? "SERVICE_NAME: postgresql-x64-16\r\nDISPLAY_NAME: x\r\n" : "SERVICE_NAME: Spooler\r\n" });
      return Promise.resolve({ code: 0, output: "" });
    },
    hasWsl: () => o.wsl ?? true,
    ask: () => Promise.resolve(answers.shift() ?? "fallback"),
    programFiles: () => Promise.resolve(o.pg ? [{ name: "14", hasPgCtl: true }, { name: "tools", hasPgCtl: false }] : []),
    say: (t) => said.push(t),
    warn: (t) => said.push(t),
  };
  return { h, calls, said };
}

const opts = (more: Partial<WindowsOptions> = {}): WindowsOptions => ({
  distro: "Debian",
  user: "",
  bootstrapUrl: "https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-bootstrap.sh",
  baseUrl: "https://raw.githubusercontent.com/intellectual-frontiers/.github/main",
  dryRun: false,
  ...more,
});
const lines = (calls: Call[]) => calls.map((c) => c.argv.join(" "));

Deno.test("it installs WSL and Debian, makes the user, gives it sudo, makes it the default, and runs the bootstrap as it (FR-093)", async () => {
  const { h, calls, said } = host({ answers: ["Bad Name", "ada"] });
  const o = await prepareWindows(h, opts());
  assertEquals(o.kind, "done");
  const l = lines(calls);
  assert(l.includes("wsl.exe --install -d Debian --no-launch"));
  const user = calls.find((c) => c.argv.join(" ").includes("adduser"));
  assertEquals(user?.how, "interactive", "the person types the password");
  assertStringIncludes(user?.argv.join(" ") ?? "", "adduser --gecos '' ada && usermod -aG sudo ada");
  assert(l.some((x) => x.includes("/etc/wsl.conf") && x.includes("default=ada")));
  assert(l.some((x) => x.includes("apt-get install -y curl wget unzip")));
  const boot = calls.find((c) => c.argv.join(" ").includes("curl -fsSL"));
  assertEquals(boot?.argv.slice(0, 6), ["wsl.exe", "-d", "Debian", "-u", "ada", "--"]);
  assertStringIncludes(boot?.argv.join(" ") ?? "", "cd && curl -fsSL 'https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-bootstrap.sh' | sh");
  assertEquals(boot?.how, "interactive");
  assertEquals(boot?.env.BOOTSTRAP_URL, "https://raw.githubusercontent.com/intellectual-frontiers/.github/main");
  assertStringIncludes(said.join("\n"), "it does not run natively on Windows yet");
  for (const x of l) for (const forbidden of ["--unregister", "--shutdown", "Set-ExecutionPolicy"]) assert(!x.includes(forbidden), x);
});

Deno.test("an existing distribution and user are continued in, never deleted (FR-093)", async () => {
  const { h, calls, said } = host({ distros: ["Ubuntu", "Debian"], uid1000: "grace\n" });
  assertEquals((await prepareWindows(h, opts())).kind, "done");
  const l = lines(calls);
  assert(!l.some((x) => x.startsWith("wsl.exe --install")));
  assert(!l.some((x) => x.includes("adduser")));
  assertStringIncludes(said.join("\n"), "already installed: continuing in it. Nothing in it is deleted");
  assert(l.some((x) => x.includes("-u grace -- sh -c cd && curl")));
});

Deno.test("a Windows that must restart, WSL that cannot install, and no WSL each stop with what to do (FR-093)", async () => {
  const restart = await prepareWindows(host({ installs: "restart" }).h, opts());
  assert(restart.kind === "stopped");
  assertStringIncludes(restart.reason, "Windows has to restart");
  const fails = await prepareWindows(host({ installs: "fails" }).h, opts());
  assert(fails.kind === "stopped");
  assertStringIncludes(fails.reason, "WSL could not be installed");
  const none = await prepareWindows(host({ wsl: false }).h, opts());
  assert(none.kind === "stopped");
  assertStringIncludes(none.reason, "WSL is not part of this Windows");
});

Deno.test("the bootstrap's exit status 1 is done with notes; any other failure stops (FR-093, FR-055)", async () => {
  assertEquals((await prepareWindows(host({ bootstrap: 1, uid1000: "u" }).h, opts())).kind, "notes");
  const s = await prepareWindows(host({ bootstrap: 4, uid1000: "u" }).h, opts());
  assert(s.kind === "stopped" && s.status === 4);
  assertEquals(outcomeOf(0).kind, "done");
  assertStringIncludes(closingWords(outcomeOf(1), "Debian").join("\n"), "Done, with notes");
  assertStringIncludes(closingWords(outcomeOf(0), "Debian").join("\n"), "./erga local start");
});

Deno.test("PostgreSQL on Windows is found reading only, and handed to the setup inside through WSLENV (FR-093)", async () => {
  const { h, calls, said } = host({ pg: true, uid1000: "u" });
  assertEquals(await findWindowsPostgres(h), ["14@5432", "16@5432", "18@5433"]);
  await prepareWindows(h, opts());
  const boot = calls.find((c) => c.argv.join(" ").includes("curl -fsSL"));
  assertEquals(boot?.env.ERGA_WINDOWS_POSTGRES, "14@5432,16@5432,18@5433");
  assertEquals(boot?.env.WSLENV, "BOOTSTRAP_URL:ERGA_WINDOWS_POSTGRES");
  assertStringIncludes(said.join("\n"), "Nothing about it is changed");
  for (const c of calls) {
    for (const forbidden of ["Stop-Service", "Set-Service", "reg.exe add", "reg.exe delete", "sc.exe stop", "sc.exe config", "netsh"]) {
      assert(!c.argv.join(" ").includes(forbidden), c.argv.join(" "));
    }
  }
  const pgAt = calls.findIndex((c) => c.argv[0] === "reg.exe");
  const bootAt = calls.findIndex((c) => c.argv.join(" ").includes("curl -fsSL"));
  assert(pgAt < bootAt, "found before the bootstrap runs, so that the setup is told");
});

Deno.test("a dry run on Windows lists the steps and changes nothing, with WSL or without", async () => {
  const bare = host({ wsl: false });
  assertEquals((await prepareWindows(bare.h, opts({ dryRun: true }))).kind, "planned");
  assertEquals(bare.calls, []);
  assertStringIncludes(bare.said.join("\n"), "WSL is not part of this Windows");
  const { h, calls, said } = host();
  assertEquals((await prepareWindows(h, opts({ dryRun: true }))).kind, "planned");
  assertEquals(lines(calls), ["wsl.exe --list --quiet"]);
  assertStringIncludes(said.join("\n"), "would install WSL 2 and Debian");
});

Deno.test("what Windows prints is read as text", () => {
  assertEquals(distroNames("﻿D\0e\0b\0i\0a\0n\0\r\n\0U\0b\0u\0n\0t\0u\0\r\n"), ["Debian", "Ubuntu"]);
  assertEquals(registryInstallations("HKEY_X\r\n    Version    REG_SZ    17.2\r\n\r\nHKEY_Y\r\n    Service ID    REG_SZ    s\r\n"), [{ major: "17", service: "" }]);
  assertEquals(registryPort("    Port    REG_DWORD    0x1538\r\n"), "5432");
  assertEquals(registryPort("nothing"), null);
  assertEquals(serviceMajors("SERVICE_NAME: postgresql-x64-15\r\nSERVICE_NAME: postgresql16\r\nSERVICE_NAME: other\r\n"), ["15", "16"]);
});
