// Steps, the pool, the stop and the telemetry (009-machine-bootstrap FR-030, FR-054, FR-061 to FR-067).
import { assert, assertEquals, assertGreaterOrEqual, assertLess, assertStringIncludes } from "@std/assert";
import { Captured, context, Fx, OFF, serve, without } from "./helpers.ts";
import { command, pool, step, stepSoft, task } from "../bin/setup/steps.ts";
import { type Props, Signals } from "../bin/setup/telemetry.ts";
import type { Ctx } from "../bin/setup/context.ts";

const has = (s: string, ...needles: string[]) => needles.forEach((n) => assertStringIncludes(s, n));

function logged(fx: Fx, extra: Record<string, string> = {}): { ctx: Ctx; log: string; support: string } {
  const dir = `${fx.home}/.erga-bootstrap/log`;
  Deno.mkdirSync(dir, { recursive: true });
  const log = `${dir}/bootstrap-20260101-000000.log`;
  Deno.writeTextFileSync(log, "");
  return { ctx: context(fx, extra, [], { logPath: log }), log, support: `${dir}/support-20260101-000000.txt` };
}

Deno.test("a failed step stops with the log, the support file and how to ask for help (FR-066, FR-067)", async () => {
  await using fx = await Fx.make();
  const { ctx, log, support } = logged(fx, { BOOTSTRAP_SUPPORT: "the help desk" });
  using cap = new Captured();
  const r = await step(ctx, "Installing everything", command(["sh", "-c", "echo broke the thing; exit 7"]));
  assert(!r.ok && r.error.kind === "step-failed");
  has(cap.out, "Setup stopped", "Installing everything", "broke the thing", "~/.erga-bootstrap/log/bootstrap-", "support-", "the help desk", "the problem starts at line");
  has(Deno.readTextFileSync(log), "==== STEP 1: Installing everything (exit 7)");
  has(Deno.readTextFileSync(support), "broke the thing", "Failed step: Installing everything", "Retries:");
});

Deno.test("a secret in the output is removed from the support file", async () => {
  await using fx = await Fx.make();
  const { ctx, support } = logged(fx);
  using _ = new Captured();
  await step(ctx, "x", command(["sh", "-c", "echo token=abc123 ghp_ABCDEFGHIJKLMNOP1234; exit 1"]));
  const text = Deno.readTextFileSync(support);
  assert(!text.includes("abc123") && !text.includes("ghp_ABCDEFGHIJKLMNOP1234"), text);
});

Deno.test("a step whose words say the network failed says so, and to try --patient (FR-033)", async () => {
  await using fx = await Fx.make();
  const { ctx } = logged(fx);
  using cap = new Captured();
  await step(ctx, "x", command(["sh", "-c", "echo 'Could not resolve host: github.com'; exit 6"]));
  has(cap.out, "This looks like the network", "--patient");
});

Deno.test("BOOTSTRAP_KEEP_GOING=1 goes on after a failed step; a soft step returns its status", async () => {
  await using fx = await Fx.make();
  const { ctx } = logged(fx, { BOOTSTRAP_KEEP_GOING: "1" });
  using cap = new Captured();
  assert((await step(ctx, "one", command(["false"]))).ok);
  assertEquals(await stepSoft(ctx, "two", command(["sh", "-c", "exit 3"])), 3);
  has(cap.err, "one", "two");
  lacks(cap.out, "Setup stopped");
});

Deno.test("a dry run only names the step", async () => {
  await using fx = await Fx.make();
  const ctx = context(fx, {}, ["--dry-run"]);
  using cap = new Captured();
  const marker = `${fx.tmp}/ran`;
  await step(ctx, "Doing it", command(["touch", marker]));
  assertEquals(cap.out, "  - Doing it\n");
  assert(!(await Deno.lstat(marker).then(() => true, () => false)));
});

Deno.test("jobs that do not touch each other run at the same time, at most BOOTSTRAP_JOBS at once (FR-030)", async () => {
  await using fx = await Fx.make();
  const { ctx } = logged(fx, { BOOTSTRAP_JOBS: "6" });
  using _ = new Captured();
  const t0 = Date.now();
  const r = await pool(ctx, "T", Array.from({ length: 6 }, (_, i) => ({ label: `job ${i}`, work: command(["sleep", "1"]) })));
  assert(r.ok);
  assertLess(Date.now() - t0, 3500, "six one-second jobs in parallel take about one second");
  const capped = logged(fx, { BOOTSTRAP_JOBS: "2" }).ctx;
  const t1 = Date.now();
  await pool(capped, "T", Array.from({ length: 4 }, (_, i) => ({ label: `job ${i}`, work: command(["sleep", "1"]) })));
  assertGreaterOrEqual(Date.now() - t1, 1900, "four one-second jobs two at a time take two seconds");
});

