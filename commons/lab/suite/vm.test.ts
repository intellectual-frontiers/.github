/**
 * Tests of the Omarchy virtual machine (commons lab 0003-lab-arch-family FR-008 to FR-013). The pure parts are tested as data: the manifest, the sums, the differences named, the credential, the emulator's arguments and the bounds. The fetch and its digest
 * checks run the real code against an origin on this disk (a `file://` address, so that a tampered image of a few bytes can be made: the code under test is the fetch and the check, not the network). The real tests boot the real published image of Omarchy
 * 4.5.0, by SHA-256 pins, under QEMU (with `/dev/kvm` where there is one, with software emulation where not), and are skipped with the reason where QEMU or its tools are absent and never passed. Every name is made up.
 *
 * @module
 */
import * as proc from "@intellectual-frontiers/system/proc";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { VM_NOT_FAITHFUL, NOT_FAITHFUL } from "../src/governance/mod.ts";
import { digestDifferences, keyCredential, qemuArgv, readOmarchyManifest, readSums, sshBoundSeconds } from "../src/logical/mod.ts";
import { fetchOmarchy, startVm, vmUsable } from "../src/physical/mod.ts";

/** What the manifest of Omarchy 4.5.0 says, as it was read on 2026-11-22 (the real test fetches the live one and pins these digests). */
const IMAGE_SHA = "fea962bb66bef8f922900018f8241e50a2d1a00268715541882479016235dc9f";
const PINS = {
  vmlinuz: "b4aae0fbbcfe8893671f504b2971373c43350d029d28f1c9d69d8f516fae6756",
  initrd: "b38fca90c90f480811abcd6ccfe7113d08c6a161f6e434316d05278f47551379",
  cmdline: "47458e7a23aadd46309f235b5d03a38110817ac7f51740fd43211b18e627013c",
} as const;
const MANIFEST = {
  version: "4.5.0",
  vm: { url: "https://nightly.omarchy.org/stable/4.5.0/494/omarchy-4.5.0.qcow2", sha256: IMAGE_SHA, size: 4192291328, unpacked: "https://nightly.omarchy.org/stable/4.5.0/494/unpacked/", unpacked_files: ["vmlinuz", "initrd", "cmdline", "vm-boot", "SHA256SUMS"], user: "omarchy", password: "omarchy" },
};

const hex = async (bytes: Uint8Array): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map((b) => b.toString(16).padStart(2, "0")).join("");

proves(["0003-lab-arch-family FR-008"], "the manifest is read only where it has the form Lab knows, and every reason it has not is given", () => {
  const ok = readOmarchyManifest(MANIFEST);
  assert(ok.kind === "ok" && ok.value.sha256 === IMAGE_SHA && ok.value.user === "omarchy" && ok.value.unpacked.endsWith("/unpacked/"));
  const bad = readOmarchyManifest({ version: "", vm: { url: "http://x/y", sha256: "abc", size: 0, unpacked: "https://x/y", unpacked_files: ["vmlinuz"], user: "Bad User" } });
  assert(bad.kind === "err" && bad.error.length >= 8, JSON.stringify(bad));
  assertEquals(readOmarchyManifest(null).kind, "err");
  const sums = readSums(`${PINS.vmlinuz}  vmlinuz\n${PINS.initrd}  initrd\nnot a line\n`);
  assertEquals([...sums.keys()], ["vmlinuz", "initrd"]);
});

proves(["0003-lab-arch-family FR-008"], "a digest that differs, or has nothing to be checked against, refuses the whole machine and each is named", () => {
  assertEquals(digestDifferences([{ name: "vmlinuz", expected: "a", actual: "a" }]), undefined);
  const said = digestDifferences([{ name: "the image", expected: "a", actual: "b" }, { name: "initrd", expected: undefined, actual: "c" }, { name: "cmdline", expected: "d", actual: "d" }]);
  assert(said !== undefined && said.startsWith("nothing was booted") && said.includes("the image is b where a is expected") && said.includes("initrd has no digest") && !said.includes("cmdline"), said);
});

proves(["0003-lab-arch-family FR-009"], "the credential makes the user's .ssh folder and authorized_keys with the key of this boot, and refuses what is not a user or an ed25519 key line", () => {
  const key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample lab-vm";
  const c = keyCredential("omarchy", key);
  assert(c.kind === "ok");
  assertEquals(atob(c.value), `d /home/omarchy/.ssh 0700 omarchy omarchy -\nf+ /home/omarchy/.ssh/authorized_keys 0600 omarchy omarchy - ${key}\n`);
  assertEquals(keyCredential("Bad", key).kind, "err");
  assertEquals(keyCredential("omarchy", `${key}\nssh-ed25519 AAAA other`).kind, "err");
  assertEquals(keyCredential("omarchy", "ssh-rsa AAAA x").kind, "err");
});

