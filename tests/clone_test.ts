// The clone, its fast-forward-only update and erga's commands (FR-051, FR-055 to FR-058, FR-089), against a local repository whose stand-in launcher and
// bin/setup.sh answer as erga's do; the GitHub sign-in and the settings kept for new terminals (FR-044 to FR-048, FR-052).
import { assert, assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { Captured, context, exists, Fx, git, OFF, without, withPath } from "./helpers.ts";
import { linkLauncher, parseList, toolchainNamesOf } from "../bin/setup/erga.ts";
import { keepSettings, secretOf, signIn, withSecret } from "../bin/setup/github.ts";

const has = (s: string, ...needles: string[]) => needles.forEach((n) => assertStringIncludes(s, n));
const lacks = (s: string, ...needles: string[]) => needles.forEach((n) => assert(!s.includes(n), `unexpected ${JSON.stringify(n)} in:\n${s}`));

// A stand-in for erga's ./ergactl: `toolchain list` prints its table, or (FAKE_JSON) its JSON; `repository check --help` names --quick unless FAKE_NO_QUICK.
const LAUNCHER = `#!/bin/sh
case "$*" in "toolchain list"* | "repository check --help") ;; *) echo "ERGA $* assume_yes=\${ERGA_ASSUME_YES:-} no_admin=\${ERGA_NO_ADMIN:-} env=\${ERGA_ENVIRONMENT:-}" >>"\${CALLS:?}" ;; esac
[ -f "$(dirname "$0")/.setup-done" ] || { echo "Deno 2.9.8 is not here: run bin/setup.sh, then ./ergactl again." >&2; exit 3; }
case "$*" in
  "toolchain list"*)
    if [ -n "\${FAKE_JSON:-}" ]; then
      a='[]'; b='[]'; acts='[]'
      [ -n "\${FAKE_LIBS:-}" ] && a='["libnss3","libgbm1"]' && b='["libnss3"]' && acts='[{"title":"Install the system packages","command":"sudo apt-get install -y libnss3 libgbm1"}]'
      echo '{"schema":"erga/toolchain-list@1","data":[{"name":"node","phase":"Dev","found":{"version":"22"},"system_packages":[]},{"name":"python","phase":"Dev","found":null,"system_packages":'"$a"'},{"name":"docker","phase":"Dev","found":null,"optional":true},{"name":"jre","phase":"Dev","found":null,"system_packages":'"$b"'}],"actions":'"$acts"'}'
    else
      echo "deno         2.9.8          downloaded at its pin  Deno, which runs ergactl and every domain agent"
      echo "git          >= 2.39        found on the computer  Git, which keeps the history of every clone"
      echo "node         22.23.3        downloaded at its pin  Node.js, which builds and tests the TypeScript services"
      echo "podman       >= 4.0         found on the computer  podman, which builds and runs the images of the container services"
      echo "tex-newunicodechar 77677          downloaded at its pin  the TeX Live 2025 package newunicodechar"
      echo "paragon      23.23.0        no build here  Paragon's CLI"
    fi ;;
  "repository check --help") [ -n "\${FAKE_NO_QUICK:-}" ] || echo "  --quick                      Leave out the sections that compile or run every test." ;;
  "doctor") echo "DOCTOR SAYS: Next: ergactl toolchain ensure jq" ;;
esac
[ "$1 $2" = "check --quick" ] && [ -n "\${FAKE_FAIL:-}" ] && exit 4
exit 0
`;
// A stand-in for erga's bin/setup.sh: the clone made ready for ./ergactl (a marker), or a failure as one that could not fetch Deno has (FAKE_NO_SETUP).
const SETUP = `#!/bin/sh
echo "SETUP $* assume_yes=\${ERGA_ASSUME_YES:-} no_admin=\${ERGA_NO_ADMIN:-} env=\${ERGA_ENVIRONMENT:-}" >>"\${CALLS:?}"
[ -n "\${FAKE_NO_SETUP:-}" ] && { echo "Deno 2.9.8 could not be downloaded" >&2; exit 3; }
: >"$(dirname "$0")/../.setup-done"
`;

class Clone {
  readonly upstream: string;
  readonly clone: string;
  readonly calls: string;
  constructor(readonly fx: Fx) {
    this.upstream = `${fx.tmp}/upstream`;
    this.clone = `${fx.home}/workspaces/github.com/intellectual-frontiers/erga`;
    this.calls = `${fx.tmp}/erga-calls.txt`;
  }
  static async make(fx: Fx): Promise<Clone> {
    const c = new Clone(fx);
    Deno.mkdirSync(`${c.upstream}/bin`, { recursive: true });
    await git(c.upstream, "init", "-q", "-b", "main");
    Deno.writeTextFileSync(`${c.upstream}/ergactl`, LAUNCHER, { mode: 0o755 });
    Deno.writeTextFileSync(`${c.upstream}/bin/setup.sh`, SETUP, { mode: 0o755 });
    Deno.writeTextFileSync(`${c.upstream}/.gitignore`, ".setup-done\n");
    await git(c.upstream, "add", ".");
    await git(c.upstream, "commit", "-qm", "one");
    return c;
  }
  /** The setup, with the clone and erga's commands on and everything else off; a token stands for the GitHub sign-in. */
  go(extra: Record<string, string> = {}) {
    Deno.writeTextFileSync(this.calls, "");
    return this.fx.setup([], {
      ...without(OFF, "BOOTSTRAP_NO_CLONE", "BOOTSTRAP_NO_ERGA", "BOOTSTRAP_NO_DOTFILES"),
      ERGA_URL: this.upstream,
      CALLS: this.calls,
      PATH: this.fx.path,
      GH_TOKEN: "test-token",
      ...extra,
    });
  }
  get log(): string {
    return Deno.readTextFileSync(this.calls);
  }
  async push(name: string, text = "x\n"): Promise<void> {
    Deno.writeTextFileSync(`${this.upstream}/${name}`, text);
    await git(this.upstream, "add", name);
    await git(this.upstream, "commit", "-qm", name);
  }
}

Deno.test("it copies erga, runs its commands in the spec's order and says what is next (FR-055 to FR-058, FR-065)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const p = await c.go();
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assert(exists(`${c.clone}/ergactl`));
  const calls = c.log;
  const order = ["SETUP ", "ERGA toolchain ensure deno node tex-newunicodechar", "ERGA check --quick", "ERGA doctor"].map((x) => calls.indexOf(x));
  assert(order.every((i) => i >= 0), calls);
  assertEquals(order, [...order].sort((a, b) => a - b));
  const ensured = calls.split("ERGA toolchain ensure")[1]?.split("\n")[0] ?? "";
  lacks(ensured, " git", " podman", " paragon");
  for (const word of ["assume_yes=1", "no_admin=1", "env=bootstrap"]) assertEquals(calls.split(word).length - 1, 4, word);
  lacks(calls + p.stdout, "cargo");
  const out = p.stdout;
  has(out, "DOCTOR SAYS: Next: ergactl toolchain ensure jq", 'eval "$(ergactl agent-tools shell emit bash --json | jq -r .text)"', "ergactl help", "~/.bashrc");
  assert(out.indexOf("DOCTOR SAYS") < out.indexOf("ergactl agent-tools shell emit bash"));
  lacks(out, "exec bash -l", "orch");
  assert(!/(?<![\w-])\.\/erga\b(?!ctl)/.test(out), "no command of the retired Rust erga is named");
  const wrapper = `${fx.home}/.local/bin/ergactl`;
  has(Deno.readTextFileSync(wrapper), `${c.clone}/ergactl`);
  assert(((Deno.statSync(wrapper).mode ?? 0) & 0o111) !== 0);
  assert(!exists(`${fx.home}/.local/bin/arcactl`), "a copy of erga with no arcactl launcher has nothing to link");
});

