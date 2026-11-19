/**
 * Tests of the plan and of the state classification (commons 0002-workspace-model FR-021 to FR-027, FR-029, FR-030): `plan(desired, observed)` is a pure function that holds, for each repository, the
 * `defaultAction` of its state; fast-forwards only a repository that is `Behind`; never removes a tree with local work or a generated file that was edited; refuses a repository on the wrong remote or a
 * folder that is not a repository; plans a worktree only where one is needed; and holds a change of the host only for `ergonex setup --apply`. The tables it reads (default actions, which states are
 * fast-forwardable and hold local work, which actions are destructive or change the host) are held equal to the ontology's. Pure: no file, no program. The real `git` is in `ergonex-state.test.ts`.
 *
 * @module
 */
import fc from "fast-check";
import { parseRemote } from "@intellectual-frontiers/commons/ts/githost";
import type { RepoRef } from "@intellectual-frontiers/commons/ts/githost";
import { sha256, type Sha256 } from "@intellectual-frontiers/commons/ts/kernel";
import { actionKinds, repoStates } from "./vocabulary.ts";
import {
  type Action,
  type ActionKind,
  describeAction,
  type Desired,
  type DesiredRepo,
  isDestructive,
  isHostChange,
  isSettled,
  mayRemove,
  type Observed,
  plan,
  planDigest,
} from "../src/plan.ts";
import {
  classify,
  defaultActionOf,
  fastForwardable,
  holdsLocalWork,
  REPO_STATE_KINDS,
  type RepoState,
  type RepoStateKind,
} from "../src/state.ts";
import { repoPath } from "../src/portable.ts";
import { branchName, type BranchName, type RepoPath, version } from "../src/types.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const mk = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const rp = (...s: string[]): RepoPath => mk(repoPath(s));
const ref: RepoRef = mk(parseRemote("https://github.com/octo/hello.git"));
const HELLO = rp("github.com", "octo", "hello");
const TOOL = rp("gitlab.com", "g", "s", "tool");
const main: BranchName = mk(branchName("main"));

const repo = (path: RepoPath, settings: Record<string, string> = {}): DesiredRepo => ({
  path,
  ref,
  cloneUrl: `https://${path}.git`,
  settings,
});
const desired = (repos: DesiredRepo[], more: Partial<Desired> = {}): Desired => ({
  repos,
  worktrees: [],
  files: [],
  hostChanges: [],
  ...more,
});
const observed = (repos: Observed["repos"] = {}, more: Partial<Observed> = {}): Observed => ({ repos, worktrees: {}, files: {}, ...more });
const at = (state: RepoState, extra: { config?: Record<string, string>; busy?: boolean } = {}): Observed["repos"][string] => ({
  state,
  config: extra.config ?? {},
  busy: extra.busy ?? false,
});

const STATES: Record<RepoStateKind, RepoState> = {
  Missing: { kind: "Missing" },
  Clean: { kind: "Clean" },
  Dirty: { kind: "Dirty" },
  Ahead: { kind: "Ahead", commits: 2 },
  Behind: { kind: "Behind", commits: 3 },
  Diverged: { kind: "Diverged", ahead: 1, behind: 4 },
  Locked: { kind: "Locked" },
  Detached: { kind: "Detached" },
  WrongRemote: { kind: "WrongRemote", found: "gitlab.com/someone/else" },
  NotARepo: { kind: "NotARepo" },
};

