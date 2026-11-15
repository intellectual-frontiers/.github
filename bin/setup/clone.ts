// The workspaces folder and the copy of erga (009-machine-bootstrap FR-051): cloned beside its place and moved in whole, so that a try again starts clean; an
// existing copy is updated by fast-forward only, and a copy with work in it is left exactly as it is.
import { type Ctx, problem } from "./context.ts";
import { isDir, run, which } from "./proc.ts";
import { retryCommand } from "./net.ts";
import { stepSoft, task } from "./steps.ts";
import { gitGh } from "./github.ts";

export async function workspaceAndClone(ctx: Ctx): Promise<void> {
  const ui = ctx.ui;
  const { workspaces, target } = ctx.opts.paths;
  const url = ctx.opts.ergaUrl;
  ui.heading(`${ui.e.dir}Your workspace`);
  if (ctx.opts.dryRun) {
    ui.would(`create ${workspaces}/github.com/intellectual-frontiers`);
    if (ctx.opts.switches.clone) ui.would(isDir(`${target}/.git`) ? `update ${target} by fast-forward only` : `copy ${url} to ${target}`);
    return;
  }
  await Deno.mkdir(`${workspaces}/github.com/intellectual-frontiers`, { recursive: true });
  ui.say(`Your workspaces folder is ${workspaces}.`);
  if (!ctx.opts.switches.clone) {
    ui.say("Skipped the copy of erga (BOOTSTRAP_NO_CLONE=1).");
    return;
  }
  if (which("git") === null) {
    problem(ctx, "git is not installed, so erga was not copied");
    return;
  }
  const noPrompt = { GIT_TERMINAL_PROMPT: "0" };
  if (isDir(`${target}/.git`)) {
    const fetched = await stepSoft(
      ctx,
      `${ui.e.sync}Checking erga for news`,
      task(async (out) =>
        (await retryCommand(ctx.retries, "updating erga from GitHub", gitGh(["-C", target, "fetch", "--quiet", "origin"]), { env: noPrompt, onOutput: out })).code
      ),
    );
    if (fetched === 0) {
      if ((await run(["git", "-C", target, "merge", "--ff-only", "--quiet", "@{upstream}"])).code !== 0) ui.say("Your copy of erga was left exactly as it was; your work is safe.");
    } else {
      ui.say(`Could not reach ${url}, so your copy was left as it was; your work is safe.`);
    }
    ctx.st.cloned = true;
    return;
  }
  await Deno.mkdir(target.replace(/\/[^/]*$/, ""), { recursive: true });
  const partial = `${target}.partial`;
  const cloned = await stepSoft(
    ctx,
    `${ui.e.dir}Copying erga`,
    task(async (out) => {
      const clean = () => Deno.remove(partial, { recursive: true }).catch(() => {});
      const r = await retryCommand(ctx.retries, "copying erga from GitHub", gitGh(["clone", "--quiet", url, partial]), { env: noPrompt, onOutput: out }, clean);
      if (r.code !== 0) return r.code;
      await Deno.rename(partial, target);
      return 0;
    }),
  );
  if (cloned === 0) {
    ctx.st.cloned = true;
    return;
  }
  const said = ctx.st.lastOutput;
  if (/could not read Username|could not read Password|Authentication failed|terminal prompts disabled|Invalid username or password/i.test(said)) {
    ui.say(`GitHub did not accept a login for ${url}. Sign in with: GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https, then run this again.`);
  } else if (/not found/i.test(said)) {
    const who = (await run(["gh", "api", "user", "--jq", ".login"])).output.trim() || "unknown";
    ui.say(
      `GitHub says ${url} does not exist for your account. Your GitHub login (signed in as ${who}) may not have access to the repository: ask an administrator of the intellectual-frontiers organization to add you, then run this again.`,
    );
  } else {
    ui.say(`Could not copy ${url}. Check your network, then run this again.`);
  }
  problem(ctx, "erga was not copied");
}
