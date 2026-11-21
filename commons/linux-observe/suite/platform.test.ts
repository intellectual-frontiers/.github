/**
 * Tests of the platform of a machine (commons linux-observe 0004-linux-observe-platform): the family of each distribution from its `os-release`, a distribution that derives from another, one of no known family, the architecture, a declaration refused and the drift between a declaration and a machine, and the real `os-release` of the machine the test runs on read through a way of running programs. Every name is made up.
 *
 * @module
 */
import { textOf, type Executor, type Output } from "@intellectual-frontiers/headless/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { familyOf } from "../src/governance/mod.ts";
import { architectureOf, osReleaseTable, parseDeclared, platformDrift, platformOfOsRelease } from "../src/logical/mod.ts";
import { observePlatform } from "../src/physical/mod.ts";
import { readFileSync } from "node:fs";

const OS = {
  ubuntu: 'NAME="Ubuntu"\nVERSION_ID="26.04"\nID=ubuntu\nID_LIKE=debian\n',
  debian: 'PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nID=debian\nVERSION_ID="13"\n',
  rocky: 'NAME="Rocky Linux"\nID="rocky"\nID_LIKE="rhel centos fedora"\nVERSION_ID="9.4"\n',
  fedora: "ID=fedora\nVERSION_ID=42\n",
  suse: 'ID="opensuse-leap"\nID_LIKE="suse opensuse"\nVERSION_ID="15.6"\n',
  arch: "ID=arch\nBUILD_ID=rolling\n",
};

proves(["0004-linux-observe-platform FR-001", "0004-linux-observe-platform FR-002"], "each distribution is of its family from its ID, one that derives from another is found by ID_LIKE, and one of no known family is named and never guessed", () => {
  const families = Object.entries(OS).map(([k, text]) => {
    const r = platformOfOsRelease(text, "x86_64");
    assert(r.kind === "ok", `${k}: ${r.kind === "err" ? r.error : ""}`);
    return [k, r.value.family, r.value.release, r.value.arch] as const;
  });
  assertEquals(families, [["ubuntu", "debian", "26.04", "x86_64"], ["debian", "debian", "13", "x86_64"], ["rocky", "rhel", "9.4", "x86_64"], ["fedora", "rhel", "42", "x86_64"], ["suse", "suse", "15.6", "x86_64"], ["arch", "arch", "", "x86_64"]]);
  assertEquals(familyOf("somearchspin", "arch"), "arch");
  assertEquals(familyOf("elementary", "ubuntu debian"), "debian");
  const unknown = platformOfOsRelease("ID=plan9\nID_LIKE=none\n");
  assert(unknown.kind === "err" && unknown.error.includes("plan9") && unknown.error.includes("no family Archon knows"));
  assertEquals(platformOfOsRelease("NAME=x\n").kind, "err");
  assertEquals(osReleaseTable("A='b c'\nB=\"d\"\n#x\nC=e").get("A"), "b c");
  assertEquals([architectureOf("amd64\n"), architectureOf("arm64"), architectureOf("aarch64"), architectureOf("riscv64")], ["x86_64", "aarch64", "aarch64", undefined]);
});

const DECLARED = { family: "rhel", distro: "rocky", release: "9.4", arch: "x86_64" };

proves(["0004-linux-observe-platform FR-003"], "a declaration is refused with every reason, one in a family its distribution is not of is refused, and the drift is said in a sentence each", () => {
  const bad = parseDeclared({ family: "bsd", distro: "Rocky", release: "9", arch: "sparc" });
  assert(bad.kind === "err");
  assertEquals(bad.error.length, 3);
  const wrong = parseDeclared({ ...DECLARED, family: "debian" });
  assert(wrong.kind === "err" && wrong.error[0]?.includes("is of the family rhel"));
  const ok = parseDeclared(DECLARED);
  assert(ok.kind === "ok");
  const seen = platformOfOsRelease(OS.debian, "aarch64");
  assert(seen.kind === "ok");
  assertEquals(platformDrift(ok.value, seen.value).length, 4);
  const same = platformOfOsRelease(OS.rocky, "x86_64");
  assert(same.kind === "ok");
  assertEquals(platformDrift(ok.value, same.value), []);
  assertEquals(platformDrift({ ...ok.value, release: "" }, { ...same.value, release: "9.6" }), []);
});

function pretend(table: Record<string, string>): Executor & { readonly asked: string[][] } {
  const asked: string[][] = [];
  const out = (code: number, text: string): Output => ({ code, success: code === 0, signal: null, stdout: new TextEncoder().encode(text), stderr: new Uint8Array() });
  return { asked, exec: async (argv) => (asked.push([...argv]), argv.join(" ") in table ? out(0, table[argv.join(" ")] ?? "") : out(1, "")) };
}

proves(["0004-linux-observe-platform FR-004"], "the platform is read by cat and uname only, from /usr/lib/os-release where /etc has none, with the reason where there is none, and the real os-release of this machine reads", async () => {
  const fake = pretend({ "sudo -n cat /etc/os-release": OS.rocky, "sudo -n uname -m": "x86_64\n" });
  const r = await observePlatform(fake, ["sudo", "-n"]);
  assert(r.kind === "ok" && r.value.family === "rhel" && r.value.arch === "x86_64");
  assertEquals(fake.asked.map((a) => a.slice(0, 3).join(" ")), ["sudo -n cat", "sudo -n uname"]);
  const usr = await observePlatform(pretend({ "cat /usr/lib/os-release": OS.arch }));
  assert(usr.kind === "ok" && usr.value.family === "arch");
  const none = await observePlatform(pretend({}));
  assert(none.kind === "err" && none.error.includes("no os-release"));
  const here = await observePlatform({ exec: async (argv) => ({ code: 0, success: true, signal: null, stdout: new TextEncoder().encode(argv[0] === "cat" ? readFileSync(argv[1] ?? "", "utf8") : "x86_64\n"), stderr: new Uint8Array() }) });
  assert(here.kind === "ok", here.kind === "err" ? here.error : "");
  void textOf;
});
