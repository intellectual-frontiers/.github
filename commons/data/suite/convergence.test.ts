// Spec: 0019-sql-convergence FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012
/**
 * The convergence strategy (commons data 0019-sql-convergence), on real engines: a database made outside the lifecycle is read as the state of its version, drift made by hand is found, a reviewed
 * proposal is applied only if approved and not stale, autonomous convergence applies what only adds and holds the rest, and the version gate says where a database is.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { annotate, attribute, boolean, concept, domain, identifier, integer, text, vocabularies } from "@intellectual-frontiers/data/governance";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import {
  applyProposal,
  connect,
  defaultPolicy,
  desiredState,
  normalizeType,
  propose,
  proposalText,
  readState,
  renderProposal,
  sameType,
  settingsOf,
  spell,
  versionGate,
} from "@intellectual-frontiers/data/sql/extensions/convergence";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import { safety } from "@intellectual-frontiers/data/sql/extensions/safety";
import { type Driver, readLedger, sha256Hex, stateHash, type StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const s = safety();
const transforms: readonly StepTransform[] = [...s.transforms, idempotency()];
/** A database made by `bind` for a version, outside the lifecycle. */
const dbAt = async (name: Engine["name"], d: Dialect, v: 1 | 2 | 3): Promise<Engine> => {
  const e = await openEngine(name);
  const b = bind(libraryAt(v), { dialect: d });
  assert(b.kind === "ok");
  if (b.kind === "ok") await load(e, b.value);
  return e;
};
const wantedAt = (d: Dialect, v: 1 | 2 | 3) =>
  must({ kind: "ok" as const, value: desiredState(libraryAt(v), { dialect: d }) as NonNullable<ReturnType<typeof desiredState>> });
const names = async (e: Engine): Promise<string[]> =>
  (e.name === "postgres"
    ? await e.rows("SELECT table_name n FROM information_schema.tables WHERE table_schema = 'public'")
    : e.name === "duckdb"
      ? await e.rows("SELECT table_name n FROM duckdb_tables()")
      : await e.rows("SELECT name n FROM sqlite_master WHERE type = 'table'")
  )
    .map((r) => String(r["n"]))
    .sort();

proves(["0019-sql-convergence FR-001"], "each dialect reads its own catalog into a neutral value and says what it compares", async () => {
  for (const { name, dialect } of DIALECTS) {
    assert(
      dialect.catalog !== undefined && dialect.catalog.compares.includes("tables") && dialect.catalog.compares.includes("primary keys"),
      name,
    );
    const e = await dbAt(name, dialect, 2);
    try {
      const tables = await dialect.catalog!.read((q) => e.rows(q));
      same(tables.map((t) => t.name).sort(), ["author", "book", "genre", "publisher"], `${name}: the tables`);
      const author = tables.find((t) => t.name === "author");
      same(author?.columns.map((c) => c.name).sort(), ["born", "id", "name"]);
      same(author?.primaryKey, ["id"]);
      assert(
        author?.columns.find((c) => c.name === "id")?.nullable === false &&
          author.columns.find((c) => c.name === "born")?.nullable === true,
        `${name}: nullability`,
      );
      same(author?.constraints === undefined, name !== "postgres", `${name}: constraints listed only where the dialect can`);
      if (name === "postgres")
        assert(tables.find((t) => t.name === "book")?.constraints?.some((c) => c.name === "book_author_id_fk" && c.kind === "foreignKey"));
    } finally {
      await e.close();
    }
  }
  assert(
    postgres.catalog?.compares.some((c) => c.includes("foreign keys")) && !duckdb.catalog?.compares.some((c) => c.includes("foreign keys")),
  );
  assert(sqlite.catalog !== undefined);
});

