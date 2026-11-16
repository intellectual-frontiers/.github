// The one-command installers of agora (erga's 274-agora FR-096): you install Git and GitHub CLI and run one command. The script says what is missing with the one
// line that installs it, signs GitHub CLI in only where it is not, copies erga (or brings the copy up to date) and hands over to the installer inside it. Stand-ins
// for `git` and `gh` write down what they were asked.
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { ROOT } from "./helpers.ts";

const SH = `${ROOT}/bin/agora-install.sh`;
const SYSTEM = "/usr/bin:/bin";

type Ran = { code: number; out: string; err: string };

async function run(env: Record<string, string>): Promise<Ran> {
  const r = await new Deno.Command("sh", { args: [SH], env, clearEnv: true, stdout: "piped", stderr: "piped" }).output();
  const text = new TextDecoder();
  return { code: r.code, out: text.decode(r.stdout), err: text.decode(r.stderr) };
}

/** A folder of stand-ins: `gh` records its arguments, says it is signed in unless SIGNED_OUT is set, and `gh repo clone` makes the copy with an installer that records it ran. */
function standIns(root: string, tools: readonly string[]): string {
  const bin = `${root}/bin`;
  Deno.mkdirSync(bin, { recursive: true });
  const script = (name: string, body: string) => {
    Deno.writeTextFileSync(`${bin}/${name}`, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  };
  if (tools.includes("git")) script("git", `echo "git $*" >> "$RECORD"`);
  if (tools.includes("gh")) {
    script(
      "gh",
      `echo "gh $*" >> "$RECORD"
case "$1 $2" in
  "auth status") [ -z "\${SIGNED_OUT:-}" ] && exit 0 || exit 1 ;;
  "repo clone") mkdir -p "$4/bin"; printf '#!/bin/sh\\necho installer ran >> "$RECORD"\\n' > "$4/bin/install.sh" ;;
esac
exit 0`,
    );
  }
  return bin;
}

function fixture(tools: readonly string[]) {
  const root = Deno.makeTempDirSync({ prefix: "agora-install-" });
  const bin = standIns(root, tools);
  const dest = `${root}/copy/erga`;
  const record = `${root}/record`;
  // The system's own programs the script uses, and none of the system's git or gh: only the stand-ins stand for those.
  const sys = `${root}/sys`;
  Deno.mkdirSync(sys, { recursive: true });
  for (const name of ["sh", "uname", "dirname", "mkdir", "cat"]) {
    for (const dir of SYSTEM.split(":")) {
      try {
        Deno.symlinkSync(`${dir}/${name}`, `${sys}/${name}`);
        break;
      } catch {
        // Not in this folder.
      }
    }
  }
  const env = { PATH: `${bin}:${sys}`, HOME: `${root}/home`, ERGA_DIR: dest, RECORD: record, LANG: "C" };
  return { root, dest, record, env, lines: () => (Deno.statSync(record).isFile ? Deno.readTextFileSync(record).split("\n").filter((l) => l !== "") : []) };
}

Deno.test("agora-install.sh without Git, or without GitHub CLI, says what is missing and the one line that installs both (exit 3)", async () => {
  for (const [tools, missing] of [[[], "Git is not installed"], [["git"], "GitHub CLI is not installed"]] as const) {
    const fx = fixture(tools);
    try {
      const r = await run(fx.env);
      assertEquals(r.code, 3);
      assertStringIncludes(r.err, missing);
      assertStringIncludes(r.err, "install Git and GitHub CLI, then run this again:");
      assert(/apt-get install -y git gh|pacman -S --needed git github-cli|dnf install -y git gh|brew install git gh/.test(r.err), r.err);
    } finally {
      Deno.removeSync(fx.root, { recursive: true });
    }
  }
});

Deno.test("agora-install.sh signed in copies erga with GitHub CLI and runs the installer in the copy, and signs in only where it is not", async () => {
  const fx = fixture(["git", "gh"]);
  try {
    const r = await run(fx.env);
    assertEquals(r.code, 0);
    assertEquals(fx.lines(), ["gh auth status", "gh auth setup-git", `gh repo clone intellectual-frontiers/erga ${fx.dest}`, "installer ran"]);
    const out = await run({ ...fx.env, SIGNED_OUT: "1" });
    assertEquals(out.code, 0);
    assert(fx.lines().some((l) => l.startsWith("gh auth login --hostname github.com --git-protocol https --web")));
  } finally {
    Deno.removeSync(fx.root, { recursive: true });
  }
});

Deno.test("agora-install.sh run again brings the copy up to date with a fast-forward alone, and runs the installer again", async () => {
  const fx = fixture(["git", "gh"]);
  try {
    Deno.mkdirSync(`${fx.dest}/.git`, { recursive: true });
    Deno.mkdirSync(`${fx.dest}/bin`, { recursive: true });
    Deno.writeTextFileSync(`${fx.dest}/bin/install.sh`, '#!/bin/sh\necho installer ran >> "$RECORD"\n');
    const r = await run(fx.env);
    assertEquals(r.code, 0);
    assertEquals(fx.lines(), ["gh auth status", "gh auth setup-git", `git -C ${fx.dest} pull --ff-only`, "installer ran"]);
  } finally {
    Deno.removeSync(fx.root, { recursive: true });
  }
});

Deno.test("agora-install.ps1 asks for the same, in the same order, and hands over to the installer in the copy", () => {
  const ps = Deno.readTextFileSync(`${ROOT}/bin/agora-install.ps1`);
  const order = [
    "Get-Command git",
    "Get-Command gh",
    "gh auth status",
    "gh auth login --hostname github.com --git-protocol https --web",
    "gh auth setup-git",
    "gh repo clone intellectual-frontiers/erga",
    "bin\\install.ps1",
  ];
  let at = -1;
  for (const needle of order) {
    const i = ps.indexOf(needle, at + 1);
    assert(i > at, `${needle} comes in order`);
    at = i;
  }
  assertStringIncludes(ps, "winget install --id Git.Git -e; winget install --id GitHub.cli -e");
});
