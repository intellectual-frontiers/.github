// Spec: 0047-arcactl-init FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * `arcactl init` (commons data 0047-arcactl-init FR-011 to FR-015): sets up a person's workstation, the DBA's or the developer's, and no database. It finds the instances the person can reach and looks at
 * each, makes the one they choose their default (its service, its password in `.pgpass`, the prompt and helpers of `psql`, the script `arcactl shell` prints in the profile of their shell), shows every
 * change and makes it only when agreed, and ends by running the checks of the workstation. Run again it changes nothing; `--undo` takes away what it put in. It is for a person at a terminal: the server
 * model refuses it.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { modelNames } from "./config.ts";
import { connect as realConnect, type Connection, type ConnectOptions } from "./connection.ts";
import { type Candidate, discover, passwordFor, type Probe, probe } from "./discover.ts";
import { type Change, applyChange, diffOf, planBlock, planRemoveFile, planWhole } from "./files.ts";
import { type Credential, checkCredential, checkInstance, fixModes, type Instance, planPgpass, planPsql, planServices, planUndo, readInstances, type WriteError } from "./libpq.ts";
import type { Outcome } from "./main.ts";
import { cacheOf, profileBody, scriptFor } from "./profile.ts";
import { type Prompter, silent } from "./prompt.ts";
import { redact } from "./redact.ts";
import { modeOf, secretOf } from "./server.ts";
import { type Installed, type Known, planState, readState, type State, withInstance } from "./state.ts";
import { workstationChecks } from "./workstation-checks.ts";
import { type Platform, type Paths, pathsOf, profileTargets, type Shell, shellOf, shells } from "./workstation.ts";

/** What `init` is given besides its arguments. */
export interface InitIo {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: Platform;
  readonly cwd: string;
  readonly tty: boolean;
  readonly prompt?: Prompter;
  /** Reads standard input to its end, for `--password-stdin`. */
  readonly stdin?: () => Promise<string>;
  readonly connect?: (o: ConnectOptions) => Promise<Connection>;
  readonly psqlVersion?: () => string | undefined;
}

const SWITCHES = new Set(["--discover", "--local", "--no-psql", "--dry-run", "--yes", "-y", "--undo", "--password-stdin", "--json", "--interactive", "--non-interactive"]);

