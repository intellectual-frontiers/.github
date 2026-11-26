// Spec: 0004-repoctl-status-release FR-004
/**
 * `repoctl release plan|apply|publish` on Headless (commons repoctl 0004-repoctl-status-release FR-004 to FR-010): the release of the libraries, wrapped from `releasing.ts` of the libraries and not made again here. `plan` says what a release would
 * do and why, library by library; `apply` raises the versions the plan says (the record, the manifest, the package and the constants the manifest names), makes every generated file and runs the tests that pack, and writes the record;
 * `publish` sends the packed libraries of the record to npm, and is a destruction: it needs the releaser tier, a preview, `--yes` and the typed confirmation that the preview printed.
 *
 * @example
 * ```ts
 * import { releasePlanVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof releasePlanVerb; // "function"
 * ```
 *
 * @module
 */
import { type ConsumerReport, CONSUMER_FILE, checksOf, findingsOfHandoff, findingsOfPublish, finding, findingsOfSync, folderOf, gate, handoffOf, orderGenerators, type Pin, type PinState, pinsOf, planPublish, reportData, reportText, repinned, type Released, runPublish, runSync, STAGED_NOTE, type TrainReport, underFolder, type Verified, type Finding, type PublishPlan, type Published, type ReleaseEntry, type World } from "@intellectual-frontiers/repoctl/logical";
import { activeMode, applyRelease, describe, offlinePublishedExports, offlineRegistry, type DistributionMode, type Plan, raiseOf, readRecord, MODE_VARIABLE, publishedOf, REAL, registryOf, RECORD_PATH, releasePlan } from "@intellectual-frontiers/libraries/releasing";
import { CHECK_CLASS, checkOf } from "@intellectual-frontiers/libraries/ci/policy";
import { holdSentence } from "@intellectual-frontiers/libraries/libraries";
import type { Outcome } from "@intellectual-frontiers/headless/logical";
import { join, resolve } from "@intellectual-frontiers/system/path";
import { flag, many, value } from "@intellectual-frontiers/terminal/args";
import { type Done, defineVerb, generatorsOf, type Host, outcomeOfDone, outcomeOfEnvironment, outcomeOfUsage } from "../define.ts";

/** The lines of a plan for a person: one for each library that is released, and the libraries that are left alone. */
export function planText(plan: Plan): string {
  const held = plan.held.map((h) => `${h.name} not released  ${holdSentence(h.hold)}`);
  if (plan.steps.length === 0) return ["nothing to release: every library is tagged at its version and unchanged", ...held].join("\n");
  const lines = plan.steps.map((s) => `${s.slug} ${s.from === s.to ? s.to : `${s.from} -> ${s.to}`}${s.publish ? "" : " (tag only)"}  ${describe(s.decision, s.from)}`);
  return [...lines, ...(plan.unchanged.length > 0 ? [`left alone (${plan.unchanged.length}): ${plan.unchanged.join(", ")}`] : []), ...held].join("\n");
}

/** The data of a plan, for `--json`. */
export function planData(plan: Plan): unknown {
  return {
    steps: plan.steps.map((s) => ({ library: s.slug, from: s.from, to: s.to, tag: s.tag, publish: s.publish, why: describe(s.decision, s.from) })),
    unchanged: plan.unchanged,
    held: plan.held.map((h) => ({ library: h.name, kind: h.hold.kind, why: holdSentence(h.hold) })),
  };
}

const OPTIONS = {
  offline: flag({ help: "Do not ask npm what it holds: a version with no tag is then raised only where its files changed since it was raised." }),
  distribution: value({ help: "The distribution mode for this run: per-library or single (the mode of the repository, or IFC_DISTRIBUTION, where it is not given).", valueName: "MODE" }),
  raise: many<never>({ help: "Raise a library whatever its state says: NAME, or NAME=major|minor|patch.", valueName: "NAME[=IMPACT]" }),
};

/** The mode of a run: the option, else the variable of the host's environment, else the mode of the repository. */
function modeOf(option: string | undefined, host: Host): { readonly mode: DistributionMode } | { readonly problem: string } {
  const m = activeMode(option ?? host.env(MODE_VARIABLE));
  return m.kind === "ok" ? { mode: m.value } : { problem: m.error };
}