proves(["0003-lab-arch-family FR-009", "0003-lab-arch-family FR-010"], "the emulator runs on an overlay, forwards the SSH port to 127.0.0.1 only, shows nothing, and uses kvm or tcg as it is told, with 300 or 2400 seconds to wait", () => {
  const plan = { cpus: 4, memory: "6G", dir: "/c", overlay: "/s/run.qcow2", cmdline: "root=x rw", credential: "ZQ==", port: 22022, qmp: "/s/qmp.sock", pidfile: "/s/qemu.pid", uuid: "u", serial: "/s/serial.log" };
  const tcg = qemuArgv({ ...plan, accel: "tcg" }).join(" ");
  const kvm = qemuArgv({ ...plan, accel: "kvm" }).join(" ");
  assert(tcg.includes("accel=tcg") && !tcg.includes("-enable-kvm") && kvm.includes("-enable-kvm") && kvm.includes("accel=kvm") && !kvm.includes("tcg"));
  for (const t of [tcg, kvm]) {
    assert(t.includes("file=/s/run.qcow2,format=qcow2") && !t.includes("omarchy-4.5.0"), "the disk is the overlay, never the image");
    assert(t.includes("hostfwd=tcp:127.0.0.1:22022-:22") && t.includes("-display none") && t.includes("tmpfiles.extra=ZQ==") && t.includes("-daemonize"));
  }
  assertEquals([sshBoundSeconds("kvm"), sshBoundSeconds("tcg")], [300, 2400]);
});

proves(["0003-lab-arch-family FR-012"], "the areas a virtual machine does not stand in for are stated, and are among those a container does not stand in for", () => {
  assertEquals(VM_NOT_FAITHFUL.map((a) => a.area), ["UEFI, Secure Boot and boot", "hardware facts", "power cycle"]);
  for (const a of VM_NOT_FAITHFUL) assert(a.fidelity === "not faithful" && a.note.length > 10 && NOT_FAITHFUL.includes(a.area));
  assert(VM_NOT_FAITHFUL.some((a) => a.note.includes("speed")), "nothing is said of speed under emulation");
});