/** The arguments of `init`: the options with their values, and the switches. */
function parse(argv: readonly string[]): { readonly values: Map<string, string>; readonly switches: Set<string>; readonly unknown: readonly string[] } {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  const unknown: string[] = [];
  const takes = new Set(["--instance", "--host", "--port", "--database", "--user", "--sslmode", "--env", "--schema", "--models", "--shell", "--url"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (SWITCHES.has(a)) switches.add(a === "-y" ? "--yes" : a);
    else if (takes.has(a) && argv[i + 1] !== undefined) values.set(a, argv[++i] as string);
    else unknown.push(a);
  }
  return { values, switches, unknown };
}

/** `.pgpass` lines with the passwords not shown, for what the person is asked to agree to. */
const maskPgpass = (text: string): string => text.split("\n").map((l) => (/^[^#].*:.*:.*:.*:/.test(l) ? l.replace(/:[^:]*$/, ":***") : l)).join("\n");

/** The change as a person reads it: what happens to the file and what changes in it. */
function describe(c: Change, paths: Paths): string {
  if (c.action === "unchanged") return `  unchanged  ${c.path}`;
  const mask = c.path === paths.pgpass ? maskPgpass : (t: string): string => t;
  const body = c.action === "remove" ? "" : diffOf(c.before === undefined ? undefined : mask(c.before), mask(c.after)).split("\n").map((l) => `      ${l}`).join("\n");
  return `  ${c.action.padEnd(9)}  ${c.path}${c.through ? ` (through the link to ${c.target})` : ""}${body === "" ? "" : `\n${body}`}`;
}

const errorText = (e: WriteError): string => {
  switch (e.kind) {
    case "invalid":
      return `${e.what}: ${e.why}`;
    case "conflict":
      return e.why;
    case "block":
      return `${e.path}: the markers of the arcactl block do not make sense (${e.error.kind}); it was not changed`;
    case "unreadable":
      return `${e.path}: ${e.why}`;
  }
};

/** The shells to put the script into. */
function shellsWanted(spec: string | undefined, io: InitIo): Shell[] | string {
  if (spec === "none") return [];
  if (spec === "all") return [...shells];
  if (spec === undefined || spec === "auto") {
    const s = shellOf(io.env["SHELL"]) ?? (io.platform === "win32" ? "pwsh" : undefined);
    return s === undefined ? [] : [s];
  }
  const out: Shell[] = [];
  for (const n of spec.split(",").map((x) => x.trim())) {
    const s = shellOf(n);
    if (s === undefined) return `${n} is not a shell (${shells.join(", ")}, all, auto, none)`;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** The table of what discovery found. */
function table(rows: readonly { c: Candidate; p: Probe | undefined }[]): string {
  if (rows.length === 0) return "no instances were found";
  const head = ["instance", "from", "host:port", "status", "as", "could", "arca"];
  const body = rows.map(({ c, p }) => [
    c.name,
    c.sources.join(", "),
    `${c.host ?? "?"}:${c.port ?? 5432}`,
    p === undefined ? "not looked at" : p.reachable ? (p.version ?? "reached") : `not reached: ${(p.error ?? "").slice(0, 60)}`,
    p?.user ?? "",
    p === undefined || !p.reachable ? "" : p.level,
    p === undefined || !p.reachable ? "" : p.arca.models.length > 0 ? p.arca.models.join(", ") : p.arca.exists ? `${p.arca.schema} (${p.arca.tables} tables)` : "none",
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...body.map((r) => (r[i] as string).length)));
  return [head, ...body].map((r) => r.map((cell, i) => cell.padEnd(w[i] as number)).join("  ").trimEnd()).join("\n");
}

/** Runs `arcactl init`. */
export async function runInit(argv: readonly string[], io: InitIo): Promise<Outcome> {
  const a = parse(argv);
  const fail = (m: string): Outcome => ({ code: 2, out: "", err: `${m}\n` });
  if (a.unknown.length > 0) return fail(`init has no option ${a.unknown[0]}`);
  const mode = modeOf(argv, io.env, io.tty);
  if (mode.mode === "server") return fail(`init sets up a person's workstation and writes files in a home directory: this run is a server (${mode.why}). In a pipeline, give the environment instead (ARCA_DATABASE_URL, ARCA_DATABASE_URL_FILE); to run init anyway, say --interactive`);
  const paths = pathsOf({ platform: io.platform, env: io.env });
  if (paths.kind === "err") return fail(paths.error);
  const P = paths.value;
  const read = readState(P);
  if (read.kind === "err") return fail(read.error);
  let state: State = read.value;
  const prompt = io.prompt ?? silent;
  const connect = io.connect ?? realConnect;
  const json = a.switches.has("--json");
  const log: string[] = [];
  const say = (s = ""): void => void log.push(s);
  const apply = async (changes: readonly Change[], modes: readonly { path: string; from: number; to: number }[], what: string): Promise<boolean> => {
    say(`${what}:`);
    for (const c of changes) say(describe(c, P));
    if (changes.every((c) => c.action === "unchanged") && modes.length === 0) {
      say("  nothing to change");
      return true;
    }
    if (a.switches.has("--dry-run")) {
      say("  (dry run: nothing was written)");
      return true;
    }
    if (!a.switches.has("--yes")) {
      if (!prompt.interactive) {
        say("  nothing was written: run it again with --yes to make these changes");
        return false;
      }
      if (!(await prompt.confirm("Make these changes?"))) {
        say("  nothing was written");
        return false;
      }
    }
    for (const c of changes) applyChange(c);
    fixModes({ changes, warnings: [], modes });
    for (const m of modes) say(`  mode of ${m.path} put right`);
    for (const c of changes) if (c.action !== "unchanged") say(`  done      ${c.path}`);
    return true;
  };
  const finish = (code: 0 | 1, extra: Record<string, unknown> = {}): Outcome => ({ code, out: json ? `${JSON.stringify({ mode: mode.mode, log, ...extra }, null, 2)}\n` : `${log.join("\n")}\n`, err: "" });

  // ---- undo
  if (a.switches.has("--undo")) {
    const plan = planUndo(P);
    if (plan.kind === "err") return fail(plan.error.map(errorText).join("\n"));
    const changes: Change[] = [...plan.value.changes];
    const errors: WriteError[] = [];
    for (const sh of shells)
      for (const f of P.profiles[sh].files) {
        const c = planBlock(f, "shell", "#", "absent");
        if (c.kind === "err") errors.push(c.error);
        else changes.push(c.value);
      }
    for (const sh of shells) {
      const c = planRemoveFile(cacheOf(P, sh));
      if (c.kind === "err") errors.push(c.error);
      else changes.push(c.value);
    }
    const st = planRemoveFile(P.instances);
    if (st.kind === "ok") changes.push(st.value);
    if (errors.length > 0) return fail(errors.map(errorText).join("\n"));
    const ok = await apply(changes, [], "Taking away what arcactl init put in");
    return finish(ok ? 0 : 1);
  }

  // ---- what can be reached
  const urlGiven = a.values.get("--url") ?? ((): string | undefined => {
    const r = secretOf(io.env, "ARCA_DATABASE_URL");
    return r.kind === "ok" ? r.value : undefined;
  })();
  const found = discover({ paths: P, env: io.env, ...(urlGiven === undefined ? {} : { url: urlGiven }), ...(a.switches.has("--local") ? { local: true } : {}), state, ...(io.env["ARCACTL_ROOT"] === undefined ? {} : { workspace: io.env["ARCACTL_ROOT"] as string }) });
  let candidates = [...found.candidates];
  const wanted = a.values.get("--instance") ?? (candidates.length === 1 && !a.switches.has("--discover") ? undefined : undefined);
  const looking = a.switches.has("--discover") || wanted === undefined;
  const rows: { c: Candidate; p: Probe | undefined }[] = [];
  for (const c of candidates) rows.push({ c, p: looking ? await probe(connect, c, passwordFor(P, c), a.values.get("--schema") ?? "arca") : undefined });
  if (looking) {
    say("Instances you can reach:");
    say(table(rows));
    if (found.configs.length > 0) say(`\nConfigurations under ARCACTL_ROOT: ${found.configs.join(", ")}`);
    say();
  }

  // ---- the instance
  let name = wanted ?? (prompt.interactive && rows.length > 0 ? await prompt.ask("Which instance is your default? (a name from the list, or a new one)", state.default ?? candidates[0]?.name) : undefined);
  name = name ?? state.default;
  let known: Known | undefined;
  let password: string | undefined;
  let writeService = false;
  if (name !== undefined) {
    const have = candidates.find((c) => c.name === name);
    const host = a.values.get("--host") ?? have?.host ?? (prompt.interactive ? await prompt.ask(`Host of ${name}?`) : undefined);
    if (host === undefined) return fail(`${name} is not a place arcactl knows, and no --host was given`);
    const portText = a.values.get("--port") ?? (have?.port === undefined ? undefined : String(have.port));
    const port = portText === undefined ? undefined : Number(portText);
    const env = a.values.get("--env") ?? state.instances.find((i) => i.name === name)?.env ?? (prompt.interactive ? await prompt.ask("What is it for? (dev, staging, prod)", "dev") : undefined);
    const models = a.values.get("--models")?.split(",").map((m) => m.trim()).filter((m) => m !== "");
    const bad = (models ?? []).find((m) => !(modelNames as readonly string[]).includes(m));
    if (bad !== undefined) return fail(`the model ${bad} is not one of: ${modelNames.join(", ")}`);
    const database = a.values.get("--database") ?? have?.database;
    const user = a.values.get("--user") ?? have?.user;
    const sslmode = a.values.get("--sslmode") ?? have?.sslmode;
    const schema = a.values.get("--schema") ?? state.instances.find((i) => i.name === name)?.schema;
    known = {
      name,
      host,
      ...(port === undefined ? {} : { port }),
      ...(database === undefined ? {} : { database }),
      ...(user === undefined ? {} : { user }),
      ...(sslmode === undefined ? {} : { sslmode }),
      ...(env === undefined ? {} : { env }),
      ...(schema === undefined ? {} : { schema }),
      ...(models === undefined ? (state.instances.find((i) => i.name === name)?.models === undefined ? {} : { models: state.instances.find((i) => i.name === name)?.models as readonly string[] }) : { models }),
    };
    const inst: Instance = { name, host, ...(port === undefined ? {} : { port }), ...(database === undefined ? {} : { database }), ...(user === undefined ? {} : { user }), ...(sslmode === undefined ? {} : { sslmode }), ...(schema === undefined ? {} : { schema }) };
    const errs = checkInstance(inst);
    if (errs.length > 0) return fail(errs.map(errorText).join("\n"));
    writeService = have?.userService !== true;
    if (a.switches.has("--password-stdin")) {
      if (io.stdin === undefined) return fail("--password-stdin needs standard input");
      password = (await io.stdin()).replace(/\r?\n$/, "");
    } else if (prompt.interactive && user !== undefined && passwordFor(P, { host, ...(port === undefined ? {} : { port }), ...(database === undefined ? {} : { database }), user }) === undefined) {
      const typed = await prompt.secret(`Password of ${user}@${host} (nothing to keep none)`);
      password = typed === undefined || typed === "" ? undefined : typed;
    }
    if (password !== undefined && user === undefined) return fail("a password needs --user, so that .pgpass can say whose it is");
  }
  const secrets = password === undefined ? [] : [password];

  // ---- the plan
  const targets = shellsWanted(a.values.get("--shell"), io);
  if (typeof targets === "string") return fail(targets);
  const changes: Change[] = [];
  const modes: { path: string; from: number; to: number }[] = [];
  const warnings: string[] = [];
  const errors: WriteError[] = [];
  const take = (r: { kind: "ok"; value: { changes: readonly Change[]; warnings: readonly string[]; modes: readonly { path: string; from: number; to: number }[] } } | { kind: "err"; error: readonly WriteError[] }): void => {
    if (r.kind === "err") errors.push(...r.error);
    else {
      changes.push(...r.value.changes);
      warnings.push(...r.value.warnings);
      modes.push(...r.value.modes);
    }
  };
  if (known !== undefined && password !== undefined && known.user !== undefined) {
    const cred: Credential = { host: known.host as string, port: String(known.port ?? 5432), database: known.database ?? "*", user: known.user, password };
    const ce = checkCredential(cred);
    if (ce.length > 0) return fail(ce.map(errorText).join("\n"));
    take(planPgpass(P, { set: [cred] }));
  }
  if (known !== undefined && writeService) {
    const ours = readInstances(P);
    if (ours.kind === "err") errors.push(...ours.error);
    else {
      const inst: Instance = { name: known.name, host: known.host as string, ...(known.port === undefined ? {} : { port: known.port }), ...(known.database === undefined ? {} : { database: known.database }), ...(known.user === undefined ? {} : { user: known.user }), ...(known.sslmode === undefined ? {} : { sslmode: known.sslmode }), ...(known.schema === undefined ? {} : { schema: known.schema }) };
      take(planServices(P, [...ours.value.filter((i) => i.name !== known?.name), inst]));
    }
  }
  if (!a.switches.has("--no-psql")) take(planPsql(P));
  if (known !== undefined) state = withInstance(state, { ...known, ...(writeService ? { ownsService: true } : {}) }, true);
  const installed: Installed[] = state.profiles.filter((p) => !targets.includes(p.shell));
  const current = state.instances.find((i) => i.name === state.default);
  for (const sh of targets) {
    const cache = cacheOf(P, sh);
    const cc = planWhole(cache, scriptFor(sh, P, current));
    if (cc.kind === "err") errors.push(cc.error);
    else changes.push(cc.value);
    const files = profileTargets(P.profiles[sh], existsSync);
    for (const f of files) {
      const b = planBlock(f, "shell", "#", { body: profileBody(sh, cache) });
      if (b.kind === "err") errors.push(b.error);
      else changes.push(b.value);
    }
    installed.push({ shell: sh, files, cache });
  }
  // the scripts already cached for the shells that stay are made again for the default
  for (const p of installed.filter((x) => !targets.includes(x.shell))) {
    const cc = planWhole(p.cache, scriptFor(p.shell, P, current));
    if (cc.kind === "ok") changes.push(cc.value);
  }
  state = { ...state, profiles: installed };
  const stateChange = planState(P, state);
  if (stateChange.kind === "err") errors.push(stateChange.error);
  else changes.push(stateChange.value);
  if (errors.length > 0) return fail(errors.map((e) => redact(errorText(e), secrets)).join("\n"));
  for (const w of warnings) say(`note: ${w}`);
  const done = await apply(changes, modes, "Setting up your workstation");
  if (!done) return finish(1);
  if (a.switches.has("--dry-run")) return finish(0);

  // ---- the checks
  say();
  say("Checking your workstation:");
  const report = await workstationChecks({ paths: P, state, connect, ...(io.psqlVersion === undefined ? {} : { psqlVersion: io.psqlVersion }) });
  for (const r of report.results) say(`  ${r.status === "pass" ? "PASS" : r.status === "warn" ? "WARN" : r.status === "fail" ? "FAIL" : "?   "}  ${r.id}  ${r.title}: ${redact(r.detail, secrets)}${r.next === undefined ? "" : `\n        next: ${r.next}`}`);
  return finish(report.code, { checks: report.results });
}
