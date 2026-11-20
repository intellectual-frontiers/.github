/**
 * Tests of the tool catalog, the version probes, the pinned install and the inventory of IF Workspaces (commons 0002-workspace-model FR-037 to FR-040, FR-033, 0001-ergonex FR-018). The install runs
 * over the runtime's real `liveTransport` against a real HTTP server on the loopback interface that serves real archives (a gzipped tar, a zip, a bare file); the server is a stand-in for the
 * HOST that publishes the artifacts, which is outside the code under test. A pinned `https` URL is also fetched through `recordedTransport` with the exchange recorded by hand. The probes run the
 * real `git` and `node`/`bun` where installed. What needs the public hosts that publish a tool (a real download from them) is not tested.
 *
 * @module
 */
import { fakePlaces } from "./ergonex-fixtures.ts";
import { readdirSync } from "node:fs";
import { readFile, readTextFile, writeTextFile, exists, walkFiles, makeTempDir, mkdir, remove } from "../src/platform/r-fs.ts";
import { liveTransport, recordedTransport } from "../src/platform/r-http-client.ts";
import { join } from "../src/platform/r-path.ts";
import { build, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { decodeCatalog, artifactFor, installDirOf, urlProblem, type ToolCatalog, type ToolOs } from "../src/tools/catalog.ts";
import { installTool, installedTools, toolDir, verifyTool } from "../src/tools/host/install.ts";
import { probeAll, probeTool } from "../src/tools/host/probe.ts";
import { tools } from "../src/tools/host/tools.ts";
import { parseToolsArgs } from "../src/tools/args.ts";
import { exportDocument, outsideCatalogFindings, oscalInventoryItems, purlOf } from "../src/tools/inventory.ts";
import { describeProbe, judgeProbe, probeFinding, PROBES } from "../src/tools/probe.ts";
import { INSTALL_RECORD, describeInstallError, shimOf, unpackVerified } from "../src/tools/install.ts";
import { UNAPPROVED_GRACE_DAYS } from "../src/findings.ts";
import { artifactServer, bare, catalogOf, pinned, tarball, zipfile } from "./ergonex-tools-fixtures.ts";

const OS: ToolOs = build.os === "darwin" ? "macos" : build.os === "windows" ? "windows" : "linux";
const ARCH = build.arch === "aarch64" ? "arm64" : "x64";
const SUM = "a".repeat(64);

const pin = (over: Record<string, unknown> = {}): unknown => ({
  name: "hello",
  version: "1.2.3",
  artifacts: [
    {
      os: "linux",
      arch: "x64",
      url: "https://example.org/hello-1.2.3.tar.gz",
      sha256: SUM,
      kind: "tar.gz",
      bin: "hello-1.2.3/bin/hello",
    },
  ],
  ...over,
});

proves(
  ["0002-workspace-model FR-037"],
  "the catalog holds each tool's name, one pinned version, what it provides and, per system and architecture, an https URL and a SHA-256",
  () => {
    const c = decodeCatalog([
      pin(),
      pin({
        name: "other",
        provides: ["o1", "o2"],
        artifacts: [
          {
            os: "windows",
            arch: "arm64",
            url: "https://example.org/o.zip",
            sha256: SUM,
            kind: "zip",
            bin: "bin/o.exe",
          },
        ],
      }),
    ]);
    assert(c.kind === "ok", JSON.stringify(c));
    assertEquals(
      c.value.tools.map((t) => [
        t.name,
        t.version,
        t.provides,
        t.artifacts.map((a) => [a.os, a.arch, a.url.startsWith("https://"), a.sha256.length, a.kind, a.bin]),
      ]),
      [
        ["hello", "1.2.3", ["hello"], [["linux", "x64", true, 64, "tar.gz", "hello-1.2.3/bin/hello"]]],
        ["other", "1.2.3", ["o1", "o2"], [["windows", "arm64", true, 64, "zip", "bin/o.exe"]]],
      ],
    );
    const hello = c.value.tools[0];
    assert(hello !== undefined);
    assertEquals(artifactFor(hello, "linux", "x64")?.kind, "tar.gz");
    assertEquals(artifactFor(hello, "linux", "arm64"), undefined);
    assertEquals(installDirOf(hello), "hello/1.2.3");
  },
);

proves(
  ["0002-workspace-model FR-037", "0002-workspace-model FR-039"],
  "the catalog refuses latest, a range, an http URL, a credential in a URL, a hash that is not a SHA-256 and a path that leaves the folder",
  () => {
    const refused = (over: Record<string, unknown>, rule: string, part: string): void => {
      const r = decodeCatalog([pin(over)]);
      assert(r.kind === "err", `${rule} should be refused`);
      assert(
        r.error.some((i) => i.path.includes(part) && i.rule === rule),
        JSON.stringify(r.error),
      );
    };
    for (const v of ["latest", "^1.2.0", "1.x", ">=1", "v1.2.3", "1.2"]) refused({ version: v }, "ergonex/catalog-tool", ".version");
    const art = (over: Record<string, unknown>): Record<string, unknown> => ({
      artifacts: [
        {
          os: "linux",
          arch: "x64",
          url: "https://example.org/hello-1.2.3.tar.gz",
          sha256: SUM,
          kind: "tar.gz",
          bin: "bin/hello",
          ...over,
        },
      ],
    });
    refused(art({ url: "http://example.org/hello.tar.gz" }), "ergonex/catalog-tool", ".url");
    refused(art({ url: "https://example.org/releases/latest/hello.tar.gz" }), "ergonex/catalog-tool", ".url");
    refused(art({ url: "https://user:pw@example.org/hello.tar.gz" }), "ergonex/catalog-tool", ".url");
    refused(art({ url: "https://example.org/hello.tar.gz?token=abc" }), "ergonex/catalog-tool", ".url");
    refused(art({ sha256: "not-a-hash" }), "ergonex/catalog-tool", ".sha256");
    refused(art({ sha256: "a".repeat(63) }), "ergonex/catalog-tool", ".sha256");
    const upper = decodeCatalog([
      pin({
        artifacts: [
          {
            os: "linux",
            arch: "x64",
            url: "https://example.org/h.tgz",
            sha256: SUM.toUpperCase(),
            kind: "tar.gz",
            bin: "h",
          },
        ],
      }),
    ]);
    assertEquals(upper.kind === "ok" ? upper.value.tools[0]?.artifacts[0]?.sha256 : undefined, SUM, "a hash is kept in lower case");
    refused(art({ bin: "../../etc/passwd" }), "ergonex/catalog-tool", ".bin");
    refused(art({ bin: "/bin/sh" }), "ergonex/catalog-tool", ".bin");
    refused(
      {
        artifacts: [
          {
            os: "plan9",
            arch: "x64",
            url: "https://example.org/x",
            sha256: SUM,
          },
        ],
      },
      "ergonex/catalog-shape",
      "os",
    );
    assertEquals(urlProblem("https://example.org/a.tar.gz"), undefined);
    assert(urlProblem("http://127.0.0.1:1/a") !== undefined, "http is refused unless the loopback is allowed for a test");
    assertEquals(urlProblem("http://127.0.0.1:1/a", true), undefined);
  },
);

proves(["0002-workspace-model FR-038"], "git, bun and node are only probed, never installed: the catalog refuses them as tools", () => {
  for (const name of ["git", "bun", "node"]) {
    const r = decodeCatalog([pin({ name })]);
    assert(r.kind === "err", name);
    assertStringIncludes(JSON.stringify(r.error), "never installed");
  }
  assertEquals(PROBES, ["git", "bun", "node"]);
});

proves(
  ["0002-workspace-model FR-038"],
  "a probe judges what a tool said of its version: enough, too old, missing, or not a version; each failure says what to do",
  () => {
    assertEquals(judgeProbe("git", "git version 2.43.0.windows.1\n"), {
      kind: "ok",
      tool: "git",
      version: "2.43.0",
    });
    assertEquals(judgeProbe("node", "v26.1.0\n"), {
      kind: "ok",
      tool: "node",
      version: "26.1.0",
    });
    assertEquals(judgeProbe("bun", "1.4.4\n"), {
      kind: "ok",
      tool: "bun",
      version: "1.4.4",
    });
    const old = judgeProbe("node", "v22.0.0");
    assertEquals(old.kind, "too-old");
    assertStringIncludes(describeProbe(old), "nodejs.org");
    const missing = judgeProbe("bun", undefined);
    assertEquals(missing.kind, "missing");
    assertStringIncludes(describeProbe(missing), "bun.sh");
    assertEquals(judgeProbe("git", "no number here").kind, "unreadable");
    assertEquals(probeFinding(old, "2026-11-17")?.severity, "Error");
    assertEquals(probeFinding(judgeProbe("git", "git version 2.43.0"), "2026-11-17"), undefined);
  },
);

proves(
  ["0002-workspace-model FR-038"],
  "the real probes run the real programs, and a program that is not there is a missing probe, not a crash",
  async () => {
    const none = await probeTool("git", "ergonex-no-such-program-xyz");
    assertEquals(none, { kind: "missing", tool: "git" });
    if (which("git") !== undefined) {
      const git = await probeTool("git");
      assert(git.kind === "ok" || git.kind === "too-old", JSON.stringify(git));
    }
    const all = await probeAll({ bun: "ergonex-no-such-program-xyz" });
    assertEquals(
      all.map((p) => p.tool),
      ["git", "bun", "node"],
    );
    assertEquals(all[1]?.kind, "missing");
  },
);

const SERVED_PATH = "/releases/hello-1.0.0.tar.gz";

proves(
  ["0002-workspace-model FR-039", "0001-ergonex FR-018"],
  "a pinned artifact is fetched, its hash checked and the tool installed under the tools folder of ergonex's data, <name>/<version>/, with a shim and an install record",
  async () => {
    const home = await makeTempDir({ prefix: "ergonex-tools-" });
    const art = tarball("hello", "1.0.0");
    const { server, base, requests } = await artifactServer(new Map([[SERVED_PATH, art.bytes]]));
    try {
      const tool = await pinned("hello", "1.0.0", art, `${base}${SERVED_PATH}`, OS, ARCH);
      const r = await installTool(
        {
          places: fakePlaces(home),
          transport: liveTransport(),
          os: OS,
          arch: ARCH,
          loopbackHttp: true,
        },
        tool,
      );
      assert(r.kind === "ok", r.kind === "err" ? describeInstallError(r.error) : "");
      assertEquals(requests, [`GET ${SERVED_PATH}`]);
      const dir = toolDir(fakePlaces(home), tool);
      assertEquals(dir, join(fakePlaces(home).tools, "hello", "1.0.0"));
      assertEquals(await readTextFile(join(dir, "hello-1.0.0", "bin", "hello")), "#!/bin/sh\necho hello\n");
      assertEquals(await readTextFile(join(dir, "hello-1.0.0", "README")), "a tool\n");
      assert(await exists(join(dir, INSTALL_RECORD)));
      assertEquals(r.value.shims.length, 1);
      const shim = await readTextFile(r.value.shims[0] ?? "");
      assertStringIncludes(shim, r.value.exe);
      // a second install fetches nothing: the tool is whole
      const again = await installTool(
        {
          places: fakePlaces(home),
          transport: liveTransport(),
          os: OS,
          arch: ARCH,
          loopbackHttp: true,
        },
        tool,
      );
      assert(again.kind === "ok" && again.value.already);
      assertEquals(requests.length, 1);
      assertEquals(await verifyTool(fakePlaces(home), tool, OS, ARCH), {
        kind: "ok",
        value: [],
      });
      assertEquals(
        (await installedTools(fakePlaces(home))).map((t) => [t.name, t.version]),
        [["hello", "1.0.0"]],
      );
    } finally {
      await server.shutdown();
      await remove(home, { recursive: true });
    }
  },
);

proves(
  ["0002-workspace-model FR-039"],
  "a zip and a bare file install the same way: the hash is checked, the executable is where the catalog says",
  async () => {
    const home = await makeTempDir({ prefix: "ergonex-tools-" });
    const z = zipfile("zed");
    const b = bare("barefile");
    const { server, base } = await artifactServer(
      new Map([
        ["/z.zip", z.bytes],
        ["/b", b.bytes],
      ]),
    );
    try {
      const zt = await pinned("zed", "2.0.0", z, `${base}/z.zip`, OS, ARCH);
      const bt = await pinned("barefile", "0.1.0", b, `${base}/b`, OS, ARCH);
      for (const t of [zt, bt]) {
        const r = await installTool(
          {
            places: fakePlaces(home),
            transport: liveTransport(),
            os: OS,
            arch: ARCH,
            loopbackHttp: true,
          },
          t,
        );
        assert(r.kind === "ok", r.kind === "err" ? describeInstallError(r.error) : "");
        assert(await exists(r.value.exe), r.value.exe);
      }
      assertEquals((await installedTools(fakePlaces(home))).map((t) => t.name).sort(), ["barefile", "zed"]);
    } finally {
      await server.shutdown();
      await remove(home, { recursive: true });
    }
  },
);

proves(
  ["0002-workspace-model FR-039"],
  "an artifact whose hash differs from the pin is refused and NOTHING is written, not a folder, not a partial file, not a shim",
  async () => {
    const home = await makeTempDir({ prefix: "ergonex-tools-" });
    const art = tarball("hello", "1.0.0");
    const { server, base } = await artifactServer(new Map([[SERVED_PATH, art.bytes]]));
    try {
      const wrong = await pinned("hello", "1.0.0", art, `${base}${SERVED_PATH}`, OS, ARCH, "0".repeat(64));
      const r = await installTool(
        {
          places: fakePlaces(home),
          transport: liveTransport(),
          os: OS,
          arch: ARCH,
          loopbackHttp: true,
        },
        wrong,
      );
      assert(r.kind === "err" && r.error.kind === "hash-mismatch", JSON.stringify(r));
      assertStringIncludes(describeInstallError(r.error), "nothing was written");
      assertEquals(readdirSync(home), []);
      // and the right pin installs
      const right = await pinned("hello", "1.0.0", art, `${base}${SERVED_PATH}`, OS, ARCH);
      const ok = await installTool(
        {
          places: fakePlaces(home),
          transport: liveTransport(),
          os: OS,
          arch: ARCH,
          loopbackHttp: true,
        },
        right,
      );
      assert(ok.kind === "ok");
    } finally {
      await server.shutdown();
      await remove(home, { recursive: true });
    }
  },
);

proves(
  ["0002-workspace-model FR-039"],
  "the hash is the one of the bytes, checked both ways on the pure function: right bytes unpack, one flipped byte does not",
  async () => {
    const art = tarball("hello", "1.0.0");
    const tool = await pinned("hello", "1.0.0", art, "https://example.org/hello.tar.gz", "linux", "x64");
    const a = tool.artifacts[0];
    assert(a !== undefined);
    const good = await unpackVerified(a, art.bytes);
    assert(good.kind === "ok");
    assertEquals([...good.value.keys()].sort(), ["hello-1.0.0/README", "hello-1.0.0/bin/hello"]);
    const flipped = new Uint8Array(art.bytes);
    flipped[flipped.length - 1] = (flipped[flipped.length - 1] ?? 0) ^ 1;
    const bad = await unpackVerified(a, flipped);
    assert(bad.kind === "err" && bad.error.kind === "hash-mismatch");
    // the right hash but the executable is not in the archive
    const missing = await unpackVerified({ ...a, bin: "nowhere/hello" }, art.bytes);
    assert(missing.kind === "err" && missing.error.kind === "missing-bin");
  },
);

proves(
  ["0002-workspace-model FR-039"],
  "a recorded exchange of an https pin installs the same way, and a 404, a missing system and a pin that is not a pin write nothing",
  async () => {
    const home = await makeTempDir({ prefix: "ergonex-tools-" });
    try {
      const art = tarball("hello", "1.0.0");
      const url = "https://downloads.example.org/hello-1.0.0.tar.gz";
      const tool = await pinned("hello", "1.0.0", art, url, OS, ARCH);
      const recorded = recordedTransport([
        {
          method: "GET",
          url,
          status: 200,
          headers: { "content-type": "application/gzip" },
          body: "",
          bytes: art.bytes,
        },
      ]);
      const r = await installTool({ places: fakePlaces(home), transport: recorded, os: OS, arch: ARCH }, tool);
      assert(r.kind === "ok", r.kind === "err" ? describeInstallError(r.error) : "");

      const other = await makeTempDir({ prefix: "ergonex-tools-" });
      const gone = recordedTransport([{ method: "GET", url, status: 404, headers: {}, body: "no" }]);
      const f = await installTool({ places: fakePlaces(other), transport: gone, os: OS, arch: ARCH }, tool);
      assert(f.kind === "err" && f.error.kind === "fetch" && f.error.reason.includes("404"));
      const nosystem = await installTool(
        {
          places: fakePlaces(other),
          transport: gone,
          os: OS === "linux" ? "windows" : "linux",
          arch: ARCH,
        },
        tool,
      );
      assert(nosystem.kind === "err" && nosystem.error.kind === "no-artifact");
      const a = tool.artifacts[0];
      assert(a !== undefined);
      const latest = await installTool(
        { places: fakePlaces(other), transport: gone, os: OS, arch: ARCH },
        {
          ...tool,
          artifacts: [{ ...a, url: "https://example.org/latest/hello.tgz" }],
        },
      );
      assert(latest.kind === "err" && latest.error.kind === "unpinned", JSON.stringify(latest));
      const http = await installTool(
        { places: fakePlaces(other), transport: gone, os: OS, arch: ARCH },
        { ...tool, artifacts: [{ ...a, url: "http://example.org/hello.tgz" }] },
      );
      assert(http.kind === "err" && http.error.kind === "unpinned");
      assertEquals(readdirSync(other), []);
      await remove(other, { recursive: true });
    } finally {
      await remove(home, { recursive: true });
    }
  },
);

proves(
  ["0002-workspace-model FR-039", "0002-workspace-model FR-033"],
  "ergonex tools verify finds a file changed, removed or added since the install, and reports it as an error",
  async () => {
    const home = await makeTempDir({ prefix: "ergonex-tools-" });
    const art = tarball("hello", "1.0.0");
    const { server, base } = await artifactServer(new Map([[SERVED_PATH, art.bytes]]));
    try {
      const tool = await pinned("hello", "1.0.0", art, `${base}${SERVED_PATH}`, OS, ARCH);
      const catalog = catalogOf(tool);
      const r = await installTool(
        {
          places: fakePlaces(home),
          transport: liveTransport(),
          os: OS,
          arch: ARCH,
          loopbackHttp: true,
        },
        tool,
      );
      assert(r.kind === "ok");
      const deps = {
        places: fakePlaces(home),
        catalog,
        os: OS,
        arch: ARCH,
        today: "2026-11-17",
        at: "2026-11-17T10:00:00Z",
        firstSeen: {},
        probe: () => probeAll(),
        workspace: "ws",
      } as const;
      const clean = await tools({ command: "list" }, { ...deps, probe: () => Promise.resolve([]) });
      assert(clean.kind === "ok");
      assertEquals(
        clean.value.rows.map((x) => [x.name, x.status]),
        [["hello", "installed"]],
      );
      assertEquals(clean.value.findings, []);
      // change a file, add one
      await writeTextFile(r.value.exe, "#!/bin/sh\necho tampered\n");
      await writeTextFile(join(r.value.dir, "extra.txt"), "x");
      const v = await tools({ command: "verify" }, { ...deps, probe: () => Promise.resolve([]) });
      assert(v.kind === "ok");
      assertEquals(v.value.rows[0]?.status, "drifted");
      assertEquals(v.value.exit, "Findings");
      const messages = v.value.findings.map((f) => f.message).join("\n");
      assertStringIncludes(messages, "is not the file that was installed");
      assertStringIncludes(messages, "extra.txt");
      assert(v.value.findings.every((f) => f.severity === "Error" && f.ruleId === "ergonex/tool-drift"));
    } finally {
      await server.shutdown();
      await remove(home, { recursive: true });
    }
  },
);

proves(
  ["0002-workspace-model FR-033"],
  "a tool outside the catalog is informational for 90 days from the day first seen and a warning after; the day is never restarted",
  async () => {
    const catalog = catalogOf();
    const at = (seen: string, today: string): string[] =>
      outsideCatalogFindings(catalog, [{ name: "mystery", firstSeen: seen }], today).map((f) => f.severity);
    assertEquals(UNAPPROVED_GRACE_DAYS, 90);
    assertEquals(at("2026-08-18", "2026-11-16"), ["Informational"]); // 90 days
    assertEquals(at("2026-08-17", "2026-11-16"), ["Warning"]); // 91 days
    assertEquals(at("2026-11-17", "2026-11-17"), ["Informational"]);
    // git, bun and node are never outside the catalog
    assertEquals(outsideCatalogFindings(catalog, [{ name: "git", firstSeen: "2020-01-01" }], "2026-11-17"), []);
    // in the real folder: a tool put there by hand is found, its first day taken from the state record and kept
    const home = await makeTempDir({ prefix: "ergonex-tools-" });
    try {
      await mkdir(join(fakePlaces(home).tools, "mystery", "1.0.0"), {
        recursive: true,
      });
      await writeTextFile(join(fakePlaces(home).tools, "mystery", "1.0.0", "x"), "x");
      const base = {
        places: fakePlaces(home),
        catalog,
        os: OS,
        arch: ARCH,
        at: "2026-11-17T10:00:00Z",
        probe: () => Promise.resolve([]),
        workspace: "ws",
      } as const;
      const first = await tools({ command: "verify" }, { ...base, today: "2026-11-17", firstSeen: {} });
      assert(first.kind === "ok");
      assertEquals(
        first.value.findings.map((f) => [f.subject, f.severity, f.firstSeen]),
        [["mystery", "Informational", "2026-11-17"]],
      );
      assertEquals(first.value.exit, "Ok");
      const later = await tools({ command: "verify" }, { ...base, today: "2027-02-20", firstSeen: first.value.seen });
      assert(later.kind === "ok");
      assertEquals(
        later.value.findings.map((f) => [f.severity, f.firstSeen]),
        [["Warning", "2026-11-17"]],
      );
      assertEquals(later.value.exit, "Findings");
    } finally {
      await remove(home, { recursive: true });
    }
  },
);

proves(
  ["0002-workspace-model FR-040"],
  "the catalog is OSCAL inventory-items and what is installed is SPDX 2.3 and CycloneDX 1.6, each with the pinned SHA-256",
  async () => {
    const art = tarball("hello", "1.0.0");
    const tool = await pinned("hello", "1.0.0", art, "https://downloads.example.org/hello-1.0.0.tar.gz", "linux", "x64");
    const catalog: ToolCatalog = catalogOf(tool);
    const sum = tool.artifacts[0]?.sha256 ?? "";
    const items = await oscalInventoryItems(catalog);
    assertEquals(items.length, 1);
    assertEquals(items[0]?.description, "hello 1.0.0 for linux x64");
    assert(items[0]?.props.some((p) => p.name === "sha256" && p.value === sum));
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(items[0]?.uuid ?? ""), "a UUID of version 5");
    assertEquals((await oscalInventoryItems(catalog))[0]?.uuid, items[0]?.uuid);
    const installed = [
      {
        name: "hello",
        version: "1.0.0",
        os: "linux" as const,
        arch: "x64" as const,
        url: "https://downloads.example.org/hello-1.0.0.tar.gz",
        sha256: sum,
      },
    ];
    const spdx = await exportDocument("spdx", catalog, installed, "2026-11-17T10:00:00Z", "ws");
    assertEquals(spdx["spdxVersion"], "SPDX-2.3");
    const pkg = (
      spdx["packages"] as {
        name: string;
        versionInfo: string;
        checksums: { algorithm: string; checksumValue: string }[];
      }[]
    )[0];
    assertEquals(
      [pkg?.name, pkg?.versionInfo, pkg?.checksums[0]?.algorithm, pkg?.checksums[0]?.checksumValue],
      ["hello", "1.0.0", "SHA256", sum],
    );
    const cdx = await exportDocument("cyclonedx", catalog, installed, "2026-11-17T10:00:00Z", "ws");
    assertEquals([cdx["bomFormat"], cdx["specVersion"]], ["CycloneDX", "1.6"]);
    assert(String(cdx["serialNumber"]).startsWith("urn:uuid:"));
    const comp = (
      cdx["components"] as {
        name: string;
        purl: string;
        hashes: { alg: string; content: string }[];
      }[]
    )[0];
    assertEquals(
      [comp?.name, comp?.purl, comp?.hashes[0]?.alg, comp?.hashes[0]?.content],
      ["hello", purlOf("hello", "1.0.0"), "SHA-256", sum],
    );
    // the same facts give the same documents
    assertEquals(JSON.stringify(await exportDocument("spdx", catalog, installed, "2026-11-17T10:00:00Z", "ws")), JSON.stringify(spdx));
    const oscal = await exportDocument("oscal", catalog, installed, "2026-11-17T10:00:00Z", "ws");
    assertEquals((oscal["inventory-items"] as unknown[]).length, 1);
  },
);

