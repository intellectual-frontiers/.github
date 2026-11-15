/**
 * Keeps the documentation maps of model modules: for each module given, `<module>.docs.auto.ts` written from its TSDoc comments, or,
 * with `--check`, a failure where the map is not what the source makes (commons 0009-sql-aide FR-005).
 *
 * `bun sql-aide/runtime/docs.ts [--check] arca/party.ts ...`
 *
 * @module
 */
import { fs, proc } from "../../../runtime/mod.ts";
import { docsModule, extractDocs } from "../docs/tsdoc.ts";

/** The path of the documentation map of a module. */
export const docsPathOf = (modulePath: string): string => modulePath.replace(/\.ts$/, ".docs.auto.ts");

/**
 * The text the documentation map of a module should hold.
 *
 * @param modulePath - the path of the model module
 */
export async function docsTextOf(modulePath: string): Promise<string> {
  const source = await fs.readTextFile(modulePath);
  const shown = modulePath.split(/[\\/]/).slice(-2).join("/");
  return docsModule(extractDocs(source), shown);
}

/**
 * Whether a module's documentation map is what its source makes.
 *
 * @param modulePath - the path of the model module
 */
export async function docsAreCurrent(modulePath: string): Promise<boolean> {
  try {
    return (await fs.readTextFile(docsPathOf(modulePath))) === (await docsTextOf(modulePath));
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const check = proc.args.includes("--check");
  const modules = proc.args.filter((a) => !a.startsWith("--"));
  let stale = 0;
  for (const m of modules) {
    if (check) {
      if (!(await docsAreCurrent(m))) {
        console.error(`${docsPathOf(m)}: is not what the comments of ${m} make; run sql-aide/runtime/docs.ts ${m}`);
        stale++;
      }
    } else await fs.writeTextFile(docsPathOf(m), await docsTextOf(m));
  }
  if (stale > 0) proc.exit(1);
}
