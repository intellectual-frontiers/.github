// Spec: 0006-agents FR-009, FR-011, FR-018, FR-022, FR-036, FR-038
/**
 * `ergonex agent brief|init|doctor|keys line|register|jobs` (commons ergonex 0006-agents): what a harness given a machine needs to find its way. `brief` is the map of the workspace; `init` writes the files
 * of one harness without touching what is not its own; `doctor` says what is missing; `keys line` prints the forced-command line for a key; `register` declares the machine as a workstation of the estate.
 * `jobs` is in `jobs.ts`.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { authorizedKeysLine, matchBlock } from "@intellectual-frontiers/headless/ssh-inbound";
import { flag, value } from "../platform/k-args.ts";
import { existsSync, mkdir, readTextFile, readTextOr, writeTextFile } from "../platform/r-fs.ts";
import { join } from "../platform/r-path.ts";
import { run, which, execPath } from "../platform/r-proc.ts";
import type { Finding } from "../findings.ts";
import { loadWorkspace, loadFailureOutcome, AREA } from "../host/workspace.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { type Json } from "@intellectual-frontiers/formats";
import { briefInput, thisDistro } from "../agents/host/gather.ts";
import { renderBrief } from "../agents/brief.ts";
import { adapterOf } from "../agents/host/adapters/index.ts";
import { runSteps, type InitSite } from "../agents/host/adapters/port.ts";
import { HARNESSES, isHarness } from "../agents/persona.ts";
import { AGENT_COMMANDS, type AgentsPolicy } from "../agents/policy.ts";
import { configHomeOf, describeTokenError, findToken, REDACTED } from "../agents/host/token-source.ts";
import { sha256Of } from "@intellectual-frontiers/crypto";
import { handshakeInput, readHandshake } from "../agents/mcp-probe.ts";
import { disposableRecommendation } from "../agents/distro.ts";
import { jobsOf } from "../agents/host/jobs.ts";
import { defineCommand } from "./define.ts";
import { changes, HOME, reads } from "./options.ts";
import { jsonOf } from "./common.ts";
import { dirname, fromFileUrl } from "../platform/r-path.ts";

const LAUNCHER = join(dirname(fromFileUrl(import.meta.url)), "..", "..", "bin", "ergonex.mjs");

const finding = (ctx: Context, ruleId: string, severity: Finding["severity"], message: string, subject: string): Finding => ({ ruleId, severity, message, subject, firstSeen: ctx.today });

/** The absolute path of the installed `ergonex`: the option, else the program on the `PATH`. */
export function ergonexPathOf(option: string | undefined): string | undefined {
  return option !== undefined && option !== "" ? option : which("ergonex");
}

const brief = defineCommand({
  name: "brief",
  summary: "Give the map of the workspace for an agent: its repositories, tools, hooks, policy and what the persona may run; it changes nothing.",
  options: { ...HOME, format: value({ help: "The text form: md (the default) or json; --json gives the JSON envelope.", valueName: "FORMAT" }) },
  examples: [
    { args: [], says: "Give the brief as Markdown." },
    { args: ["--json"], says: "Give the brief as data." },
  ],
  action: reads(),
  run: (ctx, args) => {
    const format = args.options.format ?? "md";
    if (format !== "md" && format !== "json") return Promise.resolve(err({ kind: "usage", message: `${JSON.stringify(format)} is not a format of the brief: md or json` }));
    return loadWorkspace(ctx).then(async (loaded): Promise<Outcome> => {
      if (loaded.kind === "err") return loadFailureOutcome(loaded.error, ctx);
      const made = renderBrief(await briefInput(loaded.value, ctx.identity));
      const data = jsonOf(made.brief);
      return ok({ text: format === "md" ? made.markdown.replace(/\n$/, "") : JSON.stringify(data), data, findings: [] });
    });
  },
});

const INIT_OPTIONS = {
    ...HOME,
    scope: value({ help: "user (the harness's files in your home) or project (the working folder's); project is the default.", valueName: "SCOPE" }),
    ergonexPath: value({ help: "The absolute path of the installed ergonex, written into the files (else the one on the PATH).", valueName: "FILE" }),
};