Deno.test("a managed .bashrc that reads ~/.bashrc.local names that file for the one line", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  Deno.writeTextFileSync(`${fx.home}/.bashrc`, "[ -f ~/.bashrc.local ] && . ~/.bashrc.local\n");
  has((await c.go()).stdout, "add this line to ~/.bashrc.local");
  has((await c.go({ SHELL: "/usr/bin/fish" })).stdout, "ergactl agent-tools shell emit fish --json | jq -r .text | source", "~/.config/fish/conf.d/erga.fish");
  has((await c.go({ SHELL: "/bin/zsh" })).stdout, "~/.zshrc");
});

Deno.test("the wrappers of the retired Rust launchers go, and a file of the person's stays (FR-058)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const bin = `${fx.home}/.local/bin`;
  Deno.mkdirSync(bin, { recursive: true });
  Deno.writeTextFileSync(`${bin}/erga`, `#!/bin/sh\n# erga-setup wrapper: runs the clone's launcher, so erga works from any folder\nexec "${c.clone}/erga" "$@"\n`);
  Deno.writeTextFileSync(`${bin}/arca`, "#!/bin/sh\necho mine\n");
  assertEquals((await c.go()).code, 0);
  assert(!exists(`${bin}/erga`));
  assertEquals(Deno.readTextFileSync(`${bin}/arca`), "#!/bin/sh\necho mine\n");
});