proves(
  ["0019-sql-convergence FR-002"],
  "the state of a database made from a schema has the hash of the desired state, with types read under another name found the same, and the words of a table found with the schema's taken off",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      for (const v of [1, 2, 3] as const) {
        const e = await dbAt(name, dialect, v);
        try {
          const live = must(await readState(driverOf(e), dialect, wantedAt(dialect, v)));
          same(stateHash(live), stateHash(wantedAt(dialect, v)), `${name} v${v}: the same state`);
        } finally {
          await e.close();
        }
      }
    }
    assert(
      sameType("character varying(10)", "VARCHAR(10)") &&
        sameType("timestamp with time zone", "TIMESTAMPTZ") &&
        sameType("NUMERIC(8, 2)", "numeric(8,2)") &&
        sameType("int4", "INTEGER"),
    );
    assert(!sameType("TEXT", "INTEGER") && !sameType("VARCHAR(10)", "VARCHAR(11)"));
    same(normalizeType("Character  Varying ( 10 )"), "varchar(10)");
    same(
      [
        spell(postgres, "character varying(10)"),
        spell(postgres, "timestamp with time zone"),
        spell(postgres, "numeric(8,2)"),
        spell(duckdb, "FLOAT[3]"),
        spell(postgres, "mystery"),
      ],
      ["VARCHAR(10)", "TIMESTAMPTZ", "NUMERIC(8, 2)", "FLOAT[3]", "mystery"],
      "a type is spelled as the dialect writes it",
    );
    // a schema's words on a dialect that has no schemas
    const e = await openEngine("sqlite");
    try {
      const b = bind(libraryAt(2), { dialect: sqlite, schema: "data" });
      assert(b.kind === "ok");
      if (b.kind === "ok") await load(e, b.value);
      const wanted = must({ kind: "ok" as const, value: desiredState(libraryAt(2), { dialect: sqlite, schema: "data" })! });
      same(stateHash(must(await readState(driverOf(e), sqlite, wanted))), stateHash(wanted), "tables read as data_book are the table book");
    } finally {
      await e.close();
    }
    const unsupported = await readState(
      { exec: () => Promise.resolve(), query: () => Promise.resolve([]) },
      { ...sqlite, catalog: undefined } as unknown as Dialect,
      wantedAt(sqlite, 1),
    );
    assert(unsupported.kind === "err" && unsupported.error[0]?.why.includes("cannot read"));
  },
);

