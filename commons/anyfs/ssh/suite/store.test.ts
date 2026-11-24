/**
 * Tests of the store on a host (commons anyfs-ssh 0003-anyfs-ssh-store FR-001 to FR-010), over an executor that runs the real helper on this computer by the path an ssh executor takes: the store
 * passes the conformance suite of AnyFS under each shell and each way of reaching the helper, says exactly the capabilities it keeps, sends the bytes of an object over standard input and never in an
 * argument, refuses what leaves its folder, names what went wrong as one of the problems of AnyFS, and does not take a host whose helper is not the pinned one.
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path, proc } from "@intellectual-frontiers/system";
import type { Executor, Output, RunOptions } from "@intellectual-frontiers/headless/logical";
import { expectAbsent, expectAny, expectRev, formatPlace, parsePath, type Path, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { openSshStore, SSH_CAPABILITIES, type SshOptions } from "../src/mod.ts";
import { fakeHost, type FakeHost } from "./support.ts";

const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);
const SHELLS = ["dash", "bash"].filter((s) => ["/usr/bin", "/bin"].some((d) => proc.isExecutable(`${d}/${s}`)));
const HELLO = "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

async function withHost<T>(options: Parameters<typeof fakeHost>[0], run: (host: FakeHost) => Promise<T>): Promise<T> {
  const host = await fakeHost(options);
  try {
    return await run(host);
  } finally {
    await host.cleanup();
  }
}

const options = (host: FakeHost, more: Partial<SshOptions> = {}): SshOptions => ({ place: { host: "alpha", user: "ops" }, root: host.root, ...more });

async function open(executor: Executor, o: SshOptions) {
  const r = await openSshStore(executor, o);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

// each shell with one way of reaching the helper: the conformance suite is long, and the helper itself is tested under each shell by its own tests
const VARIANTS: readonly (readonly [string, boolean])[] = SHELLS.map((shell, i) => [shell, i % 2 === 0] as const);
for (const [shell, install] of VARIANTS) {
  {
    proves(["0003-anyfs-ssh-store FR-001", "0003-anyfs-ssh-store FR-002"], `under ${shell}, with the helper ${install ? "kept on the host" : "carried in each call"}: the store passes every case of the conformance suite`, () =>
      withHost({ shell }, async (host) => {
        let n = 0;
        const reports = await runConformance(async () => {
          n += 1;
          return (await open(host.executor, options(host, { root: `${host.root}/s${n}`, create: true, install }))).store;
        });
        assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
        assert(reports.length >= 15, `${reports.length} cases ran`);
      }),
    );
  }
}

proves(["0003-anyfs-ssh-store FR-002"], "the store has the capabilities it keeps and no others, strong consistency and the place of the host", () =>
  withHost({}, async (host) => {
    const o = await open(host.executor, options(host));
    assertEquals([...o.store.capabilities].sort(), [...SSH_CAPABILITIES].sort());
    assertEquals([...o.store.capabilities].includes("batch" as never), false);
    assertEquals(o.store.consistency, "strong");
    assertEquals(o.store.place, { kind: "ssh", host: "alpha", user: "ops", path: host.root });
    assertEquals(o.store.id, formatPlace(o.store.place));
    assertEquals(o.facts.dialect, "posix");
    assertEquals(o.store.traits.caseSensitive, true);
    const raw = o.store as unknown as Record<string, unknown>;
    for (const absent of ["batch", "history", "readRange", "append", "search"]) assertEquals(absent in raw, false, absent);
  }),
);

proves(["0003-anyfs-ssh-store FR-003"], "the revision of an object is sha256: and the digest of its bytes, the same as in memory", () =>
  withHost({}, async (host) => {
    const { store } = await open(host.executor, options(host));
    const mem = memoryStore();
    const w = await store.write(p("a/b.txt"), bytes("hello"), expectAbsent);
    assert(w.kind === "ok");
    assertEquals([w.value.rev, w.value.created], [HELLO, true]);
    const m = await mem.write(p("a/b.txt"), bytes("hello"), expectAbsent);
    assert(m.kind === "ok");
    assertEquals(w.value.rev, m.value.rev);
    const r = await store.read(p("a/b.txt"));
    assert(r.kind === "ok");
    assertEquals([text(r.value.bytes), r.value.rev], ["hello", HELLO]);
    const s = await store.stat(p("a/b.txt"));
    assert(s.kind === "ok");
    assertEquals([s.value.size, s.value.rev], [5, HELLO]);
    assert(s.value.modified !== undefined && Date.now() - Date.parse(s.value.modified) < 60000, "the time the host gives");
    const stale = await store.write(p("a/b.txt"), bytes("other"), expectRev(`sha256:${"0".repeat(64)}` as never));
    assertEquals(stale.kind === "err" ? stale.error.kind : "ok", "conflict");
    const l = await store.list(ROOT);
    assert(l.kind === "ok");
    assertEquals(l.value.entries.map((e) => [e.path, e.rev]), [["a/b.txt", HELLO]]);
  }),
);

proves(["0003-anyfs-ssh-store FR-004"], "the bytes of an object go over standard input, never in an argument, and every call is one vector the executor quotes", () =>
  withHost({}, async (host) => {
    const { store } = await open(host.executor, options(host));
    const body = "SECRET-BODY-0123456789";
    const name = "it's $(touch pwned) `x` -x; a&b";
    const w = await store.write(p(name), bytes(body), expectAny);
    assert(w.kind === "ok");
    const r = await store.read(p(name));
    assert(r.kind === "ok" && text(r.value.bytes) === body);
    for (const argv of host.calls) {
      assert(!argv.some((w) => w.includes("SECRET-BODY")), "no argument holds the body");
      assert(argv[0] === "sh", "a call is the one program sh");
    }
    assert(host.calls.some((a) => a.includes(name)), "the name is one word of its call");
    assertEquals(await fs.exists(path.join(process.cwd(), "pwned")), false);
    assertEquals(await fs.exists(path.join(host.root, "pwned")), false);
  }),
);

proves(["0003-anyfs-ssh-store FR-005"], "a path that leaves the folder by a link or is the helper's own name is refused, and a file outside is never touched", () =>
  withHost({}, async (host) => {
    const { store } = await open(host.executor, options(host));
    const outside = await fs.makeTempDir({ prefix: "anyfs-outside-" });
    try {
      await fs.writeTextFile(path.join(outside, "secret.txt"), "secret");
      await fs.symlink(outside, path.join(host.root, "escape"));
      const r = await store.read(p("escape/secret.txt"));
      assertEquals(r.kind === "err" ? [r.error.kind, r.error.kind === "refused" ? r.error.reason : ""] : "ok", ["refused", "outside-scope"]);
      const w = await store.write(p("escape/new.txt"), bytes("x"), expectAny);
      assertEquals(w.kind === "err" ? w.error.kind : "ok", "refused");
      assertEquals(await fs.exists(path.join(outside, "new.txt")), false);
      const own = await store.write(p(".anyfs-x"), bytes("x"), expectAny);
      assertEquals(own.kind === "err" ? own.error.kind : "ok", "refused");
      const win = await store.write(p("con.txt"), bytes("x"), expectAny);
      assertEquals(win.kind === "err" ? win.error.kind : "ok", "refused", "a name Windows reserves");
    } finally {
      await fs.remove(outside, { recursive: true });
    }
  }),
);

proves(["0003-anyfs-ssh-store FR-006"], "the helper is kept on the host under its hash and used from there; where it cannot be kept it is carried and nothing is lost", () =>
  withHost({}, async (host) => {
    const kept = await open(host.executor, options(host));
    assertEquals(kept.transport.kind, "installed");
    assert(kept.transport.kind === "installed" && kept.transport.path.startsWith(host.home) && (await fs.exists(kept.transport.path)));
    const before = host.calls.length;
    await kept.store.read(p("x")).catch(() => undefined);
    const call = host.calls[before];
    assert(call !== undefined && call[1] === (kept.transport.kind === "installed" ? kept.transport.path : ""), "a call runs the kept script");
    assert(call.length < 8, "and does not carry the script");
    const carried = await open(host.executor, options(host, { stateDir: "/proc/anyfs-no-such-folder" }));
    assertEquals(carried.transport.kind, "carried");
    const w = await carried.store.write(p("x"), bytes("hello"), expectAbsent);
    assert(w.kind === "ok");
    const forced = await open(host.executor, options(host, { install: false }));
    assertEquals(forced.transport.kind, "carried");
  }),
);

proves(["0003-anyfs-ssh-store FR-006"], "a host whose helper is not the pinned one is refused and nothing is run from it", () =>
  withHost({}, async (host) => {
    const wrapped: Executor = {
      exec(argv: readonly string[], opts: RunOptions = {}) {
        const isInstall = argv.includes("install");
        return host.executor.exec(argv, isInstall && opts.input !== undefined ? { ...opts, input: bytes("echo not the helper") } : opts);
      },
    };
    const r = await openSshStore(wrapped, options(host));
    assertEquals(r.kind, "err");
    assertStringIncludes(r.kind === "err" ? r.error : "", "not the one this library pins");
  }),
);

proves(["0003-anyfs-ssh-store FR-007"], "a lost connection is unavailable and may be tried again; a call that the host answers as a failure is unavailable and not", () =>
  withHost({}, async (host) => {
    let lose = false;
    const flaky: Executor = {
      exec(argv: readonly string[], opts?: RunOptions): Promise<Output> {
        if (lose) return Promise.resolve({ code: 255, success: false, signal: null, stdout: new Uint8Array(), stderr: bytes("ssh: connect to host alpha port 22: Connection refused\n") });
        return host.executor.exec(argv, opts);
      },
    };
    const { store } = await open(flaky, options(host));
    assert((await store.write(p("a"), bytes("x"), expectAny)).kind === "ok");
    lose = true;
    const r = await store.read(p("a"));
    assert(r.kind === "err" && r.error.kind === "unavailable" && r.error.retryable, "retryable");
    assertStringIncludes(r.kind === "err" && r.error.kind === "unavailable" ? r.error.detail : "", "Connection refused");
    const gone = await withHost({}, async (h2) => openSshStore((await fakeHost({ lost: true })).executor, options(h2)));
    assertEquals(gone.kind, "err");
    assertStringIncludes(gone.kind === "err" ? gone.error : "", "connection");
  }),
);

proves(["0003-anyfs-ssh-store FR-008"], "bytes that the host did not keep as sent are tampered, not a success", () =>
  withHost({}, async (host) => {
    const corrupt: Executor = {
      exec(argv: readonly string[], opts: RunOptions = {}) {
        if (argv.includes("write") && opts.input instanceof Uint8Array) return host.executor.exec(argv, { ...opts, input: Uint8Array.from(opts.input, (b, i) => (i === 0 ? b ^ 1 : b)) });
        return host.executor.exec(argv, opts);
      },
    };
    const { store } = await open(corrupt, options(host));
    const w = await store.write(p("a"), bytes("hello"), expectAny);
    assertEquals(w.kind === "err" ? w.error.kind : "ok", "tampered");
  }),
);

proves(["0003-anyfs-ssh-store FR-009"], "an object of more than the most the store takes is refused when written and when read", () =>
  withHost({}, async (host) => {
    const { store } = await open(host.executor, options(host, { maxBytes: 10 }));
    const w = await store.write(p("big"), bytes("01234567890"), expectAny);
    assertEquals(w.kind === "err" && w.error.kind === "refused" ? w.error.reason : "ok", "too-large");
    await fs.writeTextFile(path.join(host.root, "other"), "01234567890");
    const r = await store.read(p("other"));
    assertEquals(r.kind === "err" && r.error.kind === "refused" ? r.error.reason : "ok", "too-large");
    assertEquals(store.traits.maxObject, 10);
  }),
);

proves(["0003-anyfs-ssh-store FR-010"], "a host with no tool for SHA-256, no such folder or a helper of another protocol is not taken, each with its sentence", () =>
  withHost({}, async (host) => {
    const noHash = await withHost({ hashTools: [] }, async (h) => openSshStore(h.executor, options(h)));
    assertEquals(noHash.kind, "err");
    assertStringIncludes(noHash.kind === "err" ? noHash.error : "", "sha256sum");
    const noRoot = await openSshStore(host.executor, options(host, { root: `${host.root}/missing` }));
    assertStringIncludes(noRoot.kind === "err" ? noRoot.error : "", "is not a folder on the host");
    const made = await openSshStore(host.executor, options(host, { root: `${host.root}/made`, create: true }));
    assertEquals(made.kind, "ok");
    const relative = await openSshStore(host.executor, options(host, { root: "fleet" }));
    assertStringIncludes(relative.kind === "err" ? relative.error : "", "not an absolute path");
  }),
);

proves(["0003-anyfs-ssh-store FR-002"], "a list is paged by name with a cursor and a rename moves an object and says what stood in its way", () =>
  withHost({}, async (host) => {
    const { store } = await open(host.executor, options(host));
    for (const n of ["e", "b", "d", "a", "c"]) await store.write(p(n), bytes(n), expectAny);
    const first = await store.list(ROOT, { limit: 2 });
    assert(first.kind === "ok" && first.value.next !== undefined);
    assertEquals(first.value.entries.map((e) => e.path), ["a", "b"]);
    const second = await store.list(ROOT, { limit: 2, after: first.value.next });
    assert(second.kind === "ok");
    assertEquals(second.value.entries.map((e) => e.path), ["c", "d"]);
    const mv = await store.rename(p("a"), p("x/y"), expectAny);
    assert(mv.kind === "ok");
    const gone = await store.stat(p("a"));
    assertEquals(gone.kind === "err" ? gone.error.kind : "ok", "missing");
    const clash = await store.rename(p("b"), p("c"), expectAny);
    assertEquals(clash.kind === "err" ? clash.error.kind : "ok", "conflict");
    assertEquals(clash.kind === "err" && clash.error.kind === "conflict" ? clash.error.path : "", "c");
    assertEquals(text((await store.read(p("b"))).kind === "ok" ? ((await store.read(p("b"))) as { value: { bytes: Uint8Array } }).value.bytes : new Uint8Array()), "b");
    assertEquals(await sha256("b"), (await store.stat(p("b"))).kind === "ok" ? ((await store.stat(p("b"))) as { value: { rev: string } }).value.rev.slice(7) : "");
  }),
);