Deno.test("arcactl is linked beside ergactl when the clone has its launcher (FR-058)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  await c.go();
  Deno.writeTextFileSync(`${c.clone}/arcactl`, "#!/bin/sh\necho arcactl ran\n", { mode: 0o755 });
  await c.go();
  has(Deno.readTextFileSync(`${fx.home}/.local/bin/arcactl`), `${c.clone}/arcactl`);
});

Deno.test("a launcher link of this clone is left without a word; another link or a file of the person's is named (FR-058)", async () => {
  await using fx = await Fx.make();
  const target = `${fx.tmp}/clone`;
  Deno.mkdirSync(target);
  Deno.writeTextFileSync(`${target}/ergactl`, "#!/bin/sh\n", { mode: 0o755 });
  const ctx = context(fx, { ERGA_WORKSPACES: `${fx.tmp}/ws` });
  const opts = { ...ctx.opts, paths: { ...ctx.opts.paths, target } };
  const c2 = { ...ctx, opts };
  const bin = `${fx.home}/.local/bin`;
  Deno.mkdirSync(bin, { recursive: true });
  const say = async () => {
    using cap = new Captured();
    await linkLauncher(c2, "ergactl");
    return cap.all;
  };
  Deno.symlinkSync(`${target}/ergactl`, `${bin}/ergactl`);
  assertEquals((await say()).trim(), "");
  Deno.removeSync(`${bin}/ergactl`);
  Deno.writeTextFileSync(`${fx.tmp}/elsewhere`, "x");
  Deno.symlinkSync(`${fx.tmp}/elsewhere`, `${bin}/ergactl`);
  has(await say(), "is a link to");
  Deno.removeSync(`${bin}/ergactl`);
  Deno.writeTextFileSync(`${bin}/ergactl`, "#!/bin/sh\necho mine\n");
  has(await say(), "is a file of yours");
  Deno.removeSync(`${bin}/ergactl`);
  await say();
  has(Deno.readTextFileSync(`${bin}/ergactl`), "erga-setup wrapper");
  Deno.removeSync(`${bin}/ergactl`);
  Deno.symlinkSync(`${fx.tmp}/gone`, `${bin}/ergactl`);
  await say();
  has(Deno.readTextFileSync(`${bin}/ergactl`), "erga-setup wrapper"); // a link to a clone that is gone is replaced
});

Deno.test("the toolchain can be named, all, or none (BOOTSTRAP_TOOLCHAIN)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  await c.go({ BOOTSTRAP_TOOLCHAIN: "node" });
  has(c.log, "ERGA toolchain ensure node assume_yes");
  await c.go({ BOOTSTRAP_TOOLCHAIN: "all" });
  has(c.log, "ERGA toolchain ensure deno git node podman tex-newunicodechar paragon assume_yes");
  await c.go({ BOOTSTRAP_TOOLCHAIN: "none" });
  lacks(c.log, "ERGA toolchain ensure");
});