const init = defineCommand({
  name: "init",
  summary: "Write the files of one harness (--harness): the brief, the tool server and the session hook, each merged and never replaced; run twice it changes nothing.",
  options: INIT_OPTIONS,
  examples: [
    { args: ["--harness", "claude-code", "--dry-run"], says: "Say what would be written for Claude Code and write nothing." },
    { args: ["--harness", "codex", "--scope", "user"], says: "Write the user-level files of Codex." },
  ],
  action: changes({ idempotent: true, dryRun: true }),
  run: async (ctx, args) => {
    const scope = args.options.scope ?? "project";
    if (scope !== "user" && scope !== "project") return err({ kind: "usage", message: `${JSON.stringify(scope)} is not a scope: user or project` });
    const harness = ctx.globals.harness ?? ctx.env["ERGONEX_HARNESS"] ?? "";
    if (!isHarness(harness)) return err({ kind: "usage", message: `agent init takes --harness ${HARNESSES.join(", ")}` });
    const path = ergonexPathOf(args.options.ergonexPath);
    if (path === undefined) return err({ kind: "environment", message: "ergonex is not on the PATH: give --ergonex-path, or install it first" });
    const home = ctx.env["HOME"] ?? ctx.env["USERPROFILE"];
    if (home === undefined || home === "") return err({ kind: "environment", message: "no home folder can be found: HOME is not set" });
    const loaded = await loadWorkspace(ctx);
    if (loaded.kind === "err") return loadFailureOutcome(loaded.error, ctx);
    const made = renderBrief(await briefInput(loaded.value, ctx.identity));
    const site: InitSite = {
      scope,
      home,
      folder: ctx.cwd,
      ergonexPath: path,
      brief: made.markdown,
      distro: await thisDistro(),
      which,
      run: (argv, cwd) => run(argv, { ...(cwd === undefined ? {} : { cwd }), env: { HOME: home } }),
    };
    const steps = await adapterOf(harness).steps(site);
    const results = await runSteps(site, steps, ctx.mode === "apply");
    const failed = results.filter((r) => r.outcome === "failed");
    const findings = failed.map((r) => finding(ctx, "ergonex/agent-doctor", "Error", `${r.what}: ${r.detail ?? "failed"}`, r.target));
    const changed = results.filter((r) => r.outcome === "changed" || r.outcome === "would-change").length;
    const lines = results.map((r) => `${r.outcome.padEnd(12)} ${r.what}: ${r.target}${r.detail === undefined ? "" : ` (${r.detail})`}`);
    return ok({
      text: [...lines, changed === 0 && failed.length === 0 ? "unchanged: nothing needed to change" : ""].filter((l) => l !== "").join("\n"),
      data: jsonOf({ harness, scope, distro: site.distro.id, results }),
      findings,
    });
  },
});

const isoOrUndefined = (s: string): number | undefined => {
  const t = Date.parse(s.trim());
  return Number.isNaN(t) ? undefined : t;
};

/** Whether this machine is a virtual machine or a container: `systemd-detect-virt` where it exists, and the marker files of a container. */
async function virtOf(): Promise<string> {
  if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) return "container";
  if (which("systemd-detect-virt") === undefined) return "none";
  const r = await run(["systemd-detect-virt"]);
  const word = r.stdout.trim();
  return r.success && word !== "" && word !== "none" ? word : "none";
}

