// Spec: 0047-arcactl-init FR-006, FR-007
/**
 * The script of `arcactl shell` (commons data 0047-arcactl-init FR-006, FR-007), run by the real shells: bash, `sh`, zsh and fish here, and PowerShell and nushell where they are installed (the CI
 * job installs them; where `ARCACTL_REQUIRE_SHELLS=1` a shell that is missing fails the test and does not skip it). Each value arrives byte for byte whatever it holds, nothing it holds is run, sourcing
 * twice is once, `arca-off` takes everything away and leaves the person's own variables, and switching instance replaces what the last set.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { commands, envJson, main, quoteFish, quoteNu, quotePosix, quotePwsh, type Shell, type ShellInput, shellScript, shells, variablesOf } from "@intellectual-frontiers/data/sql/cli";
import { same } from "./governance-fixture.ts";
import { bunPath } from "./net-fixtures.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN: Record<Shell, string> = { bash: "bash", sh: "sh", zsh: "zsh", fish: "fish", pwsh: "pwsh", nu: "nu" };
const have = (shell: Shell): boolean => spawnSync("sh", ["-c", `command -v ${BIN[shell]}`]).status === 0;
const available = (): Shell[] => {
  const out: Shell[] = [];
  for (const s of shells) {
    if (have(s)) out.push(s);
    else if (process.env["ARCACTL_REQUIRE_SHELLS"] === "1") throw new Error(`${s} is required and is not installed`);
  }
  return out;
};
const SHELLS = available();

const work = mkdtempSync(join(tmpdir(), "arcactl-shell-"));
const bin = join(work, "bin");
mkdirSync(bin);
writeFileSync(
  join(bin, "arcactl"),
  `#!/bin/sh\nif [ -n "$ARCACTL_STUB_LOG" ] && [ "$1" != shell ]; then for a in "$@"; do printf '[%s]' "$a"; done > "$ARCACTL_STUB_LOG"; exit 0; fi\nexec ${JSON.stringify(bunPath())} ${JSON.stringify(join(ROOT, "sql/cli/arcactl.ts"))} "$@"\n`,
);
chmodSync(join(bin, "arcactl"), 0o755);
const bunDir = dirname(bunPath());

const make = (shell: Shell, over: Partial<ShellInput> = {}): string => {
  const r = shellScript({ shell, schema: "arca", instance: "prod-main", env: "prod", service: "prod-main", ...over });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
};

/** Runs a snippet in a shell, after sourcing a script, and gives what it wrote to a file. */
function inShell(shell: Shell, scripts: readonly string[], snippet: (out: string) => string, extra: Record<string, string> = {}): { out: string; code: number; stderr: string } {
  const dir = mkdtempSync(join(work, "run-"));
  const files = scripts.map((s, i) => {
    const f = join(dir, `s${i}${shell === "pwsh" ? ".ps1" : shell === "nu" ? ".nu" : ""}`);
    writeFileSync(f, s);
    return f;
  });
  const out = join(dir, "out");
  const env = { PATH: `${bin}:${bunDir}:/usr/bin:/bin`, HOME: dir, TERM: "dumb", ...extra };
  const src = (f: string): string => (shell === "sh" ? `. ${f}` : shell === "pwsh" ? `. '${f}'` : `source ${f}`);
  const body = `${files.map(src).join(shell === "pwsh" ? "; " : "\n")}\n${snippet(out)}`;
  const args: Record<Shell, string[]> = {
    bash: ["--noprofile", "--norc", "-c", body],
    sh: ["-c", body],
    zsh: ["-f", "-c", body],
    fish: ["--no-config", "-c", body],
    pwsh: ["-NoProfile", "-NonInteractive", "-Command", body],
    nu: ["--no-config-file", "-c", body],
  };
  const r = spawnSync(BIN[shell], args[shell], { env, encoding: "utf8", timeout: 60000 });
  return { out: existsSync(out) ? readFileSync(out, "utf8") : "", code: r.status ?? -1, stderr: r.stderr };
}
/** The snippet that writes the value of a variable, as it is, to the file. */
const write = (shell: Shell, name: string, out: string, append = false): string => {
  if (shell === "fish") return `printf '%s' "$${name}" ${append ? ">>" : ">"} ${out}`;
  if (shell === "pwsh") return `[IO.File]::${append ? "AppendAllText" : "WriteAllText"}('${out}', [string]$env:${name})`;
  if (shell === "nu") return `$env.${name}? | default "" | ${append ? "save --append" : "save -f"} ${out}`;
  return `printf '%s' "\${${name}-}" ${append ? ">>" : ">"} ${out}`;
};

