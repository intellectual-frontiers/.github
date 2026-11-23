// Spec: 0004-kickstart-dialect FR-001
/**
 * The dialect of Debian's installer: the same facts as the autoinstall, rendered as a preseed with no secret in it, the first boot written to the new system, and a layout Debian cannot do refused. Every name is made up.
 *
 * @module
 */
import { isGenerated } from "@intellectual-frontiers/archon/dialect";
import { defineRequirement, parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOrder } from "@intellectual-frontiers/archon/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { redhatKickstart, KINDS_CARRIED, KICKSTART_DIALECT_ID, type CloudInitOptions } from "../src/dialect.ts";
import { PASSWORD_PLACEHOLDER } from "../src/install.ts";
import { kickstart } from "../src/kickstart.ts";
import { firstBootFiles } from "../src/preseed.ts";
import { installSpecOf } from "../src/dialect.ts";


function req(id: string, kind: string, desired: unknown, more: Record<string, unknown> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind, desired, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}
const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMadeUpKeyForTestsOnlyMadeUpKeyForTestsOnly1";
const REQS = [
  req("setting.timezone", "system-setting", { name: "timezone", value: "Europe/Paris" }),
  req("setting.locale", "system-setting", { name: "locale", value: "en_GB.UTF-8" }),
  req("setting.keyboard", "system-setting", { name: "keyboard", value: "fr" }),
  req("user.admin", "user", { name: "adminer", uid: 1000, comment: "Ada Admin" }),
  req("key.admin", "ssh-authorized-key", { user: "adminer", key: KEY }),
  req("pkg.git", "package", { name: "htop" }),
];
const OPTIONS: CloudInitOptions = {
  fleet: "labfleet",
  repository: { url: "https://git.example.test/labfleet.git", branch: "main", renderPath: "fleets/lab/render/delphi/ansible" },
  allowedSigners: `signer@example.test ${KEY}`,
  base: "http://192.0.2.10:8080/install/delphi/tok/",
};
const SUBJECT = (() => {
  const n = parseSubjectName("delphi");
  if (n.kind === "err") throw new Error(n.error);
  return { name: n.value, class: "machine" as const };
})();
function orderOf(requirements: readonly Requirement[]) {
  const o = buildOrder({ subject: SUBJECT, assurance: "solo", layers: [{ layer: "baseline", requirements }] });
  if (o.kind === "err") throw new Error(JSON.stringify(o.error));
  return o.value;
}

proves(["0004-kickstart-dialect FR-001"], "the dialect carries the kinds of the autoinstall dialect, has no step, says it destroys, and takes its facts the same way", () => {
  const d = redhatKickstart(OPTIONS);
  assertEquals(String(d.id), KICKSTART_DIALECT_ID);
  assertEquals(d.guarantees.kinds.map(String), [...KINDS_CARRIED]);
  assertEquals([d.guarantees.plan, d.guarantees.destroy], ["none", true]);
  assertEquals(d.steps(planOrder(orderOf(REQS), new Map()), { files: new Map(), digest: "" } as never), []);
  const spec = installSpecOf(orderOf(REQS), OPTIONS);
  assert(spec.kind === "ok" && spec.value.hostname === "delphi" && spec.value.admin.user === "adminer");
});

proves(["0004-kickstart-dialect FR-002", "0004-kickstart-dialect FR-003"], "the render is generated and the same every time, sets the machine's facts, holds only the placeholder in place of the password hash, and gives the administrator the key and no password sign-in", async () => {
  const order = orderOf(REQS);
  const plan = planOrder(order, new Map());
  const a = await redhatKickstart(OPTIONS).render(order, plan);
  const b = await redhatKickstart(OPTIONS).render(order, plan);
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(a.value.digest, b.value.digest);
  assertEquals([...a.value.files.keys()], ["kickstart/ks.cfg"]);
  const text = a.value.files.get("kickstart/ks.cfg") ?? "";
  assert(isGenerated(text));
  for (const want of [
    "lang en_GB.UTF-8",
    "keyboard --vckeymap=fr",
    "timezone Europe/Paris --utc",
    "network --bootproto=dhcp --hostname=delphi",
    "rootpw --lock",
    `--iscrypted --password=${PASSWORD_PLACEHOLDER}`,
    `sshkey --username=adminer "${KEY}"`,
    "autopart --type=lvm",
    "PasswordAuthentication no",
    "systemctl enable archon-converge.timer",
  ]) assert(text.includes(want), want);
  const pkgs = text.slice(text.indexOf("%packages"), text.indexOf("%end", text.indexOf("%packages")));
  for (const p of ["curl", "git", "openssh-clients", "ansible-core", "htop"]) assert(pkgs.split("\n").includes(p), `${p} in ${pkgs}`);
  for (const bad of ["PRIVATE KEY", "$6$", "$y$"]) assert(!text.includes(bad), bad);
  assert(kickstart(spec(), "$6$made$up").includes("--password=$6$made$up"), "the boot server puts the hash in as it serves the file");
});

function spec() {
  const s = installSpecOf(orderOf(REQS), OPTIONS);
  if (s.kind === "err") throw new Error(s.error.join("; "));
  return s.value;
}

proves(["0004-kickstart-dialect FR-004"], "the %post section writes the first boot's files to the new system, decodable, enables the timer and reports done", () => {
  const ks = kickstart(spec());
  const post = ks.slice(ks.indexOf("%post"));
  for (const f of firstBootFiles(spec())) assert(post.includes(`echo ${Buffer.from(f.content).toString("base64")} | base64 -d > ${f.path}`), f.path);
  assert(post.includes("systemctl enable archon-converge.timer") && post.includes("/done || true"), post);
});

proves(["0004-kickstart-dialect FR-005"], "the disk is the largest (picked in %pre) or the one named, lvm or direct, zfs is refused, and a kind not carried is refused", async () => {
  const largest = kickstart(spec());
  assert(largest.includes("%include /tmp/archon-disk.ks") && largest.includes("sort -rn | head -n 1") && largest.includes("clearpart --all --initlabel --drives=$d"), largest);
  const named = installSpecOf(orderOf(REQS), { ...OPTIONS, disk: { match: "/dev/nvme0n1", layout: "direct" } });
  assert(named.kind === "ok");
  const t = kickstart(named.value);
  assert(t.includes('echo "ignoredisk --only-use=nvme0n1"') && t.includes("autopart --type=plain") && !t.includes("sort -rn"), t);
  const order = orderOf(REQS);
  const zfs = await redhatKickstart({ ...OPTIONS, disk: { match: "largest", layout: "zfs" } }).render(order, planOrder(order, new Map()));
  assert(zfs.kind === "err" && zfs.error.join(" ").includes("ZFS"));
  const bad = orderOf([...REQS, req("svc.x", "service", { name: "x" })]);
  const refused = await redhatKickstart(OPTIONS).render(bad, planOrder(bad, new Map()));
  assert(refused.kind === "err" && refused.error.join(" ").includes("svc.x"));
});
