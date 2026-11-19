/**
 * Where ergonex keeps what it remembers and installs (commons 0031-install-locations FR-001 to FR-005): the folders from the environment on each system, the XDG variables honored, the logical paths of its own files
 * mapped to the state folder or the tools folder and to nothing else, and a real run that leaves its record, its evidence and its lock in the state folder, writes nothing below the user's home, makes no folder of
 * its own there and no command file, and says where each is with `ergonex paths`.
 *
 * @module
 */
import { existsSync, readDirSync } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { placesOf } from "../src/host/locations.ts";
import { type Places, movedKind, movedPath } from "../src/places.ts";
import { ONE_REPOSITORY, evidenceFiles, needsWorld, withWorld } from "./ergonex-fixtures.ts";

const env =
  (vars: Readonly<Record<string, string>>) =>
  (name: string): string | undefined =>
    vars[name];

proves(
  ["0031-install-locations FR-001", "0031-install-locations FR-002"],
  "the folders are the XDG ones on Linux and macOS and the known folders on Windows, the shims are in ~/.local/bin (the tools folder's bin on Windows), an XDG variable is honored, and no home is an error",
  () => {
    const linux = placesOf(env({ HOME: "/home/a" }), "linux");
    assert(linux.kind === "ok");
    assertEquals(linux.value, {
      os: "linux",
      data: "/home/a/.local/share/ergonex",
      state: "/home/a/.local/state/ergonex",
      cache: "/home/a/.cache/ergonex",
      tools: "/home/a/.local/share/ergonex/tools",
      shims: "/home/a/.local/bin",
    });
    const mac = placesOf(env({ HOME: "/Users/a" }), "darwin");
    assert(
      mac.kind === "ok" && mac.value.data === "/Users/a/.local/share/ergonex" && mac.value.shims === "/Users/a/.local/bin",
      "macOS is Linux's",
    );
    const win = placesOf(
      env({
        USERPROFILE: "C:\\Users\\a",
        LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local",
      }),
      "windows",
    );
    assert(win.kind === "ok");
    assertEquals(
      [win.value.data, win.value.state, win.value.tools, win.value.shims],
      [
        "C:\\Users\\a\\AppData\\Local\\ergonex",
        "C:\\Users\\a\\AppData\\Local\\ergonex\\state",
        "C:\\Users\\a\\AppData\\Local\\ergonex\\tools",
        "C:\\Users\\a\\AppData\\Local\\ergonex\\tools\\bin",
      ],
    );
    const xdg = placesOf(
      env({
        HOME: "/home/a",
        XDG_DATA_HOME: "/x/data",
        XDG_STATE_HOME: "/x/state",
      }),
      "linux",
    );
    assert(xdg.kind === "ok" && xdg.value.tools === "/x/data/ergonex/tools" && xdg.value.state === "/x/state/ergonex");
    assertStringIncludes((placesOf(env({}), "linux") as { error: string }).error, "no folder can be found");
  },
);

proves(
  ["0031-install-locations FR-005"],
  "the state record, the evidence and the lock map to the state folder and the installed tools to the tools folder, and the manifest, the Git configuration, the hooks and every path below the root map to nothing",
  () => {
    const p: Places = {
      os: "linux",
      data: "/d",
      state: "/s",
      cache: "/c",
      tools: "/d/tools",
      shims: "/h/.local/bin",
    };
    assertEquals(movedPath(p, ".ergonex/state.auto.json"), "/s/state.auto.json");
    assertEquals(movedPath(p, ".ergonex/ergonex.lock"), "/s/ergonex.lock");
    assertEquals(movedPath(p, ".ergonex/evidence/2026/11/19/x.otlp.json"), "/s/evidence/2026/11/19/x.otlp.json");
    assertEquals(movedPath(p, ".ergonex/tools/hello/1.0.0"), "/d/tools/hello/1.0.0");
    for (const kept of [
      ".ergonex/workspace.ts",
      ".ergonex/hooks/pre-commit",
      ".ergonex/git.auto.conf",
      ".ergonex/tools.auto.json",
      ".ergonex/modules.auto.json",
      "AGENTS.auto.md",
      "github.com/o/r",
    ])
      assertEquals(movedPath(p, kept), undefined, kept);
    assertEquals([movedKind("tools.auto.json"), movedKind("toolsx/y"), movedKind("evidence")], [undefined, undefined, "state"]);
    const w: Places = {
      os: "windows",
      data: "C:\\d",
      state: "C:\\s\\",
      cache: "C:\\c",
      tools: "C:\\d\\tools",
      shims: "C:\\d\\tools\\bin",
    };
    assertEquals(movedPath(w, ".ergonex/state.auto.json"), "C:\\s\\state.auto.json");
    assertEquals(movedPath(w, ".ergonex/tools/hello/1.0.0"), "C:\\d\\tools\\hello\\1.0.0");
  },
);

proves(
  ["0031-install-locations FR-005", "0004-onboarding FR-010"],
  "a run leaves its record, its evidence and its lock in the state folder and nothing there in the workspace, writes nothing below the user's home, makes no folder or command file of ergonex's own, and `ergonex paths` says where each is",
  async () => {
    await withWorld(async (w) => {
      const before = await w.userDigest();
      assertEquals((await w.ergonex("init")).code, 0);
      await w.manifest(ONE_REPOSITORY);
      assertEquals((await w.ergonex("apply")).code, 0);
      assertEquals(await w.userDigest(), before, "something below the user's home changed");
      const area = readDirSync(join(w.home, ".ergonex"))
        .map((e) => e.name)
        .sort();
      assertEquals(area, ["git.auto.conf", "hooks", "modules.auto.json", "tools.auto.json", "workspace.ts"]);
      assert(existsSync(join(w.state, "state.auto.json")), "the state record");
      assert(evidenceFiles(w.state).length >= 2, "the evidence of the runs");
      assert(
        !existsSync(join(w.user, ".ergonex")) && !existsSync(join(w.user, ".local")) && !existsSync(join(w.user, ".config")),
        "a folder of ergonex's below the user's home",
      );
      assert(!existsSync(join(w.home, ".ergonex", "bin")), "a folder of command files");
      const where = await w.ergonex("paths");
      assertEquals(where.code, 0, where.stderr);
      for (const folder of [w.home, join(w.home, ".ergonex"), w.state, w.data, w.tools]) assertStringIncludes(where.stdout, folder);
      assertStringIncludes(where.stdout, join(w.user, ".local", "bin"));
    });
  },
  needsWorld,
);