Deno.test("the role is recorded before the toolchain (FR-089)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  await c.go({ ERGA_ROLE: "operator" });
  const i = c.log.indexOf("ERGA repo workspace set --role operator");
  assert(i > c.log.indexOf("SETUP") && i < c.log.indexOf("ERGA toolchain ensure"), c.log);
  has((await c.go()).stdout, "ERGA_ROLE=operator does it here");
});

Deno.test("every command runs when one fails, and the status says so (FR-055)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const p = await c.go({ FAKE_FAIL: "1" });
  assertEquals(p.code, 1);
  for (const n of ["doctor", "toolchain ensure", "check --quick"]) has(c.log, `ERGA ${n}`);
  assertMatch(p.stdout, /(x|❌).*\.\/ergactl check --quick \(exit status 4\)/);
});

Deno.test("an ergactl without the quick check is given none, and the summary says so (FR-057)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const p = await c.go({ FAKE_NO_QUICK: "1" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  lacks(c.log, "ERGA check");
  has(c.log, "ERGA doctor");
  has(p.stdout, "no quick check yet");
});

Deno.test("a clone bin/setup.sh cannot make ready runs nothing more, and says so (FR-055)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const p = await c.go({ FAKE_NO_SETUP: "1" });
  assertEquals(p.code, 1, p.stdout + p.stderr);
  lacks(c.log, "ERGA");
  has(p.stdout, "bin/setup.sh did not finish", "bin/setup.sh: the clone could not be made ready for ./ergactl (exit status 3)", "run bin/setup.sh to see why it stopped");
  lacks(p.stdout, "names above");
});

Deno.test("a clone without ./ergactl runs nothing (FR-055)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  await git(c.upstream, "mv", "ergactl", "erga");
  await git(c.upstream, "commit", "-qm", "rust");
  const p = await c.go();
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assertEquals(c.log, "");
  has(p.stdout, "./ergactl is not here yet");
});

Deno.test("an existing clone is updated by fast-forward alone, and one with work in it is left exactly as it was (FR-051)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  assertEquals((await c.go({ BOOTSTRAP_NO_ERGA: "1" })).code, 0);
  await c.push("two");
  assertEquals((await c.go({ BOOTSTRAP_NO_ERGA: "1" })).code, 0);
  assert(exists(`${c.clone}/two`), "fast-forwarded");
  await c.push("shared", "upstream 1\n");
  await c.go({ BOOTSTRAP_NO_ERGA: "1" });
  Deno.writeTextFileSync(`${c.clone}/shared`, "mine\n");
  await c.push("shared", "upstream 2\n");
  const p = await c.go({ BOOTSTRAP_NO_ERGA: "1" });
  assertEquals(p.code, 0);
  assertEquals(Deno.readTextFileSync(`${c.clone}/shared`), "mine\n");
  has(p.stdout, "your work is safe");
  await git(c.clone, "checkout", "-q", "--", "shared");
  Deno.writeTextFileSync(`${c.clone}/local`, "z\n");
  await git(c.clone, "add", "local");
  await git(c.clone, "commit", "-qm", "local");
  const head = await git(c.clone, "rev-parse", "HEAD");
  await c.push("three");
  const q = await c.go({ BOOTSTRAP_NO_ERGA: "1" });
  assertEquals(q.code, 0);
  assertEquals(await git(c.clone, "rev-parse", "HEAD"), head);
  has(q.stdout, "your work is safe");
});

Deno.test("a copy that cannot be made says why, and no half copy is left (FR-051)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const p = await c.go({ ERGA_URL: `${fx.tmp}/no-such-repository`, ERGA_RETRIES: "1" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  has(p.stdout, "erga was not copied");
  assert(!exists(c.clone) && !exists(`${c.clone}.partial`));
});

