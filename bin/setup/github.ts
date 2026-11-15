// Git and GitHub (009-machine-bootstrap FR-044 to FR-050, FR-052, FR-101): the sign-in (a code and a browser), the token for this run, the check that this
// account can open erga, and the settings kept for every new terminal. No git config is written: the setup's own git calls name gh as the credential helper.
import { type Ctx, problem } from "./context.ts";
import { done, type Phase, stop } from "./result.ts";
import { exists, firstLine, isExecutable, run, sleep, succeeds, which } from "./proc.ts";
import { plain, shortPath } from "./ui.ts";

const LOGIN = "GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https";

/** git as this setup calls it for GitHub: gh is the credential helper for the call, so that no git config of the person's is needed or written. */
export const gitGh = (args: readonly string[]): string[] => ["git", "-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential", ...args];

const haveGh = (ctx: Ctx) => which("gh") !== null || isExecutable(`${ctx.opts.paths.bin}/gh`);
export const signedIn = async (): Promise<boolean> => which("gh") !== null && await succeeds(["gh", "auth", "status", "--hostname", "github.com"]);
const login = async (): Promise<string> => (await firstLine(["gh", "api", "user", "--jq", ".login"])) || "unknown";

/** Not signed in: the one stop that is not an error, so it asks for nothing but a second try (exit status 5). */
function signInStop(ctx: Ctx): Phase {
  const { y, b, z, d, c, g } = ctx.ui.p;
  const e = ctx.ui.e;
  ctx.ui.say("");
  ctx.ui.say(`${y}${b}${e.key}The GitHub sign-in did not finish, so setup paused here.${z}`);
  ctx.ui.say(`${d}Nothing is wrong with your computer. The sign-in is needed because erga is private.${z}`);
  ctx.ui.say("");
  ctx.ui.say(`${c}${e.one}1.${z} Type:  ${b}${LOGIN}${z}`);
  ctx.ui.say(`${c}${e.two}2.${z} Copy the code, open ${b}https://github.com/login/device${z} in your normal browser, type it, click ${g}${b}Authorize${z}.`);
  ctx.ui.say(`${c}${e.three}3.${z} Run this setup again: it picks up where it left off.`);
  ctx.ui.say(`${d}Still stuck? The log is ${ctx.ui.log.path === null ? "not written" : shortPath(ctx.opts.paths.home, ctx.ui.log.path)} ; send it to ${ctx.opts.support}.${z}`);
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
      const { y, b, z } = ctx.ui.p;
      ctx.ui.say("");
      ctx.ui.say(`${y}${b}${ctx.ui.e.wait}Waiting for you:${z} open ${b}https://github.com/login/device${z} in your browser and type this code: ${y}${b}${code}${z}`);
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
  const { g, z, b, r, d } = ui.p;
  ui.heading(`${ui.e.key}Signing in to GitHub ${d}(the one thing that needs you)${z}`);
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
    ui.say(`${g}${ui.e.ok}Using the GitHub token in ${z}${b}${tokenVar}${z}${g}: no sign-in is needed.${z}`);
    return done;
  }
  if (tokenVar !== null) {
    ui.say(`${r}${b}${ui.e.stop}GitHub did not accept the token in${z} ${b}${tokenVar}${z}${r}.${z}`);
    ui.say(`Fix it (it needs the ${b}repo${z} scope, and access to erga), or unset it: ${b}unset ${tokenVar}${z}, to sign in by hand instead. Then run this setup again.`);
    problem(ctx, `the token in ${tokenVar} was not accepted by GitHub`);
    return stop({ kind: "sign-in", reason: `GitHub did not accept the token in ${tokenVar}` });
  }
  if (await signedIn()) {
    ctx.st.signIn = "gh";
    ui.say(`${g}${ui.e.ok}You are signed in to GitHub.${z}`);
    return done;
  }
  if (!ctx.hasTty) return signInStop(ctx);
  ui.say("");
  ui.say(`${d}GitHub is where this organization keeps its work. erga is ${z}${b}private${z}${d}: only people the owner added can open it.`);
  ui.say(`Need access? Press Ctrl+C, ask the owner, then run this setup again.${z}`);
  ui.say("");
  ui.say(`${ui.p.c}${ui.e.key}Next, GitHub gives you a one-time code to type in your browser.${z} ${g}${b}After that, everything is automatic.${z} ${ui.e.rocket}`);
  const t0 = Date.now();
  const l = await interactiveLogin(ctx);
  ctx.signals.event("bootstrap_step", { step: "GitHub sign-in", phase: "sign-in", outcome: l.signedIn ? "ok" : "unfinished", duration_ms: Date.now() - t0, attended: "yes" });
  if (!l.signedIn) {
    if (!l.shown) {
      ui.say("");
      ui.say(`${d}GitHub's tool said:${z}`);
      for (const line of plain(l.output).split("\n").filter((x) => x !== "").slice(-5)) ui.say(`     ${line.slice(0, ui.look.cols - 6)}`);
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
  if ((Deno.env.get("GH_TOKEN") ?? "") === "") Deno.env.set("GH_TOKEN", tok);
  if ((Deno.env.get("GITHUB_TOKEN") ?? "") === "") Deno.env.set("GITHUB_TOKEN", tok);
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
    const { r: red, b, z } = ctx.ui.p;
    ctx.ui.say(`${red}${b}${ctx.ui.e.stop}GitHub does not let this account open erga.${z} erga is a private repository: only people the owner added can open it.`);
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
  const { d, z, b } = ctx.ui.p;
  const name = await firstLine(["git", "config", "--get", "user.name"]);
  const inGh = await signedIn();
  if (name === "") {
    const l = inGh ? await firstLine(["gh", "api", "user", "--jq", ".login"]) : "";
    ctx.ui.say(
      `${d}Git has no name for your commits yet. When you want one: ${z}${b}git config --global user.name "Your Name"${z}${d}${
        l !== "" ? ` (your GitHub login is ${l})` : ""
      }.${z}`,
    );
  }
  if (inGh) ctx.ui.say(`${d}For your own git to use your GitHub sign-in: ${z}${b}gh auth setup-git --hostname github.com${z}${d}. erga's own git calls need nothing set.${z}`);
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
  const dir = file.replace(/\/[^/]*$/, "");
  try {
    await Deno.mkdir(dir, { recursive: true });
    await Deno.chmod(dir, 0o700);
    const old = exists(file) ? await Deno.readTextFile(file) : null;
    const tmp = await Deno.makeTempFile({ dir, prefix: ".secrets." });
    await Deno.chmod(tmp, 0o600);
    await Deno.writeTextFile(tmp, withSecret(old, name, value));
    await Deno.rename(tmp, file);
    return true;
  } catch {
    return false;
  }
}

export async function keepSettings(ctx: Ctx): Promise<void> {
  const ui = ctx.ui;
  const { g, z, d } = ui.p;
  const names = ["ERGA_SIGNALS_URL", "ERGA_SIGNALS_TOKEN", "ERGA_PERSON"].filter((n) => (ctx.env[n] ?? "") !== "");
  if (!ctx.opts.dryRun && ctx.st.signIn === "gh") {
    // signed in with gh (now or before): gh keeps the login for this user and is git's credential helper, so it lasts
    const user = await firstLine(["id", "-un"]) || "you";
    ui.say(
      `${g}🔐 Your GitHub sign-in is kept on this computer.${z}${d} gh stores it for your Linux user (${user}) in its own private store (the system keyring, or ~/.config/gh/hosts.yml that only you can read),`,
    );
    ui.say("   and git uses it, so every new terminal, git and erga reach GitHub without asking you again. It is not shared and nothing was sent to anyone else.");
    ui.say(`   To remove it: gh auth logout --hostname github.com (or revoke it at https://github.com/settings/applications).${z}`);
  } else if (!ctx.opts.dryRun && ((ctx.env.GH_TOKEN ?? "") !== "" || (ctx.env.GITHUB_TOKEN ?? "") !== "")) {
    const v = (ctx.env.GH_TOKEN ?? "") !== "" ? "GH_TOKEN" : "GITHUB_TOKEN";
    ui.say(`${d}🔑 The GitHub token in ${v} was used for this setup only: it lives in this terminal's environment and is not saved.`);
    ui.say(`   To keep it for every terminal: ergactl secrets set GH_TOKEN. Or sign in once with gh auth login, and gh keeps the sign-in for you.${z}`);
  }
  if (names.length === 0) return;
  const file = ctx.opts.paths.secretsFile;
  ui.phase(`${ui.e.key}Keeping your ArcaSignals settings for new terminals ${d}(${shortPath(ctx.opts.paths.home, file)}, private to you)${z}`);
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
