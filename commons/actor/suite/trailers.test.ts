/**
 * Tests of the trailers and the vocabulary lint (commons actor 0004-actor-trailers FR-001 to FR-007).
 *
 * @module
 */
import fc from "fast-check";
import { readHistory } from "@intellectual-frontiers/actor/physical";
import { actorFromTrailer, decodeMessage, encodeTrailers, lintCommit, lintVocabulary, trailersOf } from "@intellectual-frontiers/actor/logical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { agent, DIGEST, person } from "./fixtures.ts";

const ref = { id: "work-order-001", version: "1", digest: DIGEST };

proves(["0004-actor-trailers FR-001", "0004-actor-trailers FR-002"], "the trailers are encoded in the form git reads and decoded back to the same actors", () => {
  const lines = encodeTrailers({ preparedBy: agent, directive: ref, reviewedBy: person(2) });
  assertEquals(lines, ["Prepared-by: synthetic-agent-01 (agent, model synthetic-model-1 reported)", `Directive: work-order-001@1 sha256:${DIGEST}`, "Reviewed-by: synthetic-person-02 (person)"]);
  const d = decodeMessage(`Add the thing\n\nRefs #1\n\n${lines.join("\n")}\nCo-Authored-By: Someone <a@example.test>\n`);
  assertEquals(d.errors, []);
  assertEquals(d.actors, { preparedBy: agent, directive: ref, reviewedBy: person(2) });
  assertEquals(d.trailers.length, 4);
  fc.assert(fc.property(fc.constantFrom(person(1), agent, { kind: "system", id: "synthetic-system-01" } as const), (a) => decodeMessage(`s\n\n${encodeTrailers({ preparedBy: a }).join("\n")}\n`).actors.preparedBy?.id === a.id));
  assertEquals(trailersOf("only a subject\n"), []);
  assertEquals(trailersOf("Subject\n\nA paragraph that is not trailers.\nKey: value\n"), []);
  assertEquals(trailersOf("Subject\n\nKey: one\n  folded\n").map((t) => t.value), ["one folded"]);
  const bad = decodeMessage("s\n\nPrepared-by: nobody\nDirective: x\nReviewed-by: someone (agent)\n");
  assertEquals(bad.errors.map((e) => e.key), ["Prepared-by", "Directive", "Reviewed-by"]);
  const one = actorFromTrailer("synthetic-agent-01 (agent, model synthetic-model-1 reported)");
  assert(one.kind === "ok" && one.value.kind === "agent");
  assert(actorFromTrailer("???").kind === "err");
});

proves(["0004-actor-trailers FR-003", "0004-actor-trailers FR-004"], "the lint finds an agent as author, reviewer or signer, an undirected draft and a malformed trailer", () => {
  const head = "Add\n\n";
  const lines = encodeTrailers({ preparedBy: agent, directive: ref });
  assertEquals(lintCommit({ message: `${head}${lines.join("\n")}\n`, author: person(1) }), []);
  assert(lintCommit({ message: `${head}${lines.join("\n")}\n`, author: agent }).some((f) => f.rule === "agent-author"));
  assert(lintCommit({ message: `${head}${lines.join("\n")}\nReviewed-by: x (agent)\n` }).some((f) => f.rule === "agent-reviewer"));
  assert(lintCommit({ message: `${head}${lines.join("\n")}\nSigned-off-by: synthetic-agent-01\n` }).some((f) => f.rule === "agent-signoff"));
  assert(lintCommit({ message: `${head}${lines.join("\n")}\nApproved-by: synthetic-agent-01\n` }).some((f) => f.rule === "agent-reviewer"));
  assert(lintCommit({ message: `${head}${encodeTrailers({ preparedBy: agent }).join("\n")}\n` }).some((f) => f.rule === "undirected-draft"));
  assert(lintCommit({ message: `${head}Prepared-by: nobody\n` }).some((f) => f.rule === "malformed-trailer"));
  assertEquals(lintCommit({ message: `${head}Signed-off-by: A Person <a@example.test>\n`, author: person(1) }), [], "a person's sign-off is fine");
});

