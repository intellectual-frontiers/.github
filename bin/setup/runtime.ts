// What the setup fetches before erga exists: gh (for the sign-in), rustup (Rust builds Thyra and ArcaDrive; no erga command needs Cargo) and uv (which runs
// erga's few Python programs), each the pin commons generates (009-machine-bootstrap FR-025, FR-026, FR-078). jq is not fetched any more: the setup reads JSON
// itself, and erga's own jq is an entry of its toolchain, which `./ergactl toolchain ensure` installs.
import { done } from "../../commons/ts/kernel/result.ts";
import { type Sha256, sha256Of } from "../../commons/ts/kernel/sha256.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
import { downloadVerified } from "../../commons/ts/runtime/net.ts";
import { isExecutable } from "../../commons/ts/runtime/proc.ts";
import { type Ctx, problem } from "./context.ts";
import type { Phase } from "./stop.ts";
import { pin } from "./table.ts";
import type { Platform } from "./platform.ts";
import { exists, which } from "./proc.ts";
import { retryCommand } from "./net.ts";
import { fetchPinned, installPinned, type Pinned, type Where } from "./pinned.ts";
import { type Job, pool, step, task } from "./steps.ts";

const where = (ctx: Ctx): Where => ({ tools: ctx.opts.paths.tools, bin: ctx.opts.paths.bin, cache: ctx.opts.paths.cache });

/** gh, GitHub's command line, from the publisher's release for this platform. */
export function ghPin(plat: Platform): Pinned {
  const p = pin("gh");
  const dir = plat.os === "darwin" ? `gh_${p.version}_macOS_arm64` : `gh_${p.version}_linux_${plat.arch === "x86_64" ? "amd64" : "arm64"}`;
  return {
    name: "gh",
    version: p.version,
    url: `https://github.com/cli/cli/releases/download/v${p.version}/${dir}${plat.os === "darwin" ? ".zip" : ".tar.gz"}`,
    sha256: p.sha256[plat.name] ?? "",
    archive: plat.os === "darwin" ? "zip" : "tar",
    strip: 0,
    links: [{ name: "gh", path: `${dir}/bin/gh` }],
  };
}

export function uvPin(plat: Platform): Pinned {
  const p = pin("uv");
  return {
    name: "uv",
    version: p.version,
    url: `https://github.com/astral-sh/uv/releases/download/${p.version}/uv-${plat.rustTarget}.tar.gz`,
    sha256: p.sha256[plat.name] ?? "",
    archive: "tar",
    strip: 1,
    links: [],
  };
}

export const rustupUrl = (plat: Platform): string => `https://static.rust-lang.org/rustup/archive/${pin("rustup-init").version}/${plat.rustTarget}/rustup-init`;

/** gh, which the setup itself uses for the sign-in, where none is on the PATH or linked already (FR-092); never with BOOTSTRAP_NO_DOWNLOAD (FR-068). */
export async function pinnedPrereqs(ctx: Ctx, plat: Platform): Promise<Phase> {
  if (!ctx.opts.switches.download || which("gh") !== null || isExecutable(`${ctx.opts.paths.bin}/gh`)) return done;
  const gh = ghPin(plat);
  return await step(
    ctx,
    `${ctx.ui.e.dl}Getting gh ${gh.version}`,
    task(async (out) => {
      const r = await installPinned(ctx.retries, where(ctx), gh);
      if (r.kind === "err") out(`${r.error}\n`);
      return r.kind === "ok" ? 0 : 1;
    }),
  );
}

const haveRustup = (ctx: Ctx) => which("rustup") !== null || isExecutable(`${ctx.opts.paths.cargoBin}/rustup`);

/** The pinned rustup-init, verified, run once: rustup and Cargo's folder, the stable toolchain as the default (so cargo works in any folder), no startup file. */
export async function installRustup(ctx: Ctx, url: string, sum: Sha256, out: (t: string) => void): Promise<number> {
  const f = await downloadVerified(ctx.retries, url, sum, ctx.opts.paths.cache);
  if (f.kind === "err") {
    out(`${f.error}\n`);
    return 1;
  }
  const exe = `${ctx.work}/rustup-init`;
  await fs.copyFile(f.value, exe);
  await fs.chmod(exe, 0o755);
  return (await retryCommand(ctx.retries, "rustup (static.rust-lang.org)", [exe, "-y", "--no-modify-path", "--default-toolchain", "stable", "--profile", "minimal"], {
    onOutput: out,
  })).code;
}

