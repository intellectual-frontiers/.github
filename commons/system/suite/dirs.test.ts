/**
 * Where a program keeps its files (commons 0031-install-locations FR-001 to FR-004): the XDG folders on Linux and macOS, Windows' known folders, the `XDG_*` variables honored where they are absolute paths on
 * every system, and a folder undefined where no home can be found. Every system's paths are proved from here, since the functions take the system and the environment as values.
 *
 * @module
 */
import { dirsOf, homeOf } from "../src/dirs.ts";
import { assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const env =
  (vars: Readonly<Record<string, string>>) =>
  (name: string): string | undefined =>
    vars[name];

proves(
  ["0001-system FR-008"],
  "on Linux the folders are the XDG defaults below the home with the program's name, there is no runtime folder, and the binary folder is ~/.local/bin; on Windows they are the known folders and there is no binary folder",
  () => {
    assertEquals(dirsOf("ergonex", env({ HOME: "/home/a" }), "linux"), {
      config: "/home/a/.config/ergonex",
      data: "/home/a/.local/share/ergonex",
      state: "/home/a/.local/state/ergonex",
      cache: "/home/a/.cache/ergonex",
      runtime: undefined,
      bin: "/home/a/.local/bin",
    });
    assertEquals(dirsOf("ergonex", env({ HOME: "/home/a", XDG_RUNTIME_DIR: "/run/user/1000" }), "linux").runtime, "/run/user/1000/ergonex");
    const win = dirsOf(
      "ergonex",
      env({ USERPROFILE: "C:\\Users\\a", APPDATA: "C:\\Users\\a\\AppData\\Roaming", LOCALAPPDATA: "D:\\Local" }),
      "windows",
    );
    assertEquals(win, {
      config: "C:\\Users\\a\\AppData\\Roaming\\ergonex",
      data: "D:\\Local\\ergonex",
      state: "D:\\Local\\ergonex\\state",
      cache: "D:\\Local\\ergonex\\cache",
      runtime: undefined,
      bin: undefined,
    });
    // LOCALAPPDATA and APPDATA not set: below the user's profile, as Windows has them
    assertEquals(dirsOf("ergonex", env({ USERPROFILE: "C:\\Users\\a" }), "windows").data, "C:\\Users\\a\\AppData\\Local\\ergonex");
    assertEquals(dirsOf("ergonex", env({ USERPROFILE: "C:\\Users\\a" }), "windows").config, "C:\\Users\\a\\AppData\\Roaming\\ergonex");
    assertEquals(
      [homeOf(env({ HOME: "/h", USERPROFILE: "C:\\u" }), "windows"), homeOf(env({ HOME: "/h", USERPROFILE: "C:\\u" }), "linux")],
      ["C:\\u", "/h"],
    );
  },
);

proves(
  ["0001-system FR-008"],
  "an XDG variable is honored where it is an absolute path, on Windows too (a path with / as Git Bash gives it as well), and ignored where it is not",
  () => {
    const all = {
      HOME: "/home/a",
      XDG_CONFIG_HOME: "/x/cfg",
      XDG_DATA_HOME: "/x/data",
      XDG_STATE_HOME: "/x/state",
      XDG_CACHE_HOME: "/x/cache",
    };
    assertEquals(dirsOf("p", env(all), "linux"), {
      config: "/x/cfg/p",
      data: "/x/data/p",
      state: "/x/state/p",
      cache: "/x/cache/p",
      runtime: undefined,
      bin: "/home/a/.local/bin",
    });
    // the specification: a value that is not an absolute path is invalid and ignored
    const bad = dirsOf(
      "p",
      env({ HOME: "/home/a", XDG_DATA_HOME: "relative/dir", XDG_CONFIG_HOME: "", XDG_STATE_HOME: "~/state" }),
      "linux",
    );
    assertEquals([bad.data, bad.config, bad.state], ["/home/a/.local/share/p", "/home/a/.config/p", "/home/a/.local/state/p"]);
    const win = dirsOf(
      "p",
      env({ USERPROFILE: "C:\\u", LOCALAPPDATA: "C:\\u\\L", XDG_STATE_HOME: "C:\\s", XDG_CONFIG_HOME: "C:/cfg" }),
      "windows",
    );
    assertEquals([win.state, win.config, win.data, win.cache], ["C:\\s\\p", "C:\\cfg\\p", "C:\\u\\L\\p", "C:\\u\\L\\p\\cache"]);
  },
);

proves(["0001-system FR-008"], "macOS gives the folders Linux gives, and none is under ~/Library", () => {
  const e = env({ HOME: "/Users/a" });
  assertEquals(dirsOf("p", e, "darwin"), dirsOf("p", e, "linux"));
  for (const d of Object.values(dirsOf("p", e, "darwin"))) assertEquals(d?.includes("Library") ?? false, false);
});

proves(
  ["0001-system FR-008"],
  "with no home and no variable every folder is undefined, never a guess, and a variable alone is enough for its folder",
  () => {
    assertEquals(dirsOf("p", env({}), "linux"), {
      config: undefined,
      data: undefined,
      state: undefined,
      cache: undefined,
      runtime: undefined,
      bin: undefined,
    });
    assertEquals(dirsOf("p", env({ XDG_CONFIG_HOME: "/c" }), "linux").config, "/c/p");
    assertEquals(dirsOf("p", env({ HOME: "" }), "linux").data, undefined);
    assertEquals(dirsOf("p", env({}), "windows").data, undefined);
  },
);
