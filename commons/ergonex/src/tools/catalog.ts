// Spec: 0002-workspace-model FR-037
/**
 * The tool catalog (commons 0002-workspace-model FR-037, FR-038): the tools a workspace approves, each with one pinned version, what it provides and, for each operating system and
 * architecture, an `https` URL and a SHA-256, decoded once at the boundary and then checked as a whole, so that a pin that is `latest`, a range, an `http` URL, a URL that holds a
 * credential, a hash that is not a SHA-256 or a tool that is only probed (`git`, `bun`, `node`) is refused with its place and none is guessed.
 *
 * @remarks
 * The catalog is a field of the manifest (`tools`); `manifest.ts` decodes the rest of the manifest, and `decodeCatalog` decodes this field, so that the catalog can be read alone. Pure: nothing
 * is read or fetched here. The operating systems and architectures are the keys of `ergonex:Tool` in the ontology (`linux`, `macos`, `windows`; `x64`, `arm64`).
 *
 * @module
 */
import { array, formatDecodeError, literal, object, string } from "@intellectual-frontiers/commons/ts/kernel";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { sha256Of, type Sha256 } from "@intellectual-frontiers/commons/ts/kernel";
import { describeBrandError, version, type Version } from "../types.ts";

/** The operating systems of a pinned artifact (`ergonex:toolOs`). */
export type ToolOs = "linux" | "macos" | "windows";

/** The architectures of a pinned artifact (`ergonex:toolArch`). */
export type ToolArch = "x64" | "arm64";

/** All the operating systems. */
export const TOOL_OSES: readonly ToolOs[] = ["linux", "macos", "windows"];

/** All the architectures. */
export const TOOL_ARCHES: readonly ToolArch[] = ["x64", "arm64"];

/** How a downloaded artifact is laid out: one executable file, a gzipped tar or a zip. */
export type ArtifactKind = "file" | "tar.gz" | "zip";

/** The tools Ergonex only probes and never installs (0002-workspace-model FR-038). */
export const PROBED_TOOLS: readonly string[] = ["git", "bun", "node"];

/** One pinned artifact of a tool, for one operating system and architecture. */
export type ToolArtifact = {
  readonly os: ToolOs;
  readonly arch: ToolArch;
  /** An `https` URL of the pinned version, holding no credential and never a `latest`. */
  readonly url: string;
  /** The SHA-256 of the bytes at the URL. */
  readonly sha256: Sha256;
  readonly kind: ArtifactKind;
  /** The executable, as a path inside the archive (or the file's own name for kind `file`), with `/` between parts. */
  readonly bin: string;
};

/** A tool of the catalog (`ergonex:Tool`): a name, one pinned version, what it provides and its artifacts. */
export type Tool = {
  readonly name: string;
  readonly version: Version;
  /** The commands it provides on the path of the shims; the tool's own name where the manifest names none. */
  readonly provides: readonly string[];
  readonly artifacts: readonly ToolArtifact[];
};

/** The tool catalog (`ergonex:ToolCatalog`). */
export type ToolCatalog = { readonly tools: readonly Tool[] };

/** One thing wrong in the catalog, with where (as `$.tools[1].artifacts[0].url`). */
export type CatalogIssue = {
  readonly rule: "ergonex/catalog-shape" | "ergonex/catalog-tool";
  readonly path: string;
  readonly message: string;
};

const artifactShape = object(
  {
    os: literal("linux", "macos", "windows"),
    arch: literal("x64", "arm64"),
    url: string,
    sha256: string,
  },
  { kind: literal("file", "tar.gz", "zip"), bin: string },
);
const toolShape = object({ name: string, version: string, artifacts: array(artifactShape) }, { provides: array(string) });
const catalogShape = array(toolShape);

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Whether a relative path inside an archive is safe: no `..`, no absolute path, no drive letter, no backslash, no empty part. */
export function safeInnerPath(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.includes("\\") || /^[A-Za-z]:/.test(path)) return false;
  return path.split("/").every((p) => p !== "" && p !== "." && p !== "..");
}

/** Why a URL may not be a pin, or undefined where it may: `https` only (`loopbackHttp` also allows `http` to the loopback interface, for a test's own server; the catalog's decoder does so only where it is told to, by `ergonex` for a person's own local mirror), no credential, no query that carries one, and no `latest` in its path. */
export function urlProblem(text: string, loopbackHttp = false): string | undefined {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return "it is not a URL";
  }
  const loopback =
    loopbackHttp && url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]");
  if (url.protocol !== "https:" && !loopback) return "a pinned artifact is fetched over https only";
  if (url.username !== "" || url.password !== "") return "it holds a credential";
  if (/[?&](key|api_key|apikey|access_token|token|password|passwd|signature|sig)=/i.test(url.search)) return "its query holds a credential";
  if (url.pathname.split("/").some((p) => p.toLowerCase() === "latest")) return "it names `latest`, which is not a version";
  return undefined;
}

