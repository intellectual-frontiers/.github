/**
 * Report the standards whose newest version is not the one pinned (commons 0018-standards-first FR-006, FR-014, FR-017).
 *
 *     bun commons/libraries/src/newer.ts                     read commons/libraries/src/imports/*.import.ts, fetch each `latest` source and hold the findings against commons/spec-kit/mizan.newer.baseline.txt
 *     bun commons/libraries/src/newer.ts --imports DIR       read the manifests of DIR
 *     bun commons/libraries/src/newer.ts --root DIR          hold the findings against DIR/mizan.newer.baseline.txt (DIR holds `mizan.baseline.txt` too, as for `check.ts`)
 *     bun commons/libraries/src/newer.ts --write-baseline    write the baseline from today's findings (to start it, or to shrink it: never to add a line to pass)
 *
 * A manifest of an import (0019-mizan-integrations FR-014) may name, beside its versioned `source`, a `latest` source: an URL that always serves the newest version of the
 * standard (schema.org's `.../version/latest/...`, a repository's latest tag). This command fetches each one and gives one finding, `mizan/standard-newer`, where the SHA-256 of
 * what it serves differs from the pin. It is opt-in and the only part of Mizan that needs the network: `check.ts` and `import.ts --check` never do, so the network never fails the offline
 * check. Its exit status is 0 (nothing new), 1 (a finding the baseline does not hold, or a baseline line that no longer occurs) or 2 (a `latest` source that cannot be fetched, or a
 * manifest that cannot be read, named with its reason).
 *
 * @limits
 * It compares bytes, not versions: a source that changes its prefixes or its date changes the hash, and a person reads the difference. It reads the manifests of one folder.
 *
 * @example
 * ```ts
 * import { staleFindings } from "./newer.ts";
 * staleFindings([{ file: "imports/x.import.ts", id: "x", version: "1", pin: "a".repeat(64), latest: "https://example.org/latest", sha256: "b".repeat(64) }]).length; // 1
 * ```
 *
 * Spec: 0001-libraries FR-008
 *
 * @module
 */
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { formatBaseline, judge, parseBaseline, passes, report } from "@intellectual-frontiers/mizan/trace";
import { existsSync, readDirSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { stdio } from "@intellectual-frontiers/system";
import { resolve } from "@intellectual-frontiers/system/path";
import { decodeManifest, isUrl } from "@intellectual-frontiers/mizan/integrations/host/import";
import type { MizanFinding } from "@intellectual-frontiers/mizan/rules";

/** A manifest that names a `latest` source: its file, the standard it pins (id, version, SHA-256) and the URL that always serves the newest. */
export type LatestManifest = {
  readonly file: string;
  readonly id: string;
  readonly version: string;
  readonly pin: string;
  readonly latest: string;
};

/** A manifest with the SHA-256 of what its `latest` source serves. */
export type Fetched = LatestManifest & { readonly sha256: string };

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null && !Array.isArray(x);

/** The comment lines a baseline of this command begins with. */
export const NEWER_BASELINE_COMMENTS = [
  "The standards whose latest source served other bytes than the pin when each was first held (commons 0018-standards-first FR-017).",
  "A new finding fails the check, and so does a line below that no longer occurs: when you repin an import, delete its line.",
  "Never add a line to make a check pass.",
] as const;

/** The findings: one sentence for each manifest whose `latest` source serves other bytes than the pin (0018-standards-first FR-014). */
export function staleFindings(fetched: readonly Fetched[]): readonly MizanFinding[] {
  return fetched.flatMap((f) =>
    f.sha256 === f.pin
      ? []
      : [
          {
            file: f.file,
            line: 1,
            rule: "mizan/standard-newer" as const,
            message: `${f.id} is pinned at version ${f.version} (SHA-256 ${f.pin}), and ${f.latest} now serves SHA-256 ${f.sha256}, so a newer version of the standard may be out`,
            key: `mizan/standard-newer ${f.file} ${f.id} ${f.sha256}`,
          },
        ],
  );
}

/** The manifests of a folder (`NAME.import.ts`, in the order of their names) that name a `latest` source, and a sentence for each that cannot be read. */
export async function readLatestManifests(
  dir: string,
): Promise<{ readonly manifests: readonly LatestManifest[]; readonly problems: readonly string[] }> {
  const manifests: LatestManifest[] = [];
  const problems: string[] = [];
  const base = resolve(dir);
  const folder = base.split(/[\\/]/).pop() ?? "imports";
  if (!existsSync(base)) return { manifests, problems: [`${dir}: no such folder`] };
  const names = readDirSync(base)
    .filter((e) => e.isFile && e.name.endsWith(".import.ts"))
    .map((e) => e.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const file = `${folder}/${name}`;
    const loaded: unknown = await import(pathToFileURL(resolve(base, name)).href);
    const raw = isRecord(loaded) ? loaded["manifest"] : undefined;
    const m = decodeManifest(raw);
    if (m.kind === "err") {
      problems.push(`${file}: ${m.error}`);
      continue;
    }
    const latest = isRecord(raw) ? raw["latest"] : undefined;
    if (latest === undefined) continue;
    if (typeof latest !== "string" || !isUrl(latest)) {
      problems.push(`${file}: latest must be an https:// URL`);
      continue;
    }
    manifests.push({ file, id: m.value.standard.id, version: m.value.standard.version, pin: m.value.standard.sha256, latest });
  }
  return { manifests, problems };
}

/** The SHA-256 of what a URL serves, with its line ends normalised as an import's are (0019-mizan-integrations FR-014), or the sentence that says why it could not be fetched. */
export async function latestHash(url: string): Promise<Result<string, string>> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return err(`${url}: HTTP ${r.status}`);
    return ok(await sha256((await r.text()).replaceAll("\r\n", "\n")));
  } catch (e) {
    return err(`${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The command line. Returns the exit status: 0, 1 where a finding is new or a baseline line is stale, 2 where a source or a manifest cannot be read. */
export async function main(argv: readonly string[]): Promise<number> {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const imports = arg("--imports") ?? fileURLToPath(new URL("./imports", import.meta.url));
  const root = (arg("--root") ?? fileURLToPath(new URL("../../spec-kit", import.meta.url))).replace(/[\\/]$/, "");
  const baselineFile = `${root}/mizan.newer.baseline.txt`;
  const { manifests, problems: unread } = await readLatestManifests(imports);
  const problems = [...unread];
  const fetched: Fetched[] = [];
  for (const m of manifests) {
    const h = await latestHash(m.latest);
    if (h.kind === "err") problems.push(`${m.file}: ${h.error}`);
    else fetched.push({ ...m, sha256: h.value });
  }
  const found = staleFindings(fetched);
  if (argv.includes("--write-baseline")) {
    if (problems.length === 0) {
      writeTextFileSync(baselineFile, formatBaseline(found, NEWER_BASELINE_COMMENTS));
      stdio.stdout.writeSync(`wrote ${baselineFile}: ${new Set(found.map((f) => f.key)).size} findings\n`);
      return 0;
    }
  }
  for (const p of problems) stdio.stderr.writeSync(`${p}\n`);
  if (problems.length > 0) return 2;
  const held = existsSync(baselineFile) ? parseBaseline(readTextFileSync(baselineFile)) : [];
  const verdict = judge(found, held);
  stdio.stderr.writeSync(`${report(verdict, "mizan-newer", baselineFile).join("\n")}\n`);
  return passes(verdict) ? 0 : 1;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
