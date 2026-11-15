// The pinned programs the setup fetches itself, before erga exists (009-machine-bootstrap FR-025, FR-091, FR-092): each checked against its SHA-256 before it
// is unpacked, kept in tools/NAME/VERSION of the account's own folder, `current` pointed at it, and its programs linked into ~/.local/bin.
import { err, ok, type Result, sha256 } from "./result.ts";
import { downloadVerified, type Retries } from "./net.ts";
import { exists, isDir, run } from "./proc.ts";

export type Archive = "tar" | "zip" | "raw";
/** One program of a pinned download: its name in ~/.local/bin, and its path inside the unpacked folder. */
export type Link = { readonly name: string; readonly path: string };

export type Pinned = {
  readonly name: string;
  readonly version: string;
  readonly url: string;
  readonly sha256: string;
  readonly archive: Archive;
  /** for a tarball: the leading folders left out */
  readonly strip: number;
  readonly links: readonly Link[];
};

export type Where = { readonly tools: string; readonly bin: string; readonly cache: string };

/** Put a link where DEST is, in one step: a link beside it, renamed over it. */
export async function swapLink(target: string, dest: string): Promise<void> {
  const tmp = `${dest.replace(/[^/]*$/, "")}.${dest.replace(/^.*\//, "")}.new`;
  await Deno.remove(tmp).catch(() => {});
  await Deno.symlink(target, tmp);
  await Deno.rename(tmp, dest);
}

async function unpack(file: string, kind: Archive, dest: string, strip: number, first: string): Promise<Result<void, string>> {
  switch (kind) {
    case "tar": {
      const r = await run(["tar", "-xf", file, "-C", dest, `--strip-components=${strip}`]);
      return r.code === 0 ? ok(undefined) : err(r.output);
    }
    case "zip": {
      const r = await run(["unzip", "-q", "-o", file, "-d", dest]);
      return r.code === 0 ? ok(undefined) : err(r.output);
    }
    case "raw":
      await Deno.copyFile(file, `${dest}/${first}`);
      await Deno.chmod(`${dest}/${first}`, 0o755);
      return ok(undefined);
  }
}

const linksPresent = (bin: string, links: readonly Link[]) => links.every((l) => exists(`${bin}/${l.name}`));
const currentOf = async (root: string) => await Deno.readLink(`${root}/current`).catch(() => "");

/** Fetched, verified and unpacked into tools/NAME/VERSION (once), and `current` pointed at it. */
export async function fetchPinned(retries: Retries, w: Where, p: Pinned): Promise<Result<void, string>> {
  const root = `${w.tools}/${p.name}`;
  if (!isDir(`${root}/${p.version}`)) {
    const sum = sha256(p.sha256);
    if (sum === null) return err(`${p.name} ${p.version} has no checksum for this platform, so it was not installed`);
    const file = await downloadVerified(retries, p.url, sum, w.cache);
    if (!file.ok) return file;
    const part = `${root}/${p.version}.partial`;
    await Deno.remove(part, { recursive: true }).catch(() => {});
    await Deno.mkdir(part, { recursive: true });
    const u = await unpack(file.value, p.archive, part, p.strip, p.links[0]?.name ?? p.name);
    if (!u.ok) {
      await Deno.remove(part, { recursive: true }).catch(() => {});
      return u;
    }
    await Deno.rename(part, `${root}/${p.version}`);
  }
  if (await currentOf(root) !== p.version) await swapLink(p.version, `${root}/current`);
  return ok(undefined);
}

/** Fetched, verified, unpacked, `current` pointed at it, and its programs linked; nothing is done where all of it is in place. */
export async function installPinned(retries: Retries, w: Where, p: Pinned): Promise<Result<void, string>> {
  const root = `${w.tools}/${p.name}`;
  if (await currentOf(root) === p.version && isDir(`${root}/${p.version}`) && linksPresent(w.bin, p.links)) return ok(undefined);
  const f = await fetchPinned(retries, w, p);
  if (!f.ok) return f;
  await Deno.mkdir(w.bin, { recursive: true });
  for (const l of p.links) await swapLink(`${root}/current/${l.path}`, `${w.bin}/${l.name}`);
  return ok(undefined);
}