proves(
  ["0001-ergonex FR-017", "0002-workspace-model FR-030"],
  "ergonex tools never installs: its arguments name no install and its run writes nothing",
  async () => {
    for (const word of ["install", "update", "add"]) {
      const r = parseToolsArgs([word, "hello"]);
      assert(r.kind === "err");
      assertStringIncludes(r.error.message, "ergonex setup");
    }
    assertEquals(parseToolsArgs([]), {
      kind: "ok",
      value: { command: "list" },
    });
    assertEquals(parseToolsArgs(["export", "spdx"]), {
      kind: "ok",
      value: { command: "export", format: "spdx" },
    });
    assert(parseToolsArgs(["export", "pdf"]).kind === "err");
    const home = await makeTempDir({ prefix: "ergonex-tools-" });
    try {
      const art = tarball("hello", "1.0.0");
      const tool = await pinned("hello", "1.0.0", art, "https://downloads.example.org/hello-1.0.0.tar.gz", OS, ARCH);
      const r = await tools(
        { command: "list" },
        {
          places: fakePlaces(home),
          catalog: catalogOf(tool),
          os: OS,
          arch: ARCH,
          today: "2026-11-17",
          at: "2026-11-17T10:00:00Z",
          firstSeen: {},
          probe: () => Promise.resolve([]),
          workspace: "ws",
        },
      );
      assert(r.kind === "ok");
      assertEquals(
        r.value.rows.map((x) => x.status),
        ["not-installed"],
      );
      assertEquals(await walkFiles(home), []);
    } finally {
      await remove(home, { recursive: true });
    }
  },
);