proves(
  ["0019-sql-convergence FR-003", "0019-sql-convergence FR-012"],
  "drift made by hand is a difference: a column added is a column to drop, a table missing is a table to make, a table made by hand is a table to drop, and what is not compared is not",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbAt(name, dialect, 2);
      try {
        const live = () => readState(driverOf(e), dialect, wantedAt(dialect, 2));
        same(stateHash(must(await live())), stateHash(wantedAt(dialect, 2)), `${name}: the same as it was made`);
        await e.run(`ALTER TABLE "author" ADD COLUMN "nickname" TEXT`);
        await e.run(`CREATE TABLE "scratch" ("id" TEXT NOT NULL PRIMARY KEY)`);
        await e.run(`DROP TABLE "publisher"`);
        assert(stateHash(must(await live())) !== stateHash(wantedAt(dialect, 2)), `${name}: drift is a difference`);
        const r = must(await propose(driverOf(e), libraryAt(2), { dialect }, { transforms }));
        const kinds = r.plan.steps.map((x) => `${x.kind}:${x.name}`);
        assert(
          kinds.includes("dropColumn:drop column author.nickname") &&
            kinds.includes("dropTable:drop table scratch") &&
            kinds.includes("createTable:create table publisher"),
          `${name}: ${kinds.join(", ")}`,
        );
        assert(r.plan.steps.find((x) => x.kind === "dropColumn")?.reversibility === "quarantine", `${name}: the drop is a quarantine`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0019-sql-convergence FR-004", "0019-sql-convergence FR-005"],
  "a proposal is the plan from the state read, pinned to it and to the state it ends in, empty between equal states, and refused as stale when the database moved",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbAt(name, dialect, 1);
      try {
        const r = must(await propose(driverOf(e), libraryAt(2), { dialect }, { transforms }));
        same(r.proposal.base, stateHash(wantedAt(dialect, 1)), `${name}: pinned to the state it was in`);
        same(r.proposal.to, stateHash(wantedAt(dialect, 2)), `${name}: and to the state it ends in`);
        assert(r.proposal.steps.length > 0 && r.proposal.steps.every((x, i) => x.number === i + 1 && x.up.length > 0));
        const equal = must(await propose(driverOf(e), libraryAt(1), { dialect }, { transforms }));
        same(equal.proposal.steps.length, 0, `${name}: none between equal states`);
        // the database moves after the proposal
        const text = proposalText(r.proposal);
        await e.run(`ALTER TABLE "genre" ADD COLUMN "extra" TEXT`);
        const stale = await applyProposal(text, sha256Hex(text), driverOf(e), dialect, wantedAt(dialect, 2));
        assert(
          stale.kind === "err" &&
            stale.error[0]?.kind === "stale" &&
            stale.error[0].pinned === r.proposal.base &&
            stale.error[0].found !== r.proposal.base,
          `${name}: stale`,
        );
        assert(!(await names(e)).includes("publisher"), `${name}: and nothing was applied`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0019-sql-convergence FR-006", "0019-sql-convergence FR-012"],
  "a reviewed proposal is text a person approves by its hash, the same every time; it is applied only if the text is the approved one, leaves the database as bind makes it, and a second apply finds nothing to do",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbAt(name, dialect, 1);
      try {
        const r = must(await propose(driverOf(e), libraryAt(2), { dialect }, { transforms }));
        const files = renderProposal(r.proposal, "library");
        same(renderProposal(r.proposal, "library"), files, `${name}: the same every time`);
        same(
          files.map((f) => f.path),
          [`convergence/library.${r.proposal.to.slice(0, 8)}.plan.json`, `convergence/library.${r.proposal.to.slice(0, 8)}.plan.md`],
        );
        const text = files[0]?.text ?? "";
        assert(files[1]?.text.includes("## 1.") && files[1].text.includes("```sql") && files[1].text.includes("Approve the hash"));
        const approved = sha256Hex(text);
        // text that is not what was approved
        const forged = text.replace("ADD COLUMN", "ADD  COLUMN");
        const refused = await applyProposal(forged, approved, driverOf(e), dialect, wantedAt(dialect, 2));
        assert(
          refused.kind === "err" && refused.error[0]?.kind === "unapproved" && refused.error[0].approved === approved,
          `${name}: text that was not approved`,
        );
        assert(!(await names(e)).includes("publisher"), `${name}: nothing was applied`);
        const done = await applyProposal(text, approved, driverOf(e), dialect, wantedAt(dialect, 2));
        assert(done.kind === "ok" && done.value.steps.length === r.proposal.steps.length, `${name}: ${JSON.stringify(done)}`);
        same(
          stateHash(must(await readState(driverOf(e), dialect, wantedAt(dialect, 2), { ignore: ["lifecycle_ledger"] }))),
          stateHash(wantedAt(dialect, 2)),
          `${name}: the database is as bind makes it`,
        );
        const again = await applyProposal(text, approved, driverOf(e), dialect, wantedAt(dialect, 2));
        assert(again.kind === "ok" && again.value.steps.length === 0, `${name}: a second apply does nothing`);
        same((await readLedger(driverOf(e), dialect)).filter((x) => x.kind === "step").length, r.proposal.steps.length);
        assert(applyProposalText(text) !== undefined);
      } finally {
        await e.close();
      }
    }
  },
);
const applyProposalText = (t: string): unknown => JSON.parse(t);

proves(
  ["0019-sql-convergence FR-007", "0019-sql-convergence FR-008", "0019-sql-convergence FR-011"],
  "autonomous convergence applies what only adds, holds a plan that renames or drops and changes nothing, holds everything when the policy is off, and says which steps it did not allow",
  async () => {
    const settings = settingsOf({ approval: "autonomous" });
    same(settings.policy, defaultPolicy);
    same([settings.approval, settings.ledgerTable, settings.ignore], ["autonomous", "lifecycle_ledger", ["lifecycle_ledger", "*quarantine", "*quarantined"]]);
    for (const { name, dialect } of DIALECTS) {
      const e = await dbAt(name, dialect, 1);
      try {
        const up = await connect(driverOf(e), dialect, libraryAt(2), { dialect }, settings, { transforms });
        assert(up.kind === "applied" && up.applied.steps.length > 0, `${name}: ${JSON.stringify(up)}`);
        same(
          stateHash(must(await readState(driverOf(e), dialect, wantedAt(dialect, 2), { ignore: ["lifecycle_ledger"] }))),
          stateHash(wantedAt(dialect, 2)),
          `${name}: it applied what adds`,
        );
        const again = await connect(driverOf(e), dialect, libraryAt(2), { dialect }, settings, { transforms });
        same(again.kind, "current", `${name}: the next access finds it current`);
        const before = await names(e);
        const held = await connect(driverOf(e), dialect, libraryAt(3), { dialect }, settings, { transforms });
        assert(
          held.kind === "held" &&
            held.why.some(
              (w) =>
                w.step === "rename column author.name to full_name" &&
                String(w.because).includes("renameColumn is not a kind the policy allows"),
            ) &&
            held.why.some((w) => w.step === "drop column author.born" && String(w.because).includes("data-dependent")),
          `${name}: ${JSON.stringify(held)}`,
        );
        same(await names(e), before, `${name}: and changed nothing`);
        assert(held.kind === "held" && held.plan !== undefined && held.plan.steps.length > 0, "the plan is held for a person");
        const off = await connect(
          driverOf(e),
          dialect,
          libraryAt(2),
          { dialect },
          settingsOf({ approval: "autonomous", policy: { enabled: false } }),
          { transforms },
        );
        assert(off.kind === "held" && off.why[0]?.because === "autonomous convergence is off", `${name}: off`);
        // a policy that allows more
        const wide = settingsOf({
          approval: "autonomous",
          policy: {
            classes: ["safe", "data-dependent"],
            reversibilities: ["lossless", "quarantine"],
            kinds: ["createTable", "addColumn", "addConstraint", "upsertRows", "renameColumn", "dropColumn"],
          },
        });
        const done = await connect(driverOf(e), dialect, libraryAt(3), { dialect }, wide, { transforms });
        assert(done.kind === "applied", `${name}: ${JSON.stringify(done)}`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0019-sql-convergence FR-007", "0019-sql-convergence FR-009"],
  "a step that fails leaves the database at the step before and the next access resumes, a lock is taken where the dialect has one, and a rehearsal that says no holds the plan",
  async () => {
    const settings = settingsOf({ approval: "autonomous" });
    await withEngine(
      "postgres",
      async (e) => {
        const log: string[] = [];
        const inner = driverOf(e);
        const spy: Driver = { exec: (sql) => (log.push(sql), inner.exec(sql)), query: inner.query };
        const up = await connect(spy, postgres, libraryAt(2), { dialect: postgres }, settings, { transforms });
        assert(up.kind === "applied");
        assert(
          log[0]?.startsWith("SELECT pg_advisory_lock(") && log[log.length - 1]?.startsWith("SELECT pg_advisory_unlock("),
          "one instance applies at a time",
        );
      },
      1,
    );
    for (const { name, dialect } of DIALECTS) {
      const e = await dbAt(name, dialect, 1);
      try {
        const poison: StepTransform = (d) =>
          d.kind === "createTable" && d.name.endsWith("publisher")
            ? { ...d, up: [...d.up, { group: "table", origin: "core", sql: "SELECT * FROM nowhere;", of: [] }] }
            : d;
        const failed = await connect(driverOf(e), dialect, libraryAt(2), { dialect }, settings, { transforms: [...transforms, poison] });
        assert(
          failed.kind === "failed" && failed.error.kind === "step" && failed.error.name === "create table publisher",
          `${name}: ${JSON.stringify(failed)}`,
        );
        assert(!(await names(e)).includes("publisher"), `${name}: the failed step left nothing`);
        const resumed = await connect(driverOf(e), dialect, libraryAt(2), { dialect }, settings, { transforms });
        assert(resumed.kind === "applied", `${name}: the next access resumes: ${JSON.stringify(resumed)}`);
        assert((await names(e)).includes("publisher"));
        same(
          stateHash(must(await readState(driverOf(e), dialect, wantedAt(dialect, 2), { ignore: ["lifecycle_ledger"] }))),
          stateHash(wantedAt(dialect, 2)),
        );
      } finally {
        await e.close();
      }
      const e2 = await dbAt(name, dialect, 1);
      try {
        const no = await connect(driverOf(e2), dialect, libraryAt(2), { dialect }, settings, {
          transforms,
          rehearse: () => Promise.resolve(false),
        });
        assert(
          no.kind === "held" && no.why[0]?.because === "the rehearsal said no" && !(await names(e2)).includes("publisher"),
          `${name}: a rehearsal that says no`,
        );
        let seen = 0;
        const yes = await connect(driverOf(e2), dialect, libraryAt(2), { dialect }, settings, {
          transforms,
          rehearse: (p) => ((seen = p.steps.length), Promise.resolve(true)),
        });
        assert(yes.kind === "applied" && seen > 0, `${name}: a rehearsal that says yes`);
      } finally {
        await e2.close();
      }
    }
  },
);
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>, v: 1 | 2 | 3 = 1): Promise<void> => {
  const d = DIALECTS.find((x) => x.name === name)!.dialect;
  const e = await dbAt(name, d, v);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};

proves(
  ["0019-sql-convergence FR-010"],
  "the version gate says whether a database is in the state an application expects, and names both states where it is not",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const ok = await versionGate(driverOf(e), dialect, wantedAt(dialect, 1));
        assert(ok.kind === "ok" && ok.value === stateHash(wantedAt(dialect, 1)), `${name}: where it is expected`);
        const behind = await versionGate(driverOf(e), dialect, wantedAt(dialect, 2));
        assert(
          behind.kind === "err" &&
            behind.error.kind === "state" &&
            behind.error.expected === stateHash(wantedAt(dialect, 2)) &&
            behind.error.found === stateHash(wantedAt(dialect, 1)),
          `${name}: behind`,
        );
      });
    }
  },
);

const settingConcept = concept("setting", {
  definition: "A named setting with defaults",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    mode: attribute(text(), { definition: "How it works", annotations: [annotate(vocabularies.quality.defaultValue, "open")] }),
    count: attribute(integer(), { definition: "How many", annotations: [annotate(vocabularies.quality.defaultValue, 5)] }),
    live: attribute(boolean(), { definition: "Whether it is on", annotations: [annotate(vocabularies.quality.defaultValue, true)] }),
  },
  identifiedBy: ["id"],
});
const settingsSchema = (() => {
  const d = domain("settings", { definition: "Settings", concepts: [settingConcept] });
  if (d.kind === "err") throw new Error(JSON.stringify(d.error));
  const p = projectDomain(d.value);
  if (p.kind === "err") throw new Error(JSON.stringify(p.error));
  return p.value.schema;
})();

