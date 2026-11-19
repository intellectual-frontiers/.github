/**
 * What the tests of the tools, the setup and the policy scans of IF Workspaces share: a real HTTP server on the loopback interface that serves real archives (a gzipped tar, a zip, a bare
 * file) and counts what it was asked, real temporary folders and a catalog value built from those archives with their real SHA-256. The server is a stand-in for the HOST that publishes the
 * artifacts, which is outside the code under test; the archives, the hashes, the unpacking and the writing are the real code's.
 *
 * @module
 */
import { gzip, tar, zip } from "@intellectual-frontiers/commons/ts/kernel";
import { sha256, sha256Of } from "@intellectual-frontiers/commons/ts/kernel";
import { serve, type Server } from "../src/platform/r-serve.ts";
import { assert } from "@intellectual-frontiers/commons/ts/runtime/test";
import type { ArtifactKind, Tool, ToolArch, ToolCatalog, ToolOs } from "../src/tools/catalog.ts";
import { version } from "../src/types.ts";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

/** An archive to serve: its bytes, its kind and the path of the executable inside it. */
export type Served = {
  readonly bytes: Uint8Array;
  readonly kind: ArtifactKind;
  readonly bin: string;
};

/** A gzipped tar holding `<name>-<version>/bin/<name>` and a README. */
export function tarball(name: string, ver: string, body = "#!/bin/sh\necho hello\n"): Served {
  const files = new Map<string, Uint8Array>([
    [`${name}-${ver}/bin/${name}`, text(body)],
    [`${name}-${ver}/README`, text("a tool\n")],
  ]);
  const t = tar(files);
  assert(t.kind === "ok", "a tar");
  return {
    bytes: gzip(t.value),
    kind: "tar.gz",
    bin: `${name}-${ver}/bin/${name}`,
  };
}

/** A zip holding `bin/<name>` and a README. */
export function zipfile(name: string, body = "#!/bin/sh\necho hello\n"): Served {
  return {
    bytes: zip(
      new Map<string, Uint8Array>([
        [`bin/${name}`, text(body)],
        ["README", text("a tool\n")],
      ]),
    ),
    kind: "zip",
    bin: `bin/${name}`,
  };
}

/** A bare executable. */
export function bare(name: string, body = "#!/bin/sh\necho hello\n"): Served {
  return { bytes: text(body), kind: "file", bin: name };
}

/** A server that serves artifacts by path and counts the requests it had. */
export type ArtifactServer = {
  readonly server: Server;
  readonly base: string;
  readonly requests: string[];
  readonly serve: Map<string, Uint8Array>;
};

/** Starts a server on the loopback interface, serving `files` by their path (a path that is not served is a 404). */
export async function artifactServer(files: ReadonlyMap<string, Uint8Array>): Promise<ArtifactServer> {
  const requests: string[] = [];
  const served = new Map(files);
  const server = await serve({}, (req) => {
    const path = new URL(req.url).pathname;
    requests.push(`${req.method} ${path}`);
    const bytes = served.get(path);
    return bytes === undefined
      ? new Response("not found", { status: 404 })
      : new Response(new Uint8Array(bytes), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
  });
  return {
    server,
    base: `http://127.0.0.1:${server.addr.port}`,
    requests,
    serve: served,
  };
}

/** A tool pinned to an archive: the real SHA-256 of its bytes (or `pin` where a test pins another). */
export async function pinned(
  name: string,
  ver: string,
  served: Served,
  url: string,
  os: ToolOs,
  arch: ToolArch,
  pin?: string,
): Promise<Tool> {
  const v = version(ver);
  assert(v.kind === "ok", "a version");
  const sum = sha256Of(pin ?? (await sha256(served.bytes)));
  assert(sum !== undefined, "a SHA-256");
  return {
    name,
    version: v.value,
    provides: [name],
    artifacts: [{ os, arch, url, sha256: sum, kind: served.kind, bin: served.bin }],
  };
}

/** A catalog of tools. */
export function catalogOf(...tools: Tool[]): ToolCatalog {
  return { tools };
}
