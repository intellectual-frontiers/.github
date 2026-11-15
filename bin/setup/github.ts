// Git and GitHub (009-machine-bootstrap FR-044 to FR-050, FR-052, FR-101): the sign-in (a code and a browser), the token for this run, the check that this
// account can open erga, and the settings kept for every new terminal. No git config is written: the setup's own git calls name gh as the credential helper.
import { done, err, ok } from "../../commons/ts/kernel/result.ts";
import { plain } from "../../commons/ts/kernel/text.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
import * as path from "../../commons/ts/runtime/path.ts";
import * as proc from "../../commons/ts/runtime/proc.ts";
import { type Ctx, problem } from "./context.ts";
import { type Phase, stop } from "./stop.ts";
import { exists, run, sleep, succeeds, which } from "./proc.ts";
import { shortPath } from "./ui.ts";

const LOGIN = "GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https";

/** git as this setup calls it for GitHub: gh is the credential helper for the call, so that no git config of the person's is needed or written. */
export const gitGh = (args: readonly string[]): string[] => ["git", "-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential", ...args];

const haveGh = (ctx: Ctx) => which("gh") !== null || proc.isExecutable(`${ctx.opts.paths.bin}/gh`);
export const signedIn = async (): Promise<boolean> => which("gh") !== null && await succeeds(["gh", "auth", "status", "--hostname", "github.com"]);
const login = async (): Promise<string> => (await proc.firstLine(["gh", "api", "user", "--jq", ".login"])) || "unknown";

/** Not signed in: the one stop that is not an error, so it asks for nothing but a second try (exit status 5). */
function signInStop(ctx: Ctx): Phase {
  const e = ctx.ui.e;
  ctx.ui.say("");
  ctx.ui.say(`${e.key}The GitHub sign-in did not finish, so setup paused here.`);
  ctx.ui.say(`Nothing is wrong with your computer. The sign-in is needed because erga is private.`);
  ctx.ui.say("");
  ctx.ui.say(`${e.one}1. Type:  ${LOGIN}`);
  ctx.ui.say(`${e.two}2. Copy the code, open https://github.com/login/device in your normal browser, type it, click Authorize.`);
  ctx.ui.say(`${e.three}3. Run this setup again: it picks up where it left off.`);
  ctx.ui.say(`Still stuck? The log is ${ctx.ui.log.path === null ? "not written" : shortPath(ctx.opts.paths.home, ctx.ui.log.path)} ; send it to ${ctx.opts.support}.`);
  ctx.ui.say("");
  return stop({ kind: "sign-in", reason: "the GitHub sign-in did not finish" });
}

