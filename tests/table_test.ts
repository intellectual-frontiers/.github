// The setup reads commons' packaging table and keeps no second copy of a fact it holds (commons 0001-software-supply-chain FR-003; erga 009-machine-bootstrap
// FR-014 to FR-016, FR-069); its options are parsed once, at the boundary; and the code is the strongly typed TypeScript the repository asks for.
import { assert, assertEquals, assertNotMatch, assertStringIncludes } from "@std/assert";
import { acting, adminInstall, adminInstallPrograms, families, familyOf, familyOfUname } from "../bin/setup/table.ts";
import { wantedPackages } from "../bin/setup/packages.ts";
import { earlier, recordText } from "../bin/setup/record.ts";
import { parseOptions, settingOf, toolchainChoice } from "../bin/setup/options.ts";
import { secretOf } from "../bin/setup/github.ts";
import { ROOT, sh } from "./helpers.ts";
import type { AbsPath } from "../bin/setup/result.ts";

const SETUP_DIR = `${ROOT}/bin/setup`;
const sources = () => [...Deno.readDirSync(SETUP_DIR)].filter((f) => f.name.endsWith(".ts")).map((f) => ({ name: f.name, text: Deno.readTextFileSync(`${SETUP_DIR}/${f.name}`) }));
const code = (text: string) => text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

Deno.test("the family is the table's: Omarchy is Arch by ID_LIKE, Ubuntu is Debian, a Mac is named by uname", () => {
  assertEquals(familyOf(["omarchy", "arch"]), "arch");
  assertEquals(familyOf(["ubuntu", "debian"]), "debian");
  assertEquals(familyOf(["fedora"]), "redhat");
  assertEquals(familyOf(["nothing-known"]), null);
  assertEquals(familyOfUname("Darwin"), "macos");
  assertEquals(acting("redhat"), null);
  assertEquals(acting("debian"), "debian");
});

Deno.test("what the bootstrap installs is what it installed before the table, but for the C compiler and linker (FR-015, FR-021)", () => {
  assertEquals(wantedPackages("debian").join(" "), "git ca-certificates curl wget tar xz-utils unzip build-essential");
  assertEquals(wantedPackages("arch").join(" "), "git ca-certificates curl wget tar xz unzip gcc");
  for (const pkg of ["nodejs", "npm", "chromium", "rustc", "cargo", "rustup", "jq", "github-cli", "gh"]) {
    assert(!wantedPackages("debian").includes(pkg) && !wantedPackages("arch").includes(pkg), pkg);
  }
});

Deno.test("the command for a person with administrator rights is the family's own (FR-016)", () => {
  assertEquals(adminInstallPrograms("debian", ["git", "xz", "unzip"]), "sudo apt-get install -y git xz-utils unzip");
  assertEquals(adminInstallPrograms("arch", ["git", "xz", "unzip"]), "sudo pacman -S --needed git xz unzip");
  assertEquals(adminInstall("debian", ["a", "b"]), "sudo apt-get install -y a b");
});

Deno.test("no file of the setup keeps a package name, a command or a detecting ID the table holds", () => {
  const ids: string[] = Object.values(families).flatMap((f) => [...f.detect]);
  for (const { name, text } of sources()) {
    const c = code(text);
    for (
      const needle of [
        "xz-utils",
        "github-cli",
        "apt-get install -y",
        "pacman -S --needed --noconfirm",
        "dpkg-query",
        "apt-cache policy",
        "pacman -Qi",
        "pacman -Si",
        "DEBIAN_FRONTEND",
        "libmagickcore",
        "build-essential",
      ]
    ) {
      assert(!c.includes(needle), `${name} keeps ${needle}, which the table holds`);
    }
    for (const id of ids) assert(!c.includes(`"${id}"`) || ["arch", "debian", "macos"].includes(id), `${name} detects ${id} on its own`);
  }
});

