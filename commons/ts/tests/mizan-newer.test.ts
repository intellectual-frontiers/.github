/**
 * The command that reports a standard whose newest version is not the one pinned (commons 0018-standards-first FR-006, FR-014, FR-017), run as a program on the runtime this
 * test runs on against a real HTTP server on the loopback address that serves the bytes of the pin and then others, with manifests written to a temporary folder. The command run
 * for real against schema.org is not here (a test needs no network that is not its own): the run is in the commit that adds it.
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { makeTempDirSync, mkdirSync, readTextFileSync, removeSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { execPath, run } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { staleFindings } from "@intellectual-frontiers/libraries/newer";

const HERE = dirname(fromFileUrl(import.meta.url));
const NEWER = resolve(HERE, "..", "..", "libraries", "src", "newer.ts");
const IMPORT = resolve(HERE, "..", "..", "mizan", "src", "integrations", "host", "import.ts");
const CHECK = resolve(HERE, "..", "..", "libraries", "src", "check.ts");
const SCHEMA_ORG = resolve(HERE, "..", "..", "libraries", "src", "imports", "schema-org.import.ts");

const V1 = "@prefix ex: <https://example.org/> .\nex:Thing a ex:Class .\n";
const V2 = "@prefix ex: <https://example.org/> .\nex:Thing a ex:Class .\nex:Widget a ex:Class .\n";

/** A server that serves `body()` and counts what it is asked for. */
async function serve(body: () => string): Promise<{ readonly server: Server; readonly url: string; readonly asked: string[] }> {
  const asked: string[] = [];
  const server = createServer((req, res) => {
    asked.push(req.url ?? "");
    res.setHeader("content-type", "text/turtle");
    res.end(body());
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const addr = server.address();
  assert(addr !== null && typeof addr === "object");
  return { server, url: `http://127.0.0.1:${addr.port}`, asked };
}

const closed = (server: Server): Promise<void> => new Promise((done) => server.close(() => done()));

/** A manifest module that pins `pin` and, where `latest` is given, names a latest source. */
function manifest(id: string, pin: string, latest: string | undefined): string {
  return `export const manifest = ${JSON.stringify({
    standard: {
      id,
      issuer: "Example Org",
      name: "Example vocabulary",
      version: "1.0",
      location: "https://example.org/vocab",
      license: "CC0-1.0",
      redistributable: true,
      sha256: pin,
    },
    source: "vocab.ttl",
    ...(latest === undefined ? {} : { latest }),
    format: "turtle",
    namespace: { prefix: "ex", iri: "https://example.org/" },
    slice: ["Thing"],
    out: `${id}.auto.ts`,
    rdfImport: "unused",
  })};\n`;
}

async function command(imports: string, root: string, ...args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  const o = await run([execPath(), NEWER, "--imports", imports, "--root", root, ...args]);
  return { code: o.code, stderr: o.stderr, stdout: o.stdout };
}

proves(
  ["0018-standards-first FR-014"],
  "a standard whose latest source serves other bytes than its pin is one finding of one sentence, and one that serves the pin is none",
  () => {
    const f = {
      file: "imports/x.import.ts",
      id: "x",
      version: "1.0",
      pin: "a".repeat(64),
      latest: "https://example.org/latest",
      sha256: "b".repeat(64),
    };
    assertEquals(staleFindings([{ ...f, sha256: f.pin }]), []);
    const found = staleFindings([f]);
    assertEquals(
      found.map((x) => [x.rule, x.key, x.line]),
      [["mizan/standard-newer", `mizan/standard-newer imports/x.import.ts x ${"b".repeat(64)}`, 1]],
    );
    assertEquals(
      found[0]?.message,
      `x is pinned at version 1.0 (SHA-256 ${"a".repeat(64)}), and https://example.org/latest now serves SHA-256 ${"b".repeat(64)}, so a newer version of the standard may be out`,
    );
  },
);

proves(
  ["0018-standards-first FR-014", "0018-standards-first FR-017"],
  "the command fetches each latest source from a real server: the pin's bytes are no finding, other bytes are one, a manifest with no latest is not fetched, the baseline holds it and goes stale when it is fixed",
  async () => {
    const dir = makeTempDirSync({ prefix: "mizan-newer-" });
    let body = V1;
    const { server, url, asked } = await serve(() => body);
    try {
      const imports = `${dir}/imports`;
      const root = `${dir}/spec-kit`;
      mkdirSync(imports, { recursive: true });
      mkdirSync(root, { recursive: true });
      const pin = await sha256(V1);
      writeTextFileSync(`${imports}/example.import.ts`, manifest("example", pin, `${url}/latest/vocab.ttl`));
      writeTextFileSync(`${imports}/versioned.import.ts`, manifest("versioned", pin, undefined));
      writeTextFileSync(`${imports}/not-a-manifest.ts`, "this is not read");

      const same = await command(imports, root);
      assertEquals([same.code, asked], [0, ["/latest/vocab.ttl"]]);
      assertStringIncludes(same.stderr, "passed: 0 new, 0 stale, 0 held");

      body = V2;
      const moved = await command(imports, root);
      assertEquals(moved.code, 1);
      const sentence = `example is pinned at version 1.0 (SHA-256 ${pin}), and ${url}/latest/vocab.ttl now serves SHA-256 ${await sha256(V2)}, so a newer version of the standard may be out`;
      assertStringIncludes(moved.stderr, sentence);
      assertStringIncludes(moved.stderr, "mizan/standard-newer");
      assertEquals(asked, ["/latest/vocab.ttl", "/latest/vocab.ttl"]);

      assertEquals((await command(imports, root, "--write-baseline")).code, 0);
      assertStringIncludes(
        readTextFileSync(`${root}/mizan.newer.baseline.txt`),
        `mizan/standard-newer imports/example.import.ts example ${await sha256(V2)}`,
      );
      assertEquals((await command(imports, root)).code, 0);

      body = V1;
      const fixed = await command(imports, root);
      assertEquals(fixed.code, 1);
      assertStringIncludes(fixed.stderr, "no longer occurs; delete the line, the baseline only shrinks");

      body = V2.replace("Widget", "Gadget");
      const another = await command(imports, root);
      assertEquals(another.code, 1);
      assertStringIncludes(another.stderr, "now serves SHA-256");
    } finally {
      server.close();
      removeSync(dir, { recursive: true });
    }
  },
);

proves(
  ["0018-standards-first FR-017"],
  "a latest source that cannot be fetched exits 2 and is named, and is neither a pass nor a finding; a manifest that cannot be read is named too",
  async () => {
    const dir = makeTempDirSync({ prefix: "mizan-newer-down-" });
    const { server, url } = await serve(() => V1);
    try {
      const imports = `${dir}/imports`;
      mkdirSync(imports, { recursive: true });
      mkdirSync(`${dir}/spec-kit`, { recursive: true });
      writeTextFileSync(`${imports}/example.import.ts`, manifest("example", await sha256(V2), `${url}/latest/vocab.ttl`));
      assertEquals((await command(imports, `${dir}/spec-kit`)).code, 1);
      await closed(server);
      const down = await command(imports, `${dir}/spec-kit`);
      assertEquals(down.code, 2);
      assertStringIncludes(down.stderr, `imports/example.import.ts: ${url}/latest/vocab.ttl`);
      assert(!down.stderr.includes("passed"));
      const written = await command(imports, `${dir}/spec-kit`, "--write-baseline");
      assertEquals(written.code, 2);
      writeTextFileSync(`${imports}/example.import.ts`, "export const manifest = { standard: 1 };\n");
      const unreadable = await command(imports, `${dir}/spec-kit`);
      assertEquals(unreadable.code, 2);
      assertStringIncludes(unreadable.stderr, "imports/example.import.ts: the manifest has no standard");
      writeTextFileSync(`${imports}/example.import.ts`, manifest("example", await sha256(V2), "ftp://example.org/latest"));
      assertStringIncludes((await command(imports, `${dir}/spec-kit`)).stderr, "latest must be an https:// URL");
    } finally {
      server.close();
      removeSync(dir, { recursive: true });
    }
  },
);

proves(
  ["0018-standards-first FR-017"],
  "the offline checks do not use the network: check.ts and import.ts --check pass with every proxy and every host pointed at nothing",
  async () => {
    const dead = {
      HTTPS_PROXY: "http://127.0.0.1:1",
      HTTP_PROXY: "http://127.0.0.1:1",
      https_proxy: "http://127.0.0.1:1",
      NODE_USE_ENV_PROXY: "1",
    };
    const rules = await run([execPath(), CHECK], { env: dead });
    assertEquals(rules.code, 0);
    const pins = await run([execPath(), IMPORT, SCHEMA_ORG, "--check"], { env: dead });
    assertEquals([pins.code, pins.stderr], [0, ""]);
    assertStringIncludes(readTextFileSync(SCHEMA_ORG), 'latest: "https://schema.org/version/latest/');
    const unreachable = await run([execPath(), NEWER], { env: dead });
    assertEquals(unreachable.code, 2);
    assertStringIncludes(unreachable.stderr, "imports/schema-org.import.ts: https://schema.org/version/latest/");
  },
);