proves(
  ["0002-workspace-model FR-039"],
  "a shim runs the installed executable with its arguments: a sh script on Linux and macOS, a .cmd file on Windows, and a path that cannot be quoted safely is refused",
  () => {
    const sh = shimOf("linux", "hello", "/w/it's here/hello");
    assert(sh.kind === "ok");
    assertEquals(sh.value, {
      name: "hello",
      text: `#!/bin/sh\nexec '/w/it'\\''s here/hello' "$@"\n`,
    });
    const cmd = shimOf("windows", "hello", "C:\\w\\hello.exe");
    assert(cmd.kind === "ok");
    assertEquals(cmd.value, {
      name: "hello.cmd",
      text: '@echo off\r\n"C:\\w\\hello.exe" %*\r\n',
    });
    assert(shimOf("windows", "hello", "C:\\100%\\hello.exe").kind === "err");
    assert(shimOf("linux", "../evil", "/x").kind === "err");
    assert(shimOf("linux", "hello", "/x\n/y").kind === "err");
  },
);

proves(["0002-workspace-model FR-039"], "a real installed shim runs the real executable", async () => {
  if (OS === "windows") return;
  const home = await makeTempDir({ prefix: "ergonex-tools-" });
  const art = tarball("hello", "1.0.0", '#!/bin/sh\necho "hello $1"\n');
  const { server, base } = await artifactServer(new Map([[SERVED_PATH, art.bytes]]));
  try {
    const tool = await pinned("hello", "1.0.0", art, `${base}${SERVED_PATH}`, OS, ARCH);
    const r = await installTool(
      {
        places: fakePlaces(home),
        transport: liveTransport(),
        os: OS,
        arch: ARCH,
        loopbackHttp: true,
      },
      tool,
    );
    assert(r.kind === "ok");
    const out = await run([r.value.shims[0] ?? "", "world"]);
    assertEquals(out.stdout.trim(), "hello world");
    assertEquals(new TextDecoder().decode(await readFile(r.value.exe)).includes("hello"), true);
  } finally {
    await server.shutdown();
    await remove(home, { recursive: true });
  }
});
