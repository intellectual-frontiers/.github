// Spec: 0002-anyfs-s3-store FR-001
/**
 * The name of a bucket, made only by `parseBucketName`: the rules of the general purpose buckets of S3 that every S3-compatible service also keeps (3 to 63 characters of lower case letters, digits, hyphens and
 * dots, beginning and ending with a letter or a digit, no two dots together, no dot beside a hyphen, not an address of the internet, none of the prefixes and suffixes S3 reserves). A name that passes is safe to put in a
 * URL as it is.
 *
 * @example
 * ```ts
 * import { parseBucketName } from "./bucket.ts";
 * parseBucketName("fleet-backup").kind; // "ok"
 * parseBucketName("Fleet_Backup").kind; // "err"
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";

/** The name of a bucket. Made only by `parseBucketName`. */
export type BucketName = Brand<string, "s3 bucket name">;

const SHAPE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const ADDRESS = /^\d{1,3}(?:\.\d{1,3}){3}$/u;
const RESERVED_PREFIXES = ["xn--", "sthree-", "amzn-s3-demo-"] as const;
const RESERVED_SUFFIXES = ["-s3alias", "--ol-s3", ".mrap", "--x-s3", "--table-s3"] as const;

/** A bucket name from text, or the reason it is not one. */
export function parseBucketName(text: string): Result<BucketName, string> {
  if (!SHAPE.test(text)) return err(`${JSON.stringify(text.slice(0, 70))} is not a bucket name: 3 to 63 lower case letters, digits, hyphens and dots, beginning and ending with a letter or a digit`);
  if (text.includes("..") || text.includes(".-") || text.includes("-.")) return err(`${JSON.stringify(text)} is not a bucket name: no two dots together and no dot beside a hyphen`);
  if (ADDRESS.test(text)) return err(`${JSON.stringify(text)} is not a bucket name: it is written as an address of the internet`);
  if (RESERVED_PREFIXES.some((p) => text.startsWith(p)) || RESERVED_SUFFIXES.some((s) => text.endsWith(s))) return err(`${JSON.stringify(text)} is not a bucket name: it begins or ends as S3 reserves`);
  return ok(text as BucketName);
}
