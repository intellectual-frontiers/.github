// What the setup fetches itself (009-machine-bootstrap FR-019, FR-025, FR-026, FR-078, FR-091, FR-092): gh, rustup from the pinned rustup-init, the pinned uv,
// and in the clone the toolchain rust-toolchain.toml names; local files and stand-ins for the network and for rustup.
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { Captured, context, exists, Fx, OFF, sha256Hex, withPath, zipBytes } from "./helpers.ts";
import { ghPin, installRustup, linkUv, pinnedPrereqs, rustupUrl, setupRuntime, setupRustToolchain, uvPin } from "../bin/setup/runtime.ts";
import { fetchPinned, installPinned } from "../bin/setup/pinned.ts";
import type { Sha256 } from "../commons/ts/kernel/sha256.ts";
import type { Platform } from "../bin/setup/platform.ts";
import { pin } from "../bin/setup/table.ts";

const linux = (arch: "x86_64" | "aarch64" = "x86_64"): Platform => ({
  os: "linux",
  arch,
  family: "debian",
  id: "debian",
  version: "13",
  codename: "trixie",
  pretty: "Debian",
  wsl: false,
  tested: true,
  rustTarget: `${arch}-unknown-linux-gnu`,
  name: arch === "x86_64" ? "linux-x64" : "linux-arm64",
});
const mac: Platform = { ...linux("aarch64"), os: "darwin", family: "macos", id: "macos", pretty: "macOS 15.1", rustTarget: "aarch64-apple-darwin", name: "macos-arm64" };

async function tarball(fx: Fx, name: string, files: Record<string, string>): Promise<{ path: string; sha: string }> {
  const out = `${fx.tmp}/${name}`;
  if (name.endsWith(".zip")) {
    Deno.writeFileSync(out, zipBytes(files));
    return { path: out, sha: await sha256Hex(Deno.readFileSync(out)) };
  }
  const dir = `${fx.tmp}/src-${name}`;
  for (const [rel, body] of Object.entries(files)) {
    Deno.mkdirSync(`${dir}/${rel.replace(/\/[^/]*$/, "")}`, { recursive: true });
    Deno.writeTextFileSync(`${dir}/${rel}`, body, { mode: 0o755 });
  }
  const p = await new Deno.Command("tar", { args: ["-czf", out, "-C", dir, ...new Set(Object.keys(files).map((f) => f.split("/")[0] ?? f))] }).output();
  assert(p.success, new TextDecoder().decode(p.stderr));
  return { path: out, sha: await sha256Hex(Deno.readFileSync(out)) };
}

Deno.test("the pins are commons', and the release files are the publishers' for each platform (FR-019, FR-078)", () => {
  const ri = pin("rustup-init").version;
  for (const p of [linux(), linux("aarch64"), mac]) assertEquals(rustupUrl(p), `https://static.rust-lang.org/rustup/archive/${ri}/${p.rustTarget}/rustup-init`);
  assertEquals(uvPin(linux()).url, `https://github.com/astral-sh/uv/releases/download/${pin("uv").version}/uv-x86_64-unknown-linux-gnu.tar.gz`);
  const gh = pin("gh").version;
  assertEquals(ghPin(linux()).url, `https://github.com/cli/cli/releases/download/v${gh}/gh_${gh}_linux_amd64.tar.gz`);
  assertEquals(ghPin(linux("aarch64")).url, `https://github.com/cli/cli/releases/download/v${gh}/gh_${gh}_linux_arm64.tar.gz`);
  assertEquals(ghPin(mac).url, `https://github.com/cli/cli/releases/download/v${gh}/gh_${gh}_macOS_arm64.zip`);
  for (const p of [linux(), linux("aarch64"), mac]) {
    for (const name of ["gh", "uv", "rustup-init", "deno"] as const) assertEquals(pin(name).sha256[p.name]?.length, 64, `${name} on ${p.name}`);
  }
});

