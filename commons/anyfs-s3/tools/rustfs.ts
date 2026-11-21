// Spec: 0003-anyfs-s3-tests FR-001
/**
 * The real server the tests of the S3 store run against where it can be run: RustFS, an S3-compatible object store in one binary. This module obtains the binary of the platform from the publisher's address,
 * pinned by the SHA-256 of the archive (a download whose digest is not the pin is refused and never unpacked, and a program that was not unpacked from a verified archive is never run), keeps it below the cache
 * folder of the user (XDG on Linux, as `dirsOf` of the system library says), and starts it on the loopback with a data folder, keys and a port made for one run, and stops it again. Where the platform has no pin, there
 * is no network, or the archive is not the pinned one, it says why and the tests use the server made in process.
 *
 * ```sh
 * bun tools/rustfs.ts           obtain the binary and print where it is
 * bun tools/rustfs.ts --start   start it, make a bucket, print the endpoint and stop at the first line of input
 * ```
 *
 * @module
 */
import process from "node:process";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { unzip } from "@intellectual-frontiers/formats/archive";
import { dirsOf } from "@intellectual-frontiers/system/dirs";
import { fs, path, proc } from "@intellectual-frontiers/system";

/** The version the pins are of. */
export const RUSTFS_VERSION = "1.0.6";

/** A binary the publisher offers: where, the SHA-256 of the archive, and the file in it. */
export type Pin = { readonly url: string; readonly sha256: string; readonly entry: string };

const BASE = "https://dl.rustfs.com/artifacts/rustfs/release";

/**
 * The pins, by the platform's name. The digests are of the archives the publisher serves at these addresses, which were downloaded over TLS and hashed on 2026-11-21; the publisher gives no checksum file, so this
 * is the pin the tests hold it to from then on.
 */
export const PINS: Readonly<Record<string, Pin>> = {
  "linux-x86_64": { url: `${BASE}/rustfs-linux-x86_64-musl-v${RUSTFS_VERSION}.zip`, sha256: "a4d109a09857c04bf5d11b2cec0fbbf0887819b9392e5d46d7d153dae6a1398f", entry: "rustfs" },
  "linux-aarch64": { url: `${BASE}/rustfs-linux-aarch64-musl-v${RUSTFS_VERSION}.zip`, sha256: "dcbe86dbb0c521cb6738f72bb36a2d056866667d3d137c2118ee7e2cc9475855", entry: "rustfs" },
  "darwin-aarch64": { url: `${BASE}/rustfs-macos-aarch64-v${RUSTFS_VERSION}.zip`, sha256: "e0bf7e8aeee45490034576fde6513377db81844d8c40e24c57269e9bb274882f", entry: "rustfs" },
  "windows-x86_64": { url: `${BASE}/rustfs-windows-x86_64-v${RUSTFS_VERSION}.zip`, sha256: "d718157c08ffcbc32e667176f941d6d36b37c7d73335b9f82d4d30a2d5ea5393", entry: "rustfs.exe" },
};

/** The pin of this platform, or none. */
export const pinOf = (os: string, arch: string): Pin | undefined => PINS[`${os}-${arch}`];

const dirs = () => dirsOf("anyfs", (name) => proc.env.get(name), proc.build.os === "windows" ? "windows" : proc.build.os === "darwin" ? "darwin" : "linux");

/** The folder the binary of the version is kept in, or none where the user has no cache folder. */
export const cacheFolder = (): string | undefined => {
  const cache = dirs().cache;
  return cache === undefined ? undefined : path.join(cache, "rustfs", RUSTFS_VERSION);
};

