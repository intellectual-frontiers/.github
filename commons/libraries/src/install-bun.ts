/**
 * Bun at the version commons pins (`BUN_VERSION` and its SHA-256 per platform in `commons/generated/pins.auto.env`, commons
 * 0005-typescript-runtime FR-026), fetched from Bun's release with retries, kept only where its SHA-256 is the pinned one, unpacked by the
 * kernel's own zip reader and put in a folder; nothing but IFC TypeScript itself, so it runs on Node 26 (or Bun) on Linux, macOS
 * and Windows with no shell, no Python and no unzip. CI's `.github/actions/bun` runs it.
 *
 * `node commons/libraries/src/install-bun.ts <folder>` (the folder is required) prints the folder that holds `bun` (or `bun.exe`); with `GITHUB_PATH` set, it is also
 * added there.
 *
 * Spec: 0001-libraries FR-006
 *
 * @module
 */
import { formatArchiveError, unzip } from "@intellectual-frontiers/formats/archive";
import { sha256Of } from "@intellectual-frontiers/crypto/sha256";
import { chmod, ensureDir, readFile, readTextFile, writeFile, writeTextFile } from "@intellectual-frontiers/system/fs";
import { downloadVerified, Retries } from "@intellectual-frontiers/net/net";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { args, build, env, exit } from "@intellectual-frontiers/system/proc";
import { bunTarget, readEnvFile } from "./pins.ts";

/** Stop with a message and status 1. */
function stop(message: string): never {
  console.error(`install-bun: ${message}`);
  return exit(1);
}

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..", "..", "..");
const given = args[0];
if (given === undefined) stop("give the folder to put Bun in");
const dest = resolve(given);
const pins = readEnvFile(await readTextFile(join(ROOT, "commons", "generated", "pins.auto.env")));
const platform = bunTarget(build.os, build.arch);
if (platform === undefined) stop(`Bun has no build for ${build.os} on ${build.arch}`);
const version = pins.get("BUN_VERSION");
const sum = sha256Of(pins.get(`BUN_SHA256_${platform.key}`) ?? "");
if (version === undefined || sum === undefined) stop(`commons pins no Bun for ${platform.key}`);
const retries = new Retries({ tries: 5, base: 2, cap: 30 }, (line) => console.error(line));
const url = `https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-${platform.target}.zip`;
const zip = await downloadVerified(retries, url, sum, join(dest, "cache"));
if (zip.kind === "err") stop(zip.error);
const files = await unzip(await readFile(zip.value));
if (files.kind === "err") stop(formatArchiveError(files.error));
const exe = build.os === "windows" ? "bun.exe" : "bun";
const bytes = files.value.get(`bun-${platform.target}/${exe}`);
if (bytes === undefined) stop(`the zip holds no bun-${platform.target}/${exe}`);
const bin = join(dest, `bun-${version}`);
await ensureDir(bin);
await writeFile(join(bin, exe), bytes);
await chmod(join(bin, exe), 0o755);
const githubPath = env.get("GITHUB_PATH");
if (githubPath !== undefined && githubPath !== "") await writeTextFile(githubPath, `${bin}\n`, { append: true });
console.log(bin);