proves(
  ["0047-arcactl-init FR-006"],
  "each shell's quoting makes any text one word: the known answers of the rules of POSIX shells, fish, PowerShell and nushell, and the real shells hand back what they are given, spaces, quotes, $, backticks and line endings included",
  () => {
    same([quotePosix("a b"), quotePosix("it's"), quotePosix(""), quotePosix("$(x) `y`\n")], ["'a b'", "'it'\\''s'", "''", "'$(x) `y`\n'"]);
    same([quoteFish("it's"), quoteFish("a\\b"), quoteFish("$x (y)")], ["'it\\'s'", "'a\\\\b'", "'$x (y)'"]);
    same([quotePwsh("it's"), quotePwsh("$x `y`"), quotePwsh("")], ["'it''s'", "'$x `y`'", "''"]);
    same([quoteNu('a "b"'), quoteNu("a\\b"), quoteNu("l1\nl2\t$x")], ['"a \\"b\\""', '"a\\\\b"', '"l1\\nl2\\t$x"']);
    const nasty = ["it's \"quoted\" and $HOME and `id` and $(touch PWNED)", "back\\slash \\n end", "tab\there", "line1\nline2", "unicodé ✓ ☃", "  spaces  ", "'", "''", "$", "*?[x]"];
    assert(SHELLS.includes("bash") && SHELLS.includes("sh"), "at least bash and sh are here");
    for (const shell of SHELLS) {
      for (const v of nasty) {
        const script = make(shell, { config: v, home: v, models: [v, "b"] });
        const r1 = inShell(shell, [script], (out) => write(shell, "ARCA_CONFIG", out));
        same(r1.out, v, `${shell}: ARCA_CONFIG ${JSON.stringify(v)} ${r1.stderr}`);
        const r2 = inShell(shell, [script], (out) => write(shell, "ARCA_MODELS", out));
        same(r2.out, `${v},b`, `${shell}: ARCA_MODELS`);
        assert(!existsSync(join(work, "PWNED")), "nothing in a value was run");
      }
    }
  },
);

proves(
  ["0047-arcactl-init FR-006"],
  "the script sets the instance, the service and the search path, keeps the person's own PGOPTIONS, and is the same sourced twice",
  () => {
    for (const shell of SHELLS) {
      const script = make(shell, { config: "/c/arca.config.ts", schema: "tenancy" });
      const got = (name: string, pre = "", extra: Record<string, string> = {}, more: readonly string[] = []) => inShell(shell, [script, ...more], (out) => `${pre}${shell === "pwsh" ? "; " : "\n"}${write(shell, name, out)}`, extra).out;
      same([got("ARCA_INSTANCE"), got("ARCA_ENV"), got("ARCA_SCHEMA"), got("ARCA_SERVICE"), got("PGSERVICE"), got("PGOPTIONS"), got("ARCA_PGOPTIONS")], ["prod-main", "prod", "tenancy", "prod-main", "prod-main", "-c search_path=tenancy,public", "-c search_path=tenancy,public"], shell);
      same(got("PGOPTIONS", "", {}, [script, script]), "-c search_path=tenancy,public", `${shell}: twice is once`);
      // the person's own PGOPTIONS is theirs
      same(inShell(shell, [script], (out) => write(shell, "PGOPTIONS", out), { PGOPTIONS: "-c statement_timeout=5s" }).out, "-c statement_timeout=5s", `${shell}: kept`);
      same(inShell(shell, [script], (out) => write(shell, "ARCA_PGOPTIONS", out), { PGOPTIONS: "-c statement_timeout=5s" }).out, "-c search_path=tenancy,public", `${shell}: what the script offers is still said`);
    }
  },
);

