// Spec: 0002-policy-gate FR-006
/**
 * Builders and a baseline of rules (0002-policy-gate FR-006): `require`, `forbid` and `oneOf` make a rule from an attribute and what it must be, so a policy reads as the facts it states; the baseline is a small set that holds for any estate (nothing in the clear, nothing open to the world
 * on an administrative port, storage encrypted, an owner named, a certificate not close to its end, an image that is not floating). Each names the controls of SP 800-53 it gives evidence for.
 *
 * @example
 * ```ts
 * import { BASELINE } from "./rules.ts";
 * BASELINE.length > 0; // true
 * ```
 *
 * @module
 */
import type { Problem, Rule, Severity, Subject, Value } from "@intellectual-frontiers/gate/governance";

type Meta = { readonly id: string; readonly title: string; readonly severity?: Severity; readonly kinds?: readonly string[]; readonly controls?: readonly string[] };
const rule = (m: Meta, check: (s: Subject) => readonly Problem[]): Rule => ({ id: m.id, title: m.title, severity: m.severity ?? "block", ...(m.kinds === undefined ? {} : { kinds: m.kinds }), ...(m.controls === undefined ? {} : { controls: m.controls }), check });

/** A rule that an attribute must be there and satisfy a test. */
export function require(m: Meta, attribute: string, test: (v: Value) => boolean, expected: string): Rule {
  return rule(m, (s) => {
    const v = s.attributes[attribute];
    if (v === undefined) return [{ attribute, message: `is missing (expected ${expected})` }];
    return test(v) ? [] : [{ attribute, message: `is ${JSON.stringify(v)} (expected ${expected})` }];
  });
}

/** A rule that an attribute, where it is there, must not satisfy a test. */
export function forbid(m: Meta, attribute: string, test: (v: Value) => boolean, what: string): Rule {
  return rule(m, (s) => {
    const v = s.attributes[attribute];
    return v !== undefined && test(v) ? [{ attribute, message: what }] : [];
  });
}

/** A rule that an attribute must be one of the values. */
export function oneOf(m: Meta, attribute: string, allowed: readonly (string | number | boolean)[]): Rule {
  return require(m, attribute, (v) => !Array.isArray(v) && allowed.includes(v as string | number | boolean), `one of ${allowed.join(", ")}`);
}

const ADMIN_PORTS = new Set([22, 23, 135, 139, 445, 1433, 3306, 3389, 5432, 5900, 6379, 9200, 27017]);

/** The baseline: rules that hold for any estate. */
export const BASELINE: readonly Rule[] = [
  forbid({ id: "no-cleartext", title: "An endpoint does not accept cleartext", kinds: ["endpoint", "service"], controls: ["SC-8", "SC-13"] }, "allows-cleartext", (v) => v === true, "accepts cleartext connections"),
  rule({ id: "no-open-admin-port", title: "No administrative port is open to the world", kinds: ["cloud-resource", "endpoint"], controls: ["AC-17", "SC-7"] }, (s) => {
    const cidrs = s.attributes["ingress-cidrs"];
    const ports = s.attributes["ingress-ports"];
    const open = Array.isArray(cidrs) && cidrs.some((c) => c === "0.0.0.0/0" || c === "::/0");
    const admin = Array.isArray(ports) ? ports.filter((p) => ADMIN_PORTS.has(Number(p))) : [];
    return open && admin.length > 0 ? [{ attribute: "ingress-ports", message: `administrative port ${admin.join(", ")} is open to 0.0.0.0/0` }] : [];
  }),
  require({ id: "storage-encrypted", title: "Storage is encrypted at rest", kinds: ["cloud-resource"], controls: ["SC-28"] }, "encrypted-at-rest", (v) => v === true, "true"),
  require({ id: "has-owner", title: "Every subject has an owner", severity: "warn", controls: ["CM-8", "PM-5"] }, "owner", (v) => typeof v === "string" && v.trim() !== "", "a name"),
  rule({ id: "certificate-not-near-end", title: "A certificate is not near its end", severity: "warn", kinds: ["certificate"], controls: ["SC-12", "SC-17"] }, (s) => {
    const days = s.attributes["days-to-expiry"];
    return typeof days === "number" && days < 30 ? [{ attribute: "days-to-expiry", message: `${days} days left (at least 30 are wanted)` }] : [];
  }),
  forbid({ id: "image-pinned", title: "An image is pinned, not floating", kinds: ["application", "service", "cloud-resource"], controls: ["CM-2", "SI-7"] }, "image", (v) => typeof v === "string" && (/:latest$/.test(v) || !/[:@]/.test(v)), "uses a floating image reference (no tag, or latest)"),
];
