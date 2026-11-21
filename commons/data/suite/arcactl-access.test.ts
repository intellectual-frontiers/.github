// Spec: 0046-arcactl FR-012, FR-013, 0051-project-cli FR-004, 0051-project-cli FR-006
/**
 * What `arcactl` does for row security (commons data 0046-arcactl FR-012, FR-013; 0051-project-cli FR-006): `sql` writes the grants, the policies, the protected layer and the seal that its flags ask for, with the key from
 * the environment and never from an argument; `scope` prints the statement that sets a sealed scope for one tenant, a list, a tenant and those beneath it, or every tenant, and refuses what is not a scope; and `doctor` holds a
 * project's own module as it holds the arca models. On PGlite, the PostgreSQL that runs in process.
 *
 * @module
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/test";
import { type Connection, main, type Io, projectCommandOf } from "./arcactl-access-fixture.ts";
import { openEngine } from "./engines-fixture.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "uat-seal-key-0123456789abcdef";
const env = { ARCA_SEAL_KEY: KEY, ARCA_UNLOCK_SECRET: "unlock" };
const io = (over: Partial<Io> = {}): Io => ({ env, cwd: DATA, ...over });
const sql = (...flags: string[]) => projectCommandOf("sql", ["--module", "suite/arcactl-access-model.ts", ...flags], io());

proves(["0051-project-cli FR-006"], "sql writes the grants and policies, the protected layer, the reach and the seal that its flags ask for, and refuses a seal with no key, a key given as an argument, a reach with no access, and a dialect that has no row security", async () => {
  const plain = await sql("--schema", "data");
  assert(plain.code === 0 && !plain.out.includes("CREATE POLICY"), "without a flag it writes what it always wrote");
  const access = await sql("--schema", "data", "--access");
  assert(access.code === 0 && access.out.includes('GRANT SELECT ON "data"."customer_account"') && access.out.includes("CREATE POLICY") && !access.out.includes("ifc_seal"), "--access: grants and policies");
  const full = await sql("--schema", "data", "--protect", "crm_owner", "--seal", "--reach", "set", "--wildcard");
  assert(full.code === 0 && full.out.includes('CREATE VIEW "api"."customer_account"') || full.out.includes('"api"."customer_account"'), "--protect: views in api");
  assert(full.out.includes("ifc_seal.scope('tenant')") && full.out.includes("string_to_array") && full.out.includes("= '*'") && full.out.includes('OWNER TO "crm_owner"'), "seal, reach and wildcard, owned by the role");
  assert(full.out.includes(KEY), "the key is in the statements, since the database holds it; that is why they are piped and not stored");
  assert(!full.err.includes(KEY), "and never in what is said about them");
  const noKey = await projectCommandOf("sql", ["--module", "suite/arcactl-access-model.ts", "--seal"], { cwd: DATA, env: {} });
  assert(noKey.code === 2 && noKey.err.includes("ARCA_SEAL_KEY"), "no key: refused");
  const short = await projectCommandOf("sql", ["--module", "suite/arcactl-access-model.ts", "--seal"], { cwd: DATA, env: { ARCA_SEAL_KEY: "short" } });
  assert(short.code === 2 && short.err.includes("16"), "a short key: refused");
  for (const bad of [["--reach", "set"], ["--wildcard"], ["--access", "--reach", "everything"], ["--access", "--wildcard"], ["--protect", "Not A Role"], ["--access", "--dialect", "sqlite"]]) {
    const r = await sql(...bad);
    assert(r.code === 2 && !r.out.includes(KEY), `refused: ${bad.join(" ")}`);
  }
  const arg = await sql("--seal", `--key=${KEY}`);
  assert(!arg.out.includes("--key") && arg.code === 0 && arg.out.includes("ifc_seal"), "there is no key argument: the key is the environment's");
});

const rows = (tenants: readonly string[]): NonNullable<Io["connect"]> => async (): Promise<Connection> => ({
  kind: "custom",
  driver: { exec: async () => {}, query: async () => tenants.map((t) => ({ tenant_id: t })) },
  close: async () => {},
});

proves(["0046-arcactl FR-012"], "scope prints the statement that sets a sealed scope for a tenant, a list, a tenant and those beneath it, or every tenant, for the session or the transaction, and refuses what is not a scope", async () => {
  const one = await main(["scope", "--tenant", "acme"], io());
  assert(one.code === 0 && /^SELECT set_config\('app\.tenant', 'acme\.[0-9a-f]{64}', false\);\n$/.test(one.out), one.out);
  assert(!one.out.includes(KEY) && !one.err.includes(KEY), "the statement holds a mark, never the key");
  const list = await main(["scope", "--tenant", "acme,initech", "--local", "--name", "tenant", "--prefix", "myapp"], io());
  assert(list.code === 0 && list.out.startsWith("SELECT set_config('myapp.tenant', 'acme,initech.") && list.out.includes(", true);"), list.out);
  const all = await main(["scope", "--all", "--json"], io());
  const j = JSON.parse(all.out) as { reaches: unknown; statement: string };
  assert(all.code === 0 && j.reaches === "*" && j.statement.includes("'*."), "the wildcard");
  const under = await main(["scope", "--subtree", "northwind", "--schema", "data"], io({ connect: rows(["acme", "initech", "northwind"]) }));
  assert(under.code === 0 && under.out.includes("'acme,initech,northwind.") && under.err.includes("3 tenants"), under.out + under.err);
  const none = await main(["scope", "--subtree", "nobody"], io({ connect: rows([]) }));
  assert(none.code === 1 && none.err.includes("no tenant nobody"), "an unknown tenant");
  const noKey = await main(["scope", "--tenant", "acme"], io({ env: {} }));
  assert(noKey.code === 2 && noKey.err.includes("ARCA_SEAL_KEY"), "no key");
  for (const bad of [[], ["--tenant", "a", "--all"], ["--tenant", "a,*"], ["--tenant", ",,"], ["--tenant", "acme", "--name", "Tenant"], ["--tenant", "acme", "--prefix", "a-b"]]) {
    const r = await main(["scope", ...bad], io());
    assert(r.code === 2 && r.out === "", `refused: ${bad.join(" ")}`);
  }
  const help = await main(["--help"], io());
  assert(help.out.includes("arcactl scope") && help.out.includes("--protect") && help.out.includes("--reach"), "the usage says so");
});

proves(["0046-arcactl FR-013"], "doctor holds a project's own module as it holds the arca models: sound with the seal in place, and a fault planted in row security is found", async () => {
  const made = await sql("--schema", "data", "--protect", "crm_owner", "--seal", "--reach", "set", "--wildcard");
  const e = await openEngine("postgres");
  try {
    await e.run("CREATE ROLE crm_owner; CREATE ROLE crm_reader; CREATE ROLE crm_writer; CREATE ROLE crm_support;");
    await e.run(made.out);
    const connect: Io["connect"] = async () => ({ kind: "custom", driver: { exec: (q) => e.run(q), query: (q) => e.rows(q) }, close: async () => {} });
    const check = (...extra: string[]) => main(["doctor", "--module", "suite/arcactl-access-model.ts", "--schema", "data", "--seal", ...extra], io({ connect }));
    const sound = await check();
    assert(sound.out.includes("PASS  ARCA-D002") && sound.out.includes("all 17 tables of the project's models") && sound.out.includes("PASS  ARCA-D003") && sound.out.includes("PASS  ARCA-D007") && sound.out.includes("4 scoped tables"), sound.out);
    assert(!sound.out.includes("FAIL"), "nothing fails");
    // a change of a table is refused twice over (the protected layer wants a migration, the seal wants its secret): the person who plants the fault says both
    await e.run(`SELECT set_config('ifc.ddl_unlock', 'unlock', false), set_config('lifecycle.migrating', 'on', false)`);
    await e.run(`ALTER TABLE "data"."contact" NO FORCE ROW LEVEL SECURITY`);
    const broken = await check();
    assert(broken.code === 1 && broken.out.includes("FAIL  ARCA-D007") && broken.out.includes("row security is not forced on contact"), broken.out);
    const both = await main(["doctor", "--module", "suite/arcactl-access-model.ts", "--models", "identityAgent"], io({ connect }));
    assert(both.code === 2 && both.err.includes("not both"), "a module and models: refused");
  } finally {
    await e.close();
  }
}, { timeout: 60_000 });

proves(["0051-project-cli FR-004"], "a generator is named by its id or by the short name the usage gives, for a module of the project's own", async () => {
  const names = ["dictionary", "mermaid", "d2", "rust", "zod", "register", "html"];
  for (const n of names) {
    const short = await projectCommandOf("generate", [n, "--module", "suite/arcactl-access-model.ts"], io());
    const id = await projectCommandOf("generate", [`sql.generate.${n === "mermaid" ? "erd-mermaid" : n === "d2" ? "erd-d2" : n}`, "--module", "suite/arcactl-access-model.ts"], io());
    assert(short.code === 0 && short.out.length > 0 && short.out === id.out, `${n}: the short name and the id say the same`);
  }
  const dictionary = await projectCommandOf("generate", ["dictionary", "--module", "suite/arcactl-access-model.ts"], io());
  assert(dictionary.out.includes("customer_account") && dictionary.out.includes("tenant_id"), "the project's own tables");
  const none = await projectCommandOf("generate", ["nothing", "--module", "suite/arcactl-access-model.ts"], io());
  assert(none.code === 2 && none.err.includes("generate what"), "a name that is not one");
});