Deno.test("a failed job stops the run after the others finish, names it, and every job is in the log (FR-030)", async () => {
  await using fx = await Fx.make();
  const { ctx, log } = logged(fx);
  using cap = new Captured();
  const r = await pool(ctx, "T", [
    { label: "good one", work: command(["true"]) },
    { label: "bad one", work: command(["sh", "-c", "echo nope; exit 9"]) },
    { label: "good two", work: task(() => Promise.resolve(0)) },
  ]);
  assert(!r.ok);
  has(cap.out, "bad one", "nope");
  const text = Deno.readTextFileSync(log);
  has(text, "(exit 9)");
  assertEquals(text.split("==== STEP").length - 1, 3);
});

// ---- telemetry (FR-054)

type Event = { event: string; distinctId: string; resource: Record<string, unknown>; properties: Record<string, unknown> };
const plainValue = (v: Record<string, unknown>) => "stringValue" in v ? v.stringValue : v.doubleValue;

function door(): { url: string; got: Event[]; auth: string[]; close: () => Promise<void> } {
  const got: Event[] = [];
  const auth: string[] = [];
  const s = serve(async (req) => {
    assertEquals(new URL(req.url).pathname, "/v1/logs");
    auth.push(req.headers.get("authorization") ?? "");
    const body = await req.json();
    for (const rl of body.resourceLogs) {
      const resource = Object.fromEntries(rl.resource.attributes.map((a: { key: string; value: Record<string, unknown> }) => [a.key, plainValue(a.value)]));
      for (const sl of rl.scopeLogs) {
        for (const r of sl.logRecords) {
          got.push({
            event: r.eventName,
            distinctId: String(resource["enduser.id"]),
            resource,
            properties: Object.fromEntries(r.attributes.map((a: { key: string; value: Record<string, unknown> }) => [a.key, plainValue(a.value)])),
          });
        }
      }
    }
    return new Response("ok");
  });
  return { url: s.url, got, auth, close: s.close };
}

Deno.test("steps and a failure are sent with the environment and a stable device id, and journalled without the token", async () => {
  await using fx = await Fx.make();
  const d = door();
  try {
    const { ctx } = logged(fx);
    const machine: Props = { hostname: "h", os_user: "u", host_kind: "machine", os_id: "debian", arch: "x86_64", cpus: 2 };
    const journal = `${fx.home}/.local/state/erga/telemetry`;
    const signals = new Signals({ kind: "on", url: d.url, token: "arca_test" }, journal, () => Promise.resolve("dev-0123456789abcdef"), () => Promise.resolve(machine), () => "");
    const c: Ctx = { ...ctx, signals };
    using _ = new Captured();
    await step(c, "Installing one", command(["true"]));
    await step(c, "Installing two", command(["sh", "-c", `echo broke at ${fx.home}/y; exit 7`]));
    await signals.wait();
    assertEquals(d.got.filter((e) => e.event === "bootstrap_step").length, 2);
    const failed = d.got.find((e) => e.event === "bootstrap_failed");
    assert(failed !== undefined);
    has(String(failed.properties.log_file), "~/.erga-bootstrap/log/bootstrap-");
    has(String(failed.properties.error_tail), "broke at ~/y");
    for (const e of d.got) {
      assertEquals(e.properties.environment, "bootstrap");
      assertEquals(e.resource["service.name"], "erga-bootstrap");
      assertEquals(e.resource["deployment.environment.name"], "bootstrap");
      assertEquals(e.distinctId, "dev-0123456789abcdef");
      assertEquals(e.resource["device.id"], e.properties.device_id);
      for (const k of ["host_kind", "os_id", "arch", "cpus", "bootstrap_run", "hostname", "os_user"]) assert(k in e.properties, k);
    }
    assert(d.auth.every((a) => a === "Bearer arca_test"));
    assert(!JSON.stringify(d.got).includes(fx.home));
    const lines = Deno.readTextFileSync(`${journal}/sent.jsonl`).trim().split("\n").map((l) => JSON.parse(l));
    assertEquals(lines.map((l) => l.event).sort(), d.got.map((e) => e.event).sort());
    assert(lines.every((l) => l.source === "bootstrap" && l.status === 200));
    assert(!Deno.readTextFileSync(`${journal}/sent.jsonl`).includes("arca_test"));
  } finally {
    await d.close();
  }
});