Deno.test("the setup alone names the one command for the system libraries erga says it lacks, and keeps no list of its own (FR-023)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const p = await c.go({ FAKE_JSON: "1", FAKE_LIBS: "1" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  has(p.stdout + p.stderr, "sudo apt-get install -y libnss3 libgbm1", "system libraries are missing: libnss3 libgbm1");
  has(c.log, "ERGA toolchain ensure python jre"); // the programs are still installed: what is not here and not optional
  const quiet = await c.go({ FAKE_JSON: "1" });
  lacks(quiet.stdout + quiet.stderr, "system libraries");
  const table = await c.go();
  lacks(table.stdout + table.stderr, "system libraries");
  for (const f of Deno.readDirSync(new URL("../bin/setup", import.meta.url))) lacks(Deno.readTextFileSync(new URL(`../bin/setup/${f.name}`, import.meta.url)), "libnss3");
});

Deno.test("the bootstrap installs those libraries with the rights it has, and only where packages are on (FR-023)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  const log = `${fx.tmp}/pm.log`;
  fx.stub("sudo", 'case "$1" in -v | -n) exit 0 ;; esac\nexec "$@"');
  fx.stub("dpkg-query", 'echo "install ok installed"');
  fx.stub("apt-get", `echo "apt-get $*" >>${log}`);
  const run = (extra: Record<string, string>) =>
    fx.boot([], {
      ...without(OFF, "BOOTSTRAP_NO_CLONE", "BOOTSTRAP_NO_ERGA", "BOOTSTRAP_NO_APT"),
      ERGA_URL: c.upstream,
      CALLS: c.calls,
      PATH: fx.path,
      GH_TOKEN: "t",
      FAKE_JSON: "1",
      FAKE_LIBS: "1",
      ...extra,
    });
  Deno.writeTextFileSync(c.calls, "");
  const p = await run({});
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assertMatch(Deno.readTextFileSync(log), /apt-get install -y -qq .*libnss3 libgbm1/);
  lacks(p.stdout, "system libraries are missing");
  Deno.writeTextFileSync(log, "");
  const off = await run({ BOOTSTRAP_NO_APT: "1" });
  assertEquals(Deno.readTextFileSync(log), "");
  has(off.stdout, "system libraries are missing");
});

Deno.test("the list of ergactl is read from its JSON or its table", () => {
  const json = '{"data":[{"name":"node","found":{"version":"22"}},{"name":"python","found":null,"system_packages":["a"]},{"name":"docker","found":null,"optional":true}],' +
    '"actions":[{"title":"Install the system packages","command":"sudo apt-get install -y a"}]}';
  assertEquals(toolchainNamesOf(json, "missing"), ["python"]);
  assertEquals(toolchainNamesOf(json, "all"), ["node", "python", "docker"]);
  assertEquals(parseList(json)?.systemPackages, ["a"]);
  assertEquals(parseList(json)?.systemCommand, "apt-get install -y a");
  assertEquals(parseList("not json"), null);
  assertEquals(toolchainNamesOf("node 1 downloaded at its pin  x\ngit >= 2 found on the computer  y\n", "missing"), ["node"]);
});

// ---- the GitHub sign-in (FR-044 to FR-048)

Deno.test("without a sign-in and without a terminal it stops before the clone, with the command (FR-044)", async () => {
  await using fx = await Fx.make();
  const c = await Clone.make(fx);
  fx.stub("gh", 'case "$1 $2" in "auth status") exit 1 ;; esac\nexit 0');
  const p = await fx.setup([], { ...without(OFF, "BOOTSTRAP_NO_CLONE", "BOOTSTRAP_NO_ERGA", "BOOTSTRAP_NO_AUTH"), ERGA_URL: c.upstream, PATH: fx.path });
  assertEquals(p.code, 5, p.stdout + p.stderr);
  has(p.stdout, "GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https", ".erga-bootstrap/log/");
  assert(!exists(c.clone));
});