proves(["0003-lab-arch-family FR-008"], "the fetch checks every digest and caches by the image's: an image that differs boots nothing and is named, a pin that differs is refused before anything is fetched, and an image that agrees is cached by its digest and not fetched again", async () => {
  const dir = await fs.makeTempDir({ prefix: "lab-test-" });
  try {
    const origin = path.join(dir, "origin");
    const unpacked = path.join(origin, "unpacked");
    await fs.mkdir(unpacked, { recursive: true });
    const enc = new TextEncoder();
    const files = { vmlinuz: enc.encode("kernel of a test"), initrd: enc.encode("initrd of a test"), cmdline: enc.encode("root=x rw\n") };
    const sums: string[] = [];
    for (const [name, bytes] of Object.entries(files)) {
      await fs.writeFile(path.join(unpacked, name), bytes);
      sums.push(`${await hex(bytes)}  ${name}`);
    }
    await fs.writeTextFile(path.join(unpacked, "SHA256SUMS"), `${sums.join("\n")}\n`);
    const disk = enc.encode("a disk image of a test");
    await fs.writeFile(path.join(origin, "disk.qcow2"), disk);
    const manifest = (sha256: string): unknown => ({ ...MANIFEST, vm: { ...MANIFEST.vm, url: `file://${origin}/disk.qcow2`, sha256, size: disk.length, unpacked: `file://${unpacked}/` } });
    const write = (sha256: string): Promise<void> => fs.writeTextFile(path.join(origin, "latest.json"), JSON.stringify(manifest(sha256)));
    const cache = path.join(dir, "cache");
    const options = { manifestUrl: `file://${origin}/latest.json`, cacheDir: cache };

    await write("0".repeat(64));
    const tampered = await fetchOmarchy(options);
    assert(tampered.kind === "err" && tampered.error.startsWith("nothing was booted") && tampered.error.includes("the image is") && tampered.error.includes(`${await hex(disk)} where ${"0".repeat(64)} is expected`), JSON.stringify(tampered));
    assertEquals(await fs.exists(path.join(cache, "0".repeat(64), "disk.qcow2")), false, "an image that differs is not kept");

    const good = await hex(disk);
    await write(good);
    const pinned = await fetchOmarchy({ ...options, pin: "1".repeat(64) });
    assert(pinned.kind === "err" && pinned.error.includes("pinned") && pinned.error.includes(good), JSON.stringify(pinned));
    const badFile = await fetchOmarchy({ ...options, pinFiles: { initrd: "2".repeat(64) } });
    assert(badFile.kind === "err" && badFile.error.includes("initrd"), JSON.stringify(badFile));

    const fetched = await fetchOmarchy({ ...options, pin: good, pinFiles: { vmlinuz: await hex(files.vmlinuz) } });
    assert(fetched.kind === "ok", fetched.kind === "err" ? fetched.error : "");
    assertEquals(fetched.value.dir, path.join(cache, good), "cached by its digest");
    assertEquals(await fs.readFile(fetched.value.imageFile), disk);
    await fs.remove(path.join(origin, "disk.qcow2"));
    const again = await fetchOmarchy(options);
    assert(again.kind === "ok" && again.value.imageFile === fetched.value.imageFile, "a cached image is not fetched again");
    await fs.writeFile(path.join(cache, good, "initrd"), enc.encode("damaged"));
    const repaired = await fetchOmarchy(options);
    assert(repaired.kind === "ok" && new TextDecoder().decode(await fs.readFile(path.join(cache, good, "initrd"))) === "initrd of a test", "a damaged file is fetched again and checked");
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

const reason = await vmUsable();

proves(["0003-lab-arch-family FR-011"], "the reason a virtual machine cannot be run is given, or nothing where it can", async () => {
  assert(reason === undefined || reason.length > 10);
});

const text = (o: { stdout: Uint8Array }): string => new TextDecoder().decode(o.stdout).trim();

proves(
  ["0003-lab-arch-family FR-008", "0003-lab-arch-family FR-009", "0003-lab-arch-family FR-010", "0003-lab-arch-family FR-011", "0003-lab-arch-family FR-013"],
  "the real Omarchy 4.5.0 image boots under QEMU on an overlay: SSH answers to the key of this boot and to no other, it is Omarchy, the executor runs a program, the builder's CA is trusted only where there is one, the image is unchanged, and stop removes the overlay, the keys and the emulator",
  async (t) => {
    if (reason !== undefined) return t.skip(reason);
    const steps: string[] = [];
    const started = await startVm({ pin: IMAGE_SHA, pinFiles: PINS, onStep: (s) => steps.push(s) });
    assert(started.kind === "ok", started.kind === "err" ? started.error : "");
    const m = started.value;
    const imageBefore = await fs.sha256File(m.imageFile);
    assertEquals(imageBefore, IMAGE_SHA, "the image on disk is the one pinned");
    const pid = Number((await fs.readTextFile(path.join(path.dirname(m.overlay), "qemu.pid"))).trim());
    try {
      assert(m.accel === "kvm" || m.accel === "tcg");
      assertEquals(m.accel === "kvm", await fs.exists("/dev/kvm"), "kvm where there is /dev/kvm, tcg where not, said");
      assert(steps.some((s) => s.includes(m.accel === "kvm" ? "kvm" : "tcg")));
      assert(m.secondsToSsh <= sshBoundSeconds(m.accel), `${m.secondsToSsh} seconds to SSH`);
      assert(await fs.exists(m.overlay), "the overlay exists while the machine runs");
      const os = text(await m.executor.exec(["cat", "/etc/os-release"]));
      assert(/^ID=omarchy$/m.test(os), os);
      assertEquals(text(await m.executor.exec(["id", "-un"])), "omarchy");
      const stdin = await m.executor.exec(["sh", "-c", "cat; echo end"], { input: "from the test\n" });
      assertEquals(text(stdin), "from the test\nend", "input reaches the program");
      const other = `${m.identityFile}-other`;
      await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", other]);
      const refused = await proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes", "-o", `UserKnownHostsFile=${m.knownHostsFile}`, "-o", "PasswordAuthentication=no", "-i", other, "-p", String(m.port), "omarchy@127.0.0.1", "id"]);
      assertEquals(refused.code, 255, "another key is refused");
      const unpinned = await proc.run(["ssh", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile=/dev/null", "-i", m.identityFile, "-p", String(m.port), "omarchy@127.0.0.1", "id"]);
      assertEquals(unpinned.code, 255, "a host key that is not pinned is refused");
      const anchors = text(await m.executor.exec(["sh", "-c", "ls /etc/ca-certificates/trust-source/anchors | wc -l"]));
      const ca = process.env["LAB_CA_BUNDLE"];
      if (ca !== undefined && ca !== "" && (await fs.exists(ca))) {
        const https = await m.executor.exec(["curl", "-sS", "-o", "/dev/null", "--max-time", "60", "-w", "%{http_code}", "https://github.com/"]);
        assertEquals(https.code, 0, `HTTPS through the builder's re-signing network: ${new TextDecoder().decode(https.stderr)}`);
        assert(Number(anchors) >= 1, "the builder's CA is an anchor of the machine");
      } else {
        assertEquals(anchors, "0", "no CA was given to a machine on a network that does not inspect TLS");
      }
    } finally {
      await m.stop();
    }
    assertEquals(await fs.exists(m.overlay), false, "the overlay is gone");
    assertEquals(await fs.exists(m.identityFile), false, "the keys are gone");
    assertEquals((await proc.run(["kill", "-0", String(pid)])).success, false, "the emulator is gone");
    assertEquals(await fs.sha256File(m.imageFile), imageBefore, "the image is never written");
    await m.stop();
  },
  { timeout: 3_000_000 },
);
