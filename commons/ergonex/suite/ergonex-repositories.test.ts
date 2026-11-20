/**
 * Tests of `ergonex add`, `remove` and `adopt` (commons ergonex 0005-repositories FR-001 to FR-010) as real programs on a world with a real bare repository that stands as the remote
 * `git.example.org/team/tool`: a remote written as a person writes it is recorded as the https address, the manifest reads the two files as one list, a change the manifest would refuse is
 * refused with nothing written, `--apply` clones, `--delete` deletes only a clean folder, and `adopt` finds what was cloned by hand.
 *
 * @module
 */
import { existsSync, readTextFile, writeTextFile, mkdir } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { run } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { needsWorld, REMOTE, withWorld } from "./ergonex-fixtures.ts";

const LIST = (home: string): string => join(home, ".ergonex", "repositories.ts");

proves(
  ["0005-repositories FR-001", "0005-repositories FR-002", "0005-repositories FR-003"],
  "repos add reads a remote as a person writes it, records the https address and the branch of a page, reports what is already held, and keeps workspace.ts as it was",
  async () => {
    await withWorld(async (w) => {
      await w.manifest({ repositories: [] });
      const before = await readTextFile(join(w.home, ".ergonex", "workspace.ts"));
      const r = await w.ergonex("repos", "add", "git.example.org/team/tool/tree/dev");
      assertEquals(r.code, 0, r.stderr + r.stdout);
      assertStringIncludes(r.stdout, "added git.example.org/team/tool");
      const list = await readTextFile(LIST(w.home));
      assertStringIncludes(list, `{ remote: ${JSON.stringify(REMOTE)}, branch: "dev" }`);
      assertEquals(await readTextFile(join(w.home, ".ergonex", "workspace.ts")), before, "workspace.ts is not edited");
      // the manifest sees the list: the plan clones the repository
      const plan = await w.ergonex("plan");
      assertEquals(plan.code, 0, plan.stderr);
      assertStringIncludes(plan.stdout, "clone");
      // the same repository written another way is already held, and a second add changes nothing
      for (const again of ["https://git.example.org/team/tool", "git@git.example.org:team/tool.git", "git.example.org/team/tool"]) {
        const x = await w.ergonex("repos", "add", again);
        assertEquals(x.code, 0, x.stderr);
        assertStringIncludes(x.stdout, "already in the manifest");
      }
      assertEquals(await readTextFile(LIST(w.home)), list);
      // a repository named in workspace.ts and in the list is a collision
      await w.manifest({ repositories: [{ remote: REMOTE }] });
      const clash = await w.ergonex("plan");
      assertStringIncludes(clash.stdout + clash.stderr, "is the same path as");
    });
  },
  needsWorld,
);

proves(
  ["0005-repositories FR-004"],
  "repos add decodes the whole manifest with its change first, and writes nothing that the manifest would refuse or that is not a repository",
  async () => {
    await withWorld(async (w) => {
      await w.manifest({ repositories: [], policy: { allowedGitHost: ["github.com"] } });
      const refused = await w.ergonex("repos", "add", "git.example.org/team/tool");
      assertEquals(refused.code, 2, refused.stdout + refused.stderr);
      assertStringIncludes(refused.stderr + refused.stdout, "nothing was added");
      assert(!existsSync(LIST(w.home)), "nothing was written");
      const local = await w.ergonex("repos", "add", "/tmp/somewhere", "github.com/o/r");
      assertEquals(local.code, 2, local.stdout + local.stderr);
      assert(!existsSync(LIST(w.home)), "a bad word writes nothing, even for the good ones");
      assertEquals((await w.ergonex("add")).code, 2);
    });
  },
  needsWorld,
);

proves(
  ["0005-repositories FR-005"],
  "repos add then apply clones the repository at the path its remote makes, and repos add --dry-run writes nothing",
  async () => {
    await withWorld(async (w) => {
      await w.manifest({ repositories: [] });
      const preview = await w.ergonex("repos", "add", "--dry-run", "git.example.org/team/tool");
      assertEquals(preview.code, 0, preview.stderr + preview.stdout);
      assertStringIncludes(preview.stdout, "would add");
      assert(!existsSync(LIST(w.home)), "a preview wrote the list");
      const r = await w.ergonex("repos", "add", "git.example.org/team/tool");
      assertEquals(r.code, 0, r.stderr + r.stdout);
      assertStringIncludes(r.stderr, "next: ergonex apply");
      const applied = await w.ergonex("apply");
      assertEquals(applied.code, 0, applied.stderr + applied.stdout);
      assert(existsSync(join(w.repo, ".git")), "cloned");
      assertStringIncludes(applied.stdout, "cloned");
    });
  },
  needsWorld,
);

