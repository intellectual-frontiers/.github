// Spec: 0001-docs FR-022
/**
 * The line coverage of a library's tests (docs 0001-docs FR-022): `parseLcov` reads the LCOV file that `bun test --coverage` writes into the files of one library, `parseCoverage` reads what `tools/evidence.ts --coverage` keeps
 * of it, and `percent` is the share of lines hit. Source files only: tests, and what is under `node_modules`, are left out.
 *
 * @module
 */

/** The lines of one file that the tests reach. */
export interface FileCoverage {
  /** From the root of the repository. */
  readonly path: string;
  readonly found: number;
  readonly hit: number;
}

/** The coverage of one library. */
export interface LibraryCoverage {
  readonly library: string;
  readonly files: readonly FileCoverage[];
}

export const isSource = (p: string): boolean => !/(^|\/)(suite|tests|node_modules|dist)\//.test(p) && !/\.test\.[cm]?[jt]sx?$/.test(p);

/** The files of an LCOV text: each `SF:` begins a file and `LF:` and `LH:` give its lines found and hit; `base` is what the `SF:` paths are relative to, from the root of the repository. */
export function parseLcov(lcov: string, base: string): readonly FileCoverage[] {
  const files: FileCoverage[] = [];
  let sf: string | undefined;
  let found = 0;
  let hit = 0;
  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      sf = line.slice(3).trim();
      found = 0;
      hit = 0;
    } else if (line.startsWith("LF:")) found = Number(line.slice(3)) || 0;
    else if (line.startsWith("LH:")) hit = Number(line.slice(3)) || 0;
    else if (line.startsWith("end_of_record") && sf !== undefined) {
      const parts: string[] = [];
      for (const seg of `${base}/${sf}`.split("/")) {
        if (seg === "..") parts.pop();
        else if (seg !== "" && seg !== ".") parts.push(seg);
      }
      const p = parts.join("/");
      if (isSource(p) && found > 0) files.push({ path: p, found, hit });
      sf = undefined;
    }
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** The share of lines hit, 0 to 100, or undefined where there are no lines. */
export function percent(files: readonly { readonly found: number; readonly hit: number }[]): number | undefined {
  const found = files.reduce((n, f) => n + f.found, 0);
  return found === 0 ? undefined : Math.round((files.reduce((n, f) => n + f.hit, 0) / found) * 1000) / 10;
}

/** What `tools/evidence.ts --coverage` kept, or why it cannot be read. */
export function parseCoverage(text: string): { readonly value: LibraryCoverage } | { readonly error: string } {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (typeof j !== "object" || j === null || typeof (j as Record<string, unknown>)["library"] !== "string" || !Array.isArray((j as Record<string, unknown>)["files"])) return { error: "is not a coverage report (a library and its files)" };
  const o = j as { library: string; files: unknown[] };
  const files = o.files.flatMap((f): FileCoverage[] => {
    const r = f as Record<string, unknown>;
    return typeof r["path"] === "string" && typeof r["found"] === "number" && typeof r["hit"] === "number" ? [{ path: r["path"], found: r["found"], hit: r["hit"] }] : [];
  });
  return { value: { library: o.library, files } };
}
