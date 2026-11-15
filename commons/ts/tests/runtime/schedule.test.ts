/**
 * Tests of `runtime/schedule.ts`: each scheduler's job installed into a temporary home folder and removed again, with a fake runner in
 * place of systemctl, launchctl and schtasks, so no real scheduled job is ever made; the files written, their modes and the commands run
 * are checked, and so are a required command that fails, one that may fail, and a plan that is refused.
 *
 * @module
 */
import { type JobSpec, jobName, planJob, schedule, type SchedulerOs, type Target, type When } from "../../kernel/schedule.ts";
import { exists, readTextFile, stat, withTempDir } from "../../runtime/fs.ts";
import { join } from "../../runtime/path.ts";
import { build } from "../../runtime/proc.ts";
import { formatJobError, installJob, type JobOptions, type Outcome, removeJob, type StepRunner } from "../../runtime/schedule.ts";
import { assert, assertEquals, fail, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-046";
const posix = build.os !== "windows";

const when = (w: When) => {
  const r = schedule(w);
  return r.kind === "ok" ? r.value : fail(r.error.message);
};
const NAME = ((r) => (r.kind === "ok" ? r.value : fail(r.error.message)))(jobName("nightly"));

function jobFor(os: SchedulerOs): JobSpec {
  const posixJob = { argv: ["/usr/bin/nightly", "--all", "two words"], workdir: "/srv" };
  const windowsJob = { argv: ["C:\\Tools\\nightly.exe", "--all", "two words"], workdir: "C:\\srv" };
  return {
    name: NAME,
    owner: { domain: "org.example", folder: "Example" },
    ...(os === "windows" ? windowsJob : posixJob),
    env: { MODE: "full" },
    when: when({ kind: "weekly", day: "sun", hour: 3, minute: 30 }),
  };
}

/** A runner that records each command and answers with the status `codeOf` gives it (0 by default). */
function fakeRunner(codeOf: (argv: readonly string[]) => number = () => 0): { readonly runner: StepRunner; readonly ran: string[][] } {
  const ran: string[][] = [];
  return {
    ran,
    runner: (argv) => {
      ran.push([...argv]);
      const code = codeOf(argv);
      return Promise.resolve({ code, output: code === 0 ? "" : "it failed" });
    },
  };
}

const OSES: readonly SchedulerOs[] = ["linux", "darwin", "windows"];
const ran = (outcomes: readonly Outcome[]): string[][] => outcomes.flatMap((o) => (o.kind === "ran" ? [[...o.argv]] : []));

for (const os of OSES) {
  proves(
    [FR],
    `${os}: install writes the planned files under the home folder and runs the install commands, and remove undoes it`,
    async () => {
      await withTempDir(async (home) => {
        const job = jobFor(os);
        const target: Target = { os, home, uid: 501 };
        const planned = planJob(job, target);
        if (planned.kind === "err") return fail(planned.error.message);
        const plan = planned.value;
        const paths = plan.files.map((f) => join(home, ...f.path.split("/")));
        const fake = fakeRunner();
        const options: JobOptions = { os, home, uid: 501, runner: fake.runner };

        const installed = await installJob(job, options);
        if (installed.kind === "err") return fail(formatJobError(installed.error));
        assertEquals(installed.value.plan, plan);
        assertEquals(
          fake.ran,
          plan.install.map((s) => [...s.argv]),
        );
        assertEquals(installed.value.outcomes, [
          ...paths.map((path): Outcome => ({ kind: "wrote", path })),
          ...plan.install.map((s): Outcome => ({ kind: "ran", argv: s.argv, code: 0, output: "", mayFail: s.mayFail })),
        ]);
        for (const [i, f] of plan.files.entries()) {
          const path = paths[i] ?? fail("no path");
          assertEquals(await readTextFile(path), f.content);
          if (posix && f.mode !== undefined) assertEquals(((await stat(path)).mode ?? 0) & 0o777, f.mode, path);
        }
        const expected: Readonly<Record<SchedulerOs, readonly string[]>> = {
          linux: [".config/systemd/user/org.example.nightly.service", ".config/systemd/user/org.example.nightly.timer"],
          darwin: ["Library/LaunchAgents/org.example.nightly.plist"],
          windows: ["AppData/Local/Example/nightly.cmd"],
        };
        assertEquals(
          plan.files.map((f) => f.path),
          [...expected[os]],
        );

        fake.ran.length = 0;
        const removed = await removeJob(job, options);
        if (removed.kind === "err") return fail(formatJobError(removed.error));
        assertEquals(
          fake.ran,
          [...plan.remove, ...plan.afterRemove].map((s) => [...s.argv]),
        );
        for (const path of paths) assert(!(await exists(path)), `${path} is removed`);
        assertEquals(
          removed.value.outcomes.filter((o) => o.kind === "removed"),
          paths.map((path): Outcome => ({ kind: "removed", path, existed: true })),
        );

        const again = await removeJob(job, options);
        if (again.kind === "err") return fail(formatJobError(again.error));
        assertEquals(
          again.value.outcomes.filter((o) => o.kind === "removed"),
          paths.map((path): Outcome => ({ kind: "removed", path, existed: false })),
        );
      });
    },
  );
}

proves([FR], "a required command that fails stops the install with its status and output; one that may fail does not", async () => {
  await withTempDir(async (home) => {
    const job = jobFor("darwin");
    const bootoutFails = fakeRunner((argv) => (argv[1] === "bootout" ? 3 : 0));
    const ok = await installJob(job, { os: "darwin", home, uid: 501, runner: bootoutFails.runner });
    if (ok.kind === "err") return fail(formatJobError(ok.error));
    assertEquals(
      ran(ok.value.outcomes).map((a) => a[1]),
      ["bootout", "bootstrap"],
    );
    const first = ok.value.outcomes.find((o) => o.kind === "ran");
    assertEquals(first?.kind === "ran" ? [first.code, first.mayFail] : [], [3, true]);

    const bootstrapFails = fakeRunner((argv) => (argv[1] === "bootstrap" ? 5 : 0));
    const r = await installJob(job, { os: "darwin", home, uid: 501, runner: bootstrapFails.runner });
    if (r.kind === "ok") return fail("expected the install to stop");
    if (r.error.kind !== "step") return fail(`expected a step error, not ${r.error.kind}`);
    assertEquals([r.error.argv[1], r.error.code, r.error.output], ["bootstrap", 5, "it failed"]);
    assertEquals(
      r.error.outcomes.map((o) => o.kind),
      ["wrote", "ran", "ran"],
    );
    assert(formatJobError(r.error).startsWith("launchctl bootstrap gui/501 "));
    assert(formatJobError(r.error).endsWith(" failed (5): it failed"));
  });
});

proves([FR], "a job that cannot be planned is refused before anything is written or run", async () => {
  await withTempDir(async (home) => {
    const fake = fakeRunner();
    const bad = { ...jobFor("linux"), argv: ["/usr/bin/nightly", `a${String.fromCharCode(10)}b`] };
    const r = await installJob(bad, { os: "linux", home, runner: fake.runner });
    if (r.kind === "ok") return fail("expected a refusal");
    if (r.error.kind !== "plan") return fail(`expected a plan error, not ${r.error.kind}`);
    assertEquals([r.error.error.field, r.error.outcomes], ["argv[1]", []]);
    assertEquals(formatJobError(r.error), `argv[1]: ${r.error.error.message}`);
    assertEquals(fake.ran, []);
    assert(!(await exists(join(home, ".config"))));
  });
});

proves([FR], "the scheduler and home folder default to this computer's", async () => {
  if (build.os !== "linux" && build.os !== "darwin" && build.os !== "windows") return;
  await withTempDir(async (home) => {
    const fake = fakeRunner();
    const job = jobFor(build.os === "windows" ? "windows" : "linux");
    const r = await installJob(job, { home, runner: fake.runner });
    if (r.kind === "err") return fail(formatJobError(r.error));
    assertEquals(r.value.plan.os, build.os);
    for (const o of r.value.outcomes) if (o.kind === "wrote") assert(await exists(o.path), o.path);
    const back = await removeJob(job, { home, runner: fake.runner });
    assertEquals(back.kind, "ok");
  });
});
