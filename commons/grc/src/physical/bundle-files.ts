// Spec: 0011-grc-bundles FR-002, FR-010, FR-012
/**
 * The file adapter of bundle verification (0011-grc-bundles FR-002): it reads a folder into the contents `verifyBundle` takes, and reads the keys and the evidence policy the verifier gives. It reads
 * files only: no network, and nothing is written.
 *
 * @example
 * ```ts
 * import { readBundle } from "./bundle-files.ts";
 * // const contents = await readBundle("./bundle"); // { kind: "ok", value: { manifest, ledger, evidence, signature, items } }
 * ```
 *
 * @module
 */
import { array, err, object, ok, type Result, string } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import { evidencePolicy, type EvidencePolicy } from "@intellectual-frontiers/grc/governance";
import type { BundleContents, Trust, TrustedKey } from "./bundle.ts";
import type { Signer } from "./signer.ts";

async function textOrUndefined(file: string): Promise<string | undefined> {
  return (await fs.exists(file)) ? fs.readTextFile(file) : undefined;
}

/**
 * The bundle in a folder: its documents' text (absent where a file is) and the bytes of `items/<digest>`; or why the folder cannot be read.
 *
 * @example
 * ```ts
 * // const contents = await readBundle("./bundle");
 * ```
 */
export async function readBundle(dir: string): Promise<Result<BundleContents, string>> {
  try {
    if (!(await fs.exists(dir)) || !(await fs.stat(dir)).isDirectory) return err(`${dir} is not a folder`);
    const items = new Map<string, Uint8Array>();
    const folder = path.join(dir, "items");
    if (await fs.exists(folder)) for await (const e of fs.readDir(folder)) if (e.isFile) items.set(e.name, await fs.readFile(path.join(folder, e.name)));
    return ok({
      manifest: await textOrUndefined(path.join(dir, "manifest.json")),
      ledger: await textOrUndefined(path.join(dir, "ledger.json")),
      evidence: await textOrUndefined(path.join(dir, "evidence.json")),
      signature: await textOrUndefined(path.join(dir, "signature.json")),
      items,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

const keysFile = object({ keys: array(object({ keyid: string, role: string, jwk: (input) => ok(input) })) });

async function importKey(jwk: unknown): Promise<Result<CryptoKey, string>> {
  if (typeof jwk !== "object" || jwk === null) return err("a key is a JSON Web Key object");
  // a JSON Web Key is read by its fields; the type of the web platform is not assumed to be in the compiler's libraries
  const json = jwk as { readonly kty?: string; readonly crv?: string };
  try {
    if (json.kty === "OKP" && json.crv === "Ed25519") return ok(await crypto.subtle.importKey("jwk", json as never, { name: "Ed25519" }, true, ["verify"]));
    if (json.kty === "EC" && (json.crv === "P-256" || json.crv === "P-384" || json.crv === "P-521")) {
      return ok(await crypto.subtle.importKey("jwk", json as never, { name: "ECDSA", namedCurve: json.crv }, true, ["verify"]));
    }
    return err("a key is an Ed25519 (OKP) or an EC (P-256, P-384, P-521) public key");
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

/**
 * The trust of a verifier: the evidence policy file (a `grc.evidence-policy`), the keys file (`{ "keys": [{ keyid, role, jwk }] }` of public keys) and the signer that verifies; or why a file cannot be read.
 *
 * @example
 * ```ts
 * // const trust = await readTrust("policy.json", "keys.json", dsseSigner);
 * ```
 */
export async function readTrust(policyFile: string, keysFilePath: string, signer: Signer): Promise<Result<Trust, string>> {
  try {
    const policyJson: unknown = JSON.parse(await fs.readTextFile(policyFile));
    const p = evidencePolicy.decode(policyJson);
    if (p.kind === "err") return err(`${policyFile}: ${p.error.path}: expected ${p.error.expected}, found ${p.error.found}`);
    const k = keysFile(JSON.parse(await fs.readTextFile(keysFilePath)));
    if (k.kind === "err") return err(`${keysFilePath}: ${k.error.path}: expected ${k.error.expected}, found ${k.error.found}`);
    const keys: TrustedKey[] = [];
    for (const entry of k.value.keys) {
      const key = await importKey(entry.jwk);
      if (key.kind === "err") return err(`${keysFilePath}: ${entry.keyid}: ${key.error}`);
      keys.push({ keyid: entry.keyid, role: entry.role, key: { key: key.value, keyid: entry.keyid } });
    }
    const policy: EvidencePolicy = p.value;
    return ok({ policy, signer, keys });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
