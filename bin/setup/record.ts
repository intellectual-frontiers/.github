// How this account was set up (009-machine-bootstrap FR-069; commons 0002-packaging FR-016): one small file, ~/.config/erga/install.toml, so that `ergactl doctor`
// and `ergactl repo update` can say it. The first method is kept; a later run only refreshes the date.
import type { Ctx } from "./context.ts";
import type { Mode } from "./options.ts";
import type { Platform } from "./platform.ts";
import { recordFieldNames } from "./table.ts";

export type InstallRecord = {
  readonly method: Mode;
  readonly family: string;
  readonly host: string;
  readonly distro: string;
  readonly arch: string;
  readonly installed: string;
  readonly refreshed: string;
};

/** The record's text: the fields in the order commons names them (a test holds the two together). */
export function recordText(r: InstallRecord): string {
  const value: Readonly<Record<string, string>> = r;
  return [
    "# Written by erga's machine setup: how this account was set up. Read by ergactl doctor and ergactl repo update; safe to delete (they then say it is not recorded yet).",
    ...recordFieldNames.map((n) => `${n} = "${(value[n] ?? "").replace(/["\\]/g, "")}"`),
    "",
  ].join("\n");
}

/** The method and the first date of a record already there; anything else in it is written again. */
export function earlier(text: string): { readonly method: Mode | null; readonly installed: string | null } {
  const method = text.match(/^method = "(.*)"$/m)?.[1] ?? null;
  return { method: method === "bootstrap" || method === "setup" ? method : null, installed: text.match(/^installed = "(.*)"$/m)?.[1] ?? null };
}

export async function recordInstall(ctx: Ctx, plat: Platform, host: string): Promise<void> {
  const file = ctx.opts.paths.installFile;
  if (ctx.opts.dryRun) {
    ctx.ui.would(`record how this account was set up in ~/.config/erga/install.toml (${ctx.opts.mode}), which the commands that say how things stand show`);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const old = earlier(await Deno.readTextFile(file).catch(() => ""));
  const text = recordText({
    method: old.method ?? ctx.opts.mode,
    family: plat.family,
    host: host.startsWith("vm-") ? "vm" : host,
    distro: plat.pretty,
    arch: plat.arch,
    installed: old.installed ?? today,
    refreshed: today,
  });
  const dir = file.replace(/\/[^/]*$/, "");
  try {
    await Deno.mkdir(dir, { recursive: true });
    const tmp = await Deno.makeTempFile({ dir, prefix: ".install." });
    await Deno.writeTextFile(tmp, text);
    await Deno.chmod(tmp, 0o644);
    await Deno.rename(tmp, file);
    ctx.ui.log.line(`recorded the installation: ${old.method ?? ctx.opts.mode}, ${plat.family}`);
  } catch { /* the record is an aid: ergactl doctor then says it is not recorded */ }
}