/** gh auth login without a terminal (it asks nothing and opens no browser), its one-time code shown here and repeated every half minute (FR-045, FR-046). */
async function interactiveLogin(ctx: Ctx): Promise<{ readonly signedIn: boolean; readonly shown: boolean; readonly output: string }> {
  let output = "";
  let finished = false;
  const child = run(["gh", "auth", "login", "--hostname", "github.com", "--web", "--git-protocol", "https"], {
    env: { GH_BROWSER: "true", BROWSER: "true" },
    onOutput: (t) => (output += t),
  }).then((r) => {
    finished = true;
    return r;
  });
  let shown = "", waited = 0;
  while (!finished) {
    const code = output.match(/[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0] ?? "";
    if (code !== "" && (shown === "" || waited % 30 === 0)) {
      ctx.ui.say("");
      ctx.ui.say(`${ctx.ui.e.wait}Waiting for you: open https://github.com/login/device in your browser and type this code: ${code}`);
      shown = code;
    }
    await Promise.race([child, sleep(1)]);
    waited++;
  }
  await child;
  ctx.ui.log.line(`gh auth login said: ${plain(output).replaceAll("\n", " ").replace(/[A-Z0-9]{4}-[A-Z0-9]{4}/g, "<code>")}`);
  return { signedIn: await signedIn(), shown: shown !== "", output };
}

export async function signIn(ctx: Ctx): Promise<Phase> {
  const ui = ctx.ui;
  ui.heading(`${ui.e.key}Signing in to GitHub (the one thing that needs you)`);
  if (!ctx.opts.switches.auth) {
    ui.say("Skipped (BOOTSTRAP_NO_AUTH=1).");
    return done;
  }
  if (ctx.opts.dryRun) {
    ui.would(`check that you are signed in to GitHub; if not, run: ${LOGIN} (a code to type into your own browser)`);
    ui.would("make gh git's credential helper for github.com, and set the name and email on your commits where git has none");
    ui.would("export the GitHub token (GH_TOKEN) to erga and the release lookups; with none, skip what comes from GitHub and list it at the end");
    return done;
  }
  if (!haveGh(ctx)) {
    ui.warn("gh, the tool that signs you in to GitHub, is not installed.");
    problem(ctx, "gh is not installed");
    return done;
  }
  const tokenVar = (ctx.env.GH_TOKEN ?? "") !== "" ? "GH_TOKEN" : (ctx.env.GITHUB_TOKEN ?? "") !== "" ? "GITHUB_TOKEN" : null;
  if (tokenVar !== null && await signedIn()) {
    ctx.st.signIn = "env";
    ui.say(`${ui.e.ok}Using the GitHub token in ${tokenVar}: no sign-in is needed.`);
    return done;
  }
  if (tokenVar !== null) {
    ui.say(`${ui.e.stop}GitHub did not accept the token in ${tokenVar}.`);
    ui.say(`Fix it (it needs the repo scope, and access to erga), or unset it: unset ${tokenVar}, to sign in by hand instead. Then run this setup again.`);
    problem(ctx, `the token in ${tokenVar} was not accepted by GitHub`);
    return stop({ kind: "sign-in", reason: `GitHub did not accept the token in ${tokenVar}` });
  }
  if (await signedIn()) {
    ctx.st.signIn = "gh";
    ui.say(`${ui.e.ok}You are signed in to GitHub.`);
    return done;
  }
  if (!ctx.hasTty) return signInStop(ctx);
  ui.say("");
  ui.say(`GitHub is where this organization keeps its work. erga is private: only people the owner added can open it.`);
  ui.say(`Need access? Press Ctrl+C, ask the owner, then run this setup again.`);
  ui.say("");
  ui.say(`${ui.e.key}Next, GitHub gives you a one-time code to type in your browser. After that, everything is automatic. ${ui.e.rocket}`);
  // the sign-in is a step of the telemetry, so the time a person takes is seen (FR-054); it shows its own lines, so the console does not draw it
  const l = await ctx.signals.telemetry.span(
    "bootstrap.step",
    { step: "GitHub sign-in", phase: "sign-in", step_no: ctx.st.stepNo, attended: true },
    async (span) => {
      const got = await interactiveLogin(ctx);
      span.set({ outcome: got.signedIn ? "ok" : "unfinished" });
      return got.signedIn ? ok(got) : err({ got, message: "the sign-in did not finish" });
    },
  ).then((r) => r.kind === "ok" ? r.value : r.error.got);
  if (!l.signedIn) {
    if (!l.shown) {
      ui.say("");
      ui.say(`GitHub's tool said:`);
      for (const line of plain(l.output).split("\n").filter((x) => x !== "").slice(-5)) ui.say(`     ${line.slice(0, ui.look.columns - 6)}`);
    }
    return signInStop(ctx);
  }
  ctx.st.signIn = "gh";
  return done;
}

/**
 * The token, exported to the programs started from here on (erga, gh), and whether there is one. Without one, what downloads from GitHub is skipped and listed:
 * unauthenticated, GitHub answers 403 and 429 after a few dozen requests.
 */
export async function githubInit(ctx: Ctx): Promise<void> {
  if (ctx.opts.dryRun) return;
  let tok = ctx.env.GH_TOKEN || ctx.env.GITHUB_TOKEN || "";
  if (tok === "" && which("gh") !== null) tok = (await run(["gh", "auth", "token"])).output.trim().split("\n")[0] ?? "";
  if (tok === "" || /\s/.test(tok)) {
    ctx.ui.warn(
      "There is no GitHub sign-in or token, so what is downloaded from GitHub is left until there is one (the programs of erga's toolchain). To get them: gh auth login, or export GH_TOKEN=<a token>, then run this again.",
    );
    return;
  }
  if ((proc.env.get("GH_TOKEN") ?? "") === "") proc.env.set("GH_TOKEN", tok);
  if ((proc.env.get("GITHUB_TOKEN") ?? "") === "") proc.env.set("GITHUB_TOKEN", tok);
  ctx.st.haveGithub = true;
}

export const githubReady = (ctx: Ctx): boolean => ctx.opts.dryRun || ctx.st.haveGithub;

/** Before anything is fetched: stop where GitHub says this sign-in cannot open erga (FR-050); a network failure alone does not stop it. */
export async function checkAccess(ctx: Ctx): Promise<Phase> {
  if (ctx.opts.dryRun) {
    if (ctx.opts.switches.clone) ctx.ui.would("check, before installing anything, that this GitHub sign-in can open the private erga repository");
    return done;
  }
  if (!ctx.opts.switches.clone || !ctx.st.haveGithub) return done;
  const url = ctx.opts.ergaUrl;
  const r = await run(gitGh(["ls-remote", url, "HEAD"]), { env: { GIT_TERMINAL_PROMPT: "0" } });
  if (r.code === 0) return done;
  if (/not found|Authentication failed|denied|403/i.test(r.output)) {
    ctx.ui.log.line(`no access to ${url}: ${r.output}`);
    ctx.ui.say(`${ctx.ui.e.stop}GitHub does not let this account open erga. erga is a private repository: only people the owner added can open it.`);
    ctx.ui.say(
      `Ask the owner of the intellectual-frontiers organization on GitHub to add the GitHub user you signed in as (${await login()}), then run this again. Nothing has been installed.`,
    );
    return stop({ kind: "sign-in", reason: "this account cannot open erga" });
  }
  ctx.ui.log.line(`could not check access to ${url} (a network problem?): ${r.output}`);
  return done;
}

/** What git lacks for a person's commits, said; no git config is written (FR-049, FR-101). */
export async function identity(ctx: Ctx): Promise<void> {
  if (!ctx.opts.switches.auth || ctx.opts.dryRun || which("git") === null) return;
  const name = await proc.firstLine(["git", "config", "--get", "user.name"]);
  const inGh = await signedIn();
  if (name === "") {
    const l = inGh ? await proc.firstLine(["gh", "api", "user", "--jq", ".login"]) : "";
    ctx.ui.say(
      `Git has no name for your commits yet. When you want one: git config --global user.name "Your Name"${l !== "" ? ` (your GitHub login is ${l})` : ""}.`,
    );
  }
  if (inGh) ctx.ui.say(`For your own git to use your GitHub sign-in: gh auth setup-git --hostname github.com. erga's own git calls need nothing set.`);
}

// ---- the settings kept for every new terminal: secrets.env, as `ergactl secrets` writes it (FR-052; erga's 011-secrets FR-009) ----

/** One NAME='value' of the secrets file (the last one counts), or undefined. */
export function secretOf(text: string, name: string): string | undefined {
  let v: string | undefined;
  for (const line of text.split("\n")) {
    if (line.startsWith(`${name}='`) && line.endsWith("'")) v = line.slice(name.length + 2, -1);
  }
  return v;
}

/** The file with NAME='VALUE' replaced where it is, else added; the first line `ergactl secrets` writes, byte for byte, where the file is new. */
export function withSecret(text: string | null, name: string, value: string): string {
  const base = text ?? "# Kept by `ergactl secrets`; change it with `ergactl secrets set` and `ergactl secrets remove`.\n";
  const lines = base.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = `${name}='${value}'`;
  else lines.push(`${name}='${value}'`);
  return `${lines.join("\n")}\n`;
}

/** Written privately (the folder 700, the file 600) and atomically. */
async function putSecret(file: string, name: string, value: string): Promise<boolean> {
  const dir = path.dirname(file);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.chmod(dir, 0o700);
    const old = exists(file) ? await fs.readTextFile(file) : null;
    const tmp = await fs.makeTempFile({ dir, prefix: ".secrets." });
    await fs.chmod(tmp, 0o600);
    await fs.writeTextFile(tmp, withSecret(old, name, value));
    await fs.rename(tmp, file);
    return true;
  } catch {
    return false;
  }
}

