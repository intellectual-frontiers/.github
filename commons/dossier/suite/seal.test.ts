/**
 * Tests of the seal of a dossier (commons dossier 0002-dossier-core FR-012): a person's signature of the digest of the manifest, refused where the manifest has changed or the key is another.
 *
 * @module
 */
import { build, withRendition } from "@intellectual-frontiers/dossier/logical";
import { sealManifest, verifySeal } from "@intellectual-frontiers/dossier/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, proves } from "@intellectual-frontiers/test";
import { declaration, registry, sources as made } from "./fixtures.ts";

const keygen = async (dir: string, name: string): Promise<{ readonly file: string; readonly publicKey: string }> => {
  const file = path.join(dir, name);
  const r = await proc.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "synthetic-person-01", "-f", file]);
  assert(r.success, `ssh-keygen made the key: ${r.stderr}`);
  return { file, publicKey: (await fs.readTextFile(`${file}.pub`)).trim() };
};

proves(["0002-dossier-core FR-012"], "a seal covers one manifest and one key, and is refused where either differs", async () => {
  const dir = await fs.makeTempDir({ prefix: "dossier-seal-" });
  try {
    const b = await build(declaration("restricted"), registry, await made());
    assert(b.kind === "ok");
    const key = await keygen(dir, "key-01");
    const other = await keygen(dir, "key-02");
    const who = { person: "synthetic-person-01", role: "authorizing official", signedAt: "2026-11-26T13:00:00Z" };
    const seal = await sealManifest(b.value.manifest, who, { keyFile: key.file });
    assert(seal.kind === "ok", seal.kind === "err" ? seal.error : "");
    const good = await verifySeal(seal.value, b.value.manifest, key.publicKey);
    assert(good.kind === "ok", good.kind === "err" ? good.error : "");
    const changed = withRendition(b.value.manifest, "dossier.html", "0".repeat(64));
    const moved = await verifySeal(seal.value, changed, key.publicKey);
    assert(moved.kind === "err" && moved.error.includes("manifest has changed"));
    const wrong = await verifySeal(seal.value, b.value.manifest, other.publicKey);
    assert(wrong.kind === "err" && wrong.error.includes("does not verify"));
    const reworded = await verifySeal({ ...seal.value, role: "someone else" }, b.value.manifest, key.publicKey);
    assert(reworded.kind === "err" && reworded.error.includes("other words"));
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});
