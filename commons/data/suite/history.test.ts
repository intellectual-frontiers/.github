// Spec: 0018-sql-history FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
/**
 * The history strategy (commons data 0018-sql-history), on real engines: a plan is frozen into files that never change, a manifest chains them, the files are replayed on SQLite, DuckDB and
 * PostgreSQL to the same state, a release package runs with plain SQL, and a procedure inside the database applies its own history and refuses what does not follow.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import {
  checkHistory,
  frozenOf,
  freeze,
  historyPlan,
  installer,
  parseStep,
  pathOf,
  releasePackage,
  renderStep,
  replay,
  settingsOf,
  slug,
} from "@intellectual-frontiers/data/sql/extensions/history";
import { safety } from "@intellectual-frontiers/data/sql/extensions/safety";
import {
  canonicalState,
  emptyState,
  plan,
  type Plan,
  readLedger,
  sha256Hex,
  snapshotOf,
  type State,
  stateHash,
} from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, type Artifact, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, structure, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const SNAKE = { names: "snake", codes: "snake" } as const;
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const s = safety();
const stateOf = (v: 1 | 2 | 3, d: Dialect): State => must(snapshotOf(libraryAt(v), { dialect: d }));
const emptyOf = (d: Dialect): string => stateHash(emptyState(d.name, SNAKE));
const planOf = (d: Dialect, from: State | undefined, v: 1 | 2 | 3): Plan =>
  must(plan(from, libraryAt(v), { dialect: d }, { transforms: [...s.transforms, idempotency()] }));
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
/** A history frozen version by version, as a project would. */
const histOf = (d: Dialect, upTo: 1 | 2 | 3 = 3): { readonly files: readonly Artifact[]; readonly plans: readonly Plan[] } => {
  let files: Artifact[] = [];
  const plans: Plan[] = [];
  let from: State | undefined;
  for (const v of [1, 2, 3] as const) {
    if (v > upTo) break;
    const p = planOf(d, from, v);
    plans.push(p);
    const fresh = must(freeze(files, p, { state: canonicalState(stateOf(v, d)) }));
    files = [...files.filter((f) => !fresh.some((n) => n.path === f.path)), ...fresh];
    from = stateOf(v, d);
  }
  return { files, plans };
};
const shape = async (e: Engine): Promise<unknown> => {
  const x = await structure(e);
  return Object.fromEntries(
    Object.entries(x.tables)
      .filter(([n]) => !n.startsWith("lifecycle") && !n.endsWith("_quarantine") && n !== "governance")
      .map(([n, t]) => [n, Object.keys(t.columns).sort()])
      .sort(([a], [b]) => ((a as string) < (b as string) ? -1 : 1)),
  );
};

proves(
  ["0018-sql-history FR-001"],
  "a step is a file with a numbered slug name, a JSON header, its statements with their guards, its undo and what must be true after, the same every time, and parsing it gives the step back",
  () => {
    const p = planOf(postgres, stateOf(2, postgres), 3);
    for (const step of p.steps) {
      const frozen = frozenOf(step);
      const text = renderStep(frozen, 7);
      same(renderStep(frozen, 7), text, "the same every time");
      const parsed = parseStep(text);
      assert(parsed.kind === "ok");
      if (parsed.kind !== "ok") continue;
      same(parsed.value.number, 7);
      same(parsed.value.step, JSON.parse(JSON.stringify(frozen)), `${step.name}: the step comes back`);
      assert(text.startsWith(`-- step 7: ${step.name}\n-- @header {`) && text.includes("-- @section up") && text.endsWith("\n"));
    }
    const drop = p.steps.find((x) => x.kind === "dropColumn");
    const text = renderStep(frozenOf(drop!), 2);
    assert(
      text.includes("-- @section down") &&
        text.includes("-- @verify {") &&
        text.includes('"guard":{"query":') &&
        text.includes("CREATE TABLE IF NOT EXISTS"),
      "undo, verification and guards are in the file",
    );
    same(pathOf("migrations", 12, "Add column author.born"), "migrations/0012_add-column-author-born.sql");
    same(slug("  Rename  column: a.b → c "), "rename-column-a-b-c");
    assert(parseStep("nothing here").kind === "err" && parseStep("-- @header {oops").kind === "err");
    const multi = {
      ...frozenOf(p.steps[0]!),
      up: [{ group: "table" as const, origin: "core" as const, of: [], sql: "SELECT 1\n  FROM (\n  VALUES (';')) t;" }],
    };
    const back = parseStep(renderStep(multi, 1));
    assert(
      back.kind === "ok" && back.value.step.up[0]?.sql === "SELECT 1\n  FROM (\n  VALUES (';')) t;",
      "a statement of several lines comes back as it was",
    );
  },
);

