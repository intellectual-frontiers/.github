/**
 * Tests of the state record, the comparison `ifws verify` makes, the unified diff `render --diff` shows and the checks of `ifws doctor` as pure functions (commons 0024-ifws-host FR-009, FR-010, FR-012,
 * 0023-if-workspaces FR-012, FR-014, FR-036, 0025-ifws FR-014): the record decodes and encodes the same bytes and refuses a hand-damaged one; a hand edit is an error and a missing, an unrecorded and
 * a drifted file are each a warning; a diff has hunks a person can read; a path of 270 characters is an error on Windows while long paths are off and that long paths are off is informational while none
 * is; and each file system the doctor warns about is classified from the type a probe reports, never from the path.
 *
 * @module
 */
import { sha256 } from "../kernel/sha256.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { unifiedDiff } from "../workspaces/diff.ts";
import { classifyFs, findingsOf, fsCheck, hookChecks, pathChecks, runtimeChecks, severityOf } from "../workspaces/doctor.ts";
import { repoPath } from "../workspaces/portable.ts";
import {
  decodeStateRecord,
  EMPTY_RECORD,
  encodeStateRecord,
  type FileFacts,
  verifyFindings,
  withFile,
  withoutFile,
} from "../workspaces/state-record.ts";
import { generated } from "../workspaces/render.ts";

const TODAY = "2026-11-17";

proves(
  ["0024-ifws-host FR-009"],
  "the state record holds the hash and generator of each file, the plan's hash, the version and the first-seen days, and reads back the same bytes",
  async () => {
    const f = generated("a.auto.md", { format: "markdown", text: "x" }, { generator: "ifws templates/a" });
    assert(f.kind === "ok");
    if (f.kind !== "ok") return;
    const h = await sha256(f.value.content);
    let r = withFile({ ...EMPTY_RECORD, plan: await sha256("plan"), firstSeen: { "ifws-foo": "2026-08-01" } }, f.value, h);
    const text = encodeStateRecord(r);
    const back = decodeStateRecord(text);
    assert(back.kind === "ok");
    if (back.kind === "ok") {
      assertEquals(back.value, r);
      assertEquals(encodeStateRecord(back.value), text);
    }
    assertStringIncludes(text, '"_generated"');
    assert(text.endsWith("}\n"));
    r = withoutFile(r, "a.auto.md");
    assertEquals(Object.keys(r.files), []);
    for (const bad of [
      "",
      "{",
      "[]",
      JSON.stringify({ ifws: "1", files: { x: { sha256: "no", generator: "g" } }, firstSeen: {} }),
      JSON.stringify({ ifws: "1", files: {}, firstSeen: { a: "yesterday" } }),
    ]) {
      assertEquals(decodeStateRecord(bad).kind, "err", bad);
    }
  },
);

proves(
  ["0024-ifws-host FR-010"],
  "verify reports a hand edit as an error, and a missing recorded file, an unrecorded .auto. file and a drift each as a warning; a file as written is clean",
  async () => {
    const [a, b, c] = [await sha256("a"), await sha256("b"), await sha256("c")];
    const facts: FileFacts[] = [
      { path: "clean.auto.md", onDisk: a, recorded: a, wanted: a },
      { path: "edited.auto.md", onDisk: b, recorded: a, wanted: a },
      { path: "missing.auto.md", recorded: a, wanted: a },
      { path: "stray.auto.md", onDisk: a },
      { path: "drift.auto.md", onDisk: a, recorded: a, wanted: c },
      { path: "unwritten.auto.md", wanted: a },
    ];
    const got = verifyFindings(facts, TODAY).map((f) => [f.subject, f.ruleId, f.severity]);
    assertEquals(got, [
      ["edited.auto.md", "ifws/generated-edited", "Error"],
      ["missing.auto.md", "ifws/generated-missing", "Warning"],
      ["stray.auto.md", "ifws/generated-unrecorded", "Warning"],
      ["drift.auto.md", "ifws/generated-drift", "Warning"],
      ["unwritten.auto.md", "ifws/generated-drift", "Warning"],
    ]);
  },
);