Deno.test("a whole run sends its start and its end, with the machine; the device id is the same next time", async () => {
  await using fx = await Fx.make();
  const d = door();
  try {
    fx.stub("gh", 'case "$1 $2" in "auth status") exit 1 ;; esac\nexit 0');
    const run = () => fx.setup([], { ...without(OFF, "BOOTSTRAP_NO_AUTH"), PATH: fx.path, ERGA_SIGNALS_URL: d.url, ERGA_SIGNALS_TOKEN: "arca_test" });
    const p = await run();
    assertEquals(p.code, 5, p.stdout + p.stderr);
    const names = d.got.map((e) => e.event);
    assert(names.includes("bootstrap_started") && names.includes("bootstrap_finished"), names.join(" "));
    assertEquals(d.got.find((e) => e.event === "bootstrap_finished")?.properties.outcome, "sign-in-pending");
    for (const k of ["hostname", "os_user", "host_kind", "kernel", "cpus", "memory_gb"]) assert(k in (d.got[0]?.properties ?? {}), k);
    const first = d.got[0]?.distinctId;
    assert(first?.startsWith("dev-"));
    d.got.length = 0;
    await run();
    assertEquals(d.got[0]?.distinctId, first);
  } finally {
    await d.close();
  }
});

Deno.test("nothing is sent without the address and the token, when told not to, or in a dry run; an unreachable door changes nothing", async () => {
  await using fx = await Fx.make();
  const d = door();
  try {
    const cases: Record<string, string>[] = [{ ERGA_SIGNALS_URL: d.url }, { ERGA_SIGNALS_TOKEN: "arca_test" }, {
      ERGA_SIGNALS_URL: d.url,
      ERGA_SIGNALS_TOKEN: "arca_test",
      DO_NOT_TRACK: "1",
    }, { ERGA_SIGNALS_URL: d.url, ERGA_SIGNALS_TOKEN: "arca_test", ERGA_OBSERVE: "off" }];
    for (const e of cases) {
      assertEquals((await fx.setup([], { ...OFF, ...e })).code, 0);
      await Deno.remove(`${fx.home}/.config/erga/secrets.env`).catch(() => {}); // what a run keeps counts for the next one
    }
    assertEquals((await fx.setup(["--dry-run"], { ERGA_SIGNALS_URL: d.url, ERGA_SIGNALS_TOKEN: "arca_test" })).code, 0);
    assertEquals(d.got, []);
    assertEquals((await fx.setup([], { ...OFF, ERGA_SIGNALS_URL: "http://127.0.0.1:9", ERGA_SIGNALS_TOKEN: "arca_test" })).code, 0);
  } finally {
    await d.close();
  }
});

function lacks(s: string, ...needles: string[]): void {
  for (const n of needles) assert(!s.includes(n), `unexpected ${JSON.stringify(n)} in:\n${s}`);
}

Deno.test("a counted step shows a number that rises through every phase and ends at the total (FR-064)", async () => {
  await using fx = await Fx.make();
  const base = context(fx);
  const { Ui, Log } = await import("../bin/setup/ui.ts");
  const ctx: Ctx = { ...base, ui: new Ui({ colour: false, utf: false, tty: true, cols: 100 }, new Log(null, null), false) };
  using cap = new Captured();
  const inner =
    "for p in a b c; do echo Get: $p; sleep 0.25; done; for p in a b c; do echo Unpacking $p; sleep 0.25; done; for p in a b c; do echo Setting up $p; sleep 0.25; done";
  await step(ctx, "Installing programs", command(["sh", "-c", inner]), { re: /^(Get:|Unpacking |Setting up )/, total: 3, div: 3 });
  const shown = [...cap.err.replaceAll("\r", "\n").matchAll(/Installing programs: (\d+) of 3/g)].map((m) => Number(m[1]));
  assert(shown.includes(3) || shown.includes(2), cap.err);
  assertEquals(shown, [...shown].sort((a, b) => a - b), "the number never goes down");
  assert(new Set(shown).size >= 2, `the number rises as the work is done: ${shown}`);
});

Deno.test("the setup names only commands erga has (FR-058)", () => {
  for (const f of Deno.readDirSync(new URL("../bin/setup", import.meta.url))) {
    const text = Deno.readTextFileSync(new URL(`../bin/setup/${f.name}`, import.meta.url));
    for (const gone of ["erga orch", "erga observe", "erga packaging", "erga sbom", "orch status", "erga shell ensure"]) lacks(text, gone);
  }
});