proves(["0004-actor-trailers FR-005"], "the words of FR-014 are found of an agent, in the active and the passive, and not of a person", () => {
  const found = (s: string) => lintVocabulary(s).map((f) => f.word);
  assertEquals(found("The agent approved the plan."), ["approved"]);
  assertEquals(found("The AI assistant wrote the test."), ["wrote"]);
  assertEquals(found("Claude completed the change."), ["completed"]);
  assertEquals(found("The plan was approved by the agent."), ["approved"]);
  assertEquals(found("It was signed by an AI agent."), ["signed"]);
  assertEquals(found("The model confirmed it and the bot initiated it."), ["confirmed", "initiated"]);
  assertEquals(found("The agent owns the record."), ["owns"]);
  assertEquals(found("The agent prepared the plan and assisted the step; it drafted a note."), []);
  assertEquals(found("The reviewer approved the plan."), []);
  assertEquals(found("Alice wrote the test and Bob signed it."), []);
  assertEquals(found("The agent prepared it. The person approved it."), []);
  assertEquals(found("The agent works through its own tool and records a proposal."), [], "own is not owns");
  assertEquals(found("Nothing is approved by an agent."), [], "a sentence that denies it states the rule");
  assertEquals(found("An agent never signed anything and does not approve a plan."), []);
});

proves(["0004-actor-trailers FR-006"], "the lint skips code and does not judge style", () => {
  assertEquals(lintVocabulary("Use `the agent approved` as an example.").length, 0);
  assertEquals(lintVocabulary("```\nthe agent approved\n```\nDone.").length, 0);
  assertEquals(lintVocabulary("Plain text, written in the style of a model, with no verb about an agent.").length, 0);
  assertEquals(lintVocabulary("ok\nThe agent signed the log.\n").map((f) => f.line), [2]);
});

proves(["0004-actor-trailers FR-007"], "the history gives the trailers and the files of each commit, and writes nothing", async () => {
  const root = await fs.makeTempDir({ prefix: "actor-" });
  try {
    const git = async (...args: string[]) => {
      const r = await proc.output(["git", "-C", root, ...args], { env: { GIT_AUTHOR_NAME: "Synthetic Person", GIT_AUTHOR_EMAIL: "p@example.test", GIT_COMMITTER_NAME: "Synthetic Person", GIT_COMMITTER_EMAIL: "p@example.test" } });
      assertEquals(r.code, 0, new TextDecoder().decode(r.stderr));
    };
    await git("init", "-q", "-b", "main");
    await fs.writeTextFile(path.join(root, "a.txt"), "one\n");
    await git("add", "a.txt");
    await git("-c", "commit.gpgsign=false", "commit", "-q", "-m", `First\n\n${encodeTrailers({ preparedBy: agent, directive: ref, reviewedBy: person(2) }).join("\n")}`);
    await fs.writeTextFile(path.join(root, "b.txt"), "two\n");
    await git("add", "b.txt");
    await git("-c", "commit.gpgsign=false", "commit", "-q", "-m", "Second, with no trailers");
    const r = await readHistory(root);
    assert(r.kind === "ok" && r.value.length === 2);
    if (r.kind !== "ok") return;
    const [second, first] = r.value;
    assertEquals(second?.subject, "Second, with no trailers");
    assertEquals(second?.files, ["b.txt"]);
    assertEquals(first?.decoded.actors.preparedBy, agent);
    assertEquals(first?.decoded.actors.reviewedBy, person(2));
    assertEquals(first?.author, "Synthetic Person");
    assert((await readHistory(root, { since: "--evil" })).kind === "err");
    assert((await readHistory(path.join(root, "missing"))).kind === "err");
  } finally {
    await fs.remove(root, { recursive: true });
  }
});