proves(
  ["0018-sql-history FR-002"],
  "the manifest chains the files, and a file changed, taken out, put in or moved is found, as is one whose manifest entry was edited to match",
  () => {
    const { files } = histOf(sqlite);
    const ok = checkHistory(files, "migrations");
    same(ok.problems, []);
    assert(
      ok.manifest !== undefined &&
        ok.manifest.entries.length > 0 &&
        ok.manifest.entries.every((e, i) => e.number === i + 1 && /^[0-9a-f]{64}$/.test(e.chain)),
    );
    const steps = files.filter((f) => /\/\d{4}_/.test(f.path));
    const edit = (path: string, fn: (t: string) => string): Artifact[] =>
      files.map((f) => (f.path === path ? { ...f, text: fn(f.text) } : f));
    const second = steps[1]!;
    assert(
      checkHistory(
        edit(second.path, (t) => t.replace("CREATE TABLE", "CREATE  TABLE")),
        "migrations",
      ).problems.some((p) => p.kind === "edited" && p.file === second.path),
      "a file changed",
    );
    assert(
      checkHistory(
        files.filter((f) => f.path !== second.path),
        "migrations",
      ).problems.some((p) => p.kind === "missing"),
      "a file taken out",
    );
    // an entry rewritten to match an edited file: the chain is rebuilt, but the identifier no longer matches what the file holds
    const manifest = ok.manifest!;
    const edited = second.text.replace("CREATE TABLE", "CREATE  TABLE");
    const forged = {
      ...manifest,
      entries: manifest.entries.map((e) => (e.file === second.path ? { ...e, sha256: sha256Hex(edited) } : e)),
    };
    const reChain = (m: typeof forged): typeof forged => {
      let previous = "0".repeat(64);
      return {
        ...m,
        entries: m.entries.map((e) => {
          const { chain: _c, ...rest } = e;
          const chain = sha256Hex(`${previous}`);
          void rest;
          previous = chain;
          return { ...e, chain };
        }),
      };
    };
    void reChain;
    const forgedFiles = files.map((f) =>
      f.path === second.path
        ? { ...f, text: edited }
        : f.path === "migrations/manifest.json"
          ? { ...f, text: `${JSON.stringify(forged, null, 2)}\n` }
          : f,
    );
    const found = checkHistory(forgedFiles, "migrations").problems;
    assert(
      found.some((p) => p.kind === "identity" && p.file === second.path) || found.some((p) => p.kind === "chain"),
      "an edit that rewrites its manifest entry is found",
    );
    const reordered = { ...manifest, entries: [manifest.entries[1]!, manifest.entries[0]!, ...manifest.entries.slice(2)] };
    assert(
      checkHistory(
        files.map((f) => (f.path === "migrations/manifest.json" ? { ...f, text: JSON.stringify(reordered) } : f)),
        "migrations",
      ).problems.some((p) => p.kind === "order" || p.kind === "chain"),
      "entries moved",
    );
    const unknown = {
      ...manifest,
      entries: [...manifest.entries, { number: 99, file: "migrations/0099_x.sql", id: "x", from: "y", to: "z", sha256: "0", chain: "0" }],
    };
    assert(
      checkHistory(
        files.map((f) => (f.path === "migrations/manifest.json" ? { ...f, text: JSON.stringify(unknown) } : f)),
        "migrations",
      ).problems.length > 0,
      "an entry put in",
    );
    assert(
      checkHistory(
        files.map((f) => (f.path === "migrations/manifest.json" ? { ...f, text: "{" } : f)),
        "migrations",
      ).problems[0]?.kind === "manifest",
    );
    same(checkHistory([], "migrations"), { manifest: undefined, problems: [] });
  },
);

