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
import { findingsOfPublish, finding, findingsOfSync, gate, orderGenerators, planPublish, runPublish, runSync, STAGED_NOTE, type Finding, type PublishPlan, type Published, type ReleaseEntry, type World } from "@intellectual-frontiers/repoctl/logical";
import { applyRelease, describe, factsOf, offlineRegistry, planRelease, type Plan, raiseOf, readRecord, REAL, realRegistry, RECORD_PATH } from "@intellectual-frontiers/libraries/releasing";
import { flag, many, value } from "@intellectual-frontiers/terminal/args";
import { type Done, defineVerb, generatorsOf, outcomeOfDone, outcomeOfEnvironment, outcomeOfUsage } from "../define.ts";

/** The lines of a plan for a person: one for each library that is released, and the libraries that are left alone. */
export function planText(plan: Plan): string {
  if (plan.steps.length === 0) return "nothing to release: every library is tagged at its version and unchanged";
  const lines = plan.steps.map((s) => `${s.slug} ${s.from === s.to ? s.to : `${s.from} -> ${s.to}`}${s.publish ? "" : " (tag only)"}  ${describe(s.decision, s.from)}`);
  return [...lines, ...(plan.unchanged.length > 0 ? [`left alone (${plan.unchanged.length}): ${plan.unchanged.join(", ")}`] : [])].join("\n");
}

/** The data of a plan, for `--json`. */
export function planData(plan: Plan): unknown {
  return {
    steps: plan.steps.map((s) => ({ library: s.slug, from: s.from, to: s.to, tag: s.tag, publish: s.publish, why: describe(s.decision, s.from) })),
    unchanged: plan.unchanged,
  };
}

const OPTIONS = {
  offline: flag({ help: "Do not ask npm what it holds: a version with no tag is then raised only where its files changed since it was raised." }),
  raise: many<never>({ help: "Raise a library whatever its state says: NAME, or NAME=major|minor|patch.", valueName: "NAME[=IMPACT]" }),
};

async function planOf(w: World, offline: boolean, words: readonly string[]): Promise<{ readonly plan: Plan } | { readonly problem: string; readonly usage: boolean }> {
  const raise = raiseOf(words);
  if (raise.kind === "err") return { problem: raise.error, usage: true };
  const facts = await factsOf(w.repo, offline ? offlineRegistry : realRegistry(w.repo));
  if (facts.kind === "err") return { problem: facts.error, usage: false };
  const planned = planRelease(facts.value, raise.value);
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
  run: async (args, _ctx, w) => {
    const got = await planOf(w, args.options.offline, args.options.raise ?? []);
    if ("problem" in got) return got.usage ? outcomeOfUsage(got.problem, "E-USAGE", "repoctl release plan --help") : outcomeOfDone({ data: null, text: got.problem, findings: [finding("fail", "E-RELEASE-FAILED", got.problem, "repoctl status")] });
    return outcomeOfDone({ data: planData(got.plan), text: planText(got.plan), findings: [], next: got.plan.steps.length > 0 ? ["repoctl release apply"] : [], title: "Planned" });
  },
});

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
      const got = await planOf(w, args.options.offline, args.options.raise ?? []);
      if ("problem" in got) return outcomeOfDone({ data: null, text: got.problem, findings: [finding("fail", "E-RELEASE-FAILED", got.problem, "repoctl release plan")] });
      return outcomeOfDone({ data: planData(got.plan), text: planText(got.plan), findings: [], title: "Planned" });
    }
    const raise = raiseOf(args.options.raise ?? []);
    if (raise.kind === "err") return outcomeOfUsage(raise.error, "E-USAGE", "repoctl release apply --help");
    const made = await applyRelease(w.repo, host.releasing ?? REAL, { tests: args.options.tests, raise: raise.value, registry: args.options.offline ? offlineRegistry : realRegistry(w.repo) });
    if (made.kind === "err") return outcomeOfDone({ data: null, text: made.error, findings: [finding("fail", "E-RELEASE-FAILED", made.error, "repoctl release plan")] });
    const order = orderGenerators(generatorsOf(host));
    if (order.kind === "err") return outcomeOfEnvironment(`the table of generators waits for itself: ${order.error.join(", ")}`);
    const synced = await runSync(w, "write", order.value);
    const done: Done = {
      data: { plan: planData(made.value.plan), written: made.value.written },
      text: `${planText(made.value.plan)}\n${made.value.written.length} files written`,
      findings: findingsOfSync(synced),
      next: ["repoctl commit -m \"Release\"", "git push origin HEAD:main"],
      title: "Release made",
    };
    return outcomeOfDone(done);
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
    { args: ["--yes", "--confirm", "publish 3 1a2b3c4d"], says: "Send them to npm, with the confirmation the preview printed (the releaser tier, INFRO_NPMJS_TOKEN in the environment)." },
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