/** The catalog from the manifest's `tools` value, or every issue found: the shape first (the first field that is wrong, by its path), then the meaning, all of it. */
export function decodeCatalog(input: unknown, loopbackHttp = false): Result<ToolCatalog, readonly CatalogIssue[]> {
  const shaped = catalogShape(input, "$.tools");
  if (shaped.kind === "err") {
    return err([
      {
        rule: "ergonex/catalog-shape",
        path: shaped.error.path,
        message: `the tool catalog is not what is expected: ${formatDecodeError(shaped.error)}`,
      },
    ]);
  }
  const issues: CatalogIssue[] = [];
  const tools: Tool[] = [];
  const seenTool = new Set<string>();
  for (const [i, raw] of shaped.value.entries()) {
    const at = `$.tools[${i}]`;
    const bad = (path: string, message: string): number => issues.push({ rule: "ergonex/catalog-tool", path, message });
    if (!NAME.test(raw.name))
      bad(`${at}.name`, `${JSON.stringify(raw.name)} is not a tool name (lower-case letters, digits, \`.\`, \`_\` and \`-\`)`);
    else if (PROBED_TOOLS.includes(raw.name))
      bad(
        `${at}.name`,
        `${raw.name} is verified by a probe of its version and never installed, so it is not a tool of the catalog (0002-workspace-model FR-038)`,
      );
    else if (seenTool.has(raw.name)) bad(`${at}.name`, `${raw.name} is in the catalog twice; one pinned version each`);
    seenTool.add(raw.name);
    const v = version(raw.version);
    if (v.kind === "err") bad(`${at}.version`, describeBrandError(v.error));
    const artifacts: ToolArtifact[] = [];
    const seen = new Set<string>();
    for (const [j, a] of raw.artifacts.entries()) {
      const where = `${at}.artifacts[${j}]`;
      const problem = urlProblem(a.url, loopbackHttp);
      if (problem !== undefined) bad(`${where}.url`, `the URL is not a pin: ${problem}`);
      const sum = sha256Of(a.sha256);
      if (sum === undefined) bad(`${where}.sha256`, "the hash is not a SHA-256 (64 lower-case hexadecimal digits)");
      const kind = a.kind ?? "file";
      const bin = a.bin ?? (kind === "file" ? (a.url.split("/").pop() ?? "") : "");
      if (!safeInnerPath(bin))
        bad(
          `${where}.bin`,
          `${JSON.stringify(bin)} is not a safe path to the executable (name it, relative, with \`/\` between parts and no \`..\`)`,
        );
      const key = `${a.os}/${a.arch}`;
      if (seen.has(key)) bad(`${where}`, `${raw.name} has two artifacts for ${key}`);
      seen.add(key);
      if (problem === undefined && sum !== undefined && safeInnerPath(bin))
        artifacts.push({
          os: a.os,
          arch: a.arch,
          url: a.url,
          sha256: sum,
          kind,
          bin,
        });
    }
    if (v.kind === "ok")
      tools.push({
        name: raw.name,
        version: v.value,
        provides: raw.provides ?? [raw.name],
        artifacts,
      });
  }
  return issues.length > 0 ? err(issues) : ok({ tools });
}

/** A tool of the catalog by name. */
export function toolNamed(catalog: ToolCatalog, name: string): Tool | undefined {
  return catalog.tools.find((t) => t.name === name);
}

/** The pinned artifact of a tool for an operating system and architecture, or undefined where the catalog pins none for it. */
export function artifactFor(tool: Tool, os: ToolOs, arch: ToolArch): ToolArtifact | undefined {
  return tool.artifacts.find((a) => a.os === os && a.arch === arch);
}

/** The folder of an installed tool below the workspace's home, `.ergonex/tools/<name>/<version>` (0002-workspace-model FR-039), with `/` between parts. */
export function installDirOf(tool: Pick<Tool, "name" | "version">): string {
  return `.ergonex/tools/${tool.name}/${tool.version}`;
}

/** Whether a name is a command that a tool of the catalog provides (the catalog's `provides`, with each tool's own name). */
export function providedBy(catalog: ToolCatalog, command: string): Tool | undefined {
  return catalog.tools.find((t) => t.name === command || t.provides.includes(command));
}