proves(
  ["0047-arcactl-init FR-007"],
  "arca-off takes away what the script set and the functions, leaves the person's own variables, and a switch of instance (arca-use, by the real command) replaces what the last one set without carrying its label or service over",
  () => {
    for (const shell of SHELLS.filter((s) => s !== "pwsh" && s !== "nu")) {
      const script = make(shell, { prompt: true, config: "/c/x.ts" });
      const fn = (n: string): string => (shell === "sh" ? n.replaceAll("-", "_") : n);
      const exists = (n: string): string => (shell === "fish" ? `functions -q ${n}; and echo yes; or echo no` : shell === "zsh" ? `whence -w ${fn(n)} >/dev/null 2>&1 && echo yes || echo no` : `type ${fn(n)} >/dev/null 2>&1 && echo yes || echo no`);
      const probe = (out: string): string => `${[...["arca", "arca-doctor", "arca-psql", "arca-use", "arca-off", "arca-prompt"].map((f) => (shell === "fish" ? `begin; ${exists(f)}; end >> ${out}` : `{ ${exists(f)}; } >> ${out}`))].join("\n")}`;
      const before = inShell(shell, [script], probe).out.trim().split("\n");
      same(before, ["yes", "yes", "yes", "yes", "yes", "yes"], `${shell}: the functions are there`);
      const off = inShell(shell, [script], (out) => `${fn("arca-off")}\n${probe(out)}\n${write(shell, "ARCA_INSTANCE", out, true)}\n${write(shell, "PGSERVICE", out, true)}\n${write(shell, "PGOPTIONS", out, true)}\n${write(shell, "MINE", out, true)}`, { MINE: "mine" });
      same(off.out.replace(/\n/g, ""), "nonononononomine", `${shell}: gone, and the person's own variable is there: ${off.stderr}`);
      // the person's PGOPTIONS survives arca-off
      same(inShell(shell, [script], (out) => `${fn("arca-off")}\n${write(shell, "PGOPTIONS", out)}`, { PGOPTIONS: "-c x=1" }).out, "-c x=1", `${shell}: PGOPTIONS`);
      // switching instance, by the real command: the label and the service of the first are not the second's
      const sw = inShell(shell, [script], (out) => `${fn("arca-use")} staging-db\n${["ARCA_INSTANCE", "ARCA_ENV", "ARCA_SERVICE", "PGSERVICE", "ARCA_CONFIG"].map((v) => `${write(shell, v, out, true)}\nprintf '|' >> ${out}`).join("\n")}`);
      same(sw.out, "staging-db||staging-db|staging-db|/c/x.ts|", `${shell}: switched (the project's config stays, the instance's label and service do not): ${sw.stderr}`);
      const none = inShell(shell, [script], (out) => `${fn("arca-use")}\necho ${shell === "fish" ? "$status" : "$?"} > ${out}`);
      same(none.out.trim(), "2", `${shell}: arca-use needs a name`);
      same(inShell(shell, [script], (out) => `${fn("arca-prompt")} > ${out}`).out, "[prod-main:prod]", `${shell}: the prompt`);
    }
  },
);

proves(
  ["0047-arcactl-init FR-007"],
  "the functions call arcactl with their arguments as they are, and the completions offer the commands, their options and their values",
  () => {
    for (const shell of SHELLS.filter((s) => s !== "pwsh" && s !== "nu")) {
      const script = make(shell);
      const fn = (n: string): string => (shell === "sh" ? n.replaceAll("-", "_") : n);
      const log = join(work, `log-${shell}`);
      const call = (c: string): string => {
        rmSync(log, { force: true });
        inShell(shell, [script], () => c, { ARCACTL_STUB_LOG: log });
        return existsSync(log) ? readFileSync(log, "utf8") : "(not called)";
      };
      same(call(`${fn("arca-doctor")} --json "a b" 'c'`), "[doctor][--json][a b][c]", `${shell}: arca-doctor`);
      same(call(`${fn("arca")} frob "x y"`), "[frob][x y]", `${shell}: arca`);
      same(call(`${fn("arca-psql")} -c "select 1"`), "(not called)", `${shell}: psql is psql, not arcactl`);
    }
    // bash: the completion function itself
    const bash = make("bash");
    const complete = (words: string[], at: number): string[] => inShell("bash", [bash], (out) => `COMP_WORDS=(${words.map((w) => `'${w}'`).join(" ")}); COMP_CWORD=${at}; _arcactl; printf '%s\\n' "\${COMPREPLY[@]}" > ${out}`).out.split("\n").filter((x) => x !== "");
    same(complete(["arcactl", ""], 1), commands.map((c) => c.name));
    same(complete(["arcactl", "sh"], 1), ["shell"]);
    assert(complete(["arcactl", "doctor", "--m"], 2).includes("--models") && !complete(["arcactl", "doctor", "--m"], 2).includes("--shell"));
    same(complete(["arcactl", "shell", "--shell", "p"], 3), ["pwsh"]);
    same(complete(["arcactl", "doctor", "--check", "ARCA-D00"], 3).length, 9);
    // fish: its own completion listing
    if (SHELLS.includes("fish")) {
      const fish = make("fish");
      const listed = inShell("fish", [fish], (out) => `complete -C 'arcactl doctor --' > ${out}`).out;
      assert(listed.includes("--models") && listed.includes("--json") && !listed.includes("--shell"), listed);
      const top = inShell("fish", [fish], (out) => `complete -C 'arca ' > ${out}`).out;
      assert(top.includes("doctor") && top.includes("shell"), top);
    }
  },
);