export async function keepSettings(ctx: Ctx): Promise<void> {
  const ui = ctx.ui;
  const names = ["ERGA_SIGNALS_URL", "ERGA_SIGNALS_TOKEN", "ERGA_PERSON"].filter((n) => (ctx.env[n] ?? "") !== "");
  if (!ctx.opts.dryRun && ctx.st.signIn === "gh") {
    // signed in with gh (now or before): gh keeps the login for this user and is git's credential helper, so it lasts
    const user = await proc.firstLine(["id", "-un"]) || "you";
    ui.say(
      `🔐 Your GitHub sign-in is kept on this computer. gh stores it for your Linux user (${user}) in its own private store (the system keyring, or ~/.config/gh/hosts.yml that only you can read),`,
    );
    ui.say("   and git uses it, so every new terminal, git and erga reach GitHub without asking you again. It is not shared and nothing was sent to anyone else.");
    ui.say(`   To remove it: gh auth logout --hostname github.com (or revoke it at https://github.com/settings/applications).`);
  } else if (!ctx.opts.dryRun && ((ctx.env.GH_TOKEN ?? "") !== "" || (ctx.env.GITHUB_TOKEN ?? "") !== "")) {
    const v = (ctx.env.GH_TOKEN ?? "") !== "" ? "GH_TOKEN" : "GITHUB_TOKEN";
    ui.say(`🔑 The GitHub token in ${v} was used for this setup only: it lives in this terminal's environment and is not saved.`);
    ui.say(`   To keep it for every terminal: ergactl secrets set GH_TOKEN. Or sign in once with gh auth login, and gh keeps the sign-in for you.`);
  }
  if (names.length === 0) return;
  const file = ctx.opts.paths.secretsFile;
  ui.phase(`${ui.e.key}Keeping your ArcaSignals settings for new terminals (${shortPath(ctx.opts.paths.home, file)}, private to you)`);
  if (ctx.opts.dryRun) {
    ui.would(
      `keep ${names.join(", ")} in ${
        shortPath(ctx.opts.paths.home, file)
      } (mode 600); the one line of ergactl agent-tools shell emit makes your shells read it in every new terminal`,
    );
    return;
  }
  for (const n of names) {
    const v = ctx.env[n] ?? "";
    if (/['"\n]/.test(v)) {
      ui.warn(`${n} holds a quote or a line break, which the file cannot keep (ergactl secrets refuses them too), so it was not saved.`);
      problem(ctx, `${n} was not saved`);
      continue;
    }
    if (!(await putSecret(file, n, v))) {
      ui.warn(`${n} could not be saved in ${shortPath(ctx.opts.paths.home, file)}.`);
      problem(ctx, `${n} was not saved`);
      continue;
    }
    ui.log.line(`kept ${n} in ${file}`);
  }
}
