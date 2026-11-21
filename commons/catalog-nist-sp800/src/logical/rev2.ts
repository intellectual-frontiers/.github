// Spec: 0003-sp800-171-r2 FR-001, FR-004
/**
 * The reading of SP 800-171 Revision 2 and of SP 800-171A (0003-sp800-171-r2 FR-001, FR-004): a pure function of the text that `pdftotext -raw` makes of the two publications. NIST publishes no OSCAL for Revision 2, the revision CMMC Level 2 is assessed against, so the requirements
 * (110, each in the family it is printed under) and the assessment objectives (320, the lettered ones of a requirement as `3.1.1[a]` and the single one of a requirement as its number) are taken from the printed text. The page furniture (running heads, page numbers, the licence line) is dropped
 * wherever a page break falls inside a sentence, and the worked example of Chapter Two of 800-171A, which prints requirement 3.1.3 once before the requirements, is read over by the requirement's own block.
 *
 * @example
 * ```ts
 * import { readRequirements } from "./rev2.ts";
 * readRequirements("3.1 ACCESS CONTROL\n3.1.1 Limit access.\nDISCUSSION\nAPPENDIX A\n").requirements.length; // 1
 * ```
 *
 * @module
 */
import type { OutControl } from "./convert.ts";

/** The requirements of Revision 2 with the families (`3.1` and its name) they are printed under. */
export type Rev2Requirements = { readonly requirements: readonly OutControl[]; readonly families: ReadonlyMap<string, string> };

const FURNITURE = [
  /^CHAPTER [A-Z]+\s+PAGE \d+$/,
  /^APPENDIX [A-Z]\s+PAGE \d+$/,
  /^NIST SP 800-171/,
  /^SP 800-171, REVISION 2/,
  /^_{5,}$/,
  /^This publication is available free of charge/,
  /^https:\/\/doi\.org\/10\.6028\/NIST\.SP\.800-171/,
  /^\d{1,3}$/,
];
const isFurniture = (line: string): boolean => FURNITURE.some((r) => r.test(line));
/** The side watermark of each page, which the text extraction scatters over the page one word to a line. */
const WATERMARK = /This\s+publication\s+is\s+available\s+free\s+of\s+charge\s+from:\s*(?:https:\/\/doi\.org\/\S+)?/g;
const unmarked = (text: string): string => text.replace(WATERMARK, "");
/** One line of text; the footnote marks that follow the closing full stop (`platforms.23`) are not part of the statement. */
const words = (s: string): string => s.replace(/\s+/g, " ").trim().replace(/\.(?:\d{1,2})(?: \d{1,2})*$/, ".");
const title = (s: string): string => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(And|Of)\b/g, (w) => w.toLowerCase());

/** The requirements of SP 800-171 Revision 2 from its text: from the heading `3.1 ACCESS CONTROL` of Chapter Three to Appendix A. */
export function readRequirements(text: string): Rev2Requirements {
  const lines = unmarked(text).split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => /^3\.1 [A-Z][A-Z ,&-]+$/.test(l));
  const end = lines.findIndex((l, i) => i > start && l === "APPENDIX A");
  const requirements: OutControl[] = [];
  const families = new Map<string, string>();
  let family = "";
  let open: { id: string; parts: string[] } | undefined;
  const close = (): void => {
    if (open !== undefined) requirements.push({ id: open.id, title: families.get(family) ?? "", statement: words(open.parts.join(" ")), family: `${family}` });
    open = undefined;
  };
  if (start < 0 || end < 0) return { requirements, families };
  for (const line of lines.slice(start, end)) {
    const fam = /^(3\.\d+) ([A-Z][A-Z ,&-]+)$/.exec(line);
    if (fam !== null) {
      close();
      family = fam[1] as string;
      families.set(family, title(fam[2] as string));
      continue;
    }
    const req = /^(3\.\d+\.\d+) (\S.*)$/.exec(line);
    if (req !== null) {
      close();
      open = { id: req[1] as string, parts: [req[2] as string] };
      continue;
    }
    if (open === undefined || isFurniture(line)) continue;
    if (line === "") continue;
    if (/^(DISCUSSION|Basic Security Requirements|Derived Security Requirements|THE MEANING OF)/.test(line)) close();
    else open.parts.push(line);
  }
  close();
  return { requirements, families };
}

/** The assessment objectives of SP 800-171A from its text, each as a control of the requirement it determines. */
export function readObjectives(text: string, requirements: readonly OutControl[]): readonly OutControl[] {
  const lines = unmarked(text).split("\n").map((l) => l.trim()).filter((l) => !isFurniture(l));
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const blocks: { id: string; body: string[] }[] = [];
  for (const line of lines) {
    const head = /^(3\.\d+\.\d+) SECURITY REQUIREMENT$/.exec(line);
    if (head !== null) blocks.push({ id: head[1] as string, body: [] });
    else blocks[blocks.length - 1]?.body.push(line);
  }
  const done = new Map<string, readonly OutControl[]>();
  for (const b of blocks) {
    const from = b.body.indexOf("ASSESSMENT OBJECTIVE");
    const to = b.body.findIndex((l) => l.startsWith("POTENTIAL ASSESSMENT METHODS"));
    const req = byId.get(b.id);
    if (from < 0 || to < 0 || req === undefined) continue;
    const region = b.body.slice(from + 1, to);
    const items: { id: string; parts: string[] }[] = [];
    for (const l of region) {
      const m = /^(3\.\d+\.\d+\[[a-z]+\](?:\[\d+\])?)\s*(.*)$/.exec(l);
      if (m !== null) items.push({ id: m[1] as string, parts: m[2] === "" ? [] : [m[2] as string] });
      else if (items.length > 0 && l !== "Determine if:") (items[items.length - 1] as { parts: string[] }).parts.push(l);
    }
    if (items.length === 0) items.push({ id: b.id, parts: [region.join(" ").replace(/^\s*Determine if:?\s*/, "")] });
    done.set(b.id, items.map((i) => ({ id: i.id, title: req.title, statement: words(i.parts.join(" ")), family: b.id })));
  }
  return requirements.flatMap((r) => done.get(r.id) ?? []);
}
