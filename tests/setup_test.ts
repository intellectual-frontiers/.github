// The setup and the bootstrap as a person runs them (erga's 009-machine-bootstrap): the entry, --dry-run, the switches, the families, the packages through
// stand-ins for apt, pacman and sudo, the installation record and the checks before the long installs. Run as a program, in a temporary home folder.
import { assert, assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { ARCH, exists, FEDORA, Fx, OFF, OMARCHY, tree, without } from "./helpers.ts";

const has = (s: string, ...needles: string[]) => needles.forEach((n) => assertStringIncludes(s, n));
const lacks = (s: string, ...needles: string[]) => needles.forEach((n) => assert(!s.includes(n), `unexpected ${JSON.stringify(n)} in:\n${s}`));

Deno.test("help, a bad option and an option the setup does not have", async () => {
  await using fx = await Fx.make();
  const h = await fx.setup(["--help"]);
  assertEquals(h.code, 0);
  has(h.stdout, "curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-bootstrap.sh | sh", "--dry-run", "--patient", "irm ");
  lacks(h.stdout, "--user", "--dedicated", "adduser");
  assertEquals((await fx.setup(["--nonsense"])).code, 2);
  for (const gone of [["--user", "bob"], ["--dedicated"], ["--mode", "x"]]) assertEquals((await fx.boot(["--dry-run", ...gone])).code, 2, gone.join(" "));
});

Deno.test("a home that is not a folder is refused before anything is written (FR-012)", async () => {
  await using fx = await Fx.make();
  for (const home of ["", "/", `${fx.tmp}/missing`]) {
    const p = await fx.setup(["--dry-run"], { HOME: home });
    assertEquals(p.code, 3, home);
    assertStringIncludes(p.stderr, "HOME");
  }
});

Deno.test("a family the table knows but no script acts on is named with its manager, and another is refused (FR-012, FR-014)", async () => {
  await using fx = await Fx.make();
  for (const [id, label, manager] of [["fedora", "Red Hat family", "dnf"], ["alpine", "Alpine family", "apk"], ["opensuse-leap", "SUSE family", "zypper"]]) {
    for (const run of [fx.setup.bind(fx), fx.boot.bind(fx)]) {
      const p = await run(["--dry-run"], { BOOTSTRAP_OS_RELEASE: fx.osr(`ID=${id}\nPRETTY_NAME="Test ${id}"\n`) });
      assertEquals(p.code, 3, id);
      has(p.stderr, `${label}: it uses ${manager}, and this setup does not support it yet`, "Fix:", "Arch family");
    }
  }
  const plan9 = await fx.setup(["--dry-run"], { BOOTSTRAP_OS_RELEASE: fx.osr('ID=plan9\nPRETTY_NAME="Plan 9"\n') });
  assertEquals(plan9.code, 3);
  has(plan9.stderr, "Plan 9");
  lacks(plan9.stderr, "it uses");
  const fedora = await fx.boot(["--dry-run"], { BOOTSTRAP_OS_RELEASE: fx.osr(FEDORA) });
  has(fedora.stderr, "Fedora Linux 40");
});

Deno.test("a processor other than x86-64 and Arm is refused, and so is a system that is neither Linux nor a Mac", async () => {
  await using fx = await Fx.make();
  fx.stub("uname", 'case "$1" in -s) echo Linux ;; -m) echo riscv64 ;; esac');
  const p = await fx.setup(["--dry-run"], { PATH: fx.path });
  assertEquals(p.code, 3);
  has(p.stderr, "riscv64", "amd64 or arm64");
  fx.stub("uname", 'case "$1" in -s) echo FreeBSD ;; -m) echo amd64 ;; esac');
  const q = await fx.setup(["--dry-run"], { PATH: fx.path });
  assertEquals(q.code, 3);
  has(q.stderr, "this is FreeBSD");
});

Deno.test("--dry-run lists the steps, in the spec's order, and writes nothing (FR-011, FR-026, FR-055, FR-056)", async () => {
  await using fx = await Fx.make();
  const before = await tree(fx.home);
  const p = await fx.setup(["--dry-run"]);
  assertEquals(p.code, 0, p.stderr);
  assertEquals(await tree(fx.home), before, "a dry run writes nothing");
  const out = p.stdout;
  has(
    out,
    "ergactl doctor",
    "ergactl toolchain ensure",
    "ergactl check",
    "bin/setup.sh",
    "intellectual-frontiers/erga",
    "GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https",
  );
  has(out, "rustup", "Installing uv 0.12.23", "rust-toolchain.toml");
  lacks(
    out,
    "Oh My Posh",
    "chezmoi",
    "login shell",
    "shell ensure",
    "VS Code",
    "AI assistants",
    "apt install",
    "administrator rights",
    "mise",
    "Python and uv",
    "jq 1.",
    "./erga --version",
    "Cargo",
    "cargo build",
  );
  assert(!(out + p.stderr).includes("\u001b"), "no colour away from a terminal");
  const order = [
    "rustup",
    "Installing uv",
    "copy https://github.com/intellectual-frontiers/erga",
    "rust-toolchain.toml names",
    "run in the clone: bin/setup.sh",
    "./ergactl toolchain ensure",
    "./ergactl check --quick",
    "last: ./ergactl doctor",
  ]
    .map((s) => out.indexOf(s));
  assert(order.every((i) => i >= 0), JSON.stringify(order));
  assertEquals(order, [...order].sort((a, b) => a - b), out);
  const off = (await fx.setup(["--dry-run"], { BOOTSTRAP_NO_RUNTIME: "1" })).stdout;
  lacks(off, "rust-toolchain.toml names", "Installing uv");
});

Deno.test("--dry-run records the workspace's role before the toolchain, and only where it is given (FR-089)", async () => {
  await using fx = await Fx.make();
  const out = (await fx.setup(["--dry-run"], { ERGA_ROLE: "operator" })).stdout;
  const role = out.indexOf("./ergactl repo workspace set --role operator");
  assert(out.indexOf("bin/setup.sh") < role && role < out.indexOf("./ergactl toolchain ensure"), out);
  lacks((await fx.setup(["--dry-run"])).stdout, "workspace set --role");
  const cfg = `${fx.home}/.config/erga`;
  Deno.mkdirSync(cfg, { recursive: true });
  Deno.writeTextFileSync(`${cfg}/setup.env`, "ERGA_ROLE=operator\n");
  has((await fx.setup(["--dry-run"])).stdout, "--role operator");
});

Deno.test("--dry-run follows the switches", async () => {
  await using fx = await Fx.make();
  const p = await fx.setup(["--dry-run"], OFF);
  assertEquals(p.code, 0, p.stderr);
  lacks(p.stdout, "intellectual-frontiers/erga", "ergactl doctor", "bin/setup.sh", "erga shell ensure");
});

Deno.test("with every installation off only the workspaces folder appears, and a second run changes nothing (FR-068, FR-095)", async () => {
  await using fx = await Fx.make();
  const p = await fx.setup([], OFF);
  assertEquals(p.code, 0, p.stdout + p.stderr);
  const made = await tree(fx.home);
  assert(made.includes("workspaces/github.com/intellectual-frontiers"), made.join("\n"));
  const files = made.filter((m) => Deno.statSync(`${fx.home}/${m}`).isFile && !m.startsWith(".erga-bootstrap/log/") && m !== ".config/erga/install.toml");
  assertEquals(files, [], "folders only: no file of the person's, but the log and the record of how it was set up");
  assert(made.some((m) => m.startsWith(".erga-bootstrap/log/bootstrap-")), "everything is logged to ~/.erga-bootstrap/log/");
  const again = await fx.setup([], OFF);
  assertEquals(again.code, 0);
  const noLogs = (xs: string[]) => xs.filter((m) => !m.startsWith(".erga-bootstrap/log/"));
  assertEquals(noLogs(await tree(fx.home)), noLogs(made));
  for (const name of [".profile", ".bashrc", ".zshrc", ".zshenv", ".gitconfig", ".config/fish", ".config/git"]) assert(!exists(`${fx.home}/${name}`), name);
});

Deno.test("the workspaces folder can be named, in the environment or in the settings file (FR-051)", async () => {
  await using fx = await Fx.make();
  assertEquals((await fx.setup([], { ...OFF, ERGA_WORKSPACES: `${fx.tmp}/elsewhere` })).code, 0);
  assert(exists(`${fx.tmp}/elsewhere/github.com/intellectual-frontiers`));
  assert(!exists(`${fx.home}/workspaces`));
  Deno.mkdirSync(`${fx.home}/.config/erga`, { recursive: true });
  Deno.writeTextFileSync(`${fx.home}/.config/erga/setup.env`, `ERGA_WORKSPACES="${fx.tmp}/named"\n`);
  assertEquals((await fx.setup([], OFF)).code, 0);
  assert(exists(`${fx.tmp}/named/github.com/intellectual-frontiers`));
  Deno.writeTextFileSync(`${fx.home}/.config/erga/setup.env`, "ERGA_WORKSPACES=~/tilde\n");
  assertEquals((await fx.setup([], OFF)).code, 0);
  assert(exists(`${fx.home}/tilde/github.com/intellectual-frontiers`));
});

Deno.test("the setup alone never runs sudo, a package manager or chsh (FR-001)", async () => {
  await using fx = await Fx.make();
  const log = `${fx.tmp}/calls`;
  for (const n of ["sudo", "apt-get", "apt", "dpkg", "pacman", "chsh", "useradd", "adduser", "runuser"]) fx.stub(n, `echo "${n} $*" >>"${log}"`);
  const p = await fx.setup([], { ...OFF, PATH: fx.path });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assert(!exists(log), exists(log) ? Deno.readTextFileSync(log) : "");
});

Deno.test("without git or curl the setup stops before changing anything, with the family's one command (FR-016)", async () => {
  await using fx = await Fx.make();
  for (const n of Deno.readDirSync("/usr/bin")) {
    if (n.name !== "git" && n.name !== "curl") Deno.symlinkSync(`/usr/bin/${n.name}`, `${fx.bin}/${n.name}`);
  }
  const deb = await fx.setup([], { ...OFF, PATH: fx.bin });
  assertEquals(deb.code, 3, deb.stdout + deb.stderr);
  has(deb.stderr, "no git", "sudo apt-get install -y git", "erga-bootstrap.sh");
  assert(!exists(`${fx.home}/workspaces`));
  const arch = await fx.setup([], { ...OFF, PATH: fx.bin, BOOTSTRAP_OS_RELEASE: fx.osr(ARCH) });
  assertEquals(arch.code, 3);
  has(arch.stderr, "sudo pacman -S --needed git");
  lacks(arch.stderr.replaceAll("erga-bootstrap", ""), "apt");
});

Deno.test("a program only some steps need is named with the command, and the setup goes on (FR-016, FR-027)", async () => {
  await using fx = await Fx.make();
  for (const n of Deno.readDirSync("/usr/bin")) if (!["xz", "unzip", "cc"].includes(n.name)) Deno.symlinkSync(`/usr/bin/${n.name}`, `${fx.bin}/${n.name}`);
  const p = await fx.setup([], { ...OFF, PATH: fx.bin });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  has(p.stdout + p.stderr, "sudo apt-get install -y", "xz-utils", "missing programs");
});

Deno.test("the bootstrap makes no account and runs the setup in the account that runs it (FR-001, FR-002)", async () => {
  await using fx = await Fx.make();
  const log = `${fx.tmp}/calls`;
  for (const n of ["adduser", "useradd", "runuser", "sysadminctl", "sudo"]) fx.stub(n, `echo "${n} $*" >>"${log}"`);
  const p = await fx.boot([], { ...OFF, PATH: fx.path, USER: "snshah" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assert(!exists(log) || !/adduser|useradd|runuser|sysadminctl|sudo -/.test(Deno.readTextFileSync(log)));
  has(p.stdout, "Setting up erga in this account");
  lacks(p.stdout, "sudo -iu", "deluser", "userdel", "the account erga");
});

Deno.test("the bootstrap's dry run holds the packages and the setup in one plan, and writes nothing (FR-008, FR-011)", async () => {
  await using fx = await Fx.make();
  fx.stub("apt-get");
  fx.stub("dpkg-query", "exit 1");
  const before = await tree(fx.home);
  const p = await fx.boot(["--dry-run"], { PATH: fx.path });
  assertEquals(p.code, 0, p.stderr);
  assertEquals(await tree(fx.home), before);
  has(p.stdout, "refresh the package list, then install with apt", "Setting up erga in this account", "bin/setup.sh", "ergactl doctor");
  if (Deno.uid() !== 0) has(p.stdout, "say why administrator rights are needed and ask for your password, once");
  lacks(p.stdout, "create the Linux account", "adduser", "useradd");
});

Deno.test("the two ways in run the same steps, so they cannot drift (FR-008)", async () => {
  await using fx = await Fx.make();
  fx.stub("apt-get");
  fx.stub("dpkg-query", "exit 1");
  const steps = (t: string) => t.split("\n").filter((l) => l.startsWith("  - ") || l.startsWith("  would "));
  const setup = steps((await fx.setup(["--dry-run"], { PATH: fx.path })).stdout);
  const boot = steps((await fx.boot(["--dry-run"], { PATH: fx.path })).stdout);
  assert(setup.length > 10);
  let i = 0;
  for (const s of setup) {
    const want = s.replace("install.toml (setup)", "install.toml (bootstrap)");
    while (i < boot.length && boot[i] !== want) i++;
    assert(i < boot.length, `the bootstrap's plan lacks, or reorders, a step of the setup's: ${want}`);
    i++;
  }
  for (const b of boot.filter((x) => !setup.includes(x))) assertMatch(b, /apt|package|administrator|install\.toml/, `a step only the bootstrap takes must be about packages: ${b}`);
});

// ---- the Arch family, and the packages through stand-ins (FR-014, FR-015, FR-021)

Deno.test("both ways in know the Arch family by ID or ID_LIKE, without a warning", async () => {
  await using fx = await Fx.make();
  fx.stub("pacman", "exit 1");
  for (const text of [ARCH, OMARCHY]) {
    for (const run of [fx.setup.bind(fx), fx.boot.bind(fx)]) {
      const p = await run(["--dry-run"], { BOOTSTRAP_OS_RELEASE: fx.osr(text), PATH: fx.path });
      assertEquals(p.code, 0, p.stdout + p.stderr);
      lacks(p.stdout + p.stderr, "The bootstrap is made for Debian");
    }
  }
  const arch = await fx.boot(["--dry-run"], { BOOTSTRAP_OS_RELEASE: fx.osr(ARCH), PATH: fx.path });
  has(arch.stdout, "(arch family)", "install with pacman (--needed, never refreshing the package list alone)", "git ca-certificates curl wget tar xz unzip gcc");
  lacks(arch.stdout, "useradd", "apt", "xz-utils", "github-cli", "jq", "ripgrep");
});

function packageStubs(fx: Fx, pacman: string): string {
  const log = `${fx.tmp}/calls.log`;
  Deno.writeTextFileSync(log, "");
  fx.stub("pacman", `echo "pacman $*" >>${log}\n${pacman}`);
  fx.stub("sudo", `case "$1" in -v) exit 0 ;; -n) exit 0 ;; esac\necho "sudo $*" >>${log}\nexec "$@"`);
  return log;
}
const ARCH_OFF = without(OFF, "BOOTSTRAP_NO_APT");

Deno.test("on Arch the bootstrap installs with --needed, never refreshes the list alone, and makes no account", async () => {
  await using fx = await Fx.make();
  const log = packageStubs(fx, 'case "$1" in -Qi) exit 1 ;; esac\nexit 0');
  const p = await fx.boot([], { ...ARCH_OFF, BOOTSTRAP_OS_RELEASE: fx.osr(ARCH), PATH: fx.path });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  const calls = Deno.readTextFileSync(log);
  has(calls, "pacman -S --needed --noconfirm git ca-certificates curl wget tar xz unzip gcc");
  lacks(calls, "pacman -Sy", "pacman -Syu", "pacman -y");
  lacks(calls + p.stdout, "useradd", "adduser", "userdel", "sudo -iu");
  has(p.stdout, Deno.uid() === 0 ? "Installing: git" : "I need administrator rights to install the common programs");
});

Deno.test("a package pacman cannot find stops with the full upgrade to run first", async () => {
  await using fx = await Fx.make();
  const log = packageStubs(fx, 'case "$1" in -Qi) exit 1 ;; -S) echo "error: target not found: unzip" >&2; exit 1 ;; esac\nexit 0');
  const p = await fx.boot([], { ...ARCH_OFF, BOOTSTRAP_OS_RELEASE: fx.osr(ARCH), PATH: fx.path });
  assertEquals(p.code, 3, p.stdout + p.stderr);
  has(p.stdout + p.stderr, "sudo pacman -Syu");
  lacks(p.stdout, "Setting up erga in this account");
  lacks(Deno.readTextFileSync(log), "pacman -Sy ");
});

Deno.test("on Debian apt refreshes, installs what the table names, and counts what it does (FR-021, FR-064)", async () => {
  await using fx = await Fx.make();
  const log = `${fx.tmp}/apt.log`;
  fx.stub("sudo", `case "$1" in -v | -n) exit 0 ;; esac\nexec "$@"`);
  fx.stub("dpkg-query", "exit 1");
  fx.stub("apt-cache", 'echo "x:"; echo "  Candidate: 1.0"');
  fx.stub("apt-get", `echo "apt-get $*" >>${log}`);
  const p = await fx.boot([], { ...without(OFF, "BOOTSTRAP_NO_APT"), PATH: fx.path });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  const calls = Deno.readTextFileSync(log);
  has(
    calls,
    "apt-get update -qq -o DPkg::Lock::Timeout=900",
    "apt-get install -y -qq -o DPkg::Lock::Timeout=900 -o Acquire::Retries=3 git ca-certificates curl wget tar xz-utils unzip build-essential",
  );
  lacks(calls, "nodejs", "rustc", "cargo", "postgresql", "jq", "gh ");
});

Deno.test("one package source that cannot be read does not stop the packages; only nothing to be found does (FR-021)", async () => {
  await using fx = await Fx.make();
  const log = `${fx.tmp}/pm.log`;
  Deno.writeTextFileSync(log, "");
  fx.stub("sudo", 'case "$1" in -v | -n) exit 0 ;; esac\nexec "$@"');
  fx.stub("dpkg-query", "exit 1");
  fx.stub(
    "apt-get",
    `case "$*" in
  *update*) echo "E: The repository 'http://security.ubuntu.com/ubuntu resolute-security Release' no longer has a Release file." >&2; exit 100 ;;
  *install*) echo "apt-get $*" >>${log} ;;
esac`,
  );
  fx.stub("apt-cache", 'echo "x:"; echo "  Candidate: 1.0"');
  const env = { ...without(OFF, "BOOTSTRAP_NO_APT"), PATH: fx.path, ERGA_RETRIES: "1" };
  const p = await fx.boot([], env);
  assertEquals(p.code, 0, p.stdout + p.stderr);
  has(p.stdout + p.stderr, "apt could not read every package source", "no longer has a Release file");
  assertMatch(Deno.readTextFileSync(log), /apt-get .*install/);
  fx.stub("apt-cache", 'echo "x:"; echo "  Candidate: (none)"');
  const q = await fx.boot([], env);
  assertEquals(q.code, 3, q.stdout + q.stderr);
  has(q.stdout + q.stderr, "none of the packages can be found");
});

Deno.test("with packages off the bootstrap names what it did not install, and stops only without git or curl (FR-020)", async () => {
  await using fx = await Fx.make();
  fx.stub("dpkg-query", "exit 1");
  fx.stub("apt-get");
  const p = await fx.boot([], { ...OFF, PATH: fx.path });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  has(p.stdout + p.stderr, "packages are off here", "packages not installed");
});

Deno.test("the bootstrap neither installs PostgreSQL nor adds its repository, and never touches a server (FR-090, FR-097)", () => {
  for (const f of Deno.readDirSync(new URL("../bin/setup", import.meta.url))) {
    const text = Deno.readTextFileSync(new URL(`../bin/setup/${f.name}`, import.meta.url));
    for (const gone of ["apt.postgresql.org", "PGDG", "pg_dropcluster", "pg_ctlcluster", "systemctl"]) assert(!text.includes(gone), `${f.name}: ${gone}`);
  }
});

// ---- the installation record and the checks before the long installs (FR-050, FR-069)

const record = (fx: Fx) => {
  try {
    return Deno.readTextFileSync(`${fx.home}/.config/erga/install.toml`);
  } catch {
    return "";
  }
};

Deno.test("the setup records how the account was set up, and a later run keeps the first method (FR-069)", async () => {
  await using fx = await Fx.make();
  assertEquals((await fx.setup([], OFF)).code, 0);
  const text = record(fx);
  has(text, 'method = "setup"', 'family = "debian"', 'arch = "', 'distro = "Debian GNU/Linux 13 (trixie)"', 'host = "');
  assertMatch(text, /installed = "\d{4}-\d\d-\d\d"/);
  assertEquals((Deno.statSync(`${fx.home}/.config/erga/install.toml`).mode ?? 0) & 0o777, 0o644);
  Deno.writeTextFileSync(
    `${fx.home}/.config/erga/install.toml`,
    text.replace('method = "setup"', 'method = "bootstrap"').replace(/installed = "[^"]*"/, 'installed = "2020-01-01"'),
  );
  await fx.setup([], OFF);
  has(record(fx), 'method = "bootstrap"', 'installed = "2020-01-01"');
});

Deno.test("the bootstrap records itself as the method, and a dry run names the record and writes none", async () => {
  await using fx = await Fx.make();
  const dry = await fx.setup(["--dry-run"]);
  has(dry.stdout, "install.toml (setup)", "can open the private erga repository");
  has((await fx.boot(["--dry-run"])).stdout, "install.toml (bootstrap)");
  assertEquals(record(fx), "");
  fx.stub("sudo");
  fx.stub("apt-get");
  assertEquals((await fx.boot([], { ...OFF, PATH: fx.path })).code, 0);
  has(record(fx), 'method = "bootstrap"');
});

Deno.test("an account that cannot open erga is told before anything is installed (FR-050)", async () => {
  await using fx = await Fx.make();
  fx.stub("git", 'echo "remote: Repository not found." >&2; echo "fatal: repository not found" >&2; exit 128');
  fx.stub("gh", 'case "$1" in auth) exit 0 ;; api) echo someone ;; esac');
  const p = await fx.setup([], { BOOTSTRAP_NO_DOWNLOAD: "1", GH_TOKEN: "ghp_example", PATH: fx.path });
  assertEquals(p.code, 5, p.stdout + p.stderr);
  has(p.stdout, "does not let this account open erga", "Nothing has been installed", "(someone)");
  assertEquals(record(fx), "", "stopped before the record");
});

Deno.test("a git with no sign-in to give, or a network failure, is not an account without access (FR-050)", async () => {
  await using fx = await Fx.make();
  const log = `${fx.tmp}/git-args`;
  fx.stub("git", `echo "$*" >>"${log}"; echo "fatal: could not read Username for https://github.com: terminal prompts disabled" >&2; exit 128`);
  fx.stub("gh", 'case "$1" in auth) exit 0 ;; api) echo someone ;; esac');
  const p = await fx.setup([], { BOOTSTRAP_NO_DOWNLOAD: "1", BOOTSTRAP_NO_ERGA: "1", GH_TOKEN: "ghp_example", PATH: fx.path, ERGA_RETRIES: "1" });
  lacks(p.stdout, "does not let this account open erga");
  has(Deno.readTextFileSync(log), "credential.helper=!gh auth git-credential");
  fx.stub("git", 'echo "fatal: unable to access: Could not resolve host" >&2; exit 128');
  const q = await fx.setup([], { ...without(OFF, "BOOTSTRAP_NO_AUTH"), GH_TOKEN: "ghp_example", PATH: fx.path });
  lacks(q.stdout, "does not let this account open erga");
});

Deno.test("too little room, or root, is warned of first (FR-050)", async () => {
  await using fx = await Fx.make();
  fx.stub("df", 'echo "Filesystem 1K-blocks Used Available Use% Mounted"; echo "x 100 90 2097152 5% /"');
  const p = await fx.setup([], { ...OFF, PATH: fx.path });
  has(p.stdout + p.stderr, "Only 2 GB are free");
  if (Deno.uid() === 0) has(p.stdout + p.stderr, "This runs as root");
});

Deno.test("an environment variable name is bright yellow where there is colour, and other words are not (FR-063)", async () => {
  const { envColour, paletteOf } = await import("../bin/setup/ui.ts");
  const out = envColour("set BOOTSTRAP_PROMPT=plain, not FR-001 or git", paletteOf(true));
  assertStringIncludes(out, "\u001b[1;93mBOOTSTRAP_PROMPT\u001b[0m");
  assert(!out.includes("\u001b[1;93mFR"));
  assertEquals(envColour("BOOTSTRAP_PROMPT", paletteOf(false)), "BOOTSTRAP_PROMPT");
});

Deno.test("the telemetry line at the start says whether it is on, and a person who said no is told only that (FR-053)", async () => {
  await using fx = await Fx.make();
  const say = async (e: Record<string, string>) => (await fx.setup(["--dry-run"], e)).stdout;
  has(await say({ ERGA_SIGNALS_TOKEN: "arca_test", ERGA_SIGNALS_URL: "http://127.0.0.1:9" }), "Telemetry is on");
  has(await say({ ERGA_SIGNALS_TOKEN: "arca_test" }), "Telemetry is off: ERGA_SIGNALS_URL is not set");
  has(await say({ INFRO_ERGA_SIGNAL_INGEST_PRODUCTION_TOKEN: "arca_test", ERGA_SIGNALS_URL: "http://127.0.0.1:9" }), "Telemetry is on");
  const off = await say({});
  has(off, "Telemetry is off (optional)", "export ERGA_SIGNALS_URL=", "ERGA_SIGNALS_TOKEN=");
  const refusals: Record<string, string>[] = [{ DO_NOT_TRACK: "1" }, { ERGA_OBSERVE: "off" }, {
    DO_NOT_TRACK: "1",
    ERGA_SIGNALS_TOKEN: "arca_test",
    ERGA_SIGNALS_URL: "http://127.0.0.1:9",
  }];
  for (const no of refusals) {
    const out = await say(no);
    has(out, `Telemetry is off: ${"DO_NOT_TRACK" in no ? "DO_NOT_TRACK=1" : "ERGA_OBSERVE=off"}`);
    lacks(out, "ERGA_SIGNALS_TOKEN=", "Telemetry is on");
  }
});
