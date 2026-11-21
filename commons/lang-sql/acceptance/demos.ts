/**
 * The demos (commons lang-sql 0011-acceptance FR-009): the transcripts of the scenarios, as the utilities print them over the fixture, and the `find` commands that sqlfind makes of the queries of the automated acceptance for each flavor. `bun acceptance/demos.ts`
 * writes them to `acceptance/demos/`; `--check` compares and writes nothing. A test fails where a file is not what the utilities print.
 *
 * Spec: 0011-acceptance FR-009, FR-007
 *
 * @module
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { NOW, queries } from "./aat.ts";
import { SCENARIOS } from "./scenarios.ts";
import { makeFixture } from "./shared/fixture.ts";
import { command as sqlfind } from "./sqlfind/main.ts";
import { shellQuote } from "./sqlfind/mod.ts";
import { command as sqlfs } from "./sqlfs/main.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The folder of the demos. */
export const DEMOS = join(HERE, "demos");

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Every demo file, by name, as the utilities print it over a fixture. */
export async function renderDemos(): Promise<Readonly<Record<string, string>>> {
  const fx = makeFixture();
  try {
    const hide = (s: string): string => s.split(fx.root).join("$ROOT");
    const out: Record<string, string> = {};
    for (const [i, s] of SCENARIOS.entries()) {
      const a = await sqlfs(["--root", fx.root, "--now", String(NOW), s.query]);
      const e = await sqlfind(["--root", fx.root, "--now", String(NOW), "--flavor", "gnu", "--emit", "shell", s.query]);
      const f = await sqlfind(["--root", fx.root, "--now", String(NOW), "--flavor", "gnu", s.query]);
      out[`${String(i + 1).padStart(2, "0")}-${slug(s.say)}.txt`] = hide(
        [`# ${s.say}`, "", `$ sqlfs --root $ROOT ${shellQuote(s.query)}`, a.out, "", `$ sqlfind --root $ROOT --emit shell ${shellQuote(s.query)}`, e.out, "", `$ sqlfind --root $ROOT ${shellQuote(s.query)}`, f.out, ""].join("\n"),
      );
    }
    const qs = queries({ owner: "OWNER" }).filter((q) => !q.includes("owner"));
    for (const flavor of ["gnu", "bsd"] as const) {
      const lines: string[] = [`# What sqlfind makes of the queries of the automated acceptance for ${flavor} find, over a root of /fixture. A change is a change of what is pushed down.`, ""];
      for (const q of qs) {
        const r = await sqlfind(["--root", fx.root, "--flavor", flavor, "--emit", "shell", q]);
        lines.push(q, `  ${r.out.split(fx.root).join("/fixture")}`);
      }
      out[`argv-${flavor}.txt`] = `${lines.join("\n")}\n`;
    }
    return out;
  } finally {
    fx.cleanup();
  }
}

if (import.meta.main) {
  const demos = await renderDemos();
  const check = process.argv.includes("--check");
  mkdirSync(DEMOS, { recursive: true });
  let stale = 0;
  for (const [name, text] of Object.entries(demos)) {
    const path = join(DEMOS, name);
    let have: string | undefined;
    try {
      have = readFileSync(path, "utf8");
    } catch {
      have = undefined;
    }
    if (have !== text) {
      stale++;
      if (!check) writeFileSync(path, text);
    }
  }
  process.stdout.write(check ? (stale === 0 ? "demos: up to date\n" : `demos: ${stale} files are stale; run bun acceptance/demos.ts\n`) : `demos: wrote ${stale} files\n`);
  process.exitCode = check && stale > 0 ? 1 : 0;
}