proves(
  ["0019-sql-convergence FR-013"],
  "a default changed by hand is drift on the engines that can change one, and the defaults the model made are not drift on any engine",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await openEngine(name);
      try {
        const b = bind(settingsSchema, { dialect });
        assert(b.kind === "ok");
        if (b.kind === "ok") await load(e, b.value);
        const wanted = must({ kind: "ok" as const, value: desiredState(settingsSchema, { dialect }) as NonNullable<ReturnType<typeof desiredState>> });
        assert(wanted.tables[0]?.columns.some((c) => c.default !== undefined), "the model has defaults");
        same(stateHash(must(await readState(driverOf(e), dialect, wanted))), stateHash(wanted), `${name}: the defaults it made are the defaults it has`);
        if (name === "sqlite") continue;
        await e.run(`ALTER TABLE "setting" ALTER COLUMN "mode" SET DEFAULT 'closed'`);
        assert(stateHash(must(await readState(driverOf(e), dialect, wanted))) !== stateHash(wanted), `${name}: a changed default is drift`);
        const r = must(await propose(driverOf(e), settingsSchema, { dialect }, { transforms }));
        same(r.plan.steps.map((x) => x.kind), ["alterDefault"], `${name}: and is put right`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0019-sql-convergence FR-013"],
  "what a person made outside the model is held, not dropped, where the project says to hold it: a table, a column and an index are left alone and named, and the plan has no step for them",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbAt(name, dialect, 2);
      try {
        await e.run(`ALTER TABLE "author" ADD COLUMN "nickname" TEXT`);
        await e.run(`CREATE TABLE "scratch" ("id" TEXT NOT NULL PRIMARY KEY)`);
        await e.run(`CREATE INDEX "dba_author_nickname" ON "author" ("nickname")`);
        const dropped = must(await propose(driverOf(e), libraryAt(2), { dialect }, { transforms }));
        assert(dropped.plan.steps.some((x) => x.kind === "dropTable") && dropped.proposal.held === undefined, `${name}: dropped by default, with approval`);
        const held = must(await propose(driverOf(e), libraryAt(2), { dialect }, { transforms, ignore: settingsOf({ unmanaged: "hold" }).ignore }));
        same(held.plan.steps, [], `${name}: nothing to do`);
        same([...(held.proposal.held ?? [])].toSorted(), ["column author.nickname", "index author.dba_author_nickname", "table scratch"], `${name}: and what is held is said`);
        assert((await names(e)).includes("scratch"), `${name}: the table is still there`);
      } finally {
        await e.close();
      }
    }
  },
);
