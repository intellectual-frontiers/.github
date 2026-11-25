/**
 * Tests of the runner `bash` (commons workload 0011-runner-bash FR-001 to FR-007): the script of the bootstrap runbook is read, linted, syntax-checked, checked by the shell linter where it is installed and run with the real
 * Bash of the machine against a fake verb command, so that the calls, the loop, the inputs, the failure and the receipt line are seen and not assumed. Every name is synthetic.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { authored, type CallPlan, runnerId } from "@intellectual-frontiers/workload/governance";
import { bootstrapFleet, callsOf, SYNTHETIC_BOOTSTRAP_01 } from "@intellectual-frontiers/workload/forms/runbook";
import { emitPlan } from "@intellectual-frontiers/workload/physical";
import { artifactOf, fakeWorld, have, skipped, unquotedExpansions, write } from "./emit-kit.ts";
import { must } from "./kit.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const HAVE_BASH = have("bash");
const HAVE_SHELLCHECK = have("shellcheck");
const script = async (): Promise<string> => (await artifactOf("bash")).text;

proves(["0011-runner-bash FR-001"], "the script begins with the shebang, fails fast under a Bash older than 5 before any call, and then sets strict mode and inherit_errexit", async () => {
  const text = await script();
  const lines = text.split("\n");
  assertEquals(lines[0], "#!/usr/bin/env bash");
  const code = lines.filter((l) => !l.startsWith("#") && l !== "");
  assertEquals(code.slice(0, 5), ["if ((BASH_VERSINFO[0] < 5)); then", "  printf 'workload: this script needs bash 5 or later\\n' >&2", "  exit 70", "fi", "set -Eeuo pipefail"]);
  assertEquals(code[5], "shopt -s inherit_errexit");
  assert(text.indexOf("BASH_VERSINFO") < text.indexOf("set -Eeuo pipefail") && text.indexOf("set -Eeuo pipefail") < text.indexOf("run_verb '"));
  if (!HAVE_BASH) return skipped("the run of the script", "bash");
  const world = fakeWorld();
  try {
    const old = write(world, "old.sh", text.replace("BASH_VERSINFO[0] < 5", "BASH_VERSINFO[0] < 99"));
    const r = world.run("bash", [old], { WORKLOAD_INPUT_ORDER: "ord-1" });
    assertEquals(r.status, 70);
    assert(r.stderr.includes("needs bash 5 or later"));
    assertEquals(world.calls(), []);
  } finally {
    world.close();
  }
});

proves(["0011-runner-bash FR-002"], "every call goes through one function with an array, the script has no eval, no substitution and no unquoted expansion, and bash -n and the shell linter accept it", async () => {
  const text = await script();
  for (const bad of [/\beval\b/u, /\$\(/u, /`/u, /\bsource\b/u, /^\s*\.\s/mu, /\bexec\b/u]) assert(!bad.test(text), String(bad));
  assertEquals(unquotedExpansions(text), []);
  assertEquals(unquotedExpansions('echo $HOME "x" \'$y\' "$z"\n'), ["1: echo $HOME \"x\" '$y' \"$z\""], "the lint finds an unquoted expansion");
  assert(text.includes("readonly cli=('workload')") && text.includes('"${cli[@]}" verb "$@"'));
  assertEquals(text.split("\n").filter((l) => /"\$\{cli\[@\]\}"/u.test(l)).length, 1, "one place calls the verb command");
  if (!HAVE_BASH) return skipped("the run of the script", "bash");
  const world = fakeWorld();
  try {
    const file = write(world, "bootstrap.sh", text);
    assertEquals(world.run("bash", ["-n", file]).status, 0);
    if (!HAVE_SHELLCHECK) skipped("the shell linter", "shellcheck");
    else {
      const lint = spawnSync("shellcheck", ["--shell=bash", "--severity=style", file], { encoding: "utf8" });
      assertEquals(lint.stdout + lint.stderr, "");
      assertEquals(lint.status, 0);
    }
  } finally {
    world.close();
  }
});

proves(["0011-runner-bash FR-003"], "an each is a loop over an array literal of the fixed list, and each call in it passes the member", async () => {
  const text = await script();
  assert(text.includes("members=('synthetic-host-01' 'synthetic-host-02')") && text.includes('for member in "${members[@]}"; do'));
  assert(text.includes(`--member "\${member}"`));
  if (!HAVE_BASH) return skipped("the run of the script", "bash");
  const world = fakeWorld();
  try {
    const r = world.run("bash", [write(world, "bootstrap.sh", text)], { WORKLOAD_INPUT_ORDER: "ord-1" });
    assertEquals(r.status, 0);
    assertEquals(world.calls(), ["verb workbench.ready --in task=run", "verb work.claim --in order=ord-1", "verb work.record --in order=ord-1 --member synthetic-host-01", "verb work.record --in order=ord-1 --member synthetic-host-02"]);
    const none = must(await emitPlan({ ...must(callsOf(SYNTHETIC_BOOTSTRAP_01, { fleet: () => [] })) }, authored(runnerId("bash"))));
    assert(none.text.includes("members=()"));
    const again = fakeWorld();
    try {
      assertEquals(again.run("bash", [write(again, "none.sh", none.text)], { WORKLOAD_INPUT_ORDER: "ord-1" }).status, 0);
      assertEquals(again.calls(), ["verb workbench.ready --in task=run", "verb work.claim --in order=ord-1"]);
    } finally {
      again.close();
    }
  } finally {
    world.close();
  }
});

proves(["0011-runner-bash FR-004"], "an input is read from its environment variable and an unset one stops the script before the call, and the script holds the name of a credential and never its value", async () => {
  const text = await script();
  assert(text.includes('"order=${WORKLOAD_INPUT_ORDER}"'));
  assert(text.includes("# credential: SYNTHETIC_TOKEN_01 (a name only"));
  assert(!/SYNTHETIC_TOKEN_01=/u.test(text));
  if (!HAVE_BASH) return skipped("the run of the script", "bash");
  const world = fakeWorld();
  try {
    const file = write(world, "bootstrap.sh", text);
    const unset = world.run("bash", [file]);
    assert(unset.status !== 0 && unset.status !== 70 && unset.stderr.includes("WORKLOAD_INPUT_ORDER: unbound variable"), unset.stderr);
    assertEquals(world.calls(), ["verb workbench.ready --in task=run"], "the call that reads the input is not made");
    const secret = "synthetic-secret-value-01";
    const withSecret = world.run("bash", [file], { WORKLOAD_INPUT_ORDER: "ord-1", SYNTHETIC_TOKEN_01: secret });
    assertEquals(withSecret.status, 0);
    assert(!world.calls().join("\n").includes(secret) && !withSecret.stdout.includes(secret) && !withSecret.stderr.includes(secret));
    assert(!text.includes(secret));
  } finally {
    world.close();
  }
});

proves(["0011-runner-bash FR-005"], "a failed call stops the script with its status, and the trap writes one receipt line with the plan hash, the runner, the status and the step", async () => {
  const a = await artifactOf("bash");
  assert(a.text.includes("trap 'on_exit \"$?\"' EXIT"));
  if (!HAVE_BASH) return skipped("the run of the script", "bash");
  const world = fakeWorld();
  try {
    const file = write(world, "bootstrap.sh", a.text);
    const failed = world.run("bash", [file], { WORKLOAD_INPUT_ORDER: "ord-1", FAKE_FAIL_VERB: "work.claim" });
    assertEquals(failed.status, 7);
    assertEquals(world.calls(), ["verb workbench.ready --in task=run", "verb work.claim --in order=ord-1"]);
    const lines = failed.stderr.split("\n").filter((l) => l.startsWith("workload.receipt/1 "));
    assertEquals(lines, [`workload.receipt/1 plan=${a.hash} workload=synthetic-bootstrap-01 runner=bash status=7 step=claim-order`]);
    const fine = world.run("bash", [file], { WORKLOAD_INPUT_ORDER: "ord-1" });
    assertEquals(fine.status, 0);
    assert(fine.stderr.includes(`plan=${a.hash} workload=synthetic-bootstrap-01 runner=bash status=0 step=done`));
    const loopFail = world.run("bash", [file], { WORKLOAD_INPUT_ORDER: "ord-1", FAKE_FAIL_VERB: "work.record" });
    assertEquals(loopFail.status, 7);
    assert(loopFail.stderr.includes("status=7 step=record-host"));
  } finally {
    world.close();
  }
});

proves(["0011-runner-bash FR-006"], "the script carries the plan hash and the autonomy of each step as comments, and the same plan gives the same bytes", async () => {
  const a = await artifactOf("bash");
  const b = await artifactOf("bash");
  assertEquals(a.text, b.text);
  assert(a.text.includes(`# plan: ${a.hash}`));
  assert(a.text.includes("# step claim-order: verb, agent-acts-human-reviews") && a.text.includes("# step install-check: check, agent-autonomous"));
  assertEquals(await fs.readTextFile(path.join(ROOT, "artifacts", a.path)), a.text);
});

proves(["0011-runner-bash FR-007"], "the emitter is an instance that imports no other emitter and quotes every value so that no value changes how the script is read", async () => {
  const source = (await fs.readTextFile(path.join(ROOT, "src", "physical", "runners", "bash", "mod.ts"))).replace(/\/\*\*[\s\S]*?\*\//gu, "");
  assert(!source.includes("runners/pwsh"));
  const base: CallPlan = must(callsOf(SYNTHETIC_BOOTSTRAP_01, { fleet: bootstrapFleet }));
  const nasty = ["it's", "$(touch pwned)", '"double" and `tick`', "a b\\c", "; rm -rf /", "$HOME ${PATH}", "--help", "x=y=z", ""];
  const plan: CallPlan = { ...base, steps: nasty.map((v, i) => ({ kind: "call", step: `nasty-${i}`, as: "verb", verb: "work.record", args: [{ name: "digest", value: { kind: "literal", text: v } }], autonomy: "agent-acts-human-reviews" })) };
  const made = must(await emitPlan(plan, authored(runnerId("bash"))));
  assertEquals(unquotedExpansions(made.text), []);
  if (!HAVE_BASH) return skipped("the run of the script", "bash");
  const world = fakeWorld();
  try {
    const r = world.run("bash", [write(world, "nasty.sh", made.text)]);
    assertEquals(r.status, 0, r.stderr);
    assertEquals(world.calls(), nasty.map((v) => `verb work.record --in digest=${v}`));
    assertEquals(spawnSync("ls", [world.dir], { encoding: "utf8" }).stdout.includes("pwned"), false);
  } finally {
    world.close();
  }
});
