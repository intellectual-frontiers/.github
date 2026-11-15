// Steps, the pool, the stop and the telemetry (009-machine-bootstrap FR-030, FR-054, FR-061 to FR-067).
import { assert, assertEquals, assertGreaterOrEqual, assertLess, assertStringIncludes } from "@std/assert";
import { Captured, context, exists, Fx, OFF, serve, without } from "./helpers.ts";
import { command, pool, step, stepSoft, task } from "../bin/setup/steps.ts";
import { type Props, resourceOf, startSignals } from "../bin/setup/signals.ts";
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
  assert(r.kind === "err" && r.error.kind === "step-failed");
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
  assert((await step(ctx, "one", command(["false"]))).kind === "ok");
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
  assert(r.kind === "ok");
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
  assert(r.kind === "err");
  has(cap.out, "bad one", "nope");
  const text = Deno.readTextFileSync(log);
  has(text, "(exit 9)");
  assertEquals(text.split("==== STEP").length - 1, 3);
});

// ---- telemetry (FR-054): OpenTelemetry signals, each step a span, the run the root span, the failure's log a log record

type Signal = { kind: "span" | "log"; name: string; resource: Record<string, unknown>; attributes: Record<string, unknown>; status?: number };
const plainValue = (v: Record<string, unknown>) => "stringValue" in v ? v.stringValue : "intValue" in v ? Number(v.intValue) : "boolValue" in v ? v.boolValue : v.doubleValue;
type Attr = { key: string; value: Record<string, unknown> };
const attrs = (a: Attr[] | undefined) => Object.fromEntries((a ?? []).map((x) => [x.key, plainValue(x.value)]));

/** A stand-in for arca's door: OTLP/HTTP JSON at /v1/traces and /v1/logs, what it was sent kept as spans and log records. */
function door(): { url: string; got: Signal[]; auth: string[]; paths: string[]; close: () => Promise<void> } {
  const got: Signal[] = [];
  const auth: string[] = [];
  const paths: string[] = [];
  const s = serve(async (req) => {
    const path = new URL(req.url).pathname;
    paths.push(path);
    auth.push(req.headers.get("authorization") ?? "");
    const body = await req.json();
    for (const rs of body.resourceSpans ?? []) {
      const resource = attrs(rs.resource?.attributes);
      for (const ss of rs.scopeSpans) {
        for (const sp of ss.spans) got.push({ kind: "span", name: sp.name, resource, attributes: attrs(sp.attributes), status: sp.status?.code ?? 0 });
      }
    }
    for (const rl of body.resourceLogs ?? []) {
      const resource = attrs(rl.resource?.attributes);
      for (const sl of rl.scopeLogs) for (const r of sl.logRecords) got.push({ kind: "log", name: r.eventName, resource, attributes: attrs(r.attributes) });
    }
    return Response.json({});
  });
  return { url: s.url, got, auth, paths, close: s.close };
}