Deno.test("gh is fetched only where none is here, and never with BOOTSTRAP_NO_DOWNLOAD (FR-068, FR-092)", async () => {
  await using fx = await Fx.make();
  using cap = new Captured();
  const off = context(fx, { BOOTSTRAP_NO_DOWNLOAD: "1" });
  assert((await withPath("/nonexistent", () => pinnedPrereqs(off, linux()))).kind === "ok");
  assertEquals(off.st.stepNo, 0, "no download is tried");
  fx.stub("gh");
  const here = context(fx);
  assert((await withPath(fx.bin, () => pinnedPrereqs(here, linux()))).kind === "ok");
  assertEquals(here.st.stepNo, 0, "a gh on the PATH is used, not installed again");
  assertEquals(cap.out, "");
});

Deno.test("a pinned tarball and a zip are unpacked, linked, and a second run changes nothing (FR-017, FR-025)", async () => {
  await using fx = await Fx.make();
  const ctx = context(fx);
  const w = { tools: ctx.opts.paths.tools, bin: ctx.opts.paths.bin, cache: ctx.opts.paths.cache };
  const t = await tarball(fx, "gh.tar.gz", { "gh_9.9.9_linux_amd64/bin/gh": "#!/bin/sh\necho gh 9.9.9\n" });
  const r = await installPinned(ctx.retries, w, {
    name: "gh",
    version: "9.9.9",
    url: `file://${t.path}`,
    sha256: t.sha,
    archive: "tar",
    strip: 0,
    links: [{ name: "gh", path: "gh_9.9.9_linux_amd64/bin/gh" }],
  });
  assert(r.kind === "ok", r.kind === "ok" ? "" : r.error);
  const out = await new Deno.Command(`${w.bin}/gh`).output();
  assertEquals(new TextDecoder().decode(out.stdout), "gh 9.9.9\n");
  assertEquals(Deno.readLinkSync(`${w.tools}/gh/current`), "9.9.9");
  const z = await tarball(fx, "gh.zip", { "gh_9.9.10_macOS_arm64/bin/gh": "#!/bin/sh\necho gh 9.9.10\n" });
  const r2 = await installPinned(ctx.retries, w, {
    name: "gh",
    version: "9.9.10",
    url: `file://${z.path}`,
    sha256: z.sha,
    archive: "zip",
    strip: 0,
    links: [{ name: "gh", path: "gh_9.9.10_macOS_arm64/bin/gh" }],
  });
  assert(r2.kind === "ok", r2.kind === "ok" ? "" : r2.error);
  assertEquals(new TextDecoder().decode((await new Deno.Command(`${w.bin}/gh`).output()).stdout), "gh 9.9.10\n", "a new version replaces the link");
  const bad = await installPinned(ctx.retries, w, {
    name: "jq",
    version: "1",
    url: `file://${t.path}`,
    sha256: "0".repeat(64),
    archive: "raw",
    strip: 0,
    links: [{ name: "jq", path: "jq" }],
  });
  assert(bad.kind === "err");
  assertStringIncludes(bad.error, "nothing was kept");
  assert(!exists(`${w.bin}/jq`) && !exists(`${w.tools}/jq/1`));
});

Deno.test("rustup-init runs only with its pinned checksum, with the stable toolchain and no startup file (FR-026)", async () => {
  await using fx = await Fx.make();
  const args = `${fx.tmp}/rustup-args`;
  const init = `${fx.tmp}/rustup-init`;
  Deno.writeTextFileSync(init, `#!/bin/sh\necho "$*" >"${args}"\n`);
  const good = await sha256Hex(Deno.readFileSync(init)) as Sha256;
  const ctx = context(fx);
  let said = "";
  assertEquals(await installRustup(ctx, `file://${init}`, good, (t) => (said += t)), 0, said);
  assertEquals(Deno.readTextFileSync(args).split(/\s+/).filter((x) => x !== ""), ["-y", "--no-modify-path", "--default-toolchain", "stable", "--profile", "minimal"]);
  Deno.removeSync(args);
  assertEquals(await installRustup(ctx, `file://${init}`, "0".repeat(64) as Sha256, (t) => (said += t)), 1);
  assertStringIncludes(said, "nothing was kept");
  assert(!exists(args), "a file that is not the pinned one is never run");
  for (const n of [".profile", ".bashrc", ".zshrc"]) assert(!exists(`${fx.home}/${n}`));
});

