/**
 * The length of a repository's own path (commons 0023-if-workspaces FR-048, owner decision of 2026-11-17): up to 150 characters it fits; over 150 it is an
 * informational finding (it leaves little room for the files inside the repository); over 259 it is an error whether or not long paths are enabled and on
 * every system. The limits are checked as pure functions, and `ifws doctor` is run as a real program on a workspace whose manifest names repositories of
 * three lengths.
 *
 * @module
 */
import { findingsOf, repoPathChecks } from "../workspaces/doctor.ts";
import { REPO_PATH_ROOM, repoPath, repoPathLength, WINDOWS_PATH_LIMIT } from "../workspaces/portable.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { needsWorld, withWorld } from "./ifws-fixtures.ts";

/** A repository path under `github.com/o/` whose whole path under `home` has exactly `total` characters when written with `separator`. */
function pathOfLength(home: string, separator: "/" | "\\", total: number) {
  const prefix = `${home}${separator}github.com${separator}o${separator}`;
  const rest = total - prefix.length;
  // a segment is at most 255 bytes: a long path is made of two
  const tail = rest <= 200 ? ["x".repeat(rest)] : ["x".repeat(150), "x".repeat(rest - 151)];
  const r = repoPath(["github.com", "o", ...tail]);
  assert(r.kind === "ok", "a repository path");
  return r.value;
}

proves(
  ["0023-if-workspaces FR-048"],
  "a repository's path of up to 150 characters has no finding, over 150 is informational and over 259 an error, on Windows and elsewhere, whatever the long-path setting",
  () => {
    assertEquals([REPO_PATH_ROOM, WINDOWS_PATH_LIMIT], [150, 259]);
    for (const [home, separator, windows] of [
      ["C:\\Users\\a\\ws", "\\", true],
      ["/home/a/ws", "/", false],
    ] as const) {
      const level = (total: number) =>
        repoPathChecks({ home, windows, repositories: [pathOfLength(home, separator, total)] }).map((c) => [c.id, c.level]);
      assertEquals(level(150), [], "150 characters leave room");
      assertEquals(level(151), [["ifws/repo-path-room", "suggest"]], "151 characters leave little room");
      assertEquals(level(259), [["ifws/repo-path-room", "suggest"]], "259 characters are not too long");
      assertEquals(level(260), [["ifws/repo-path-too-long", "error"]], "260 characters are too long");
      const long = repoPathChecks({ home, windows, repositories: [pathOfLength(home, separator, 300)] });
      assertStringIncludes(long[0]?.message ?? "", "whether or not long paths are enabled");
      assertEquals(
        findingsOf(long, "2026-11-17").map((f) => f.severity),
        ["Error"],
      );
      assertEquals(
        findingsOf(repoPathChecks({ home, windows, repositories: [pathOfLength(home, separator, 200)] }), "2026-11-17").map(
          (f) => f.severity,
        ),
        ["Informational"],
      );
      // the length counts the root, the separators and the path
      const p = pathOfLength(home, separator, 120);
      assertEquals(repoPathLength(home, p, separator), { kind: "fits", length: 120 });
    }
  },
);

proves(
  ["0023-if-workspaces FR-048"],
  "ifws doctor, run as a program, reports a repository whose path leaves little room as informational and one over 259 characters as an error, and says nothing of a short one",
  async () => {
    await withWorld(async (w) => {
      const remote = (name: string) => `https://git.example.org/team/${name}.git`;
      // the root is the folder of the world, so the names are chosen by the length of what is left
      const base = `${w.home}/git.example.org/team/`.length;
      const name = (total: number) => "n".repeat(total - base);
      await w.manifest({
        repositories: [
          { remote: remote("short"), group: "core", branch: "main" },
          { remote: remote(name(180)), group: "core", branch: "main" },
          { remote: remote(name(270)), group: "core", branch: "main" },
        ],
      });
      const r = await w.ifws("doctor", "--json");
      const body = JSON.parse(r.stdout) as { findings?: { ruleId: string; severity: string; subject: string }[] };
      const found = (body.findings ?? []).filter((f) => f.ruleId.startsWith("ifws/repo-path"));
      assertEquals(found.map((f) => [f.ruleId, f.severity]).sort(), [
        ["ifws/repo-path-room", "Informational"],
        ["ifws/repo-path-too-long", "Error"],
      ]);
      assert(
        found.every((f) => !f.subject.endsWith("/short")),
        "a short path has no finding",
      );
      assertEquals(r.code, 1, "an error finding makes the status 1");
    });
  },
  needsWorld,
);