proves(
  ["0024-ifws-host FR-012"],
  "a unified diff names the file, has hunks with three lines of context, and is empty where nothing differs",
  () => {
    const before = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n");
    const after = before.replace("line 6", "line six").replace("line 11", "line eleven");
    const d = unifiedDiff("AGENTS.auto.md", `${before}\n`, `${after}\n`);
    assert(d.startsWith("--- a/AGENTS.auto.md\n+++ b/AGENTS.auto.md\n"));
    assertStringIncludes(d, "-line 6\n+line six\n");
    assertStringIncludes(d, "-line 11\n+line eleven\n");
    assertEquals(d.split("\n").filter((l) => l.startsWith("@@")).length, 1, "the two changes are within the context of each other");
    const far = unifiedDiff(
      "x",
      `${Array.from({ length: 40 }, (_, i) => `l${i}`).join("\n")}\n`,
      `${Array.from({ length: 40 }, (_, i) => (i === 2 || i === 37 ? "changed" : `l${i}`)).join("\n")}\n`,
    );
    assertEquals(far.split("\n").filter((l) => l.startsWith("@@")).length, 2);
    assertEquals(unifiedDiff("x", "same\n", "same\n"), "");
    assertStringIncludes(unifiedDiff("x", "", "new\n"), "+new\n");
    assertStringIncludes(unifiedDiff("x", "old\n", ""), "-old\n");
  },
);

function longPath(): ReturnType<typeof repoPath> {
  return repoPath(["gitlab.com", "g".repeat(60), "h".repeat(60), "i".repeat(60), "r".repeat(60)]);
}

proves(
  ["0023-if-workspaces FR-012", "0023-if-workspaces FR-036"],
  "on Windows a path of more than 259 characters is an error naming it while long paths are off, with ifws setup named as the way; that long paths are off is informational while none exceeds it",
  () => {
    const long = longPath();
    assert(long.kind === "ok");
    if (long.kind !== "ok") return;
    const short = repoPath(["github.com", "o", "r"]);
    assert(short.kind === "ok");
    if (short.kind !== "ok") return;
    const home = "C:\\Users\\a\\workspaces";
    const off = pathChecks({ home, windows: true, longPaths: "disabled", paths: [short.value, long.value] });
    const errors = off.filter((c) => c.level === "error");
    assertEquals(errors.length, 1);
    assertStringIncludes(errors[0]?.message ?? "", "ifws setup");
    assertStringIncludes(errors[0]?.subject ?? "", "gggg");
    assertEquals(severityOf(errors[0]?.level ?? "ok"), "Error");
    const none = pathChecks({ home, windows: true, longPaths: "disabled", paths: [short.value] });
    assertEquals(
      none.map((c) => [c.id, c.level]),
      [["ifws/windows-long-paths", "suggest"]],
    );
    assertStringIncludes(none[0]?.message ?? "", "Windows long paths not enabled");
    assertStringIncludes(none[0]?.message ?? "", "ifws setup");
    assertEquals(
      findingsOf(none, TODAY).map((f) => f.severity),
      ["Informational"],
    );
    // on: no error whatever the length; elsewhere the limit does not apply
    assertEquals(
      pathChecks({ home, windows: true, longPaths: "enabled", paths: [long.value] }).map((c) => c.level),
      ["ok"],
    );
    assertEquals(
      pathChecks({ home: "/home/a/workspaces", windows: false, longPaths: "unknown", paths: [long.value] }).map((c) => c.level),
      ["ok"],
    );
    // exactly 259 characters is accepted and 260 is not
    const at259 = "x".repeat(259 - `${home}\\github.com\\o\\`.length);
    const ok259 = repoPath(["github.com", "o", at259]);
    const over = repoPath(["github.com", "o", `${at259}y`]);
    assert(ok259.kind === "ok" && over.kind === "ok");
    if (ok259.kind === "ok" && over.kind === "ok") {
      assertEquals(
        pathChecks({ home, windows: true, longPaths: "disabled", paths: [ok259.value] }).filter((c) => c.level === "error").length,
        0,
      );
      assertEquals(
        pathChecks({ home, windows: true, longPaths: "disabled", paths: [over.value] }).filter((c) => c.level === "error").length,
        1,
      );
    }
  },
);