const doctor = defineCommand({
  name: "doctor",
  summary: "Say what an agent needs that this machine lacks: the token, the Git identity, the tools, the harnesses, the configuration, the tool server and the jobs; it changes nothing.",
  options: { ...HOME, offline: flag({ help: "Do not ask the network whether the registry and the Git host answer." }) },
  action: reads(),
  run: async (ctx, args) => {
    const findings: Finding[] = [];
    const info = (rule: string, message: string, subject: string): number => findings.push(finding(ctx, rule, "Informational", message, subject));
    const warn = (message: string, subject: string): number => findings.push(finding(ctx, "ergonex/agent-doctor", "Warning", message, subject));
    const facts: Record<string, Json> = {};
    // the token (FR-007, FR-018)
    const token = await findToken({ env: ctx.env, configHome: configHomeOf(ctx.env) });
    if (token.kind === "err") warn(describeTokenError(token.error), "token");
    else if (token.value === undefined) warn("no token is set: give one in ERGONEX_GITHUB_TOKEN, in the file ERGONEX_GITHUB_TOKEN_FILE names, or in ergonex/token of the configuration folder", "token");
    else {
      facts["token"] = token.value.origin;
      info("ergonex/agent-doctor", `a token is set (from ${token.value.origin}); its value is never shown (${REDACTED})`, "token");
      if (token.value.origin === "environment" && ctx.identity.persona === "agent") warn("the token is in the environment of an agent, which is an ambient secret: keep it in a file of mode 0600 (ERGONEX_GITHUB_TOKEN_FILE) instead", "token");
      if (token.value.path !== undefined) {
        const expiry = await readTextOr(`${token.value.path}.expires`, undefined);
        const at = expiry === undefined ? undefined : isoOrUndefined(expiry);
        if (at !== undefined) {
          const left = Math.round((at - Date.parse(`${ctx.today}T00:00:00Z`)) / 60000);
          if (at <= Date.now()) warn("the token has expired: refresh it with `ergonex remote token refresh`", "token");
          else info("ergonex/agent-doctor", `the token expires at ${new Date(at).toISOString()} (${left < 0 ? 0 : left} minutes after midnight UTC today)`, "token");
        }
      }
    }
    const loaded = await loadWorkspace(ctx);
    let policy: AgentsPolicy | undefined;
    if (loaded.kind === "err") warn("the workspace cannot be loaded, so its repositories, tools and configuration were not checked: run `ergonex doctor`", "workspace");
    else {
      policy = loaded.value.manifest.agents;
      // the Git identity (FR-008)
      const commit = policy?.commit;
      if (commit === undefined) info("ergonex/agent-doctor", "the agents policy gives no commit identity", "identity");
      else {
        for (const r of loaded.value.manifest.repositories) {
          const folder = join(loaded.value.home, r.path);
          if (!existsSync(join(folder, ".git"))) continue;
          const email = await run(["git", "-C", folder, "config", "--local", "user.email"]);
          if (email.stdout.trim() !== commit.email) warn(`${r.path} has no commit identity of the policy (user.email is not ${commit.email}): run \`ergonex apply\``, r.path);
        }
      }
      const missing = loaded.value.manifest.catalog.tools.filter((t) => !t.provides.some((p) => which(p) !== undefined));
      if (missing.length > 0) warn(`pinned tools not on the PATH: ${missing.map((t) => t.name).join(", ")}`, "tools");
      else info("ergonex/agent-doctor", `${loaded.value.manifest.catalog.tools.length} pinned tools, all on the PATH`, "tools");
    }
    // the network (FR-018)
    if (args.options.offline !== true) {
      for (const url of ["https://github.com", "https://npm.pkg.github.com"]) {
        try {
          const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
          info("ergonex/agent-doctor", `${url} answers (${res.status})`, url);
        } catch (e) {
          warn(`${url} does not answer: ${e instanceof Error ? e.message : String(e)}`, url);
        }
      }
    }
    // the harnesses and their versions
    const found: string[] = [];
    for (const h of ["claude", "codex", "herdr"]) {
      const p = which(h);
      if (p === undefined) continue;
      const v = await run([p, "--version"]).catch(() => undefined);
      found.push(h);
      info("ergonex/agent-doctor", `${h} is installed${v?.success === true ? ` (${v.stdout.trim().split("\n")[0] ?? ""})` : ""}`, h);
    }
    facts["harnesses"] = found;
    if (found.length === 0) warn("no harness (claude, codex or herdr) is on the PATH", "harnesses");
    // the configuration that agent init wrote
    const home = ctx.env["HOME"];
    const path = ergonexPathOf(undefined);
    if (loaded.kind === "ok" && home !== undefined && path !== undefined && isHarness(ctx.identity.harness)) {
      const made = renderBrief(await briefInput(loaded.value, ctx.identity));
      const site: InitSite = { scope: "project", home, folder: ctx.cwd, ergonexPath: path, brief: made.markdown, distro: await thisDistro(), which, run: (argv, cwd) => run(argv, cwd === undefined ? {} : { cwd }) };
      const steps = await adapterOf(ctx.identity.harness).steps(site);
      const results = await runSteps(site, steps, false);
      const stale = results.filter((r) => r.outcome === "would-change");
      if (stale.length > 0) warn(`the configuration of ${ctx.identity.harness} is not as \`agent init\` writes it now: ${stale.map((r) => r.target).join(", ")}`, ctx.identity.harness);
      else if (steps.length > 0) info("ergonex/agent-doctor", `the configuration of ${ctx.identity.harness} agrees with the brief`, ctx.identity.harness);
    }
    // the tool server answers a handshake (FR-018)
    {
      const server = path !== undefined ? [path, "mcp"] : [execPath(), LAUNCHER, "mcp"];
      const r = await run(server, { input: handshakeInput("ergonex-doctor"), env: { ERGONEX_PERSONA: "agent" } }).catch((e: unknown) => ({ success: false, stdout: "", stderr: String(e) }));
      const hs = readHandshake(r.stdout);
      if (hs.kind === "ok") info("ergonex/agent-doctor", `ergonex mcp answers a handshake (protocol ${hs.value.protocolVersion}, ${hs.value.tools.length} tools)`, "mcp");
      else warn(`ergonex mcp does not answer a handshake: ${hs.error}`, "mcp");
      if (path === undefined) warn("ergonex is not on the PATH, so the handshake was made with the program that is running now", "mcp");
    }
    // jobs (FR-024)
    if (loaded.kind === "ok") {
      const jobs = await jobsOf(loaded.value.home);
      const bad = jobs.filter((j) => j.state === "abandoned" || j.state === "failed");
      facts["jobs"] = jobs.length;
      if (bad.length > 0) warn(`${bad.length} job(s) abandoned or failed: ${bad.map((j) => j.id).join(", ")}`, "jobs");
      else info("ergonex/agent-doctor", `${jobs.length} job(s), none abandoned or failed`, "jobs");
    }
    // disposable (FR-019)
    const virt = await virtOf();
    const distro = await thisDistro();
    const disposable = policy?.disposable === true || virt !== "none";
    facts["virt"] = virt;
    facts["disposable"] = disposable;
    info("ergonex/agent-doctor", disposable ? `this machine is a disposable environment (${policy?.disposable === true ? "the policy says so" : virt})` : "this machine is not declared disposable and no virtual machine or container was detected", "disposable");
    const advice = disposableRecommendation(distro, disposable);
    if (advice !== undefined) info("ergonex/agent-doctor", advice, "disposable");
    const text = findings.map((f) => `${f.severity.toLowerCase().padEnd(13)} ${f.subject}: ${f.message}`).join("\n");
    return ok({ text, data: jsonOf({ ...facts, persona: ctx.identity.persona, harness: ctx.identity.harness }), findings });
  },
});

