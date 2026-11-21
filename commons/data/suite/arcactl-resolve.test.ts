// Spec: 0046-arcactl FR-014
/**
 * Where `arcactl` connects with no URL (commons data 0046-arcactl FR-014): as `psql` does, from libpq's variables, the service that `PGSERVICE` names in `pg_service.conf` and the password in `.pgpass`, so that what
 * `arcactl init` writes is what `arcactl doctor` uses; the service wins over the variables; and the password found in a file is in no error and no description of where it came from.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, proves } from "@intellectual-frontiers/test";
import { connect, resolveTarget, urlOfTarget } from "@intellectual-frontiers/data/sql/cli";

const home = async (files: Record<string, string>): Promise<string> => {
  const dir = await fs.makeTempDir({ prefix: "arcactl-resolve-" });
  for (const [name, text] of Object.entries(files)) await fs.writeTextFile(path.join(dir, name), text);
  return dir;
};

const SERVICE = "# >>> arcactl:services >>>\n[uat]\nhost=127.0.0.1\nport=5544\ndbname=arca_uat\nuser=postgres\n# <<<\n[other]\nhost=db.example\ndbname=other\n";
const PGPASS = "127.0.0.1:5544:arca_uat:postgres:s3cret\\:pw\\\\\n*:*:*:app:wild\n";

proves(["0046-arcactl FR-014"], "the target is what psql's variables, the service PGSERVICE names and .pgpass give, the service before the variables, a missing service or host nothing, and no password in what says where it came from", async () => {
  const h = await home({ ".pg_service.conf": SERVICE, ".pgpass": PGPASS });
  try {
    const t = resolveTarget({ HOME: h, PGSERVICE: "uat" }, "linux");
    assert(t?.host === "127.0.0.1" && t.port === 5544 && t.database === "arca_uat" && t.user === "postgres" && t.password === "s3cret:pw\\", JSON.stringify({ ...t, password: "…" }));
    assert(t.from.join() === "service uat,.pgpass" && !JSON.stringify(t.from).includes("s3cret"), "where each part came from, with no value");
    assert(urlOfTarget(t) === "postgres://postgres:s3cret%3Apw%5C@127.0.0.1:5544/arca_uat", "the URL encodes the password");
    const wins = resolveTarget({ HOME: h, PGSERVICE: "uat", PGHOST: "10.0.0.9", PGUSER: "app", PGDATABASE: "x", PGPASSWORD: "given" }, "linux");
    assert(wins?.host === "127.0.0.1" && wins.user === "postgres" && wins.database === "arca_uat" && wins.password === "given", "the service wins over the variables, as libpq has it, and PGPASSWORD over .pgpass");
    const fills = resolveTarget({ HOME: h, PGSERVICE: "other", PGPORT: "6000", PGUSER: "app" }, "linux");
    assert(fills?.host === "db.example" && fills.port === 6000 && fills.user === "app" && fills.database === "other", "the variables fill what the service does not say");
    const wild = resolveTarget({ HOME: h, PGHOST: "elsewhere", PGUSER: "app" }, "linux");
    assert(wild?.password === "wild" && wild.database === "app", "a wildcard line of .pgpass, and the database defaults to the user");
    assert(resolveTarget({ HOME: h, PGSERVICE: "nobody" }, "linux") === undefined, "a service that is not there");
    assert(resolveTarget({ HOME: h, PGSERVICE: "other" }, "linux")?.port === 5432, "the default port");
    assert(resolveTarget({ HOME: h }, "linux") === undefined && resolveTarget({ HOME: h, PGHOST: "/var/run/postgresql" }, "linux") === undefined, "no host, or a socket: the driver reads the environment as it did");
    const none = resolveTarget({ HOME: h, PGHOST: "unknown.example", PGUSER: "nobody" }, "linux");
    assert(none?.password === undefined, "no line, no password");
  } finally {
    await fs.remove(h, { recursive: true });
  }
});

proves(["0046-arcactl FR-014"], "a connection that fails does not say the password that was found in a file", async () => {
  const h = await home({ ".pg_service.conf": "[dead]\nhost=127.0.0.1\nport=1\ndbname=x\nuser=someone\n", ".pgpass": "127.0.0.1:1:x:someone:p@ss/w0rd!\n" });
  try {
    let said = "";
    try {
      await connect({ env: { HOME: h, PGSERVICE: "dead" }, connectTimeout: 2 });
    } catch (thrown) {
      said = thrown instanceof Error ? thrown.message : String(thrown);
    }
    assert(said !== "" && !said.includes("p@ss/w0rd!") && !said.includes(encodeURIComponent("p@ss/w0rd!")), `the error: ${said}`);
  } finally {
    await fs.remove(h, { recursive: true });
  }
}, { timeout: 30_000 });
