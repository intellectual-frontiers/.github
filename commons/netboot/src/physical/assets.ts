// Spec: 0004-netboot-physical FR-002
/**
 * The boot files and the installer image on the boot machine: each is fetched once, checked against its pinned SHA-256 and kept; a file that does not match is removed and nothing is served from it. The fetch is a function that is given, so that a test serves
 * made-up files; the check is of the bytes, read in chunks (an installer image is several GB).
 *
 * @example
 * ```ts
 * import { sha256File } from "./assets.ts";
 * // await sha256File("/var/lib/netboot/linux")
 * ```
 *
 * @module
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fs, path } from "@intellectual-frontiers/system";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { BootPins } from "@intellectual-frontiers/netboot/governance";

/** A file's SHA-256 in hexadecimal, read in chunks. */
export async function sha256File(file: string): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk as Uint8Array);
  return h.digest("hex");
}

/** The files the server holds: the boot files by name, and the installer image. */
export type Assets = { readonly files: Readonly<Record<string, string>>; readonly iso?: string };

/** Gets the bytes at an address. */
export type Fetch = (url: string) => Promise<Response>;

async function ensure(dir: string, name: string, url: string, sha: string, fetcher: Fetch, say: (m: string) => void): Promise<Result<string, string>> {
  const file = path.join(dir, name);
  if ((await fs.exists(file)) && (await sha256File(file)) === sha) return ok(file);
  say(`fetching ${name}`);
  const res = await fetcher(url);
  if (!res.ok || res.body === null) return err(`${url}: HTTP ${res.status}`);
  const tmp = `${file}.partial`;
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
  const got = await sha256File(tmp);
  if (got !== sha) {
    await fs.remove(tmp);
    return err(`${name}: SHA-256 ${got} does not match the pin ${sha}; nothing is served`);
  }
  await fs.rename(tmp, file);
  return ok(file);
}

/** Every boot file and the installer image, fetched where they are not held and checked against their pins. */
export async function ensureAssets(dir: string, pins: BootPins, fetcher: Fetch = (u) => fetch(u), say: (m: string) => void = () => {}): Promise<Result<Assets, string>> {
  await fs.mkdir(dir, { recursive: true });
  const files: Record<string, string> = {};
  for (const [name, sha] of Object.entries(pins.files)) {
    const r = await ensure(dir, name, pins.netboot + (pins.paths?.[name] ?? name), sha, fetcher, say);
    if (r.kind === "err") return r;
    files[name] = r.value;
  }
  if (pins.iso === undefined) return ok({ files });
  const iso = await ensure(dir, pins.iso.name, pins.iso.url, pins.iso.sha256, fetcher, say);
  return iso.kind === "err" ? iso : ok({ files, iso: iso.value });
}

/** What of the assets is held and matches its pin, without fetching: the names that are ready and the ones that are not. */
export async function assetStatus(dir: string, pins: BootPins): Promise<{ readonly ready: readonly string[]; readonly missing: readonly string[] }> {
  const ready: string[] = [];
  const missing: string[] = [];
  const want: Array<[string, string]> = [...Object.entries(pins.files), ...(pins.iso === undefined ? [] : ([[pins.iso.name, pins.iso.sha256]] as Array<[string, string]>))];
  for (const [name, sha] of want) {
    const file = path.join(dir, name);
    ((await fs.exists(file)) && (await sha256File(file)) === sha ? ready : missing).push(name);
  }
  return { ready, missing };
}