const KEYS_OPTIONS = {
    ...HOME,
    publicKey: value({ help: "The file that holds one public key line.", valueName: "FILE" }),
    role: value({ help: "read-only or full.", valueName: "ROLE" }),
    user: value({ help: "The account the key logs in as (for the Match block).", valueName: "USER" }),
    ergonexPath: value({ help: "The absolute path of ergonex on the machine the key reaches (else the one on the PATH).", valueName: "FILE" }),
};

const keysLine = defineCommand({
  name: "line",
  summary: "Print the authorized_keys line that forces a key to `ergonex mcp`, and the Match block of sshd_config; it writes no file.",
  options: KEYS_OPTIONS,
  action: reads(),
  run: async (ctx, args) => {
    const file = args.options.publicKey;
    const role = args.options.role;
    if (file === undefined || (role !== "read-only" && role !== "full")) return err({ kind: "usage", message: "agent keys line takes --public-key FILE and --role read-only|full" });
    const text = (await readTextFile(file).catch(() => undefined))?.trim();
    if (text === undefined) return err({ kind: "environment", message: `${file} cannot be read` });
    const program = ergonexPathOf(args.options.ergonexPath) ?? "ergonex";
    const line = authorizedKeysLine({ program, mode: "mcp", key: { name: "agent", publicKey: text, role } });
    // a text that is not one public key line is refused, and no part of it is named (FR-022)
    if (line.kind === "err") return err({ kind: "usage", message: "the file does not hold one public key line" });
    const user = args.options.user ?? ctx.env["USER"] ?? "agent";
    const block = matchBlock({ user });
    if (block.kind === "err") return err({ kind: "usage", message: block.error });
    return ok({ text: `# authorized_keys of ${user}\n${line.value}\n\n# sshd_config\n${block.value}`, data: jsonOf({ authorizedKeys: line.value, match: block.value }), findings: [], noEvidence: false });
  },
});