const keyOf = (iri: string): string => iri.replace(/^.*[#/]/, "");

proves(
  ["0002-workspace-model FR-022"],
  "the plan's action for each of the ten states is the state's default action in the ontology",
  () => {
    assertEquals([...REPO_STATE_KINDS].sort(), Object.keys(repoStates).sort());
    for (const kind of REPO_STATE_KINDS) {
      const listed = repoStates[kind].values;
      const p = plan(desired([repo(HELLO)]), observed({ [HELLO]: at(STATES[kind]) }));
      const primary = p.actions[0];
      assert(primary !== undefined, kind);
      assertEquals(primary.kind, keyOf(listed.defaultAction.iri), `${kind}: the first action is the default action`);
      assertEquals(defaultActionOf(kind), keyOf(listed.defaultAction.iri), kind);
      assertEquals(fastForwardable(kind), listed.fastForwardable, kind);
      assertEquals(holdsLocalWork(kind), listed.holdsLocalWork, kind);
      assertEquals(p.actions.length, 1, `${kind}: one action for one repository with nothing to configure`);
    }
    // a repository with no observation at all is missing
    assertEquals(plan(desired([repo(HELLO)]), observed()).actions[0]?.kind, "Clone");
  },
);

proves(
  ["0002-workspace-model FR-021"],
  "a missing repository is one Clone at the path that mirrors its remote, and the plan changes nothing",
  () => {
    const want = desired([repo(HELLO)]);
    const seen = observed();
    const p = plan(want, seen);
    assertEquals(p.actions, [
      {
        kind: "Clone",
        target: HELLO,
        url: "https://github.com/octo/hello.git",
        branch: undefined,
      },
    ]);
    assertEquals(describeAction(p.actions[0] as Action), "clone https://github.com/octo/hello.git into github.com/octo/hello");
  },
);

proves(
  ["0002-workspace-model FR-021"],
  "plan is a pure function: it does not change its arguments, and the same arguments give the same plan and the same digest",
  async () => {
    const want = desired([repo(TOOL, { "core.hooksPath": "/h/hooks" }), repo(HELLO)], {
      hostChanges: [{ kind: "ConfigureHost", target: "git", what: "x" }],
    });
    const seen = observed({ [HELLO]: at(STATES.Behind) });
    const freeze = (o: unknown): void => {
      if (typeof o === "object" && o !== null && !Object.isFrozen(o)) {
        Object.freeze(o);
        for (const v of Object.values(o)) freeze(v);
      }
    };
    freeze(want);
    freeze(seen);
    const a = plan(want, seen);
    const b = plan(want, seen);
    assertEquals(a, b);
    assertEquals(await planDigest(a), await planDigest(b));
    assert((await planDigest(a)) !== (await planDigest(plan(want, observed({ [HELLO]: at(STATES.Clean) })))));
    // the actions are in the order of the paths, whatever the order the manifest listed them in
    assertEquals(
      a.actions.map((x) => x.target),
      [HELLO, TOOL, TOOL],
    );
    assertEquals(
      plan(desired([repo(HELLO), repo(TOOL)]), seen).actions.map((x) => x.target),
      plan(desired([repo(TOOL), repo(HELLO)]), seen).actions.map((x) => x.target),
    );
  },
);

proves(
  ["0002-workspace-model FR-026"],
  "a fast-forward is planned for a repository that is behind and for no other state, and no action merges, rebases, resets, forces or deletes",
  () => {
    fc.assert(
      fc.property(fc.constantFrom(...REPO_STATE_KINDS), fc.nat({ max: 5 }), fc.boolean(), (kind, n, busy) => {
        const state: RepoState =
          kind === "Ahead"
            ? { kind, commits: n + 1 }
            : kind === "Behind"
              ? { kind, commits: n + 1 }
              : kind === "Diverged"
                ? { kind, ahead: n + 1, behind: n + 2 }
                : (STATES[kind] ?? STATES.Clean);
        const p = plan(
          desired([repo(HELLO, { "core.hooksPath": "/h" })], {
            worktrees: [
              {
                path: rp(".worktrees", "github.com", "octo", "hello", "x"),
                repo: HELLO,
                branch: main,
              },
            ],
          }),
          observed({ [HELLO]: at(state, { busy }) }),
        );
        const ff = p.actions.filter((a) => a.kind === "FastForward");
        assertEquals(ff.length, kind === "Behind" ? 1 : 0, kind);
        for (const a of p.actions) assert(Object.keys(actionKinds).includes(a.kind), a.kind);
      }),
      { numRuns: 300 },
    );
    assertEquals(plan(desired([repo(HELLO)]), observed({ [HELLO]: at(STATES.Behind) })).actions, [
      { kind: "FastForward", target: HELLO, commits: 3 },
    ]);
    assertEquals(describeAction({ kind: "FastForward", target: HELLO, commits: 1 }), "fast-forward github.com/octo/hello by 1 commit");
  },
);

proves(
  ["0002-workspace-model FR-022", "0002-workspace-model FR-026"],
  "a dirty repository whose remote moved on is skipped with the reason, never fast-forwarded",
  () => {
    const p = plan(desired([repo(HELLO)]), observed({ [HELLO]: at(STATES.Dirty) }));
    assertEquals(p.actions, [{ kind: "Skip", target: HELLO, why: { kind: "uncommitted-changes" } }]);
    assert(describeAction(p.actions[0] as Action).includes("uncommitted changes"));
    const d = plan(desired([repo(HELLO)]), observed({ [HELLO]: at(STATES.Diverged) })).actions[0];
    assertEquals(d?.kind, "Skip");
    assert(describeAction(d as Action).includes("only a person merges"));
    const w = plan(desired([repo(HELLO)]), observed({ [HELLO]: at(STATES.WrongRemote) })).actions[0];
    assertEquals(w, {
      kind: "Refuse",
      target: HELLO,
      why: { kind: "wrong-remote", found: "gitlab.com/someone/else" },
    });
    assert(describeAction(w as Action).includes("never overwritten"));
  },
);

proves(
  ["0002-workspace-model FR-027"],
  "nothing that holds local work may be removed: the guard is the ontology's, and the plan holds no removal of a repository or a worktree",
  () => {
    for (const kind of REPO_STATE_KINDS) assertEquals(mayRemove(STATES[kind]), !repoStates[kind].values.holdsLocalWork, kind);
    assertEquals(REPO_STATE_KINDS.filter((k) => mayRemove(STATES[k])).sort(), ["Behind", "Clean", "Missing"]);
    // whatever the state, the only removal a plan can hold is of a generated file
    for (const kind of REPO_STATE_KINDS) {
      const p = plan(desired([repo(HELLO)]), observed({ [HELLO]: at(STATES[kind]) }));
      assert(!p.actions.some((a) => a.kind === "RemoveGenerated"), kind);
    }
  },
);

proves(
  ["0002-workspace-model FR-027"],
  "a generated file is rewritten where it is the recorded bytes, refused where it was edited, and removed only where it is still the recorded bytes",
  async () => {
    const [a, b, c] = [await sha256("a"), await sha256("b"), await sha256("c")];
    const F = rp(".ergonex", "tools.auto.json");
    const G = rp("AGENTS.auto.md");
    const H = rp("old.auto.md");
    const I = rp("edited-old.auto.md");
    const want = desired([], {
      files: [
        { path: F, sha256: b },
        { path: G, sha256: a },
      ],
    });
    const files = (m: Record<string, { onDisk?: Sha256; recorded?: Sha256 }>): Observed => observed({}, { files: m });

    assertEquals(
      plan(want, files({})).actions.map((x) => x.kind),
      ["WriteGenerated", "WriteGenerated"],
    );
    assertEquals(
      plan(
        want,
        files({
          [F]: { onDisk: a, recorded: a },
          [G]: { onDisk: a, recorded: a },
        }),
      ).actions.map((x) => x.kind),
      ["WriteGenerated", "Skip"],
    );
    const edited = plan(
      want,
      files({
        [F]: { onDisk: c, recorded: a },
        [G]: { onDisk: a, recorded: a },
      }),
    );
    assertEquals(
      edited.actions.find((x) => x.target === F),
      { kind: "Refuse", target: F, why: { kind: "generated-edited" } },
    );
    // a file the record does not hold, that is not the bytes wanted, is somebody's: refused, not overwritten
    assertEquals(plan(want, files({ [F]: { onDisk: c } })).actions.find((x) => x.target === F)?.kind, "Refuse");
    // no longer wanted: removed where untouched, refused where edited, nothing where it is gone
    const gone = plan(
      want,
      files({
        [H]: { onDisk: a, recorded: a },
        [I]: { onDisk: c, recorded: a },
        [rp("gone.auto.md")]: { recorded: a },
      }),
    );
    assertEquals(gone.actions.find((x) => x.target === H)?.kind, "RemoveGenerated");
    assertEquals(gone.actions.find((x) => x.target === I)?.kind, "Refuse");
    assertEquals(gone.actions.find((x) => x.target === "gone.auto.md")?.kind, "Skip");
    assertEquals(isDestructive("RemoveGenerated"), true);
  },
);

proves(["0002-workspace-model FR-007"], "a worktree is planned only where another worker or uncommitted work is on the repository", () => {
  const W = rp(".worktrees", "github.com", "octo", "hello", "issue-10-x");
  const want = desired([repo(HELLO)], {
    worktrees: [{ path: W, repo: HELLO, branch: mk(branchName("issue-10/x")) }],
  });
  const kindsFor = (state: RepoState, busy: boolean, worktree?: RepoState): string[] =>
    plan(want, observed({ [HELLO]: at(state, { busy }) }, worktree === undefined ? {} : { worktrees: { [W]: worktree } }))
      .actions.filter((a) => a.target === W)
      .map((a) => a.kind);
  assertEquals(kindsFor(STATES.Clean, false), ["Skip"]);
  assertEquals(kindsFor(STATES.Clean, true), ["CreateWorktree"]);
  assertEquals(kindsFor(STATES.Dirty, false), ["CreateWorktree"]);
  assertEquals(kindsFor(STATES.Missing, false), ["Skip"]);
  assertEquals(kindsFor(STATES.Locked, true), ["Skip"]);
  assertEquals(kindsFor(STATES.WrongRemote, true), ["Skip"]);
  assertEquals(kindsFor(STATES.Dirty, true, STATES.Clean), ["Skip"]);
  assertEquals(
    plan(want, observed({ [HELLO]: at(STATES.Dirty) })).actions.find((a) => a.kind === "CreateWorktree"),
    { kind: "CreateWorktree", target: W, repo: HELLO, branch: "issue-10/x" },
  );
});

proves(
  ["0002-workspace-model FR-013"],
  "a repository's local Git configuration is set where it differs from the manifest's, in every state that has a working configuration",
  () => {
    const settings = { "core.hooksPath": "/h/hooks", "commit.gpgsign": "true" };
    const want = desired([repo(HELLO, settings)]);
    const cfg = (config: Record<string, string>, state: RepoState = STATES.Clean): Action[] => [
      ...plan(want, observed({ [HELLO]: at(state, { config }) })).actions,
    ];
    assertEquals(cfg({ "core.hooksPath": "/other", "commit.gpgsign": "true" }).at(-1), {
      kind: "ConfigureRepo",
      target: HELLO,
      settings: { "core.hooksPath": "/h/hooks" },
    });
    assertEquals(
      cfg(settings).map((a) => a.kind),
      ["Skip"],
    );
    assertEquals(
      cfg({}, STATES.Missing).map((a) => a.kind),
      ["Clone", "ConfigureRepo"],
    );
    assertEquals(
      cfg({}, STATES.Locked).map((a) => a.kind),
      ["Skip"],
    );
    assertEquals(
      cfg({}, STATES.WrongRemote).map((a) => a.kind),
      ["Refuse"],
    );
    assertEquals(
      cfg({}, STATES.Dirty).map((a) => a.kind),
      ["Skip", "ConfigureRepo"],
    );
  },
);

proves(
  ["0002-workspace-model FR-023", "0002-workspace-model FR-029", "0002-workspace-model FR-030"],
  "the ten kinds of action are the ontology's, with its destructive and host-change flags, and a host change is planned only by setup --apply",
  () => {
    const sample: Record<ActionKind, Action> = {
      Clone: { kind: "Clone", target: HELLO, url: "u", branch: undefined },
      FastForward: { kind: "FastForward", target: HELLO, commits: 2 },
      CreateWorktree: {
        kind: "CreateWorktree",
        target: HELLO,
        repo: HELLO,
        branch: main,
      },
      ConfigureRepo: {
        kind: "ConfigureRepo",
        target: HELLO,
        settings: { a: "b" },
      },
      ConfigureHost: { kind: "ConfigureHost", target: "git", what: "w" },
      WriteGenerated: {
        kind: "WriteGenerated",
        target: HELLO,
        sha256: "0".repeat(64) as Sha256,
      },
      RemoveGenerated: { kind: "RemoveGenerated", target: HELLO },
      InstallTool: {
        kind: "InstallTool",
        target: "bun",
        tool: "bun",
        version: mk(version("1.4.4")),
      },
      Skip: { kind: "Skip", target: "x", why: { kind: "in-sync" } },
      Refuse: {
        kind: "Refuse",
        target: "x",
        why: { kind: "not-a-repository" },
      },
    };
    assertEquals(Object.keys(sample).sort(), Object.keys(actionKinds).sort());
    for (const [kind, a] of Object.entries(sample)) {
      const listed = actionKinds[kind as ActionKind].values;
      assertEquals(isDestructive(a), listed.destructive, kind);
      assertEquals(isHostChange(a), listed.hostChange, kind);
      assertEquals(isDestructive(kind as ActionKind), listed.destructive, kind);
      assert(describeAction(a).length > 0, kind);
    }
    const tool = mk(version("1.4.4"));
    const want = desired([], {
      hostChanges: [
        { kind: "ConfigureHost", target: "git", what: "long paths" },
        { kind: "InstallTool", target: "bun", tool: "bun", version: tool },
      ],
    });
    assertEquals(plan(want, observed()).actions, []);
    assertEquals(plan(want, observed(), {}).actions, []);
    assertEquals(plan(want, observed(), { setupApply: false }).actions, []);
    assertEquals(
      plan(want, observed(), { setupApply: true }).actions.map((a) => a.kind),
      ["ConfigureHost", "InstallTool"],
    );
    // no plan made without setup --apply holds one, whatever else is in it
    fc.assert(
      fc.property(fc.constantFrom(...REPO_STATE_KINDS), (kind) => {
        const p = plan(want, observed({ [HELLO]: at(STATES[kind]) }));
        assert(!p.actions.some(isHostChange));
      }),
    );
  },
);

proves(
  ["0002-workspace-model FR-022"],
  "the state of a repository is classified from the facts read of it, one state each, by the order of what is most in the way",
  () => {
    const expected = ref;
    const facts = (
      over: Partial<{
        remote: string | undefined;
        lockFile: boolean;
        detached: boolean;
        dirty: boolean;
        ahead: number;
        behind: number;
      }> = {},
    ): Parameters<typeof classify>[0] => ({
      kind: "repository",
      remote: "git@github.com:octo/hello.git",
      lockFile: false,
      detached: false,
      dirty: false,
      ahead: 0,
      behind: 0,
      ...over,
    });
    const k = (f: Parameters<typeof classify>[0]): string => classify(f, expected).kind;
    assertEquals(k({ kind: "absent" }), "Missing");
    assertEquals(k({ kind: "not-a-repository" }), "NotARepo");
    assertEquals(k(facts()), "Clean");
    assertEquals(k(facts({ remote: "https://github.com/octo/hello" })), "Clean");
    assertEquals(k(facts({ remote: "https://user:secret@github.com/octo/hello.git" })), "Clean");
    assertEquals(k(facts({ remote: "https://github.com/octo/other" })), "WrongRemote");
    assertEquals(k(facts({ remote: undefined })), "WrongRemote");
    assertEquals(k(facts({ remote: "/srv/elsewhere.git" })), "WrongRemote");
    assertEquals(k(facts({ dirty: true })), "Dirty");
    assertEquals(k(facts({ ahead: 2 })), "Ahead");
    assertEquals(k(facts({ behind: 2 })), "Behind");
    assertEquals(k(facts({ ahead: 1, behind: 1 })), "Diverged");
    assertEquals(k(facts({ detached: true })), "Detached");
    assertEquals(k(facts({ lockFile: true })), "Locked");
    // what is most in the way wins
    assertEquals(k(facts({ lockFile: true, dirty: true, behind: 3 })), "Locked");
    assertEquals(k(facts({ detached: true, dirty: true })), "Detached");
    assertEquals(k(facts({ dirty: true, behind: 3 })), "Dirty");
    assertEquals(k(facts({ remote: "https://github.com/x/y", lockFile: true })), "WrongRemote");
    // the state names the wrong remote's host and path, never a credential
    const wrong = classify(
      facts({
        remote: "https://user:ghp_SECRET0123@gitlab.com/someone/else.git",
      }),
      expected,
    );
    assertEquals(wrong, {
      kind: "WrongRemote",
      found: "gitlab.com/someone/else",
    });
    assert(!JSON.stringify(wrong).includes("SECRET"));
    assertEquals(classify(facts({ remote: undefined }), expected), {
      kind: "WrongRemote",
      found: "(none)",
    });
    assertEquals(classify(facts({ remote: "/srv/elsewhere.git" }), expected), {
      kind: "WrongRemote",
      found: "(not a remote of a host)",
    });
    // exactly one state, always
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.nat({ max: 3 }),
        fc.nat({ max: 3 }),
        (lockFile, detached, dirty, ahead, behind) => {
          assert((REPO_STATE_KINDS as readonly string[]).includes(k(facts({ lockFile, detached, dirty, ahead, behind }))));
        },
      ),
    );
  },
);

proves(["0002-workspace-model FR-025"], "a plan whose every action is a skip changes nothing", () => {
  const p = plan(desired([repo(HELLO), repo(TOOL)]), observed({ [HELLO]: at(STATES.Clean), [TOOL]: at(STATES.Dirty) }));
  assertEquals(isSettled(p), true);
  assertEquals(isSettled(plan(desired([repo(HELLO)]), observed())), false);
});
