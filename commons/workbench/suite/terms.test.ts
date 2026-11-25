/**
 * Tests of the four concepts and of the layout of a workspace (commons workbench 0002-workbench-terms FR-001 to FR-004): the concepts are a closed list with a sentence each, a remote reads into the path of a repository, a worktree is
 * one actor's on one task, and a name that could leave its folder is refused.
 *
 * @module
 */
import { CONCEPTS, DEFINITIONS, isConcept } from "@intellectual-frontiers/workbench/governance";
import { actorSegment, parseRemote, storePath, WORKBENCH_DIR, workspacePath, worktreePath } from "@intellectual-frontiers/workbench/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0002-workbench-terms FR-001"], "the concepts are workstation, workshop, workspace and workbench, each defined in a sentence, and nothing else is one", () => {
  assertEquals([...CONCEPTS], ["workstation", "workshop", "workspace", "workbench"]);
  for (const c of CONCEPTS) assert(DEFINITIONS[c].endsWith(".") && DEFINITIONS[c].length > 30, `${c} is defined`);
  assertEquals(isConcept("workbench"), true);
  assertEquals(isConcept("workroom"), false);
});

proves(["0002-workbench-terms FR-002"], "a repository is at <home>/workspaces/<githost>/<org>/<repo> whichever form its remote is written in", () => {
  for (const url of ["https://github.com/example-org/example-repo.git", "git@github.com:example-org/example-repo.git", "ssh://git@github.com/example-org/example-repo", "https://token@github.com/example-org/example-repo/"]) {
    const r = parseRemote(url);
    assert(r.kind === "ok", url);
    assertEquals(workspacePath("/home/u", r.value), "/home/u/workspaces/github.com/example-org/example-repo");
  }
  assertEquals(parseRemote("not a remote").kind, "err");
  assertEquals(parseRemote("https://github.com/../etc").kind, "err");
});

proves(["0002-workbench-terms FR-003"], "other stores are under stores/<kind>/<place> and what the workbench keeps is in .workbench", () => {
  const s = storePath("/home/u", "bucket", "synthetic/bench-01");
  assert(s.kind === "ok");
  assertEquals(s.value, "/home/u/workspaces/stores/bucket/synthetic/bench-01");
  assertEquals(storePath("/home/u", "bucket", "../x").kind, "err");
  assertEquals(WORKBENCH_DIR, ".workbench");
});

proves(["0002-workbench-terms FR-004"], "a worktree is one actor's on one task beside the repository, and an actor is a person or an agent with its harness and session", () => {
  const r = parseRemote("https://github.com/example-org/example-repo");
  assert(r.kind === "ok");
  const actor = actorSegment("agent", "synthetic-harness", "s-01");
  assert(actor.kind === "ok");
  assertEquals(actor.value, "agent-synthetic-harness-s-01");
  const wt = worktreePath("/home/u", r.value, actor.value, "task-1");
  assert(wt.kind === "ok");
  assertEquals(wt.value, "/home/u/workspaces/github.com/example-org/example-repo.wt/agent-synthetic-harness-s-01/task-1");
  assertEquals(actorSegment("human", "ana").kind === "ok" && actorSegment("human", "ana").kind, "ok");
  assertEquals(actorSegment("agent", "../x").kind, "err");
  assertEquals(worktreePath("/home/u", r.value, "a/b", "t").kind, "err");
});
