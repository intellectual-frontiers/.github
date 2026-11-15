// A Mac with Apple silicon (009-machine-bootstrap FR-017 to FR-019), faked with stand-ins for uname, sw_vers, sysctl and xcode-select; no CI runs on a Mac, so
// what only a Mac shows (Gatekeeper, the Command Line Tools window) is tried by hand.
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { exists, Fx, OFF, tree, without } from "./helpers.ts";

const MAC_OFF = without(OFF, "BOOTSTRAP_NO_APT");

function mac(fx: Fx, o: { machine?: string; version?: string; arm?: string; clt?: boolean } = {}): void {
  fx.stub("uname", `case "$1" in -s) echo Darwin ;; -m) echo ${o.machine ?? "arm64"} ;; -r) echo 24.1.0 ;; *) echo Darwin ;; esac`);
  fx.stub("sw_vers", `case "$1" in -productVersion) echo ${o.version ?? "15.1"} ;; *) echo "ProductName: macOS" ;; esac`);
  fx.stub("sysctl", `case "$2" in hw.optional.arm64) echo ${o.arm ?? "1"} ;; hw.memsize) echo 17179869184 ;; kern.hv_vmm_present) echo 0 ;; *) exit 1 ;; esac`);
  fx.stub("xcode-select", o.clt === false ? "exit 2" : "exit 0");
}

Deno.test("an Apple silicon Mac is a family of its own, and the dry run names what differs (FR-017, FR-019)", async () => {
  await using fx = await Fx.make();
  mac(fx);
  const before = await tree(fx.home);
  const p = await fx.setup(["--dry-run"], { PATH: fx.path });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assertEquals(await tree(fx.home), before);
  for (const t of ["macOS 15.1, aarch64", "xcode-select --install", "gh 2."]) assertStringIncludes(p.stdout, t);
  assert(!(p.stdout + p.stderr).includes("sudo apt"));
});

Deno.test("an Intel Mac, an old macOS and missing Command Line Tools each stop with the fix (FR-017)", async () => {
  await using fx = await Fx.make();
  mac(fx, { machine: "x86_64", arm: "0" });
  const intel = await fx.setup(["--dry-run"], { PATH: fx.path });
  assertEquals(intel.code, 3);
  assertStringIncludes(intel.stderr, "Intel");
  assertStringIncludes(intel.stderr, "Linux virtual machine");
  mac(fx, { version: "12.7" });
  const old = await fx.setup(["--dry-run"], { PATH: fx.path });
  assertEquals(old.code, 3);
  assertStringIncludes(old.stderr, "macOS 13");
  mac(fx, { clt: false });
  const none = await fx.setup([], { ...MAC_OFF, PATH: fx.path });
  assertEquals(none.code, 3, none.stdout + none.stderr);
  assertStringIncludes(none.stderr, "xcode-select --install");
  assert(!exists(`${fx.home}/.local/share/erga-setup/tools`), "nothing was fetched");
});

Deno.test("a terminal under Rosetta is still Apple silicon", async () => {
  await using fx = await Fx.make();
  mac(fx, { machine: "x86_64", arm: "1" });
  const p = await fx.setup(["--dry-run"], { PATH: fx.path });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assertStringIncludes(p.stdout, "aarch64");
});

Deno.test("with the tools here the setup runs on a Mac and ends with the line for zsh (FR-017, FR-059)", async () => {
  await using fx = await Fx.make();
  mac(fx);
  fx.stub("gh");
  const p = await fx.setup([], { ...MAC_OFF, PATH: fx.path, SHELL: "/bin/zsh" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  for (const t of ["macOS 15.1", "ergactl agent-tools shell emit zsh", "~/.zshrc"]) assertStringIncludes(p.stdout, t);
  assert(!p.stdout.includes("exec "));
  const bash = await fx.setup([], { ...MAC_OFF, PATH: fx.path, SHELL: "/bin/bash" });
  assertStringIncludes(bash.stdout, "ergactl agent-tools shell emit bash");
  const other = await fx.setup([], { ...MAC_OFF, PATH: fx.path, SHELL: "/bin/tcsh" });
  assertStringIncludes(other.stdout, "ergactl agent-tools shell emit zsh", "a Mac starts zsh");
});

Deno.test("on a Mac the bootstrap installs nothing, makes no account and runs the setup in this one (FR-018)", async () => {
  await using fx = await Fx.make();
  mac(fx);
  const dry = await fx.boot(["--dry-run"], { PATH: fx.path });
  assertEquals(dry.code, 0, dry.stdout + dry.stderr);
  for (const t of ["xcode-select --install", "install no package", "Setting up erga in this account"]) assertStringIncludes(dry.stdout, t);
  for (const t of ["apt", "pacman", "chsh", "sysadminctl", "createhomedir", "account erga"]) assert(!dry.stdout.includes(t), t);
  fx.stub("gh");
  const run = await fx.boot([], { ...MAC_OFF, PATH: fx.path, SHELL: "/bin/zsh" });
  assertEquals(run.code, 0, run.stdout + run.stderr);
  assertStringIncludes(run.stdout, "ergactl agent-tools shell emit zsh");
  assert(!run.stdout.includes("login shell"));
});