Deno.test("a rustup already here is used and not installed again; the switches leave Rust and uv out", async () => {
  await using fx = await Fx.make();
  fx.stub("rustup");
  using cap = new Captured();
  const dry = context(fx, {}, ["--dry-run"]);
  await withPath(`${fx.bin}:/usr/bin:/bin`, () => setupRuntime(dry, linux()));
  assertStringIncludes(cap.out, "use the rustup already here");
  assert(!cap.out.includes("Installing rustup"));
  for (const sw of ["BOOTSTRAP_NO_RUNTIME", "BOOTSTRAP_NO_DOWNLOAD"]) {
    const c = context(fx, { [sw]: "1" });
    await setupRuntime(c, linux());
    assertEquals(c.st.stepNo, 0, sw);
  }
});

Deno.test("the pinned uv is unpacked and linked, but a uv of the person's own stays (FR-092)", async () => {
  await using fx = await Fx.make();
  const t = await tarball(fx, "uv.tar.gz", { "uv-x86_64-unknown-linux-gnu/uv": "#!/bin/sh\necho uv 0.0.1\n", "uv-x86_64-unknown-linux-gnu/uvx": "#!/bin/sh\necho uvx 0.0.1\n" });
  const ctx = context(fx);
  const w = { tools: ctx.opts.paths.tools, bin: ctx.opts.paths.bin, cache: ctx.opts.paths.cache };
  assert((await fetchPinned(ctx.retries, w, { ...uvPin(linux()), version: "0.0.1", url: `file://${t.path}`, sha256: t.sha })).kind === "ok");
  assert(exists(`${w.tools}/uv/0.0.1/uv`) && exists(`${w.tools}/uv/0.0.1/uvx`), "the leading folder is left out");
  Deno.mkdirSync(w.bin, { recursive: true });
  Deno.writeTextFileSync(`${w.bin}/uvx`, "#!/bin/sh\necho mine\n");
  await linkUv(ctx);
  assertEquals(new TextDecoder().decode((await new Deno.Command(`${w.bin}/uv`).output()).stdout), "uv 0.0.1\n");
  assertEquals(Deno.readTextFileSync(`${w.bin}/uvx`), "#!/bin/sh\necho mine\n", "a uv the person put there is theirs");
  const bad = await fetchPinned(ctx.retries, w, { ...uvPin(linux()), version: "0.0.2", url: `file://${t.path}`, sha256: "0".repeat(64) });
  assert(bad.kind === "err" && !exists(`${w.tools}/uv/0.0.2`));
});

Deno.test("the toolchain the clone pins is installed in the clone, an older rustup's way too, and the switches leave it out", async () => {
  await using fx = await Fx.make();
  const clone = `${fx.tmp}/ws/github.com/intellectual-frontiers/erga`;
  Deno.mkdirSync(clone, { recursive: true });
  Deno.writeTextFileSync(`${clone}/rust-toolchain.toml`, '[toolchain]\nchannel = "stable"\n');
  const calls = `${fx.tmp}/rustup-calls`;
  fx.stub("rustup", `echo "$(pwd) $*" >>"${calls}"`);
  using _ = new Captured();
  const run = async (extra: Record<string, string>) => {
    const c = context(fx, { ERGA_WORKSPACES: `${fx.tmp}/ws`, ERGA_RETRIES: "1", ...extra });
    c.st.cloned = true;
    return await withPath(`${fx.bin}:/usr/bin:/bin`, () => setupRustToolchain(c));
  };
  assert((await run({})).kind === "ok");
  assertEquals(Deno.readTextFileSync(calls).trim(), `${clone} toolchain install`);
  Deno.removeSync(calls);
  for (const sw of ["BOOTSTRAP_NO_RUNTIME", "BOOTSTRAP_NO_DOWNLOAD", "BOOTSTRAP_NO_CLONE"]) {
    await run({ [sw]: "1" });
    assert(!exists(calls), sw);
  }
  fx.stub("rustup", `echo "$(pwd) $*" >>"${calls}"; [ "$1" = show ]`);
  await run({});
  assertEquals(Deno.readTextFileSync(calls).split("\n")[1], `${clone} show`);
});

Deno.test("with everything off, the setup runs without Cargo and installs nothing (FR-026)", async () => {
  await using fx = await Fx.make();
  const p = await fx.setup([], OFF);
  assertEquals(p.code, 0);
  assert(!p.stdout.toLowerCase().includes("cargo"));
});