/** The binary of RustFS on this computer: kept from an earlier run where its digest is the one recorded when it was unpacked, else downloaded, checked against the pin and unpacked. */
export async function rustfsBinary(fetcher: (url: string) => Promise<Result<Uint8Array, string>> = download, pinned: Pin | undefined = pinOf(proc.build.os, proc.build.arch)): Promise<Result<string, string>> {
  const pin = pinned;
  if (pin === undefined) return err(`there is no pinned RustFS for ${proc.build.os}/${proc.build.arch}`);
  const folder = cacheFolder();
  if (folder === undefined) return err("the user has no cache folder to keep the binary in");
  const binary = path.join(folder, pin.entry);
  const record = path.join(folder, "binary.sha256");
  if ((await fs.exists(binary)) && (await fs.exists(record))) {
    const held = (await fs.readTextFile(record)).trim();
    if (held === (await sha256(await fs.readFile(binary)))) return ok(binary);
  }
  const archive = await fetcher(pin.url);
  if (archive.kind === "err") return archive;
  const digest = await sha256(archive.value);
  if (digest !== pin.sha256) return err(`the archive at ${pin.url} hashes to ${digest}, not to the pinned ${pin.sha256}: it is not unpacked and nothing of it is run`);
  const files = await unzip(archive.value);
  if (files.kind === "err") return err(`the archive cannot be read: ${JSON.stringify(files.error)}`);
  const body = files.value.get(pin.entry);
  if (body === undefined) return err(`the archive has no ${pin.entry}`);
  await fs.mkdir(folder, { recursive: true });
  const temporary = `${binary}.part`;
  await fs.writeFile(temporary, body, { mode: 0o755 });
  await fs.rename(temporary, binary);
  await fs.chmod(binary, 0o755);
  await fs.writeTextFile(record, `${await sha256(body)}\n`);
  return ok(binary);
}

async function download(url: string): Promise<Result<Uint8Array, string>> {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(300_000) });
    if (!response.ok) return err(`${url} answered ${response.status}`);
    return ok(new Uint8Array(await response.arrayBuffer()));
  } catch (thrown) {
    return err(`${url} cannot be reached: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  }
}

/** A server that is running. */
export type Running = {
  readonly endpoint: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly stop: () => Promise<void>;
  /** Stops the server at once, where there is no time to wait for it: the process of the tests is ending. */
  readonly kill: () => void;
};

async function freePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Starts RustFS on the loopback with a data folder, a port and keys made for this run, and waits until it answers. */
export async function startRustfs(binary: string, options: { readonly readyMs?: number } = {}): Promise<Result<Running, string>> {
  const data = await fs.makeTempDir({ prefix: "anyfs-rustfs-" });
  const port = await freePort();
  const accessKey = `test${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const secretKey = crypto.randomUUID().replaceAll("-", "");
  const controller = new AbortController();
  const child = proc.spawn([binary, "server", "--address", `127.0.0.1:${port}`, "--access-key", accessKey, "--secret-key", secretKey, path.join(data, "vol")], {
    stdin: "null",
    stdout: "null",
    stderr: "null",
    signal: controller.signal,
    killAfterMs: 3000,
    env: { RUSTFS_CONSOLE_ENABLE: "false", RUSTFS_OBS_ENDPOINT: "" },
  });
  await fs.mkdir(path.join(data, "vol"), { recursive: true });
  const stop = async (): Promise<void> => {
    controller.abort();
    await child.status.catch(() => undefined);
    await fs.remove(data, { recursive: true }).catch(() => undefined);
  };
  const deadline = Date.now() + (options.readyMs ?? 30_000);
  for (;;) {
    try {
      const answer = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
      if (answer.status > 0) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      await stop();
      return err("RustFS did not answer in time");
    }
    await proc.sleep(100);
  }
  // the server does not keep the process of the tests alive: it is stopped when that ends
  child.unref();
  return ok({ endpoint: `http://127.0.0.1:${port}`, accessKey, secretKey, stop, kill: () => controller.abort() });
}

if (import.meta.main) {
  const binary = await rustfsBinary();
  if (binary.kind === "err") {
    process.stderr.write(`${binary.error}\n`);
    process.exitCode = 1;
  } else if (process.argv.includes("--start")) {
    const running = await startRustfs(binary.value);
    if (running.kind === "err") {
      process.stderr.write(`${running.error}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`${running.value.endpoint}\n`);
      await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));
      await running.value.stop();
    }
  } else {
    process.stdout.write(`${binary.value}\n`);
  }
}
