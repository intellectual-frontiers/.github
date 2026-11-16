/**
 * The Node hook that lets Node 26 run IFC TypeScript from `node_modules` (commons 0005-typescript-runtime FR-029, FR-070): Node strips
 * the types of a `.ts` file by itself, except under `node_modules`, where it refuses with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.
 * Commons is installed as a Git dependency whose entry points are its `.ts` sources, so this module registers a synchronous load hook
 * (`module.registerHooks`) that strips the types of such a file with Node's own `stripTypeScriptTypes` and hands the rest on unchanged.
 * It is JavaScript because it must load before any TypeScript can, and it does nothing on Bun, which runs TypeScript anywhere.
 *
 * ```sh
 * node --import @intellectual-frontiers/commons/ts/node app.ts
 * ```
 *
 * @module
 */
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Whether a module's URL is a TypeScript file under a `node_modules` folder, which Node will not strip: a `file:` URL whose path has a
 * `node_modules` segment and ends in `.ts`, `.mts` or `.cts`. A file URL's path is always separated by `/`, Windows' too
 * (`file:///C:/w/node_modules/x/mod.ts`), so the segments are those of the URL's path, never of a platform path.
 *
 * @param {string} url - the module's URL
 * @returns {boolean} where the hook strips it
 */
export function strippable(url) {
  if (!url.startsWith("file:")) return false;
  const { pathname } = new URL(url);
  return /\.[cm]?ts$/.test(pathname) && pathname.split("/").includes("node_modules");
}

/** The runtime is Node: Bun also gives `node:module`, and needs no hook. */
const onNode = typeof process === "object" && process.versions.bun === undefined;

/**
 * A call made with Node's one warning about it held back: `stripTypeScriptTypes` says once that it is experimental, which is Node's own
 * stripping and not news to the person running the program. Every other warning is emitted as it would be.
 *
 * @template T
 * @param {() => T} f - the call
 * @returns {T} what it returns
 */
function quietly(f) {
  const emit = process.emitWarning;
  process.emitWarning = (warning, ...rest) => {
    if (String(warning).startsWith("stripTypeScriptTypes")) return;
    emit.call(process, warning, ...rest);
  };
  try {
    return f();
  } finally {
    process.emitWarning = emit;
  }
}

if (onNode) {
  nodeModule.registerHooks({
    load(url, context, nextLoad) {
      if (!strippable(url)) return nextLoad(url, context);
      const source = quietly(() =>
        nodeModule.stripTypeScriptTypes(readFileSync(fileURLToPath(url), "utf8"), { mode: "strip", sourceUrl: url }),
      );
      return { format: url.endsWith(".cts") ? "commonjs" : "module", source, shortCircuit: true };
    },
  });
}