async function planOf(w: World, host: Host, offline: boolean, words: readonly string[], distribution: string | undefined): Promise<{ readonly plan: Plan } | { readonly problem: string; readonly usage: boolean }> {
  const raise = raiseOf(words);
  if (raise.kind === "err") return { problem: raise.error, usage: true };
  const chosen = modeOf(distribution, host);
  if ("problem" in chosen) return { problem: chosen.problem, usage: true };
  const planned = await releasePlan(w.repo, { raise: raise.value, registry: offline ? offlineRegistry : registryOf(chosen.mode, w.repo), published: offline ? offlinePublishedExports : publishedOf(chosen.mode), mode: chosen.mode });
  return planned.kind === "err" ? { problem: planned.error, usage: false } : { plan: planned.value };
}

/** `repoctl release plan`. */
export const releasePlanVerb = defineVerb({
  name: "plan",
  id: "release plan",
  options: OPTIONS,
  examples: [
    { args: [], says: "What a release would do, library by library and why; nothing is written." },
    { args: ["--offline"], says: "The same without asking npm." },
    { args: ["--raise", "headless=minor"], says: "Plan the release with headless raised by a minor." },
  ],
  run: async (args, _ctx, w, host) => {
    const got = await planOf(w, host, args.options.offline, args.options.raise ?? [], args.options.distribution);
    if ("problem" in got) return got.usage ? outcomeOfUsage(got.problem, "E-USAGE", "repoctl release plan --help") : outcomeOfDone({ data: null, text: got.problem, findings: [finding("fail", "E-RELEASE-FAILED", got.problem, "repoctl status")] });
    return outcomeOfDone({ data: planData(got.plan), text: planText(got.plan), findings: [], next: got.plan.steps.length > 0 ? ["repoctl release apply"] : [], title: "Planned" });
  },
});

/** What `release apply` and `release train` give for the options of a release. */
type MakeOptions = { readonly tests: boolean; readonly raise: readonly string[]; readonly distribution: string | undefined; readonly offline: boolean };

/** The release made: the plan, the files written, the findings of the generators; or the outcome that says why it could not be made. */
async function makeRelease(o: MakeOptions, w: World, host: Host): Promise<{ readonly outcome: Outcome } | { readonly plan: Plan; readonly written: readonly string[]; readonly findings: readonly Finding[] }> {
  const raise = raiseOf(o.raise);
  if (raise.kind === "err") return { outcome: outcomeOfUsage(raise.error, "E-USAGE", "repoctl release apply --help") };
  const chosen = modeOf(o.distribution, host);
  if ("problem" in chosen) return { outcome: outcomeOfUsage(chosen.problem, "E-USAGE", "repoctl release apply --help") };
  const made = await applyRelease(w.repo, host.releasing ?? REAL, { tests: o.tests, raise: raise.value, registry: o.offline ? offlineRegistry : registryOf(chosen.mode, w.repo), published: o.offline ? offlinePublishedExports : publishedOf(chosen.mode), mode: chosen.mode });
  if (made.kind === "err") return { outcome: outcomeOfDone({ data: null, text: made.error, findings: [finding("fail", "E-RELEASE-FAILED", made.error, "repoctl release plan")] }) };
  const order = orderGenerators(generatorsOf(host));
  if (order.kind === "err") return { outcome: outcomeOfEnvironment(`the table of generators waits for itself: ${order.error.join(", ")}`) };
  const synced = await runSync(w, "write", order.value);
  return { plan: made.value.plan, written: made.value.written, findings: findingsOfSync(synced) };
}

/** `repoctl release apply`. */
export const releaseApplyVerb = defineVerb({
  name: "apply",
  id: "release apply",
  options: { ...OPTIONS, tests: flag({ help: "Run the tests that pack, install and type-check every library (on by default).", negatable: true, default: true }) },
  examples: [
    { args: ["--dry-run"], says: "The plan, with nothing written." },
    { args: [], says: "Raise the versions the plan says, make every generated file, run the tests that pack and write the record." },
    { args: ["--no-tests"], says: "The same without the tests that pack: for trying the command, never for a release." },
  ],
  run: async (args, ctx, w, host) => {
    if (ctx.mode !== "apply") {
      const got = await planOf(w, host, args.options.offline, args.options.raise ?? [], args.options.distribution);
      if ("problem" in got) return outcomeOfDone({ data: null, text: got.problem, findings: [finding("fail", "E-RELEASE-FAILED", got.problem, "repoctl release plan")] });
      return outcomeOfDone({ data: planData(got.plan), text: planText(got.plan), findings: [], title: "Planned" });
    }
    const made = await makeRelease({ tests: args.options.tests, raise: args.options.raise ?? [], distribution: args.options.distribution, offline: args.options.offline }, w, host);
    if ("outcome" in made) return made.outcome;
    const done: Done = {
      data: { plan: planData(made.plan), written: made.written },
      text: `${planText(made.plan)}\n${made.written.length} files written`,
      findings: made.findings,
      next: ["repoctl commit -m \"Release\"", "git push origin HEAD:main"],
      title: "Release made",
    };
    return outcomeOfDone(done);
  },
});

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** Whether the words an installer printed say that a version is not on the registry (yet). */
const NOT_THERE = /\b404\b|not found|no version matching|failed to resolve/i;