Deno.test("a token in the environment means no sign-in is asked for, and a token GitHub refuses stops (FR-047)", async () => {
  await using fx = await Fx.make();
  fx.stub("gh", 'case "$1 $2" in "auth status") [ -n "$GH_TOKEN" ] && exit 0 || exit 1 ;; "auth login") echo LOGIN_CALLED; exit 9 ;; esac\nexit 0');
  const run = (more: Record<string, string>) => fx.setup([], { ...without(OFF, "BOOTSTRAP_NO_AUTH"), PATH: fx.path, ...more });
  const p = await run({ GH_TOKEN: "ghp_example" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  has(p.stdout, "GH_TOKEN");
  lacks(p.stdout + p.stderr, "LOGIN_CALLED", "ghp_example");
  fx.stub("gh", 'case "$1 $2" in "auth status") exit 1 ;; esac\nexit 0');
  const bad = await run({ GITHUB_TOKEN: "ghp_bad" });
  assertEquals(bad.code, 5, bad.stdout);
  has(bad.stdout, "did not accept the token in");
});

Deno.test("the sign-in shows the code gh printed and asks nothing (FR-045, FR-046)", async () => {
  await using fx = await Fx.make();
  const flag = `${fx.tmp}/signed`;
  fx.stub(
    "gh",
    `case "$1 $2" in\n"auth status") [ -f ${flag} ] ;;\n"auth login") [ -t 0 ] && echo TERMINAL_ASKED; [ "$GH_BROWSER" = true ] || echo NO_BROWSER_SET; echo "! First copy your one-time code: WXYZ-5678"; sleep 2; touch ${flag} ;;\nesac`,
  );
  const ctx = context(fx, { BOOTSTRAP_NO_AUTH: "" }, [], { hasTty: true });
  using cap = new Captured();
  const r = await withPath(fx.path, () => signIn(ctx));
  assert(r.ok, cap.all);
  has(cap.out, "type this code: WXYZ-5678", "https://github.com/login/device");
  lacks(cap.all, "TERMINAL_ASKED", "NO_BROWSER_SET", "ABCD-1234");
  assertEquals(ctx.st.signIn, "gh");
});

Deno.test("a sign-in gh could not start stops, shows what gh said, and does not wait for ever (FR-046)", async () => {
  await using fx = await Fx.make();
  fx.stub("gh", 'case "$1 $2" in\n"auth status") exit 1 ;;\n"auth login") echo "failed to authenticate via web browser: HTTP 415"; exit 1 ;;\nesac');
  const ctx = context(fx, {}, [], { hasTty: true });
  using cap = new Captured();
  const r = await withPath(fx.path, () => signIn(ctx));
  assert(!r.ok && r.error.kind === "sign-in");
  has(cap.out, "HTTP 415", "did not finish");
});

// ---- the settings kept for new terminals (FR-048, FR-052)

Deno.test("the ArcaSignals settings are kept privately, as `ergactl secrets` writes them, and no startup file is written (FR-052, FR-042)", async () => {
  await using fx = await Fx.make();
  const keep = (e: Record<string, string>) => fx.setup([], { ...OFF, ...e });
  const p = await keep({ ERGA_SIGNALS_TOKEN: "arca_abcdefghijklmnopqrstuvwxyz1234", ERGA_SIGNALS_URL: "https://arca.example", ERGA_PERSON: "ifcore:A B" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  const f = `${fx.home}/.config/erga/secrets.env`;
  assertEquals((Deno.statSync(f).mode ?? 0) & 0o777, 0o600);
  assertEquals((Deno.statSync(`${fx.home}/.config/erga`).mode ?? 0) & 0o777, 0o700);
  const text = Deno.readTextFileSync(f);
  assert(text.startsWith("# Kept by `ergactl secrets`; change it with `ergactl secrets set` and `ergactl secrets remove`.\n"));
  has(text, "ERGA_SIGNALS_TOKEN='arca_abcdefghijklmnopqrstuvwxyz1234'", "ERGA_SIGNALS_URL='https://arca.example'", "ERGA_PERSON='ifcore:A B'");
  lacks(p.stdout + p.stderr, "arca_abcdefghijklmnopqrstuvwxyz1234");
  for (const n of [".profile", ".bashrc", ".zshenv", ".config/fish"]) assert(!exists(`${fx.home}/${n}`), n);
  await keep({ ERGA_SIGNALS_TOKEN: "arca_abcdefghijklmnopqrstuvwxyz1234", ERGA_SIGNALS_URL: "https://arca.example", ERGA_PERSON: "ifcore:A B" });
  assertEquals(Deno.readTextFileSync(f), text, "a second run changes nothing");
  await keep({ ERGA_SIGNALS_TOKEN: "arca_newnewnewnewnewnewnew" });
  const after = Deno.readTextFileSync(f);
  assertEquals(after.split("ERGA_SIGNALS_TOKEN=").length - 1, 1);
  assertEquals(secretOf(after, "ERGA_SIGNALS_TOKEN"), "arca_newnewnewnewnewnewnew");
});

Deno.test("nothing is kept without a setting, a GitHub token is not kept, and a quote is refused (FR-052)", async () => {
  await using fx = await Fx.make();
  const keep = (e: Record<string, string>) => fx.setup([], { ...OFF, ...e });
  const p = await keep({ GH_TOKEN: `ghp_${"x".repeat(30)}` });
  assert(!exists(`${fx.home}/.config/erga/secrets.env`));
  has(p.stdout + p.stderr, "not saved", "ergactl secrets set GH_TOKEN");
  has((await keep({ ERGA_SIGNALS_TOKEN: "arca_it's" })).stderr, "not saved");
  has((await keep({ ERGA_SIGNALS_TOKEN: 'arca_"quoted"' })).stderr, "not saved");
  assert(!exists(`${fx.home}/.config/erga/secrets.env`));
  Deno.writeTextFileSync(`${fx.home}/.bashrc`, "alias mine=1");
  await keep({ ERGA_SIGNALS_TOKEN: "arca_abcdefghijklmnopqrstuvwxyz1234" });
  assertEquals(Deno.readTextFileSync(`${fx.home}/.bashrc`), "alias mine=1");
});

Deno.test("a sign-in made with gh is said to be kept on this computer; a token of the environment is not (FR-048)", async () => {
  await using fx = await Fx.make();
  const said = async (how: "gh" | "env") => {
    const ctx = context(fx, { GH_TOKEN: `ghp_${"x".repeat(30)}` });
    ctx.st.signIn = how;
    using cap = new Captured();
    await keepSettings(ctx);
    return cap.all;
  };
  const kept = await said("gh");
  has(kept, "Your GitHub sign-in is kept on this computer", "gh auth logout");
  lacks(kept, "not saved", "ergactl secrets set GH_TOKEN", "ghp_xxxx");
  const token = await said("env");
  has(token, "not saved", "ergactl secrets set GH_TOKEN", "gh auth login", "The GitHub token in GH_TOKEN was used");
  lacks(token, "ghp_xxxx");
});

Deno.test("a dry run keeps nothing, and a token kept earlier counts for telemetry where the terminal has none", async () => {
  await using fx = await Fx.make();
  const p = await fx.setup(["--dry-run"], { ...OFF, ERGA_SIGNALS_TOKEN: "arca_abcdefghijklmnopqrstuvwxyz1234" });
  assertEquals(p.code, 0, p.stdout + p.stderr);
  has(p.stdout, "would keep ERGA_SIGNALS_TOKEN");
  assert(!exists(`${fx.home}/.config/erga`));
  Deno.mkdirSync(`${fx.home}/.config/erga`, { recursive: true });
  Deno.writeTextFileSync(`${fx.home}/.config/erga/secrets.env`, "ERGA_SIGNALS_TOKEN='arca_fromthefile'\nERGA_SIGNALS_URL='https://arca.example/'\n");
  has((await fx.setup(["--dry-run"], OFF)).stdout, "Telemetry is on");
  assertEquals(withSecret(null, "A", "b"), "# Kept by `ergactl secrets`; change it with `ergactl secrets set` and `ergactl secrets remove`.\nA='b'\n");
  assertEquals(withSecret("X='1'\nA='old'\n", "A", "new"), "X='1'\nA='new'\n");
});
