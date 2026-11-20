// Spec: 0001-repoctl-layers FR-006
/**
 * The adapters of the ports of the Logical layer (commons repoctl 0001-repoctl-layers FR-006): the one place where Repoctl runs a program, reads or writes a file, asks the registry of npm or reads the environment for a credential.
 * Each is a record of functions that fills a port; a program that is not installed is a run that ended with 127 and says so, never a throw. The credential is read here and only here, and what is read is held as a `Secret`, whose
 * text, JSON and inspected form are `[redacted]`.
 *
 * @example
 * ```ts
 * import { systemWorld } from "@intellectual-frontiers/repoctl/physical";
 * const world = systemWorld("/path/to/checkout", (name) => process.env[name]);
 * world.repo; // "/path/to/checkout"
 * ```
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { secretOf } from "@intellectual-frontiers/headless/logical";
import { publishedPackage, readLibraries } from "@intellectual-frontiers/libraries/libraries";
import { makeTempDir, mkdirSync, readDirSync, readTextFileSync, removeSync, writeTextFileSync, existsSync, statSync } from "@intellectual-frontiers/system/fs";
import { dirname, join } from "@intellectual-frontiers/system/path";
import { run } from "@intellectual-frontiers/system/proc";
import type { Credentials, Files, LibraryInfo, Libraries, Process, Registry, World } from "@intellectual-frontiers/repoctl/logical";

/** The variable that holds the token for npm. */
export const NPM_TOKEN_VARIABLE = "INFRO_NPMJS_TOKEN";

/** Programs run through the system, with the environment this process has plus what a run adds. */
export const systemProcess: Process = {
  run: async (argv, options) => {
    try {
      const r = await run(argv, { ...(options?.cwd === undefined ? {} : { cwd: options.cwd }), ...(options?.env === undefined ? {} : { env: options.env }) });
      return { code: r.code, stdout: r.stdout, stderr: r.stderr };
    } catch (e) {
      return { code: 127, stdout: "", stderr: `${argv[0] ?? "the program"} could not be run: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

const isFolder = (path: string): boolean => {
  try {
    return statSync(path).isDirectory;
  } catch {
    return false;
  }
};

/** Files on the system's disk. */
export const systemFiles: Files = {
  read: (path) => Promise.resolve(existsSync(path) && !isFolder(path) ? readTextFileSync(path) : undefined),
  write: (path, text, mode) => {
    mkdirSync(dirname(path), { recursive: true });
    writeTextFileSync(path, text, mode === undefined ? {} : { mode });
    return Promise.resolve();
  },
  remove: (path) => {
    if (existsSync(path)) removeSync(path);
    return Promise.resolve();
  },
  exists: (path) => Promise.resolve(existsSync(path)),
  list: (dir) => Promise.resolve(existsSync(dir) ? readDirSync(dir).map((e) => e.name).sort() : []),
  walk: (dir) => {
    const out: string[] = [];
    const visit = (rel: string): void => {
      const here = rel === "" ? dir : join(dir, rel);
      if (!existsSync(here)) return;
      for (const e of readDirSync(here).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        if (e.name === "node_modules") continue;
        const next = rel === "" ? e.name : `${rel}/${e.name}`;
        if (e.isDirectory) visit(next);
        else if (e.isFile) out.push(next);
      }
    };
    visit("");
    return Promise.resolve(out);
  },
  makeTemp: (prefix) => makeTempDir({ prefix }),
  removeTree: (path) => {
    if (existsSync(path)) removeSync(path, { recursive: true });
    return Promise.resolve();
  },
};

/** What the registry of npm says of a package: its latest version and the versions it lists. */
export const npmRegistry: Registry = {
  view: async (name) => {
    try {
      const r = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/vnd.npm.install-v1+json" } });
      if (r.status === 404) return ok("absent");
      if (!r.ok) return err(`the registry answered ${r.status}`);
      const body: unknown = await r.json();
      const o = typeof body === "object" && body !== null ? body : {};
      const tags = "dist-tags" in o && typeof o["dist-tags"] === "object" && o["dist-tags"] !== null ? o["dist-tags"] : {};
      const latest = "latest" in tags && typeof tags.latest === "string" ? tags.latest : undefined;
      const versions = "versions" in o && typeof o.versions === "object" && o.versions !== null ? Object.keys(o.versions) : [];
      return ok({ latest, versions });
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  },
};

/** The credentials a host holds, read from its environment by name: the token for npm. */
export function envCredentials(env: (name: string) => string | undefined): Credentials {
  return {
    npmToken: () => {
      const v = env(NPM_TOKEN_VARIABLE);
      return v === undefined || v === "" ? undefined : secretOf(v);
    },
  };
}

/** The libraries of the repository, read from their manifests. */
export function manifestLibraries(repo: string): Libraries {
  return {
    list: () => {
      const found = readLibraries(repo);
      const bad = found.flatMap((f) => ("problem" in f ? [`commons/${f.dir}/library.ts: ${f.problem}`] : []));
      if (bad.length > 0) return Promise.resolve(err(bad.join("; ")));
      return Promise.resolve(
        ok(
          found.flatMap((f): readonly LibraryInfo[] =>
            "library" in f
              ? [
                  {
                    name: f.library.name,
                    package: publishedPackage(f.library),
                    folder: `commons/${f.dir}`,
                    version: f.library.version,
                    level: f.library.level,
                    specKit: f.library.specKit === undefined ? undefined : f.library.specKit,
                    npm: f.library.distribution.includes("npm"),
                    versionConstants: f.library.versionConstants ?? [],
                  },
                ]
              : [],
          ),
        ),
      );
    },
  };
}

/** The world of a repository on this system: every port filled. */
export function systemWorld(repo: string, env: (name: string) => string | undefined): World {
  return { repo, process: systemProcess, files: systemFiles, registry: npmRegistry, credentials: envCredentials(env), libraries: manifestLibraries(repo) };
}
