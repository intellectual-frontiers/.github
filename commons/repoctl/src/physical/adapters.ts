// Spec: 0001-repoctl-layers FR-006
/**
 * The adapters of the ports of the Logical layer (commons repoctl 0001-repoctl-layers FR-006): the one place where Repoctl runs a program, reads or writes a file, asks the registry of npm or reads the environment for a credential.
 * Each is a record of functions that fills a port; a program that is not installed is a run that ended with 127 and says so, never a throw. The credential is read here and only here, and what is read is held as a `Secret`, whose
 * text, JSON and inspected form are `[redacted]`.
 *
 * @example
 * ```ts
 * import { systemWorld } from "@intellectual-frontiers/repoctl/physical";
 * const world = systemWorld("/path/to/checkout", (name) => process.env[name], { libraries: undefined });
 * world.repo; // "/path/to/checkout"
 * ```
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { secretOf } from "@intellectual-frontiers/headless/logical";
import { publishedPackage, readLibraries } from "@intellectual-frontiers/libraries/libraries";
import { makeTempDir, mkdirSync, readDirSync, readFileSync, readTextFileSync, removeSync, writeTextFileSync, existsSync, statSync } from "@intellectual-frontiers/system/fs";
import { dirname, join, toFileUrl } from "@intellectual-frontiers/system/path";
import { run } from "@intellectual-frontiers/system/proc";
import type { Config } from "@intellectual-frontiers/repoctl/governance";
import type { Credentials, DocsGenerator, DocsPort, Files, LibraryInfo, Libraries, Process, Registry, World } from "@intellectual-frontiers/repoctl/logical";
import { serve } from "@intellectual-frontiers/net/serve";

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

/** The libraries of the repository, read from their manifests; none where its configuration has no libraries. */
export function manifestLibraries(repo: string, configured: boolean): Libraries {
  return {
    list: () => {
      if (!configured) return Promise.resolve(ok([]));
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
                    npm: f.library.held === undefined && f.library.distribution.includes("npm"),
                    held: f.library.held,
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

/** The package of the documentation generator, which `repoctl docs` loads where it is installed. */
export const DOCS_PACKAGE = "@intellectual-frontiers/docs";

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** The entry file of an installed package: its `exports` entry `.` (as `import` or `default`), else `module`, else `main`. */
function entryOf(folder: string): string | undefined {
  const manifest = join(folder, "package.json");
  if (!existsSync(manifest)) return undefined;
  const json: unknown = JSON.parse(readTextFileSync(manifest));
  if (!isRecord(json)) return undefined;
  const exported = isRecord(json["exports"]) ? json["exports"]["."] : json["exports"];
  const pick = (v: unknown): string | undefined => (typeof v === "string" ? v : isRecord(v) ? pick(v["import"]) ?? pick(v["default"]) : undefined);
  const entry = pick(exported) ?? pick(json["module"]) ?? pick(json["main"]) ?? "index.js";
  return join(folder, entry);
}

function generatorOf(mod: unknown): DocsGenerator | undefined {
  if (!isRecord(mod)) return undefined;
  const main = mod["main"];
  return typeof main === "function" ? { main: async (argv, cwd) => Number(await main(argv, cwd)) } : undefined;
}

/** The documentation generator: the package found in the `node_modules` of the repository or above it (an optional peer of this program, never carried by it). */
export const systemDocs: DocsPort = {
  load: async (repo, generator) => {
    const tried: string[] = [];
    if (generator !== undefined) {
      const file = join(repo, generator);
      try {
        const found = existsSync(file) ? generatorOf(await import(toFileUrl(file).href)) : undefined;
        return found === undefined ? err(`${generator} is not a module that exports main`) : ok(found);
      } catch (e) {
        return err(`${generator}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    for (let dir = repo; ; dir = dirname(dir)) {
      const entry = entryOf(join(dir, "node_modules", DOCS_PACKAGE));
      if (entry !== undefined && existsSync(entry)) {
        try {
          const found = generatorOf(await import(toFileUrl(entry).href));
          if (found !== undefined) return ok(found);
          tried.push(`${entry} exports no main`);
        } catch (e) {
          tried.push(`${entry}: ${e instanceof Error ? e.message : String(e)}`);
        }
        break;
      }
      if (dirname(dir) === dir) break;
    }
    if (tried.length === 0) tried.push(`${DOCS_PACKAGE} is not in the node_modules of ${repo} or above it`);
    return err(tried.join("; "));
  },
};

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** A folder served on a loopback port (0 asks the system for one): the address and the function that stops it. Nothing leaves the computer: the socket is bound to 127.0.0.1. */
export async function serveFolder(folder: string, port: number): Promise<{ readonly url: string; readonly close: () => Promise<void> }> {
  const server = await serve({ port, hostname: "127.0.0.1" }, (request) => {
    const asked = decodeURIComponent(new URL(request.url).pathname);
    const wanted = asked.endsWith("/") ? `${asked}index.html` : asked;
    const file = join(folder, ...wanted.split("/").filter((s) => s !== "" && s !== "." && s !== ".."));
    if (!existsSync(file) || isFolder(file)) return new Response("not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(readFileSync(file).slice(), { status: 200, headers: { "content-type": TYPES[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream" } });
  });
  return { url: `http://127.0.0.1:${server.addr.port}/`, close: () => server.shutdown() };
}

/** The world of a repository on this system: every port filled. */
export function systemWorld(repo: string, env: (name: string) => string | undefined, config: Pick<Config, "libraries">): World {
  return { repo, process: systemProcess, files: systemFiles, registry: npmRegistry, credentials: envCredentials(env), libraries: manifestLibraries(repo, config.libraries !== undefined), docs: systemDocs };
}