Deno.test("steps are spans and a failure's log a log record, sent with the environment and a stable device id, and journalled without the token", async () => {
  await using fx = await Fx.make();
  const d = door();
  try {
    const { ctx } = logged(fx);
    const machine: Props = { hostname: "h", os_user: "u", host_kind: "machine", os_id: "debian", arch: "x86_64", cpus: 2 };
    const journal = `${fx.home}/.local/state/erga/telemetry`;
    const signals = startSignals({
      settings: { kind: "on", url: d.url, token: "arca_test" },
      resource: resourceOf("dev-0123456789abcdef", "20260101-000000-1", machine),
      journalDir: journal,
      ui: ctx.ui,
    });
    const c: Ctx = { ...ctx, signals };
    using _ = new Captured();
    await step(c, "Installing one", command(["true"]));
    await step(c, "Installing two", command(["sh", "-c", `echo broke at ${fx.home}/y; exit 7`]));
    await signals.close();
    const steps = d.got.filter((e) => e.kind === "span" && e.name === "bootstrap.step");
    assertEquals(steps.map((e) => [e.attributes.step, e.attributes.outcome, e.attributes.exit_code, e.attributes.step_no]), [["Installing one", "ok", 0, 1], [
      "Installing two",
      "failed",
      7,
      2,
    ]]);
    assertEquals(steps.map((e) => e.status), [1, 2], "the span's status is its outcome: ok, then error");
    const failed = d.got.find((e) => e.kind === "log" && e.name === "bootstrap.failed");
    assert(failed !== undefined);
    has(String(failed.attributes.log_file), "~/.erga-bootstrap/log/bootstrap-");
    has(String(failed.attributes.error_tail), "broke at ~/y");
    for (const e of d.got) {
      assertEquals(e.resource["environment"], "bootstrap");
      assertEquals(e.resource["service.name"], "erga-bootstrap");
      assertEquals(e.resource["deployment.environment.name"], "bootstrap");
      assertEquals(e.resource["device.id"], "dev-0123456789abcdef");
      for (const k of ["host_kind", "os_id", "arch", "cpus", "bootstrap_run", "hostname", "os_user"]) assert(k in e.resource, k);
    }
    assertEquals([...new Set(d.paths)].sort(), ["/v1/logs", "/v1/traces"]);
    assert(d.auth.every((a) => a === "Bearer arca_test"));
    assert(!JSON.stringify(d.got).includes(fx.home));
    const kept = Deno.readTextFileSync(`${journal}/bootstrap.otlp.jsonl`);
    const lines = kept.trim().split("\n").map((l) => JSON.parse(l));
    assert(lines.some((l) => "resourceSpans" in l) && lines.some((l) => "resourceLogs" in l), kept);
    assert(!kept.includes("arca_test"));
  } finally {
    await d.close();
  }
});

Deno.test("a whole run is the root span of its steps, with how it ended and the machine; the device id is the same next time", async () => {
  await using fx = await Fx.make();
  const d = door();
  try {
    fx.stub("gh", 'case "$1 $2" in "auth status") exit 1 ;; esac\nexit 0');
    const run = () => fx.setup([], { ...without(OFF, "BOOTSTRAP_NO_AUTH"), PATH: fx.path, ERGA_SIGNALS_URL: d.url, ERGA_SIGNALS_TOKEN: "arca_test" });
    const p = await run();
    assertEquals(p.code, 5, p.stdout + p.stderr);
    const root = d.got.find((e) => e.kind === "span" && e.name === "bootstrap.run");
    assert(root !== undefined, JSON.stringify(d.got.map((e) => e.name)));
    assertEquals([root.attributes.method, root.attributes.outcome, root.attributes.exit_code], ["setup", "sign-in-pending", 5]);
    for (const k of ["hostname", "os_user", "host_kind", "kernel", "cpus", "memory_gb", "disk_free_gb"]) assert(k in root.resource, k);
    const first = root.resource["device.id"];
    assert(typeof first === "string" && first.startsWith("dev-"));
    d.got.length = 0;
    await run();
    assertEquals(d.got.find((e) => e.name === "bootstrap.run")?.resource["device.id"], first);
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
    assertEquals(d.paths, []);
    assert(!exists(`${fx.home}/.local/state/erga/telemetry`), "no journal where nothing is sent");
    assertEquals((await fx.setup([], { ...OFF, ERGA_SIGNALS_URL: "http://127.0.0.1:9", ERGA_SIGNALS_TOKEN: "arca_test" })).code, 0);
  } finally {
    await d.close();
  }
});

function lacks(s: string, ...needles: string[]): void {
  for (const n of needles) assert(!s.includes(n), `unexpected ${JSON.stringify(n)} in:\n${s}`);
}

Deno.test("a counted step shows, at a terminal, a number that rises through every phase and ends at the total (FR-064)", async () => {
  await using fx = await Fx.make();
  const ctx = context(fx, {}, [], { look: { colour: false, emoji: false, tty: true, columns: 100 } });
  using cap = new Captured();
  const inner =
    "for p in a b c; do echo Get: $p; sleep 0.25; done; for p in a b c; do echo Unpacking $p; sleep 0.25; done; for p in a b c; do echo Setting up $p; sleep 0.25; done";
  await step(ctx, "Installing programs", command(["sh", "-c", inner]), { re: /^(Get:|Unpacking |Setting up )/, total: 3, div: 3 });
  await ctx.ui.close();
  // the console's live line: the label, the seconds, and how many of how many (commons' renderer writes it as done/total and the percentage)
  const shown = [...cap.err.matchAll(/Installing programs\S* \S+ (\d+)\/3 /g)].map((m) => Number(m[1]));
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
