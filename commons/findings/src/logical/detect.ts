// Spec: 0003-findings-importers FR-005
/**
 * Which importer reads a report: by what is in it. A JSON with `runs` and a version is SARIF, one with `site` is a ZAP report; an XML with `<issues` is a Burp report and one with `<NessusClientData` a Nessus export.
 *
 * @example
 * ```ts
 * import { detectFormat } from "./detect.ts";
 * detectFormat("a.xml", "<issues/>"); // "burp"
 * ```
 *
 * @module
 */
import { importBurp } from "./burp.ts";
import { importNessus } from "./nessus.ts";
import type { Imported } from "./result.ts";
import { importSarif } from "./sarif.ts";
import { importZap } from "./zap.ts";

/** The report formats. */
export type ReportFormat = "sarif" | "zap" | "burp" | "nessus";

/** The format of a report, or nothing where none is read. */
export function detectFormat(text: string): ReportFormat | undefined {
  const t = text.trimStart();
  if (t.startsWith("{")) {
    try {
      const d = JSON.parse(text) as Record<string, unknown>;
      if (Array.isArray(d["runs"]) && typeof d["version"] === "string") return "sarif";
      if (Array.isArray(d["site"])) return "zap";
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (/<NessusClientData/.test(t)) return "nessus";
  if (/<issues[\s>/]/.test(t)) return "burp";
  return undefined;
}

/** The findings of a report by its format; `asset` is the system a SARIF report is of (the others say theirs). */
export function importReport(file: string, text: string, asset = ""): Imported & { readonly format: ReportFormat | undefined } {
  const format = detectFormat(text);
  switch (format) {
    case "sarif":
      return asset === "" ? { format, findings: [], problems: [`${file}: a SARIF report does not say what it scanned as an asset: give the asset`] } : { format, ...importSarif(file, text, asset) };
    case "zap":
      return { format, ...importZap(file, text) };
    case "burp":
      return { format, ...importBurp(file, text) };
    case "nessus":
      return { format, ...importNessus(file, text) };
    default:
      return { format, findings: [], problems: [`${file}: no importer reads it (SARIF, an OWASP ZAP JSON report, a Burp XML report, a Nessus export)`] };
  }
}
