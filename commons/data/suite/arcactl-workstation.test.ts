// Spec: 0047-arcactl-init FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The workstation and server models of `arcactl` (commons data 0047-arcactl-init): where a person's files are on each platform, managed blocks, the safe change of a file in a temporary home, and how
 * the server model is chosen and gets its secrets. Every file is in a temporary directory; no test touches the real home.
 *
 * @module
 */
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import {
  applyChange,
  blockOf,
  diffOf,
  type Host,
  main,
  markers,
  mayAsk,
  mayWriteHome,
  modeOf,
  pathsOf,
  pgpassModeOk,
  planBlock,
  profileTargets,
  secretOf,
  serverSettings,
  shellOf,
  withBlock,
  withoutBlock,
} from "@intellectual-frontiers/data/sql/cli";
import { same } from "./governance-fixture.ts";

const paths = (platform: Host["platform"], env: Record<string, string>) => {
  const r = pathsOf({ platform, env });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const temp = (): string => mkdtempSync(join(tmpdir(), "arcactl-"));

proves(
  ["0047-arcactl-init FR-001"],
  "the files of a person are found by each platform's own rules and by libpq's own variables where it has them, without touching a file, and a missing home is said",
  () => {
    const l = paths("linux", { HOME: "/home/ann" });
    same([l.pgpass, l.pgServiceFile, l.psqlrc], ["/home/ann/.pgpass", "/home/ann/.pg_service.conf", "/home/ann/.psqlrc"]);
    same([l.config, l.cache, l.state, l.arcaPsqlrc, l.instances], ["/home/ann/.config/arcactl", "/home/ann/.cache/arcactl", "/home/ann/.local/state/arcactl", "/home/ann/.config/arcactl/psqlrc", "/home/ann/.config/arcactl/instances.json"]);
    same(l.profiles.bash, { files: ["/home/ann/.bashrc"], policy: "all" });
    same([l.profiles.zsh.files, l.profiles.fish.files, l.profiles.pwsh.files, l.profiles.nu.files, l.profiles.sh.files], [["/home/ann/.zshrc"], ["/home/ann/.config/fish/conf.d/arcactl.fish"], ["/home/ann/.config/powershell/Microsoft.PowerShell_profile.ps1"], ["/home/ann/.config/nushell/config.nu"], ["/home/ann/.profile"]]);
    const x = paths("linux", { HOME: "/h", XDG_CONFIG_HOME: "/x/c", XDG_CACHE_HOME: "/x/k", XDG_STATE_HOME: "/x/s", ZDOTDIR: "/z", PGPASSFILE: "/p/pw", PGSERVICEFILE: "/p/svc", PSQLRC: "/p/rc" });
    same([x.config, x.cache, x.state, x.profiles.zsh.files, x.profiles.fish.files, x.pgpass, x.pgServiceFile, x.psqlrc], ["/x/c/arcactl", "/x/k/arcactl", "/x/s/arcactl", ["/z/.zshrc"], ["/x/c/fish/conf.d/arcactl.fish"], "/p/pw", "/p/svc", "/p/rc"]);
    const m = paths("darwin", { HOME: "/Users/ann" });
    same(m.profiles.bash, { files: ["/Users/ann/.bash_profile", "/Users/ann/.bashrc"], policy: "first-existing" });
    same(profileTargets(m.profiles.bash, (f) => f.endsWith(".bashrc")), ["/Users/ann/.bashrc"]);
    same(profileTargets(m.profiles.bash, () => false), ["/Users/ann/.bash_profile"]);
    same(profileTargets(m.profiles.bash, () => true), ["/Users/ann/.bash_profile"]);
    const w = paths("win32", { USERPROFILE: "C:\\Users\\Ann", APPDATA: "C:\\Users\\Ann\\AppData\\Roaming", LOCALAPPDATA: "C:\\Users\\Ann\\AppData\\Local" });
    same([w.pgpass, w.pgServiceFile, w.psqlrc], ["C:\\Users\\Ann\\AppData\\Roaming\\postgresql\\pgpass.conf", "C:\\Users\\Ann\\AppData\\Roaming\\postgresql\\.pg_service.conf", "C:\\Users\\Ann\\AppData\\Roaming\\postgresql\\psqlrc.conf"]);
    same([w.config, w.cache, w.state], ["C:\\Users\\Ann\\AppData\\Roaming\\arcactl", "C:\\Users\\Ann\\AppData\\Local\\arcactl\\cache", "C:\\Users\\Ann\\AppData\\Local\\arcactl\\state"]);
    same(w.profiles.pwsh, { files: ["C:\\Users\\Ann\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1", "C:\\Users\\Ann\\Documents\\WindowsPowerShell\\Microsoft.PowerShell_profile.ps1"], policy: "all" });
    same(w.profiles.nu.files, ["C:\\Users\\Ann\\AppData\\Roaming\\nushell\\config.nu"]);
    same(paths("win32", { USERPROFILE: "C:\\Users\\Ann", ARCACTL_PWSH_PROFILE: "D:\\ps\\p.ps1" }).profiles.pwsh.files, ["D:\\ps\\p.ps1"], "a redirected Documents folder");
    same(paths("win32", { HOMEDRIVE: "C:", HOMEPATH: "\\Users\\Bo" }).home, "C:\\Users\\Bo");
    for (const [p, env] of [["linux", {}], ["linux", { HOME: "" }], ["win32", {}]] as const) assert(pathsOf({ platform: p, env }).kind === "err", `${p} ${JSON.stringify(env)}`);
    same([shellOf("/usr/bin/zsh"), shellOf("pwsh.exe"), shellOf("C:\\Program Files\\PowerShell\\7\\pwsh.exe"), shellOf("powershell"), shellOf("/usr/bin/fish"), shellOf("nu"), shellOf("dash"), shellOf("/bin/csh"), shellOf(undefined)], ["zsh", "pwsh", "pwsh", "pwsh", "fish", "nu", "sh", undefined, undefined]);
  },
);

proves(
  ["0047-arcactl-init FR-002"],
  "a managed block is put in once however often it is asked, replaces itself, leaves everything outside its markers as it was, keeps the line ending, comes out leaving the file as it was, and a file whose markers make no sense is an error and is not changed",
  () => {
    const m = markers("shell", "#");
    same(m, { open: "# >>> arcactl:shell >>>", close: "# <<< arcactl:shell <<<" });
    const mine = "export PATH=$HOME/bin:$PATH\nalias ll='ls -l'\n";
    const once = must(withBlock(mine, "shell", "#", "eval \"$(arcactl shell)\""));
    same(once, `${mine}\n# >>> arcactl:shell >>>\neval "$(arcactl shell)"\n# <<< arcactl:shell <<<\n`);
    same(must(withBlock(once, "shell", "#", "eval \"$(arcactl shell)\"")), once, "twice is once");
    same(must(blockOf(once, "shell", "#")), 'eval "$(arcactl shell)"');
    const changed = must(withBlock(once, "shell", "#", "eval \"$(arcactl shell --shell bash)\""));
    assert(changed.startsWith(mine) && changed.includes("--shell bash") && !changed.includes('eval "$(arcactl shell)"\n'), "replaced in place");
    same(must(withoutBlock(once, "shell", "#")), mine, "out leaves the file as it was");
    same(must(withoutBlock(mine, "shell", "#")), mine, "out of a file without it is nothing");
    // the person's edits around the block survive a change of the block
    const edited = `# top\n${once}tail line\n`;
    const again = must(withBlock(edited, "shell", "#", "other"));
    assert(again.startsWith("# top\n") && again.endsWith("tail line\n") && again.includes("other"), again);
    // two blocks of different names do not touch each other
    const two = must(withBlock(once, "psql", "--", "\\set X 1"));
    same([must(blockOf(two, "shell", "#")), must(blockOf(two, "psql", "--"))], ['eval "$(arcactl shell)"', "\\set X 1"]);
    same(must(withoutBlock(two, "psql", "--")), once);
    // an empty file, and no line ending at the end
    same(must(withoutBlock(must(withBlock("", "a", "#", "x")), "a", "#")), "");
    same(must(withBlock("", "a", "#", "")), "# >>> arcactl:a >>>\n# <<< arcactl:a <<<\n");
    assert(must(withBlock("no newline", "a", "#", "x")).startsWith("no newline\n\n# >>>"));
    // a Windows file keeps its line endings
    const crlf = must(withBlock("a\r\nb\r\n", "a", "#", "x\ny"));
    same(crlf, "a\r\nb\r\n\r\n# >>> arcactl:a >>>\r\nx\r\ny\r\n# <<< arcactl:a <<<\r\n");
    same(must(withoutBlock(crlf, "a", "#")), "a\r\nb\r\n");
    // a round trip, over many texts
    let seed = 7;
    const next = (n: number): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    const bits = ["", "\n", "export A=1", "# >>> arcactl:other >>>", "x y z", "\n\n", "   ", "echo '<<<'"];
    for (let i = 0; i < 200; i++) {
      const text = Array.from({ length: next(6) }, () => bits[next(bits.length)] as string).join("\n");
      const base = text === "" || text.endsWith("\n") ? text : `${text}\n`;
      const put = must(withBlock(base, "sync", "#", `line ${i}\nsecond`));
      same(must(withBlock(put, "sync", "#", `line ${i}\nsecond`)), put, "idempotent");
      same(must(withoutBlock(put, "sync", "#")), base, `round trip of ${JSON.stringify(base)}`);
    }
    // markers that make no sense
    const kinds = (t: string) => {
      const r = withBlock(t, "shell", "#", "x");
      return r.kind === "err" ? r.error.kind : "ok";
    };
    same(kinds(`${m.open}\nx\n`), "unbalanced");
    same(kinds(`x\n${m.close}\n`), "unbalanced");
    same(kinds(`${m.close}\n${m.open}\n`), "unbalanced");
    same(kinds(`${once}${once}`), "duplicate");
    same(withBlock("", "Bad Name", "#", "x").kind, "err");
    same(withoutBlock(`${m.open}\n`, "shell", "#").kind, "err");
  },
);

proves(
  ["0047-arcactl-init FR-003"],
  "a change of a file is planned before it is made, is made whole by rename with the file's mode kept and a copy of the first version, writes nothing where there is nothing to change, goes through a symbolic link, and refuses a directory",
  () => {
    const home = temp();
    try {
      const rc = join(home, ".bashrc");
      writeFileSync(rc, "alias a=b\n", { mode: 0o640 });
      const plan = must(planBlock(rc, "shell", "#", { body: "eval x" }));
      same([plan.action, plan.before, plan.through], ["update", "alias a=b\n", false]);
      assert(plan.after.includes("eval x") && readFileSync(rc, "utf8") === "alias a=b\n", "planning wrote nothing");
      const diff = diffOf(plan.before, plan.after);
      assert(diff.includes("+ # >>> arcactl:shell >>>") && diff.includes("+ eval x") && !diff.includes("- "), diff);
      const done = applyChange(plan);
      same([done.action, done.backup], ["update", `${rc}.arcactl-bak`]);
      same(readFileSync(`${rc}.arcactl-bak`, "utf8"), "alias a=b\n", "the first version is kept");
      same(statSync(rc).mode & 0o777, 0o640, "the mode is kept");
      assert(readdirSync(home).every((f) => !f.includes(".arcactl-") || f.endsWith(".arcactl-bak")), "no temporary file is left");
      // nothing to change: nothing is written
      const same2 = must(planBlock(rc, "shell", "#", { body: "eval x" }));
      same(same2.action, "unchanged");
      const before = statSync(rc).mtimeMs;
      same(applyChange(same2).action, "unchanged");
      same(statSync(rc).mtimeMs, before);
      // a second change keeps the first backup
      const second = applyChange(must(planBlock(rc, "shell", "#", { body: "eval y" })));
      same(second.backup, undefined);
      same(readFileSync(`${rc}.arcactl-bak`, "utf8"), "alias a=b\n");
      // taking it out
      applyChange(must(planBlock(rc, "shell", "#", "absent")));
      same(readFileSync(rc, "utf8"), "alias a=b\n");
      same(must(planBlock(rc, "shell", "#", "absent")).action, "unchanged");
      // a new file takes the mode asked for, and a directory is made
      const pw = join(home, "deep", "dir", ".pgpass");
      const made = must(planBlock(pw, "arca", "#", { body: "h:5432:d:u:p" }, 0o600));
      same(made.action, "create");
      applyChange(made);
      same(statSync(pw).mode & 0o777, 0o600);
      assert(pgpassModeOk(statSync(pw).mode) && !pgpassModeOk(0o644) && !pgpassModeOk(0o640) && pgpassModeOk(0o400));
      same(must(planBlock(join(home, "none"), "a", "#", "absent")).action, "unchanged", "taking a block out of no file is nothing");
      // through a symbolic link, as a dotfile manager makes
      const store = join(home, "dotfiles");
      mkdirSync(store);
      writeFileSync(join(store, "zshrc"), "setopt x\n");
      symlinkSync(join(store, "zshrc"), join(home, ".zshrc"));
      const viaLink = must(planBlock(join(home, ".zshrc"), "shell", "#", { body: "eval z" }));
      assert(viaLink.through && viaLink.target.endsWith(join("dotfiles", "zshrc")));
      applyChange(viaLink);
      assert(lstatSync(join(home, ".zshrc")).isSymbolicLink() && readFileSync(join(store, "zshrc"), "utf8").includes("eval z"), "the link is kept and the file it leads to is written");
      // a directory, and a file with broken markers
      same(planBlock(store, "a", "#", { body: "x" }).kind, "err");
      writeFileSync(join(home, "broken"), "# >>> arcactl:shell >>>\nx\n");
      const broken = planBlock(join(home, "broken"), "shell", "#", { body: "y" });
      assert(broken.kind === "err" && broken.error.kind === "block");
      same(readFileSync(join(home, "broken"), "utf8"), "# >>> arcactl:shell >>>\nx\n", "a file with broken markers is not changed");
      assert(diffOf(undefined, "a\nb\n") === "+ a\n+ b" && diffOf("a\nb\nc\nd\ne\n", "a\nb\nX\nd\ne\n").includes("- c") && diffOf("a\n", "a\n") === "");
      chmodSync(home, 0o755);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  },
);

proves(
  ["0047-arcactl-init FR-004"],
  "the server model is chosen by what is said (an option, ARCA_MODE), then by the environment (CI, no terminal), and only a person at a terminal gets the workstation, where files are written and questions asked",
  () => {
    const m = (argv: string[], env: Record<string, string> = {}, tty = true) => modeOf(argv, env, tty).mode;
    same(m([]), "workstation");
    same(m([], {}, false), "server", "no terminal");
    same(m(["--non-interactive"]), "server");
    same(m(["--interactive"], { CI: "true" }, false), "workstation", "a person can say so");
    same(m([], { ARCA_MODE: "server" }), "server");
    same(m([], { ARCA_MODE: "workstation", CI: "true" }, false), "workstation", "what is said beats what is seen");
    same(m(["--non-interactive"], { ARCA_MODE: "workstation" }), "server", "an option beats the environment");
    for (const ci of ["CI", "GITHUB_ACTIONS", "GITLAB_CI", "BUILDKITE", "JENKINS_URL", "TF_BUILD", "CIRCLECI"]) same(m([], { [ci]: "true" }), "server", ci);
    same(m([], { CI: "false" }), "workstation");
    same(m([], { CI: "0" }), "workstation");
    same(m([], { CI: "" }), "workstation");
    same(modeOf([], { GITHUB_ACTIONS: "true" }, true).why, "GITHUB_ACTIONS is set");
    same([mayWriteHome("workstation"), mayAsk("workstation"), mayWriteHome("server"), mayAsk("server")], [true, true, false, false]);
  },
);

proves(
  ["0047-arcactl-init FR-005"],
  "a server run gets its secrets from a variable or from the file a NAME_FILE names, never both, without a trailing line ending, and a URL given so is used and never printed",
  async () => {
    const files: Record<string, string> = { "/run/secrets/url": "postgres://app:s3cretpw@127.0.0.1:1/arca\n", "/run/secrets/key": "the-key\r\n" };
    const read = (p: string): string => {
      const f = files[p];
      if (f === undefined) throw new Error(`ENOENT: no such file or directory, open '${p}'`);
      return f;
    };
    same(secretOf({ X: "v" }, "X", read), { kind: "ok", value: "v" });
    same(secretOf({ X_FILE: "/run/secrets/key" }, "X", read), { kind: "ok", value: "the-key" });
    same(secretOf({}, "X", read), { kind: "ok", value: undefined });
    same(secretOf({ X: "" }, "X", read), { kind: "ok", value: undefined });
    assert(secretOf({ X: "v", X_FILE: "/run/secrets/key" }, "X", read).kind === "err", "both is an error");
    const missing = secretOf({ X_FILE: "/nowhere" }, "X", read);
    assert(missing.kind === "err" && missing.error.includes("X_FILE") && missing.error.includes("/nowhere"));
    const s = serverSettings({ ARCA_DATABASE_URL_FILE: "/run/secrets/url", ARCA_SEAL_KEY_FILE: "/run/secrets/key", ARCA_UNLOCK_SECRET: "u", ARCA_APPROVE: "abc", ARCA_LOG: "json" }, read);
    same(s, { kind: "ok", value: { url: "postgres://app:s3cretpw@127.0.0.1:1/arca", sealKey: "the-key", unlockSecret: "u", approve: "abc", log: "json" } });
    const bad = serverSettings({ ARCA_DATABASE_URL: "a", ARCA_DATABASE_URL_FILE: "/run/secrets/url", ARCA_SEAL_KEY_FILE: "/nowhere" }, read);
    assert(bad.kind === "err" && bad.error.length === 2);
    // the command line takes the URL from the file, and prints no password
    const r = await main(["doctor", "--models", "identity", "--non-interactive"], { env: { ARCA_DATABASE_URL_FILE: "/run/secrets/url" }, cwd: "/nowhere", read });
    assert(r.code === 2 && r.err.includes("could not connect") && !r.err.includes("s3cretpw"), r.err);
    const wrong = await main(["doctor", "--models", "identity"], { env: { ARCA_DATABASE_URL: "a", ARCA_DATABASE_URL_FILE: "/run/secrets/url" }, cwd: "/nowhere", read });
    assert(wrong.code === 2 && wrong.err.includes("both set") && !wrong.err.includes("s3cretpw"));
    assert(!existsSync("/nowhere"));
  },
);