proves(
  ["0023-if-workspaces FR-014"],
  "FAT, exFAT, a network share and a Windows drive under WSL are each a warning found by the type a probe reports, and a probe that was not made says so",
  () => {
    assertEquals(classifyFs("vfat", false), "fat");
    assertEquals(classifyFs("msdos", false), "fat");
    assertEquals(classifyFs("exfat", false), "exfat");
    assertEquals(classifyFs("nfs4", false), "network");
    assertEquals(classifyFs("cifs", false), "network");
    assertEquals(classifyFs("smbfs", false), "network");
    assertEquals(classifyFs("9p", true), "wsl-windows-drive");
    assertEquals(classifyFs("9p", false), "network");
    assertEquals(classifyFs("ext4", true), "ok");
    assertEquals(classifyFs("apfs", false), "ok");
    for (const [type, wsl, word] of [
      ["vfat", false, "FAT"],
      ["exfat", false, "exFAT"],
      ["nfs", false, "network share"],
      ["9p", true, "/mnt/c"],
    ] as const) {
      const c = fsCheck({ kind: "found", type, wsl }, "/w");
      assertEquals(c.level, "warn");
      assertStringIncludes(c.message, word);
    }
    assertEquals(fsCheck({ kind: "found", type: "ext4", wsl: false }, "/w").level, "ok");
    const skipped = fsCheck({ kind: "not-run", reason: "stat is not available" }, "/w");
    assertEquals(skipped.level, "suggest");
    assertStringIncludes(skipped.message, "stat is not available");
  },
);

proves(
  ["0025-ifws FR-014"],
  "the runtime, the tools and the hooks are checked, each with what to do: git is required, the other runtime is a suggestion, and a repository without the hooks path is a warning",
  () => {
    const rc = runtimeChecks({ name: "bun", version: "1.4.4" }, [
      { name: "git", version: "2.50.0" },
      { name: "bun", version: "1.4.4" },
      { name: "node", version: undefined },
    ]);
    assertEquals(
      rc.map((c) => [c.subject, c.level]),
      [
        ["bun", "ok"],
        ["git", "ok"],
        ["bun", "ok"],
        ["node", "suggest"],
      ],
    );
    const noGit = runtimeChecks({ name: "bun", version: "1.4.4" }, [{ name: "git", version: undefined }]);
    assertEquals(noGit[1]?.level, "error");
    assertStringIncludes(noGit[1]?.message ?? "", "install git");
    assertEquals(runtimeChecks({ name: "node", version: "v25.0.0" }, [])[0]?.level, "error");
    assertEquals(runtimeChecks({ name: "node", version: "v26.13.1" }, [])[0]?.level, "ok");
    const a = repoPath(["github.com", "o", "a"]);
    const b = repoPath(["github.com", "o", "b"]);
    const c = repoPath(["github.com", "o", "c"]);
    assert(a.kind === "ok" && b.kind === "ok" && c.kind === "ok");
    if (a.kind === "ok" && b.kind === "ok" && c.kind === "ok") {
      const hooks = hookChecks(
        [
          { repo: a.value, present: true, hooksPath: "/w/.if-workspaces/hooks" },
          { repo: b.value, present: true, hooksPath: undefined },
          { repo: c.value, present: false, hooksPath: undefined },
        ],
        "/w/.if-workspaces/hooks",
      );
      assertEquals(
        hooks.map((h) => [h.subject, h.level]),
        [
          ["github.com/o/a", "ok"],
          ["github.com/o/b", "warn"],
        ],
      );
      assertStringIncludes(hooks[1]?.message ?? "", "ifws apply");
    }
  },
);