Deno.test("the record has commons' fields in commons' order, with the methods and hosts it allows (FR-069; commons 0002-packaging FR-016)", () => {
  const toml = Deno.readTextFileSync(`${ROOT}/commons/generated/install-record.auto.toml`);
  const names = [...toml.matchAll(/^name = "(\w+)"$/gm)].map((m) => m[1]);
  const text = recordText({ method: "setup", family: "debian", host: "wsl", distro: 'A "quoted" \\ name', arch: "x86_64", installed: "2026-01-01", refreshed: "2026-01-02" });
  assertEquals([...text.matchAll(/^(\w+) = "/gm)].map((m) => m[1]), names);
  assertStringIncludes(text, 'distro = "A quoted  name"');
  assertEquals(earlier(text), { method: "setup", installed: "2026-01-01" });
  assertEquals(earlier('method = "manual"\n'), { method: null, installed: null });
  const allowed = (field: string) => (toml.split(`name = "${field}"`)[1] ?? "").match(/values = \[([^\]]*)\]/)?.[1]?.match(/"(\w+)"/g)?.map((x) => x.slice(1, -1)) ?? [];
  assertEquals(allowed("method").sort(), ["bootstrap", "setup"]);
  const platform = Deno.readTextFileSync(`${SETUP_DIR}/platform.ts`);
  for (const h of allowed("host")) assertStringIncludes(platform, `"${h}"`);
});

Deno.test("the options are parsed once: switches, the settings file, the toolchain and the retries", () => {
  const home = "/home/x" as AbsPath;
  const o = parseOptions(
    ["--dry-run", "--patient", "--setup"],
    { BOOTSTRAP_NO_APT: "1", BOOTSTRAP_NO_RUNTIME: "1", BOOTSTRAP_JOBS: "3" },
    home,
    'ERGA_ROLE="operator"\nBOOTSTRAP_TOOLCHAIN=node jre\n',
    () => undefined,
    8,
  );
  assert(o.ok);
  const v = o.value;
  assertEquals([v.mode, v.dryRun, v.patient, v.jobs, v.role], ["setup", true, true, 3, "operator"]);
  assertEquals([v.switches.packages, v.switches.runtime, v.switches.download, v.switches.auth], [false, false, true, true]);
  assertEquals(v.toolchain, { kind: "names", names: ["node", "jre"] });
  assertEquals(v.retry, { tries: 15, base: 5, cap: 120 });
  assertEquals(v.paths.target, "/home/x/workspaces/github.com/intellectual-frontiers/erga");
  const d = parseOptions([], { XDG_DATA_HOME: "relative/not/used", XDG_CONFIG_HOME: "/cfg" }, home, "", () => undefined, 1);
  assert(d.ok);
  assertEquals([d.value.paths.data, d.value.paths.secretsFile, d.value.jobs, d.value.mode], ["/home/x/.local/share/erga-setup", "/cfg/erga/secrets.env", 2, "bootstrap"]);
  const bad = parseOptions(["--user"], {}, home, "", () => undefined, 1);
  assert(!bad.ok && bad.error.includes("unknown option --user"));
  assertEquals(toolchainChoice("none"), { kind: "none" });
  assertEquals(toolchainChoice(" "), { kind: "missing" });
  assertEquals(settingOf("A=1\nA='2'\n", "A"), "2");
  assertEquals(secretOf("ERGA_SIGNALS_TOKEN='a'\nERGA_SIGNALS_TOKEN='b'\n", "ERGA_SIGNALS_TOKEN"), "b");
  const e = parseOptions([], { ERGA_WORKSPACES: "/env" }, home, "ERGA_WORKSPACES=/file\n", () => undefined, 1);
  assert(e.ok && e.value.paths.workspaces === "/env", "the environment, then the settings file");
});

Deno.test("the setup is strongly typed: no any, no non-null escape, an exhaustive switch over each union, and no third-party module", () => {
  for (const { name, text } of sources()) {
    const c = code(text);
    assertNotMatch(c, /:\s*any\b|as any\b|<any>/, `${name} uses any`);
    assertNotMatch(c, /[\w)\]]!\.|[\w)\]]!\)|[\w)\]]!;|[\w)\]]!,/, `${name} has a non-null assertion`);
    for (const m of c.matchAll(/from "([^"]+)"/g)) {
      assert(m[1]?.startsWith("./") || m[1]?.startsWith("../../commons/generated/"), `${name} imports ${m[1]}: the setup has no dependency`);
    }
  }
  assertStringIncludes(Deno.readTextFileSync(`${SETUP_DIR}/result.ts`), "export function assertNever(x: never): never");
});

Deno.test("deno check and deno lint pass on the setup and its tests", async () => {
  const check = await sh([Deno.execPath(), "check", "--quiet", `${SETUP_DIR}/main.ts`], {
    PATH: "/usr/bin:/bin",
    HOME: Deno.env.get("HOME") ?? "/tmp",
    DENO_DIR: Deno.env.get("DENO_DIR") ?? `${Deno.env.get("HOME")}/.cache/deno`,
  }, { cwd: ROOT });
  assertEquals(check.code, 0, check.stderr);
  const lint = await sh([Deno.execPath(), "lint", "--quiet"], { PATH: "/usr/bin:/bin", HOME: Deno.env.get("HOME") ?? "/tmp" }, { cwd: ROOT });
  assertEquals(lint.code, 0, lint.stdout + lint.stderr);
});

Deno.test("the public README carries no setup instructions, which live in erga's (FR-088), and the repository stays small", async () => {
  const readme = Deno.readTextFileSync(`${ROOT}/README.md`);
  assert(!readme.includes("## Set up a new computer"));
  for (const old of ["bootstrap-archon", "archon-bootstrap.sh", "archon-setup.sh"]) assert(!readme.includes(old));
  const tracked = await sh(["git", "ls-files"], { PATH: "/usr/bin:/bin", HOME: ROOT }, { cwd: ROOT });
  if (tracked.code !== 0) return; // not a git checkout
  const top = new Set(tracked.stdout.split("\n").filter((l) => l !== "").map((l) => l.split("/")[0]));
  const allowed = new Set([".github", "bin", "commons", "profile", "tests", "README.md", "AGENTS.md", "CLAUDE.md", ".gitignore", "deno.json", "deno.lock"]);
  for (const t of top) assert(allowed.has(t ?? ""), `a new top-level entry: ${t}`);
});