/** uv's two programs, linked into ~/.local/bin where nothing else holds the name: a uv a person installed there is theirs, and stays. */
export async function linkUv(ctx: Ctx): Promise<void> {
  const { bin, tools } = ctx.opts.paths;
  await fs.mkdir(bin, { recursive: true });
  for (const t of ["uv", "uvx"]) {
    const src = `${tools}/uv/current/${t}`;
    if (!isExecutable(src)) continue;
    const dst = `${bin}/${t}`;
    const link = await fs.readLink(dst).catch(() => null);
    if (!exists(dst)) await fs.symlink(src, dst);
    else if (link !== null && link.startsWith(`${tools}/uv/`) && link !== src) {
      await fs.remove(dst);
      await fs.symlink(src, dst);
    }
  }
}

/** rustup and uv, at the same time (they do not touch each other, FR-030). */
export async function setupRuntime(ctx: Ctx, plat: Platform): Promise<Phase> {
  const ui = ctx.ui;
  ui.phase(`${ui.e.rust}Getting Rust and uv ready`);
  if (!ctx.opts.switches.download) {
    ui.say("Skipped (BOOTSTRAP_NO_DOWNLOAD=1).");
    return done;
  }
  if (!ctx.opts.switches.runtime) {
    ui.say("Skipped (BOOTSTRAP_NO_RUNTIME=1): the rustup, Rust and uv on the PATH are used.");
    return done;
  }
  const jobs: Job[] = [];
  const ri = pin("rustup-init");
  if (haveRustup(ctx)) {
    if (ctx.opts.dryRun) ui.would("use the rustup already here; the clone's rust-toolchain.toml chooses the toolchain");
  } else {
    // the pinned rustup-init, verified, run once: rustup and Cargo's folder, the stable toolchain as the default (so cargo works in any folder), no startup file
    jobs.push({
      label: `${ui.e.dl}Installing rustup ${ri.version}, Rust's installer (into ~/.rustup and ~/.cargo)`,
      work: task(async (out) => {
        const sum = sha256Of(ri.sha256[plat.name] ?? "");
        if (sum !== undefined) return await installRustup(ctx, ctx.opts.rustupUrl ?? rustupUrl(plat), sum, out);
        out(`rustup-init ${ri.version} has no checksum for ${plat.name}\n`);
        return 1;
      }),
    });
  }
  const uv = uvPin(plat);
  if (!isExecutable(`${ctx.opts.paths.tools}/uv/${uv.version}/uv`) || (await fs.readLink(`${ctx.opts.paths.tools}/uv/current`).catch(() => "")) !== uv.version) {
    jobs.push({
      label: `${ui.e.dl}Installing uv ${uv.version}`,
      work: task(async (out) => {
        const r = await fetchPinned(ctx.retries, where(ctx), uv);
        if (r.kind === "err") out(`${r.error}\n`);
        return r.kind === "ok" ? 0 : 1;
      }),
    });
  }
  const r = await pool(ctx, "Installing Rust's installer and uv", jobs);
  if (r.kind === "err") return r;
  if (!ctx.opts.dryRun) await linkUv(ctx);
  return done;
}

/** In the clone: the Rust toolchain its rust-toolchain.toml names (stable), for Thyra and ArcaDrive (rustup checks each part against its manifest). */
export async function setupRustToolchain(ctx: Ctx): Promise<Phase> {
  const s = ctx.opts.switches;
  if (!s.clone) return done;
  if (ctx.opts.dryRun) {
    if (s.download && s.runtime) ctx.ui.would("install, in the clone, the Rust toolchain its rust-toolchain.toml names (stable), with its components (rustup toolchain install)");
    return done;
  }
  if (!s.download || !s.runtime || !ctx.st.cloned || !exists(`${ctx.opts.paths.target}/rust-toolchain.toml`)) return done;
  if (which("rustup") === null) {
    problem(ctx, "rustup is not here, so the Rust toolchain of erga was not installed");
    return done;
  }
  ctx.ui.phase(`${ctx.ui.e.rust}Installing the Rust toolchain erga uses`);
  // rustup 1.28 and later install what the file names with `rustup toolchain install`; an older rustup does it on `rustup show`
  return await step(
    ctx,
    `${ctx.ui.e.dl}Installing the Rust toolchain rust-toolchain.toml names`,
    task(async (out) => {
      const cwd = ctx.opts.paths.target;
      const a = await retryCommand(ctx.retries, "the Rust toolchain (static.rust-lang.org)", ["rustup", "toolchain", "install"], { cwd, onOutput: out });
      if (a.code === 0) return 0;
      return (await retryCommand(ctx.retries, "the Rust toolchain (static.rust-lang.org)", ["rustup", "show"], { cwd, onOutput: out })).code;
    }),
  );
}