const REGISTER_ID = /^[a-z][a-z0-9-]{0,62}$/;

const REGISTER_OPTIONS = {
    ...HOME,
    tenant: value({ help: "The folder of the tenant repository.", valueName: "DIR" }),
    fleet: value({ help: "The fleet the host belongs to.", valueName: "FLEET" }),
    id: value({ help: "The name of the host (else the hostname).", valueName: "NAME" }),
    state: value({ help: "The state of the asset (adopted unless given).", valueName: "STATE" }),
};

const register = defineCommand({
  name: "register",
  summary: "Declare this machine as a workstation of the estate: the host file of a tenant's fleet, written whole and never over other content.",
  options: REGISTER_OPTIONS,
  action: changes({ idempotent: true, dryRun: true }),
  run: async (ctx, args) => {
    const tenant = args.options.tenant;
    const fleet = args.options.fleet;
    if (tenant === undefined || fleet === undefined) return err({ kind: "usage", message: "agent register takes --tenant DIR and --fleet FLEET" });
    const id = args.options.id ?? (await run(["hostname"])).stdout.trim().toLowerCase();
    if (!REGISTER_ID.test(id) || !REGISTER_ID.test(fleet)) return err({ kind: "usage", message: "a fleet and a host are named in lower case letters, digits and hyphens, beginning with a letter" });
    const state = args.options.state ?? "adopted";
    if (!/^[a-z][a-z-]*$/.test(state)) return err({ kind: "usage", message: `${JSON.stringify(state)} is not a state` });
    const distro = await thisDistro();
    const osRelease = await readTextOr("/etc/os-release", "");
    const family = /^ID_LIKE=(?:"?)([a-z0-9._-]+)/m.exec(osRelease)?.[1] ?? distro.osId;
    const loaded = await loadWorkspace(ctx);
    const policy = loaded.kind === "ok" ? loaded.value.manifest.agents : undefined;
    const digest = policy === undefined ? undefined : sha256Of(await digestOf(policy));
    const harnesses = ["claude", "codex", "herdr"].filter((h) => which(h) !== undefined).map((h) => (h === "claude" ? "claude-code" : h));
    const attributes: Record<string, Json> = {
      coordinator: (await import("../state-record.ts")).ERGONEX_VERSION,
      persona: ctx.identity.persona,
      harnesses,
      "agents-policy": policy === undefined ? "none" : `sha256:${await digestOf(policy)}`,
      "os-family": family,
      distro: distro.osId,
    };
    void digest;
    const text = [
      `// Declared by \`ergonex agent register\`: the asset of origin self that this machine says it is.`,
      `export const ${id.replaceAll("-", "_")} = ${JSON.stringify({ kind: "workstation", state, origin: "self", owners: { observe: "ergonex", verify: "ergonex" }, attributes }, null, 2)};`,
      "",
    ].join("\n");
    const target = join(tenant, "fleets", fleet, "hosts", `${id}.ts`);
    const old = await readTextOr(target, undefined);
    if (old !== undefined && old !== text) return err({ kind: "environment", message: `${target} exists with other content; it is never overwritten` });
    if (old === text) return ok({ text: `unchanged: ${target}`, data: jsonOf({ target, changed: false }), findings: [] });
    if (ctx.mode === "apply") {
      await mkdir(join(tenant, "fleets", fleet, "hosts"), { recursive: true });
      await writeTextFile(target, text, { createNew: true });
    }
    return ok({ text: `${ctx.mode === "apply" ? "wrote" : "would write"} ${target}`, data: jsonOf({ target, changed: ctx.mode === "apply", attributes }), findings: [] });
  },
});

async function digestOf(policy: AgentsPolicy): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(policy, Object.keys(policy).sort()));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The commands of the branch `agent` that this file holds; `jobs` is declared in `jobs.ts`. */
export const agentCommands = { brief, init, doctor, keysLine, register };
export { AGENT_COMMANDS, AREA, execPath };
