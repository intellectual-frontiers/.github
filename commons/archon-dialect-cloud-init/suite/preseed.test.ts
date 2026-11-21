// Spec: 0003-preseed-dialect FR-001
/**
 * The dialect of Debian's installer: the same facts as the autoinstall, rendered as a preseed with no secret in it, the first boot written to the new system, and a layout Debian cannot do refused. Every name is made up.
 *
 * @module
 */
import { isGenerated } from "@intellectual-frontiers/archon/dialect";
import { defineRequirement, parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOrder } from "@intellectual-frontiers/archon/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { debianPreseed, KINDS_CARRIED, PRESEED_DIALECT_ID, type CloudInitOptions } from "../src/dialect.ts";
import { PASSWORD_PLACEHOLDER } from "../src/install.ts";
import { firstBootFiles, preseed } from "../src/preseed.ts";
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

proves(["0003-preseed-dialect FR-001"], "the dialect carries the kinds of the autoinstall dialect, has no step, says it destroys, and takes its facts the same way", () => {
  const d = debianPreseed(OPTIONS);
  assertEquals(String(d.id), PRESEED_DIALECT_ID);
  assertEquals(d.guarantees.kinds.map(String), [...KINDS_CARRIED]);
  assertEquals([d.guarantees.plan, d.guarantees.destroy], ["none", true]);
  assertEquals(d.steps(planOrder(orderOf(REQS), new Map()), { files: new Map(), digest: "" } as never), []);
  const spec = installSpecOf(orderOf(REQS), OPTIONS);
  assert(spec.kind === "ok" && spec.value.hostname === "delphi" && spec.value.admin.user === "adminer");
});

proves(["0003-preseed-dialect FR-002", "0003-preseed-dialect FR-003"], "the render is generated and the same every time, sets the machine's facts, holds only the placeholder in place of the password hash, and gives the administrator keys and no password sign-in", async () => {
  const order = orderOf(REQS);
  const plan = planOrder(order, new Map());
  const a = await debianPreseed(OPTIONS).render(order, plan);
  const b = await debianPreseed(OPTIONS).render(order, plan);
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(a.value.digest, b.value.digest);
  assertEquals([...a.value.files.keys()], ["preseed/preseed.cfg"]);
  const text = a.value.files.get("preseed/preseed.cfg") ?? "";
  assert(isGenerated(text));
  for (const want of [
    "d-i debian-installer/locale string en_GB.UTF-8",
    "d-i keyboard-configuration/xkb-keymap select fr",
    "d-i netcfg/get_hostname string delphi",
    "d-i passwd/root-login boolean false",
    "d-i passwd/username string adminer",
    `d-i passwd/user-password-crypted password ${PASSWORD_PLACEHOLDER}`,
    "d-i time/zone string Europe/Paris",
    "d-i partman-auto/method string lvm",
  ]) assert(text.includes(want), want);
  const pkg = text.split("\n").find((l) => l.startsWith("d-i pkgsel/include")) ?? "";
  for (const p of ["curl", "git", "openssh-client", "ansible-core", "htop"]) assert(pkg.split(" ").includes(p), `${p} in ${pkg}`);
  for (const bad of ["PRIVATE KEY", "$6$", "$y$"]) assert(!text.includes(bad), bad);
  const late = text.split("\n").find((l) => l.startsWith("d-i preseed/late_command")) ?? "";
  assert(late.includes("PasswordAuthentication no") && late.includes("authorized_keys"), late);
  assertEquals(preseed(spec(), "$6$made$up").includes("$6$made$up"), true, "the boot server puts the hash in as it serves the file");
});

function spec() {
  const s = installSpecOf(orderOf(REQS), OPTIONS);
  if (s.kind === "err") throw new Error(s.error.join("; "));
  return s.value;
}

proves(["0003-preseed-dialect FR-004"], "the late command writes the first boot's files to the new system, decodable, and enables the timer and reports done", () => {
  const late = preseed(spec()).split("\n").find((l) => l.startsWith("d-i preseed/late_command")) ?? "";
  for (const f of firstBootFiles(spec())) {
    const b64 = Buffer.from(f.content).toString("base64");
    assert(late.includes(`echo ${b64} | base64 -d > /target${f.path}`), f.path);
  }
  assert(late.includes("in-target systemctl enable archon-converge.timer") && late.includes("/done"), late);
  const paths = firstBootFiles(spec()).map((f) => f.path);
  assert(paths.includes("/etc/archon/allowed_signers") && paths.includes("/usr/local/sbin/archon-converge") && paths.includes("/etc/systemd/system/archon-converge.timer"));
});

proves(["0003-preseed-dialect FR-005"], "the disk is the largest or the one named with lvm or direct, zfs is refused and a kind not carried is refused as the autoinstall dialect does", async () => {
  assert(preseed(spec()).includes("list-devices disk"), "the largest disk is picked in the installer");
  const named = installSpecOf(orderOf(REQS), { ...OPTIONS, disk: { match: "/dev/nvme0n1", layout: "direct" } });
  assert(named.kind === "ok");
  const t = preseed(named.value);
  assert(t.includes("debconf-set partman-auto/disk /dev/nvme0n1") && t.includes("d-i partman-auto/method string regular") && !t.includes("partman-lvm"), t);
  const order = orderOf(REQS);
  const zfs = await debianPreseed({ ...OPTIONS, disk: { match: "largest", layout: "zfs" } }).render(order, planOrder(order, new Map()));
  assert(zfs.kind === "err" && zfs.error.join(" ").includes("ZFS"));
  const bad = orderOf([...REQS, req("svc.x", "service", { name: "x" })]);
  const refused = await debianPreseed(OPTIONS).render(bad, planOrder(bad, new Map()));
  assert(refused.kind === "err" && refused.error.join(" ").includes("svc.x"));
});