/** The package manifests that Git tracks in a consumer, from its root: their paths, or the sentence that says it is not a checkout. */
async function trackedManifests(w: World, dir: string): Promise<{ readonly files: readonly string[] } | { readonly problem: string }> {
  const r = await w.process.run(["git", "ls-files", "--", "package.json", "*/package.json", "**/package.json"], { cwd: dir });
  if (r.code !== 0) return { problem: `${dir} is not a Git checkout` };
  return { files: [...new Set(r.stdout.split("\n").filter((l) => l !== ""))].sort() };
}

type TrainOptions = { readonly offline: boolean; readonly apply: boolean; readonly waitMs: number; readonly pollMs: number; readonly only: readonly string[] };

/** What a failure of a named check does to a release, by the one table of checks (commons libraries `ci/policy`), and undefined for a name that is no check. */
const classOfCheck = (check: string): "blocking" | "finding" | undefined => {
  const c = checkOf(check);
  return c === undefined ? undefined : CHECK_CLASS[c].class;
};

/** One consumer of the train: its pins found and, where the run applies and is not offline, moved, installed twice and checked. */
async function trainConsumer(w: World, shown: string, dir: string, released: readonly Released[], o: TrainOptions): Promise<{ readonly report: ConsumerReport; readonly findings: readonly Finding[] }> {
  const refuse = (message: string): { readonly report: ConsumerReport; readonly findings: readonly Finding[] } => ({ report: { dir: shown, pins: [], declared: false, verify: [], note: "refused" }, findings: [finding("fail", "E-TRAIN-CONSUMER", message, "repoctl release train --help")] });
  const tracked = await trackedManifests(w, dir);
  if ("problem" in tracked) return refuse(tracked.problem);
  const declText = await w.files.read(join(dir, CONSUMER_FILE));
  const declared = declText === undefined ? undefined : checksOf(declText, classOfCheck);
  if (declared?.kind === "err") return refuse(`${shown}: ${declared.error}`);
  const found: Pin[] = [];
  const texts = new Map<string, string>();
  for (const file of tracked.files) {
    if (o.only.length > 0 && !o.only.some((scope) => underFolder(folderOf(file), scope.replace(/^\.\//, "")))) continue;
    const text = await w.files.read(join(dir, file));
    if (text === undefined) continue;
    const pins = pinsOf(file, text, released);
    if (pins.kind === "err") return refuse(`${shown}: ${pins.error}`);
    if (pins.value.length > 0) {
      found.push(...pins.value);
      texts.set(file, text);
    }
  }
  const base = { dir: shown, declared: declared !== undefined, verify: [] as readonly Verified[] };
  if (found.length === 0) return { report: { ...base, pins: [], note: undefined }, findings: [] };
  if (!o.apply || o.offline) return { report: { ...base, pins: found.map((p) => ({ ...p, state: "planned" as PinState })), note: o.offline ? "offline: nothing was installed" : "dry run" }, findings: [] };
  const states = new Map<string, PinState>();
  const findings: Finding[] = [];
  const lockFiles = (folder: string): readonly string[] => [...new Set([join(dir, folder, "bun.lock"), join(dir, "bun.lock")])];
  for (const file of texts.keys()) {
    const folder = folderOf(file);
    const mine = found.filter((p) => p.file === file);
    const lockBefore = new Map<string, string | undefined>();
    for (const l of lockFiles(folder)) lockBefore.set(l, await w.files.read(l));
    const original = texts.get(file) ?? "";
    const put = async (text: string): Promise<void> => w.files.write(join(dir, file), text);
    const putBack = async (): Promise<void> => {
      await put(original);
      for (const [l, text] of lockBefore) if (text !== undefined) await w.files.write(l, text);
    };
    const cwd = join(dir, folder);
    const deadline = Date.now() + o.waitMs;
    await put(repinned(original, mine));
    let state: PinState = "moved";
    for (;;) {
      const install = await w.process.run(["bun", "install"], { cwd });
      if (install.code === 0) {
        const frozen = await w.process.run(["bun", "install", "--frozen-lockfile"], { cwd });
        if (frozen.code === 0) break;
        await putBack();
        state = "failed";
        findings.push(finding("fail", "E-TRAIN-INSTALL", `${shown}/${file}: the lockfile is not up to date after the install (${frozen.stderr.trim().split("\n").slice(-1)[0] ?? ""})`, "repoctl release train --help"));
        break;
      }
      await putBack();
      const said = `${install.stderr}\n${install.stdout}`;
      if (NOT_THERE.test(said)) {
        if (Date.now() < deadline) {
          await sleep(o.pollMs);
          await put(repinned(original, mine));
          continue;
        }
        state = "waiting";
        findings.push(finding("warn", "E-TRAIN-WAITING", `${shown}/${file}: ${mine.map((p) => `${p.package} ${p.to}`).join(", ")} is not on the registry yet; the consumer was left as it was`, `repoctl release train --consumer ${shown} --wait 300`));
      } else {
        state = "failed";
        findings.push(finding("fail", "E-TRAIN-INSTALL", `${shown}/${file}: the install failed: ${said.trim().split("\n").slice(-1)[0] ?? ""}`, "repoctl release train --help"));
      }
      break;
    }
    for (const p of mine) states.set(`${p.file}\n${p.package}`, state);
  }
  const pins = found.map((p) => ({ ...p, state: states.get(`${p.file}\n${p.package}`) ?? ("failed" as PinState) }));
  const verify: Verified[] = [];
  if (declared !== undefined && pins.every((p) => p.state === "moved")) {
    for (const c of declared.value) {
      const r = await w.process.run(c.argv, { cwd: dir });
      verify.push({ check: c.check, class: c.class, argv: c.argv, code: r.code });
      if (r.code === 0) continue;
      const where = `cd ${shown} && ${c.argv.join(" ")}`;
      findings.push(
        c.class === "blocking"
          ? finding("fail", "E-TRAIN-VERIFY", `${shown}: the check ${c.check} blocks a release and ended with ${r.code}: ${c.argv.join(" ")}`, where)
          : finding("warn", c.check === "tests" ? "E-TRAIN-TESTS-FAILING" : "E-TRAIN-FINDING", `${shown}: the check ${c.check} is a finding and does not block the release; it ended with ${r.code}${c.check === "tests" ? ": FAILING TESTS, which also hold acceptance" : ""}: ${c.argv.join(" ")}`, where),
      );
    }
  }
  return { report: { ...base, pins, verify, note: undefined }, findings };
}

/** `repoctl release train`. */
export const releaseTrainVerb = defineVerb({
  name: "train",
  id: "release train",
  options: {
    ...OPTIONS,
    tests: flag({ help: "Run the tests that pack, install and type-check every library (on by default).", negatable: true, default: true }),
    consumer: many<never>({ help: "A repository whose pins of this release move once it is published (repeatable).", valueName: "DIR" }),
    only: many<never>({ help: "Move only the pins of the manifests in this folder of a consumer or under it (repeatable).", valueName: "PATH" }),
    wait: value<never>({ help: "Try an install again for this many seconds while the version is not on the registry yet.", valueName: "SECONDS" }),
  },
  examples: [
    { args: ["--dry-run", "--consumer", "../product"], says: "What each phase would do, writing nothing." },
    { args: ["--consumer", "../product"], says: "Make the release, say whether it may be published, and move the pins of the consumer once it is." },
    { args: ["--consumer", "../product", "--only", "services/api", "--wait", "300"], says: "After the publication: move one service's pin, trying again for five minutes while the registry catches up." },
  ],
  run: async (args, ctx, w, host) => {
    const apply = ctx.mode === "apply";
    const wait = args.options.wait === undefined ? 0 : Number(args.options.wait);
    if (!Number.isFinite(wait) || wait < 0) return outcomeOfUsage(`--wait is a number of seconds, not ${args.options.wait}`, "E-USAGE", "repoctl release train --help");
    const findings: Finding[] = [];
    const read = async (): Promise<readonly Released[] | undefined> => {
      const file = await w.files.read(`${w.repo}/${RECORD_PATH}`);
      const entries = file === undefined ? undefined : readRecord(file);
      return entries?.kind === "ok" ? [...new Map(entries.value.map((e) => [e.package, { package: e.package, version: e.version }])).values()] : undefined;
    };
    const before = await read();
    const recordFile = await w.files.read(`${w.repo}/${RECORD_PATH}`);
    const recorded = recordFile === undefined ? undefined : readRecord(recordFile);
    const tagged = await tagNames(w);
    const untagged = recorded?.kind === "ok" ? recorded.value.filter((e) => !tagged.has(e.tag)) : [];
    let state: TrainReport["release"]["state"];
    let packages: readonly Released[] = before ?? [];
    if (untagged.length > 0) {
      state = "waiting";
      packages = untagged.map((e) => ({ package: e.package, version: e.version }));
    } else {
      const got = await planOf(w, host, args.options.offline, args.options.raise ?? [], args.options.distribution);
      if ("problem" in got) return got.usage ? outcomeOfUsage(got.problem, "E-USAGE", "repoctl release train --help") : outcomeOfDone({ data: null, text: got.problem, findings: [finding("fail", "E-RELEASE-FAILED", got.problem, "repoctl release plan")] });
      if (got.plan.steps.length === 0) state = "nothing";
      else if (!apply) {
        state = "planned";
        packages = got.plan.steps.filter((s) => s.publish).map((s) => ({ package: s.package, version: s.to }));
      } else {
        const made = await makeRelease({ tests: args.options.tests, raise: args.options.raise ?? [], distribution: args.options.distribution, offline: args.options.offline }, w, host);
        if ("outcome" in made) return made.outcome;
        findings.push(...made.findings);
        state = "applied";
        packages = (await read()) ?? [];
      }
    }
    const handoff: TrainReport["handoff"] =
      state === "applied" || state === "waiting" ? await handoffOf(w, RECORD_PATH) : { kind: "not-reached", why: state === "planned" ? "this is a dry run" : "no release is waiting" };
    findings.push(...(handoff.kind === "not-reached" ? [] : findingsOfHandoff(handoff, RECORD_PATH)));
    const consumers: ConsumerReport[] = [];
    // pins move to the versions of the record, whether they are waiting or were published before
    const targets = state === "planned" ? packages : ((await read()) ?? packages);
    for (const dir of args.options.consumer ?? []) {
      const got = await trainConsumer(w, dir, resolve(w.repo, dir), targets, { offline: args.options.offline, apply, waitMs: wait * 1000, pollMs: host.train?.pollMs ?? 10000, only: args.options.only ?? [] });
      consumers.push(got.report);
      findings.push(...got.findings);
    }
    const report: TrainReport = { release: { state, packages }, handoff, consumers };
    const next: string[] = [];
    if (handoff.kind === "ready") next.push("a person publishes the release: the workflow `release` with publish, or repoctl release publish", `then: repoctl release train${(args.options.consumer ?? []).map((c) => ` --consumer ${c}`).join("")} --wait 300`);
    if (handoff.kind === "not-committed") next.push('repoctl commit -m "Release"');
    if (handoff.kind === "not-pushed") next.push("git push origin HEAD:main");
    return outcomeOfDone({ data: reportData(report), text: reportText(report), findings, next, title: findings.some((f) => f.level === "fail") ? "Stopped" : "Walked" });
  },
});

/** The names of the tags of the repository: the remote's where it can be asked, else the local ones. */
async function tagNames(w: World): Promise<ReadonlySet<string>> {
  const here = { cwd: w.repo };
  const remote = await w.process.run(["git", "ls-remote", "--tags", "origin"], here);
  const text = remote.code === 0 ? remote.stdout : (await w.process.run(["git", "tag", "--list"], here)).stdout;
  return new Set(
    text
      .split("\n")
      .map((l) => (l.includes("\t") ? (l.split("\t")[1] ?? "") : l.trim()).replace(/^refs\/tags\//, "").replace(/\^\{\}$/, ""))
      .filter((n) => n !== ""),
  );
}

/** The lines of a publication plan for a person. */
export function publishPlanText(plan: PublishPlan): string {
  const lines = plan.items.map((i) => {
    switch (i.kind) {
      case "ready":
        return `would publish  ${i.entry.slug} ${i.entry.version}  (${i.tarball})`;
      case "present":
        return `on npm already ${i.entry.slug} ${i.entry.version}`;
      case "no-tarball":
        return `cannot         ${i.entry.slug} ${i.entry.version}  (no tarball at ${i.tarball})`;
      case "unknown":
        return `cannot         ${i.entry.slug} ${i.entry.version}  (npm could not be asked: ${i.why})`;
      default:
        return "";
    }
  });
  return [...(lines.length === 0 ? ["nothing to publish: every release of the record is tagged"] : lines), `confirmation: ${plan.phrase}`].join("\n");
}

const publishLine = (p: Published): string => {
  switch (p.kind) {
    case "published":
      return `published      ${p.entry.slug} ${p.entry.version}`;
    case "present":
      return `on npm already ${p.entry.slug} ${p.entry.version}`;
    case "failed":
      return `failed         ${p.entry.slug} ${p.entry.version}`;
    case "not-run":
      return `not tried      ${p.entry.slug} ${p.entry.version}  (${p.why})`;
    default:
      return "";
  }
};

/** The findings of a plan that a publication could not carry out. */
function planFindings(plan: PublishPlan): readonly Finding[] {
  return plan.items.flatMap((i): readonly Finding[] => {
    if (i.kind === "no-tarball") return [finding("fail", "E-NO-TARBALL", `${i.entry.slug} ${i.entry.version}: its tarball ${i.tarball} is not there`, "repoctl release apply")];
    if (i.kind === "unknown") return [finding("warn", "E-NPM-UNREACHABLE", `${i.entry.slug}: npm could not be asked (${i.why})`, "repoctl status")];
    return [];
  });
}

/** `repoctl release publish`. */
export const releasePublishVerb = defineVerb({
  name: "publish",
  id: "release publish",
  options: { confirm: value<never>({ help: "The confirmation the preview printed (`publish <n> <digest>`), typed by the person who publishes.", valueName: "PHRASE" }) },
  examples: [
    { args: ["--dry-run"], says: "The releases that would be sent, and the confirmation to type." },
    { args: ["--yes", "--confirm", "'publish 3 1a2b3c4d'"], says: "Send them to npm, with the confirmation the preview printed (the releaser tier, INFRO_NPMJS_TOKEN in the environment)." },
  ],
  run: async (args, ctx, w) => {
    const file = await w.files.read(`${w.repo}/${RECORD_PATH}`);
    if (file === undefined) return outcomeOfDone({ data: null, text: `${RECORD_PATH} is missing`, findings: [finding("fail", "E-RELEASE-RECORD", `${RECORD_PATH} is missing`, "repoctl release apply")] });
    const entries = readRecord(file);
    if (entries.kind === "err") return outcomeOfDone({ data: null, text: entries.error, findings: [finding("fail", "E-RELEASE-RECORD", entries.error, "repoctl release apply")] });
    const list: readonly ReleaseEntry[] = entries.value;
    const plan = await planPublish(w, list, await tagNames(w));
    const data = { phrase: plan.phrase, items: plan.items.map((i) => ({ library: i.entry.slug, version: i.entry.version, state: i.kind })) };
    if (ctx.mode !== "apply") return outcomeOfDone({ data, text: publishPlanText(plan), findings: planFindings(plan), next: [`repoctl release publish --yes --confirm "${plan.phrase}"`], title: "Previewed" });
    const token = w.credentials.npmToken();
    const refused = gate({ token, typed: args.options.confirm, phrase: plan.phrase });
    if (refused.length > 0 || token === undefined) return outcomeOfDone({ data, text: publishPlanText(plan), findings: refused });
    const done = await runPublish(w, plan, token);
    const sent = done.some((p) => p.kind === "published");
    return outcomeOfDone({
      data: { ...data, results: done.map((p) => ({ library: p.entry.slug, version: p.entry.version, result: p.kind })), staged: sent },
      text: [...done.map(publishLine), ...(sent ? [STAGED_NOTE] : [])].join("\n"),
      findings: findingsOfPublish(done),
      next: ["repoctl status"],
      title: "Published",
    });
  },
});