proves(
  ["0005-repositories FR-006", "0005-repositories FR-007"],
  "repos remove takes an entry out and leaves the folder; repos delete deletes a clean folder and refuses, changing nothing, where there is work or the entry is in workspace.ts",
  async () => {
    await withWorld(async (w) => {
      await w.manifest({ repositories: [] });
      assertEquals((await w.ergonex("repos", "add", "git.example.org/team/tool")).code, 0);
      assertEquals((await w.ergonex("apply")).code, 0);
      // work that exists nowhere else: nothing is removed, nothing is deleted
      await writeTextFile(join(w.repo, "notes.txt"), "uncommitted\n");
      await w.git(w.repo, "add", "notes.txt");
      const kept = await w.ergonex("repos", "delete", "tool", "--yes");
      assertEquals(kept.code, 2, kept.stdout + kept.stderr);
      assertStringIncludes(kept.stdout + kept.stderr, "nothing was removed");
      assert(existsSync(join(w.repo, "notes.txt")), "the work is there");
      assertStringIncludes(await readTextFile(LIST(w.home)), REMOTE);
      // with remove the folder stays and is unmanaged
      const soft = await w.ergonex("repos", "remove", "git.example.org/team/tool");
      assertEquals(soft.code, 0, soft.stdout + soft.stderr);
      assert(existsSync(w.repo), "the folder stays");
      assert(!(await readTextFile(LIST(w.home))).includes(REMOTE));
      const status = await w.ergonex("status");
      assertStringIncludes(status.stderr, "ergonex repos adopt");
      // a clean one is deleted with delete
      await w.git(w.repo, "reset", "-q");
      await writeTextFile(join(w.repo, "notes.txt"), "");
      await run(["rm", "-f", join(w.repo, "notes.txt")]);
      assertEquals((await w.ergonex("repos", "add", "git.example.org/team/tool")).code, 0);
      const gone = await w.ergonex("repos", "delete", "git.example.org/team/tool", "--yes");
      assertEquals(gone.code, 0, gone.stdout + gone.stderr);
      assert(!existsSync(w.repo), "the clean folder is deleted");
      // a repository named in workspace.ts is not edited out of it
      await w.manifest({ repositories: [{ remote: REMOTE }] });
      const own = await w.ergonex("repos", "remove", "tool");
      assertEquals(own.code, 2, own.stdout + own.stderr);
      assertStringIncludes(own.stdout + own.stderr, "workspace.ts");
    });
  },
  needsWorld,
);

proves(
  ["0005-repositories FR-008", "0005-repositories FR-009", "0005-repositories FR-010"],
  "repos adopt finds a repository cloned by hand at the path its remote makes and one cloned elsewhere, changes nothing with --dry-run, and adds only the first without it",
  async () => {
    await withWorld(async (w) => {
      await w.manifest({ repositories: [] });
      await mkdir(join(w.home, "git.example.org", "team"), { recursive: true });
      const cloneAt = async (folder: string): Promise<void> => {
        await mkdir(folder, { recursive: true });
        const r = await run(["git", "clone", "-q", REMOTE, folder], { env: w.env });
        assert(r.success, r.stderr);
      };
      await cloneAt(w.repo);
      await cloneAt(join(w.home, "elsewhere", "tool-copy"));
      const seen = await w.ergonex("repos", "adopt", "--dry-run");
      assertEquals(seen.code, 0, seen.stderr);
      assertStringIncludes(seen.stdout, "git.example.org/team/tool: can be adopted");
      assertStringIncludes(seen.stdout, "elsewhere/tool-copy: is at the wrong path");
      assertStringIncludes(seen.stdout, "git.example.org/team/tool");
      assert(!existsSync(LIST(w.home)), "adopt --dry-run changes nothing");
      const status = await w.ergonex("status");
      assertStringIncludes(status.stderr, "elsewhere/tool-copy");
      const done = await w.ergonex("repos", "adopt");
      assertEquals(done.code, 0, done.stdout + done.stderr);
      assertStringIncludes(await readTextFile(LIST(w.home)), REMOTE);
      const after = await w.ergonex("repos", "adopt", "--dry-run");
      assert(!after.stdout.includes("can be adopted"), after.stdout);
      assertStringIncludes(after.stdout, "elsewhere/tool-copy");
    });
  },
  needsWorld,
);
