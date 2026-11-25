/**
 * Tests of the runner `pwsh` (commons workload 0012-runner-powershell FR-001 to FR-008): the script of the bootstrap runbook is read and checked structurally everywhere, and where PowerShell 7 is installed it is run
 * against a fake verb command, so that the calls, the loop, the inputs, the failure and the receipt line are seen; where it is not, the tests that run it say so (`UNVERIFIED here`) and the structural checks still run. The
 * script analyzer of PowerShell is run where its module is installed. Every name is synthetic.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { authored, type CallPlan, runnerId } from "@intellectual-frontiers/workload/governance";
import { bootstrapFleet, callsOf, SYNTHETIC_BOOTSTRAP_01 } from "@intellectual-frontiers/workload/forms/runbook";
import { emitPlan } from "@intellectual-frontiers/workload/physical";
import { artifactOf, fakeWorld, have, skipped, write } from "./emit-kit.ts";
import { must } from "./kit.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const HAVE_PWSH = have("pwsh");
const text = async (): Promise<string> => (await artifactOf("pwsh")).text;
const pwsh = (world: ReturnType<typeof fakeWorld>, file: string, env: Readonly<Record<string, string>> = {}) => world.run("pwsh", ["-NoProfile", "-NonInteractive", "-File", file], env);

proves(["0012-runner-powershell FR-001"], "the script requires PowerShell 7.0 on its first line and then sets strict mode and the stop preference, before any call", async () => {
  const t = await text();
  const lines = t.split("\n");
  assertEquals(lines[0], "#Requires -Version 7.0");
  const code = lines.filter((l) => !l.startsWith("#") && l !== "");
  assertEquals(code.slice(0, 2), ["Set-StrictMode -Version Latest", "$ErrorActionPreference = 'Stop'"]);
  assert(t.indexOf("Set-StrictMode") < t.indexOf("Invoke-Verb -Step '"));
  assert(!t.includes("powershell.exe") && !/Version 5/u.test(t));
});

proves(["0012-runner-powershell FR-002"], "every call goes through one function with an array and a check of $LASTEXITCODE, and the script has no Invoke-Expression, no string built into a command and every value single-quoted", async () => {
  const t = await text();
  for (const bad of [/Invoke-Expression/iu, /\biex\b/iu, /Start-Process/iu, /^\s*\.\s/mu, /\$\(/u, /\bAdd-Type\b/u, /\[scriptblock\]::Create/iu, /-Command\b/u]) assert(!bad.test(t), String(bad));
  const native = t.split("\n").filter((l) => /^\s*& /u.test(l));
  assertEquals(native, ["    & $Cli 'verb' $Verb @VerbArguments"], "one native call");
  const at = t.split("\n").findIndex((l) => l.includes("& $Cli"));
  assert((t.split("\n")[at + 1] ?? "").includes("if ($LASTEXITCODE -ne 0) {"), "the exit code is checked right after the native call");
  assert(t.includes("-VerbArguments @('--in', 'task=run')"));
  const calls = t.split("\n").filter((l) => l.includes("Invoke-Verb -Step"));
  assertEquals(calls.length, 3);
  for (const line of calls) assert(!/"/u.test(line), `a double-quoted string in ${line}`);
  if (!HAVE_PWSH) return skipped("the parse of the script and the script analyzer", "pwsh");
  const world = fakeWorld();
  try {
    const file = write(world, "bootstrap.ps1", t);
    const parse = world.run("pwsh", ["-NoProfile", "-NonInteractive", "-Command", `$e = $null; $t = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$t, [ref]$e); $e.Count`]);
    assertEquals(parse.stdout.trim(), "0", parse.stderr);
    const analyzer = world.run("pwsh", ["-NoProfile", "-NonInteractive", "-Command", `if (-not (Get-Module -ListAvailable PSScriptAnalyzer)) { 'absent' } else { Import-Module PSScriptAnalyzer; (Invoke-ScriptAnalyzer -Path '${file}' | Measure-Object).Count }`], { HOME: process.env["HOME"] ?? "" });
    if (analyzer.stdout.trim() === "absent") skipped("the script analyzer", "PSScriptAnalyzer");
    else assertEquals(analyzer.stdout.trim(), "0", analyzer.stdout);
  } finally {
    world.close();
  }
});

proves(["0012-runner-powershell FR-003"], "an each is a foreach over an array literal of the fixed list, and each call in it passes the member", async () => {
  const t = await text();
  assert(t.includes("foreach ($member in @('synthetic-host-01', 'synthetic-host-02')) {") && t.includes("'--member', $member)"));
  if (!HAVE_PWSH) return skipped("the run of the script", "pwsh");
  const world = fakeWorld();
  try {
    const r = pwsh(world, write(world, "bootstrap.ps1", t), { WORKLOAD_INPUT_ORDER: "ord-1" });
    assertEquals(r.status, 0, r.stderr);
    assertEquals(world.calls(), ["verb workbench.ready --in task=run", "verb work.claim --in order=ord-1", "verb work.record --in order=ord-1 --member synthetic-host-01", "verb work.record --in order=ord-1 --member synthetic-host-02"]);
    const none = must(await emitPlan({ ...must(callsOf(SYNTHETIC_BOOTSTRAP_01, { fleet: () => [] })) }, authored(runnerId("pwsh"))));
    assert(none.text.includes("foreach ($member in @()) {"));
    const again = fakeWorld();
    try {
      assertEquals(pwsh(again, write(again, "none.ps1", none.text), { WORKLOAD_INPUT_ORDER: "ord-1" }).status, 0);
      assertEquals(again.calls(), ["verb workbench.ready --in task=run", "verb work.claim --in order=ord-1"]);
    } finally {
      again.close();
    }
  } finally {
    world.close();
  }
});

proves(["0012-runner-powershell FR-004"], "an input is read from its environment variable and a missing one stops the script before the call, and the script holds the name of a credential and never its value", async () => {
  const t = await text();
  assert(t.includes("(Get-Item -LiteralPath 'Env:WORKLOAD_INPUT_ORDER').Value"));
  assert(t.includes("# credential: SYNTHETIC_TOKEN_01 (a name only") && !/SYNTHETIC_TOKEN_01\s*=/u.test(t));
  if (!HAVE_PWSH) return skipped("the run of the script", "pwsh");
  const world = fakeWorld();
  try {
    const file = write(world, "bootstrap.ps1", t);
    const unset = pwsh(world, file);
    assert(unset.status !== 0 && unset.stderr.includes("WORKLOAD_INPUT_ORDER"), unset.stderr);
    assertEquals(world.calls(), ["verb workbench.ready --in task=run"], "the call that reads the input is not made");
    const secret = "synthetic-secret-value-01";
    const withSecret = pwsh(world, file, { WORKLOAD_INPUT_ORDER: "ord-1", SYNTHETIC_TOKEN_01: secret });
    assertEquals(withSecret.status, 0, withSecret.stderr);
    assert(!world.calls().join("\n").includes(secret) && !withSecret.stdout.includes(secret) && !withSecret.stderr.includes(secret) && !t.includes(secret));
  } finally {
    world.close();
  }
});

proves(["0012-runner-powershell FR-005"], "a failed call stops the script with its status, and the finally block writes one receipt line with the plan hash, the runner, the status and the step", async () => {
  const a = await artifactOf("pwsh");
  assert(a.text.includes("finally {") && a.text.includes("workload.receipt/1 plan={0} workload={1} runner={2} status={3} step={4}") && a.text.trimEnd().endsWith("exit $script:Status"));
  if (!HAVE_PWSH) return skipped("the run of the script", "pwsh");
  const world = fakeWorld();
  try {
    const file = write(world, "bootstrap.ps1", a.text);
    const failed = pwsh(world, file, { WORKLOAD_INPUT_ORDER: "ord-1", FAKE_FAIL_VERB: "work.claim" });
    assertEquals(failed.status, 7);
    assertEquals(world.calls(), ["verb workbench.ready --in task=run", "verb work.claim --in order=ord-1"]);
    assertEquals(failed.stderr.split("\n").filter((l) => l.startsWith("workload.receipt/1 ")), [`workload.receipt/1 plan=${a.hash} workload=synthetic-bootstrap-01 runner=pwsh status=7 step=claim-order`]);
    const fine = pwsh(world, file, { WORKLOAD_INPUT_ORDER: "ord-1" });
    assertEquals(fine.status, 0);
    assert(fine.stderr.includes(`plan=${a.hash} workload=synthetic-bootstrap-01 runner=pwsh status=0 step=done`));
    const loopFail = pwsh(world, file, { WORKLOAD_INPUT_ORDER: "ord-1", FAKE_FAIL_VERB: "work.record" });
    assertEquals(loopFail.status, 7);
    assert(loopFail.stderr.includes("status=7 step=record-host"));
  } finally {
    world.close();
  }
});

proves(["0012-runner-powershell FR-006"], "the script carries the plan hash and the autonomy of each step as comments, and the same plan gives the same bytes", async () => {
  const a = await artifactOf("pwsh");
  assertEquals(a.text, (await artifactOf("pwsh")).text);
  assert(a.text.includes(`# plan: ${a.hash}`) && a.text.includes("# step claim-order: verb, agent-acts-human-reviews") && a.text.includes("# step install-check: check, agent-autonomous"));
  assertEquals(await fs.readTextFile(path.join(ROOT, "artifacts", a.path)), a.text);
});

proves(["0012-runner-powershell FR-007"], "the emitter is an instance that imports no other emitter and doubles every single quote so that no value changes how the script is read", async () => {
  const source = (await fs.readTextFile(path.join(ROOT, "src", "physical", "runners", "pwsh", "mod.ts"))).replace(/\/\*\*[\s\S]*?\*\//gu, "");
  assert(!source.includes("runners/bash"));
  const base: CallPlan = must(callsOf(SYNTHETIC_BOOTSTRAP_01, { fleet: bootstrapFleet }));
  const nasty = ["it's", "$(Get-Date)", '"double" and `tick`', "a b\\c", "; Remove-Item *", "$env:PATH ${x}", "--help", "x=y=z", "@(1)", "'; exit 3; '", ""];
  const plan: CallPlan = { ...base, steps: nasty.map((v, i) => ({ kind: "call", step: `nasty-${i}`, as: "verb", verb: "work.record", args: [{ name: "digest", value: { kind: "literal", text: v } }], autonomy: "agent-acts-human-reviews" })) };
  const made = must(await emitPlan(plan, authored(runnerId("pwsh"))));
  assert(made.text.includes("'it''s'") === false && made.text.includes("'digest=it''s'"));
  if (!HAVE_PWSH) return skipped("the run of the script", "pwsh");
  const world = fakeWorld();
  try {
    const r = pwsh(world, write(world, "nasty.ps1", made.text));
    assertEquals(r.status, 0, r.stderr);
    assertEquals(world.calls(), nasty.map((v) => `verb work.record --in digest=${v}`));
    assertEquals(spawnSync("ls", [world.dir], { encoding: "utf8" }).stdout.includes("pwned"), false);
  } finally {
    world.close();
  }
});

proves(["0012-runner-powershell FR-008", "0010-workload-runners FR-017"], "the two scripts of the bootstrap runbook make the same calls when they are run against the same fake command", async () => {
  const bash = await artifactOf("bash");
  const ps = await artifactOf("pwsh");
  assertEquals(bash.hash, ps.hash);
  if (!HAVE_PWSH || !have("bash")) return skipped("the comparison of the two runs", HAVE_PWSH ? "bash" : "pwsh");
  const one = fakeWorld();
  const two = fakeWorld();
  try {
    assertEquals(one.run("bash", [write(one, "b.sh", bash.text)], { WORKLOAD_INPUT_ORDER: "ord-9" }).status, 0);
    assertEquals(pwsh(two, write(two, "p.ps1", ps.text), { WORKLOAD_INPUT_ORDER: "ord-9" }).status, 0);
    assertEquals(two.calls(), one.calls());
    assertEquals(one.calls().length, 4);
  } finally {
    one.close();
    two.close();
  }
});