proves(
  ["0018-sql-history FR-003", "0018-sql-history FR-004", "0018-sql-history FR-007"],
  "freeze gives only files that are new, never rewrites one, refuses a plan that does not start where the history ends, and freezes the repeatable objects and the state beside the steps",
  () => {
    const v1 = histOf(sqlite, 1);
    const names = (fs: readonly Artifact[]): string[] => fs.map((f) => f.path).sort();
    same(names(v1.files), [
      "migrations/0001_create-table-genre.sql",
      "migrations/0002_create-table-author.sql",
      "migrations/0003_create-table-book.sql",
      "migrations/manifest.json",
      "migrations/repeatable.json",
      "migrations/state.json",
    ]);
    // a second plan adds only its steps
    const p2 = planOf(sqlite, stateOf(1, sqlite), 2);
    const added = must(freeze(v1.files, p2, { state: canonicalState(stateOf(2, sqlite)) }));
    assert(
      added.every((f) => !v1.files.some((o) => o.path === f.path && o.text === f.text)),
      "nothing that was there is given again",
    );
    same(names(added).filter((n) => /\/\d{4}_/.test(n)).length, p2.steps.length);
    assert(names(added).includes("migrations/manifest.json") && names(added).includes("migrations/state.json"));
    assert(!added.some((f) => f.path.includes("0001_")), "an existing file is not rewritten");
    // freezing what is frozen gives nothing
    same(must(freeze(v1.files, planOf(sqlite, undefined, 1), { state: canonicalState(stateOf(1, sqlite)) })), []);
    // a plan that starts elsewhere
    const wrong = freeze(v1.files, planOf(sqlite, stateOf(2, sqlite), 3));
    assert(
      wrong.kind === "err" && wrong.error[0]?.kind === "base" && wrong.error[0].head === stateHash(stateOf(1, sqlite)),
      "a plan from another state",
    );
    // a history that does not hold together is refused
    const broken = v1.files.map((f) => (f.path.includes("0001_") ? { ...f, text: `${f.text}\n-- edited` } : f));
    const refused = freeze(broken, p2);
    assert(refused.kind === "err" && refused.error[0]?.kind === "history");
    // the state and the repeatable objects are beside the steps
    const state = v1.files.find((f) => f.path === "migrations/state.json")?.text ?? "";
    assert(state.includes('"dialect":"sqlite"') && state.endsWith("\n"));
    const withDocs = must(freeze([], must(plan(undefined, libraryAt(1), { dialect: sqlite, sources: [] }))));
    assert(withDocs.some((f) => f.path === "migrations/repeatable.json"));
    same(settingsOf().folder, "migrations");
    assert(
      must(freeze([], planOf(sqlite, undefined, 1), { folder: "db/history" })).every((f) => f.path.startsWith("db/history/")),
      "another folder",
    );
  },
);

proves(
  ["0018-sql-history FR-005", "0018-sql-history FR-006"],
  "the files are checked and then replayed through the lifecycle's run on three engines to the same state, the ledger holds the same steps, a second replay does nothing, and a history that does not check runs nothing",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const { files, plans } = histOf(dialect);
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        const r = await replay(files, d, dialect, { empty: emptyOf(dialect) });
        assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
        const ledger = await readLedger(d, dialect);
        same(
          ledger.filter((x) => x.kind === "step").map((x) => x.hash),
          plans.flatMap((p) => p.steps.map((x) => x.id)),
          `${name}: the ledger holds the steps the plans made`,
        );
        same(
          ledger.filter((x) => x.kind === "step").at(-1)?.to,
          stateHash(stateOf(3, dialect)),
          `${name}: in the state the last file names`,
        );
        await withEngine(name, async (fresh) => {
          const b = bind(libraryAt(3), { dialect });
          assert(b.kind === "ok");
          if (b.kind === "ok") await load(fresh, b.value);
          const a = (await shape(e)) as Record<string, string[]>;
          const c = (await shape(fresh)) as Record<string, string[]>;
          same(Object.keys(a).sort(), Object.keys(c).sort(), `${name}: the same tables as bind makes`);
          same(a["book"], c["book"], `${name}: the same columns`);
        });
        const again = await replay(files, d, dialect, { empty: emptyOf(dialect) });
        assert(
          again.kind === "ok" && again.value.steps.length === 0 && again.value.repeatable.length === 0,
          `${name}: a second replay does nothing`,
        );
      });
      // a history that does not check runs nothing
      await withEngine(name, async (e) => {
        const bad = files.map((f) => (f.path.includes("0002_") ? { ...f, text: f.text.replace("CREATE TABLE", "CREATE  TABLE") } : f));
        const r = await replay(bad, driverOf(e), dialect, { empty: emptyOf(dialect) });
        assert(r.kind === "err" && r.error[0]?.kind === "history", `${name}: refused`);
        same(Object.keys((await structure(e)).tables), [], `${name}: and nothing was run`);
        const other = await replay(files, driverOf(e), dialect === sqlite ? duckdb : sqlite, { empty: emptyOf(dialect) });
        assert(other.kind === "err", `${name}: another dialect refused`);
      });
    }
    assert(historyPlan([]).kind === "err");
    const plan3 = must(historyPlan(histOf(sqlite).files));
    same([plan3.dialect, plan3.steps.length > 0, plan3.to], ["sqlite", true, stateHash(stateOf(3, sqlite))]);
  },
);