proves(
  ["0047-arcactl-init FR-006", "0047-arcactl-init FR-007"],
  "the script is valid for every shell it is made for, is the same each time, holds no password, and the command that prints it connects to nothing, names the shell it is for, and refuses input that would not be safe",
  async () => {
    for (const shell of shells) {
      const a = make(shell, { prompt: true, config: "/c/x ts", models: ["identity"] });
      same(a, make(shell, { prompt: true, config: "/c/x ts", models: ["identity"] }), `${shell}: the same each time`);
      assert(a.startsWith(`# arcactl shell for ${shell}:`) && a.endsWith("\n"));
      if (!SHELLS.includes(shell)) continue;
      const check: Record<Shell, string[]> = { bash: ["-n"], sh: ["-n"], zsh: ["-n"], fish: ["--no-execute"], pwsh: ["-NoProfile", "-Command", "$null = [scriptblock]::Create((Get-Content -Raw $args[0]))"], nu: ["--commands", "nu-check"] };
      const f = join(work, `syntax-${shell}`);
      writeFileSync(f, a);
      const r = spawnSync(BIN[shell], shell === "pwsh" ? ["-NoProfile", "-Command", `$null = [scriptblock]::Create((Get-Content -Raw '${f}'))`] : shell === "nu" ? ["--no-config-file", "-c", `nu-check --debug ${f}`] : [...(check[shell] as string[]), f], { encoding: "utf8" });
      same(r.status, 0, `${shell} says it is not valid: ${r.stderr}${r.stdout}`);
    }
    // what the input may not be
    const bad = (over: Partial<ShellInput>) => {
      const r = shellScript({ shell: "bash", schema: "arca", ...over });
      return r.kind === "err" ? r.error.length : 0;
    };
    same([bad({ url: "postgres://app:pw@h/db" }), bad({ instance: "Bad Name" }), bad({ instance: "x;rm -rf" }), bad({ schema: "Arca" }), bad({ schema: "a;b" }), bad({ service: "a b" }), bad({ env: "Prod" }), bad({ shell: "csh" as Shell })], [1, 1, 1, 1, 1, 1, 1, 1]);
    same(bad({ url: "postgres://app@h/db?sslmode=require", instance: "a.b-c_d" }), 0);
    // the command: nothing connects, nothing is written, the password of the environment is not in the script
    let connected = false;
    const io = { env: { SHELL: "/usr/bin/zsh", PGPASSWORD: "hunter2pw", ARCA_ENV: "prod", ARCA_SERVICE: "old" }, cwd: "/nowhere", connect: async () => ((connected = true), (undefined as never)) };
    const r = await main(["shell", "--instance", "dev-1"], io);
    assert(r.code === 0 && r.out.startsWith("# arcactl shell for zsh:") && !r.out.includes("hunter2pw") && !connected);
    assert(r.out.includes("export ARCA_INSTANCE='dev-1'") && !r.out.includes("ARCA_ENV='prod'") && r.out.includes("export PGSERVICE='dev-1'"), "a new instance does not inherit the old one's label");
    same((await main(["shell"], { env: {}, cwd: "/" })).code, 2);
    same((await main(["shell", "--shell", "csh"], { env: {}, cwd: "/" })).code, 2);
    same((await main(["shell", "--shell", "bash", "--instance", "Bad Name"], { env: {}, cwd: "/" })).code, 2);
    same((await main(["shell", "--shell", "fish"], { env: { ARCA_INSTANCE: "from-env" }, cwd: "/" })).out.includes("set -gx ARCA_INSTANCE 'from-env'"), true);
    same((await main(["shell"], { env: { SHELL: "/usr/bin/fish" }, cwd: "/" })).out.startsWith("# arcactl shell for fish"), true);
    same((await main(["shell"], { env: { PSModulePath: "x" }, cwd: "/" })).out.startsWith("# arcactl shell for pwsh"), true);
    const json = await main(["shell", "--shell", "nu", "--env-json", "--instance", "p1", "--env", "prod"], { env: {}, cwd: "/" });
    same(JSON.parse(json.out), { ARCA_INSTANCE: "p1", ARCA_ENV: "prod", ARCA_SCHEMA: "arca", ARCA_SERVICE: "p1", PGSERVICE: "p1", ARCA_PGOPTIONS: "-c search_path=arca,public" });
    same(envJson({ shell: "bash", schema: "arca" }).kind, "ok");
    same(variablesOf({ shell: "bash", schema: "arca", instance: "x", env: "" }).map(([k]) => k), ["ARCA_INSTANCE", "ARCA_SCHEMA"]);
  },
);
