// Spec: 0005-anyfs-cli-merge-signing FR-005
/**
 * Makes a signing key for a replica (commons anyfs-cli 0005-anyfs-cli-merge-signing FR-005): the file of the key, readable by its owner only, and the entry of the roster that the others add to theirs. The private key is
 * written to the file and never printed.
 *
 * ```sh
 * bun tools/keygen.ts --replica 0123456789abcdef0123456789abcdef --key a.key
 * ```
 *
 * @module
 */
import process from "node:process";
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { generateSigningKey, signingKeyText } from "@intellectual-frontiers/anyfs/merge";
import { fs } from "@intellectual-frontiers/system";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};

const replica = parseReplicaId(arg("--replica") ?? "");
const file = arg("--key");
if (replica.kind === "err" || file === undefined) {
  console.error("usage: keygen.ts --replica <32 hexadecimal digits> --key <file to write>");
  process.exit(2);
}
if (await fs.exists(file)) {
  console.error(`${file} is there already; a key is never written over`);
  process.exit(1);
}
const key = await generateSigningKey(replica.value);
await fs.writeTextFile(file, signingKeyText(key), { mode: 0o600 });
console.log(JSON.stringify(key.entry, null, 2));