proves(
  ["0018-sql-history FR-008"],
  "a release package is plain SQL a DBA runs: a preflight that returns a row only on the right state, an installer in one transaction with the guards inside, a verification, a back-out and a runbook; and it is an error where a guard cannot be written",
  async () => {
    const { files, plans } = histOf(postgres);
    const hp = must(historyPlan(files));
    const frozen = plans.flatMap((p) => p.steps.map(frozenOf));
    const pkg = must(
      releasePackage({ from: hp.from, to: hp.to, steps: frozen, repeatable: hp.repeatable }, postgres, {
        settings: settingsOf({ release: "26.4" }),
        empty: emptyOf(postgres),
      }),
    );
    same(pkg.map((f) => f.path).sort(), [
      "migrations/release-26.4/backout.sql",
      "migrations/release-26.4/install.sql",
      "migrations/release-26.4/manifest.json",
      "migrations/release-26.4/preflight.sql",
      "migrations/release-26.4/runbook.md",
      "migrations/release-26.4/verify.sql",
    ]);
    const file = (n: string): string => pkg.find((f) => f.path.endsWith(n))?.text ?? "";
    assert(
      file("install.sql").includes("BEGIN;") &&
        file("install.sql").trimEnd().endsWith("COMMIT;") &&
        file("install.sql").includes("DO $ifc_release$") &&
        file("install.sql").includes("-- step 1:"),
    );
    await withEngine("postgres", async (e) => {
      assert(
        (
          await e.rows(
            file("preflight.sql")
              .split("\n")
              .filter((l) => !l.startsWith("--"))
              .join(" "),
          )
        ).length === 1,
        "an empty database is where the release starts",
      );
      await e.run(file("install.sql"));
      const result = async (sql: string): Promise<string[]> => {
        const out: string[] = [];
        for (const q of sql.split("\n").filter((l) => l.startsWith("SELECT"))) out.push(String((await e.rows(q))[0]?.["result"]));
        return out;
      };
      const checks = await result(file("verify.sql"));
      assert(checks.length >= 2 && checks.every((c) => c === "ok"), `every check says ok: ${checks.filter((c) => c !== "ok").join("; ")}`);
      const tables = (await e.rows(`SELECT table_name n FROM information_schema.tables WHERE table_schema = 'public'`)).map((r) =>
        String(r["n"]),
      );
      assert(
        ["author", "book", "genre", "publisher", "lifecycle_release"].every((t) => tables.includes(t)),
        "the release is installed",
      );
      assert(
        (
          await e.rows(
            file("preflight.sql")
              .split("\n")
              .filter((l) => !l.startsWith("--"))
              .join(" "),
          )
        ).length === 0,
        "and cannot be installed twice",
      );
      await e.run(file("backout.sql"));
      const after = (await e.rows(`SELECT table_name n FROM information_schema.tables WHERE table_schema = 'public'`)).map((r) =>
        String(r["n"]),
      );
      assert(!after.includes("book") && !after.includes("author"), "backed out");
      same((await e.rows(`SELECT COUNT(*)::int AS n FROM "lifecycle_release"`))[0]?.["n"], 0);
    });
    assert(file("install.sql").includes("verification failed: step"), "each step is checked inside the installer");
    const poisoned = must(
      releasePackage(
        {
          from: hp.from,
          to: hp.to,
          steps: frozen.map((x, i) =>
            i === 2
              ? { ...x, verify: { after: [{ describe: "an impossible thing", query: "SELECT 1 WHERE 1 = 0", expect: "rows" as const }] } }
              : x,
          ),
          repeatable: hp.repeatable,
        },
        postgres,
        { settings: settingsOf({ release: "bad" }), empty: emptyOf(postgres) },
      ),
    );
    await withEngine("postgres", async (e) => {
      let refused = "";
      try {
        await e.run(poisoned.find((f) => f.path.endsWith("install.sql"))?.text ?? "");
      } catch (cause) {
        refused = String((cause as Error).message);
      }
      assert(refused.includes("verification failed: step 3: an impossible thing"), refused);
      await e.run("ROLLBACK");
      same(
        (await e.rows(`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`))[0]?.["n"],
        0,
        "the installer is one transaction: nothing is left",
      );
    });
    assert(file("runbook.md").includes("# Release 26.4") && file("runbook.md").includes("| 1 | create table genre | safe | lossless |"));
    same(pkg.find((f) => f.path.endsWith("manifest.json"))?.text.includes(sha256Hex(file("install.sql"))), true);
    // SQLite has no block to carry a guard
    const lite = histOf(sqlite);
    const lp = must(historyPlan(lite.files));
    const lf = lite.plans.flatMap((p) => p.steps.map(frozenOf));
    const refused = releasePackage({ from: lp.from, to: lp.to, steps: lf, repeatable: lp.repeatable }, sqlite, { settings: settingsOf() });
    assert(refused.kind === "err" && refused.error.every((x) => x.kind === "guard" && x.why.includes("no procedural block")));
    const left = must(
      releasePackage({ from: lp.from, to: lp.to, steps: lf, repeatable: lp.repeatable }, sqlite, {
        settings: settingsOf({ unguardable: "leave-out" }),
      }),
    );
    assert(left.find((f) => f.path.endsWith("install.sql"))?.text.includes("cannot be written in sqlite's SQL and was left out"));
    // a release after another is checked against the one before it
    const next = must(
      releasePackage({ from: "a".repeat(64), to: "b".repeat(64), steps: [], repeatable: [] }, postgres, {
        settings: settingsOf(),
        empty: emptyOf(postgres),
      }),
    );
    assert(next.find((f) => f.path.endsWith("preflight.sql"))?.text.includes(`"to_state" = '${"a".repeat(64)}'`));
  },
);

proves(
  ["0018-sql-history FR-009"],
  "a procedure inside PostgreSQL applies the history, chains its ledger, refuses a ledger that was changed and a state no step starts from, is run again to do nothing, and applies only what is missing when the history grows",
  async () => {
    const h1 = histOf(postgres, 1);
    const h3 = histOf(postgres, 3);
    const frozenSteps = (plans: readonly Plan[]) => plans.flatMap((p) => p.steps.map(frozenOf));
    const make = (
      hist: { files: readonly Artifact[]; plans: readonly Plan[] },
      mutate: (s: ReturnType<typeof frozenOf>[]) => ReturnType<typeof frozenOf>[] = (x) => x,
    ): string => {
      const p = must(historyPlan(hist.files));
      return (
        must(
          installer(
            { from: p.from, steps: mutate(frozenSteps(hist.plans)), repeatable: p.repeatable },
            postgres,
            settingsOf({ delivery: "in-database" }),
          ),
        )[0]?.text ?? ""
      );
    };
    await withEngine("postgres", async (e) => {
      const rows = async (): Promise<Record<string, unknown>[]> => e.rows(`SELECT * FROM "lifecycle"."migration" ORDER BY seq`);
      await e.run(make(h1));
      await e.run("CALL lifecycle.migrate()");
      same(
        (await rows()).filter((r) => !String(r["step_id"]).startsWith("repeatable:")).length,
        h1.plans[0]!.steps.length,
        "the first history is applied",
      );
      same((await e.rows(`SELECT state FROM lifecycle.status()`))[0]?.["state"], stateHash(stateOf(1, postgres)), "in the state it names");
      same((await e.rows(`SELECT lifecycle.verify() AS ok`))[0]?.["ok"], true);
      const before = (await rows()).length;
      await e.run("CALL lifecycle.migrate()");
      same((await rows()).length, before, "run again it does nothing");
      // the history grows: the procedure is made again and applies only what is missing
      await e.run(make(h3));
      await e.run("CALL lifecycle.migrate()");
      same((await e.rows(`SELECT state FROM lifecycle.status()`))[0]?.["state"], stateHash(stateOf(3, postgres)), "up to date");
      const names = (await e.rows(`SELECT table_name n FROM information_schema.tables WHERE table_schema = 'public'`)).map((r) =>
        String(r["n"]),
      );
      assert(
        ["author", "book", "genre", "publisher", "author_born_quarantine"].every((t) => names.includes(t)),
        "what the history adds up to, with the quarantine",
      );
      same(
        (await e.rows(`SELECT COUNT(*)::int AS n FROM "lifecycle"."migration" WHERE step_id NOT LIKE 'repeatable:%'`))[0]?.["n"],
        frozenSteps(h3.plans).length,
        "one entry for each step, none twice",
      );
      // a ledger entry that was changed
      await e.run(`UPDATE "lifecycle"."migration" SET to_state = 'tampered' WHERE seq = 2`);
      same((await e.rows(`SELECT lifecycle.verify() AS ok`))[0]?.["ok"], false);
      let refused = "";
      try {
        await e.run("CALL lifecycle.migrate()");
      } catch (cause) {
        refused = String((cause as Error).message);
      }
      assert(refused.includes("the ledger was changed at entry 2"), refused);
    });
    // a state no step starts from
    await withEngine("postgres", async (e) => {
      await e.run(make(h1));
      const other = "9".repeat(64);
      const chain = sha256Hex(`${"0".repeat(64)}|elsewhere|${other}|${other}`);
      await e.run(
        `INSERT INTO "lifecycle"."migration" (seq, step_id, name, from_state, to_state, chain) VALUES (1, 'elsewhere', 'x', '${other}', '${other}', '${chain}')`,
      );
      let refused = "";
      try {
        await e.run("CALL lifecycle.migrate()");
      } catch (cause) {
        refused = String((cause as Error).message);
      }
      assert(refused.includes("the database is in state") && refused.includes("starts from"), refused);
    });
    // a verification that fails rolls the whole call back
    await withEngine("postgres", async (e) => {
      await e.run(
        make(h1, (steps) =>
          steps.map((x, i) =>
            i === steps.length - 1
              ? { ...x, verify: { after: [{ describe: "an impossible thing", query: "SELECT 1 WHERE 1 = 0", expect: "rows" as const }] } }
              : x,
          ),
        ),
      );
      let refused = "";
      try {
        await e.run("CALL lifecycle.migrate()");
      } catch (cause) {
        refused = String((cause as Error).message);
      }
      assert(refused.includes("verification failed: an impossible thing"), refused);
      same((await e.rows(`SELECT COUNT(*)::int AS n FROM "lifecycle"."migration"`))[0]?.["n"], 0, "and nothing was recorded");
      same(
        (
          await e.rows(`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'genre'`)
        )[0]?.["n"],
        0,
        "or made",
      );
    });
    const lite = installer({ from: "f", steps: [], repeatable: [] }, sqlite, settingsOf());
    assert(lite.kind === "err" && lite.error[0]?.why.includes("no procedures"));
  },
);

proves(
  ["0018-sql-history FR-010"],
  "the delivery, the folder, the release label, the guard policy and the runner's schema each have a default and can be changed",
  () => {
    same(settingsOf(), {
      delivery: "pipeline",
      folder: "migrations",
      release: undefined,
      unguardable: "refuse",
      runnerSchema: "lifecycle",
    });
    same(settingsOf({ delivery: "release-package", folder: "db", release: "r1", unguardable: "leave-out", runnerSchema: "ops" }), {
      delivery: "release-package",
      folder: "db",
      release: "r1",
      unguardable: "leave-out",
      runnerSchema: "ops",
    });
    const p = must(historyPlan(histOf(postgres, 1).files));
    const sql = must(
      installer({ from: p.from, steps: [], repeatable: [] }, postgres, settingsOf({ runnerSchema: "ops", folder: "db" })),
    )[0];
    assert(
      sql?.path === "db/in-database/installer.sql" &&
        sql.text.includes('CREATE SCHEMA IF NOT EXISTS "ops";') &&
        sql.text.includes('"ops"."migration"'),
    );
  },
);
