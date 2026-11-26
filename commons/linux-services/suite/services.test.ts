/**
 * Tests of the profiles of Linux Services (commons linux-services 0002-linux-services-profiles): what is refused and why, the requirements each profile makes (valid, ordered, for one subject, no secret), the files they render (PostgreSQL's drop-in read by the real server where it is there), the plan of a DNS zone and the Cloudflare provider against an API on a local socket. Every name is made up.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSecretLike, type JsonValue } from "@intellectual-frontiers/desired-os-state/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { canaryText } from "@intellectual-frontiers/test/canaries";
import { certificateRequirements, issueUnit, mailRelayRequirements, mainCf, mcpAccessRequirements, mcpAuthorizedKeys, parseCertificate, parseMailRelay, parseMcpAccess, parsePostgres, planDns, postgresDropIn, postgresRequirements, recipientMap, senderMap, isEmpty } from "../src/logical/mod.ts";
import type { FoundRecord } from "../src/logical/mod.ts";
import { cloudflare } from "../src/physical/mod.ts";

const PG = { machine: "synthetic-server-01", version: 18, port: 5432, listen: ["localhost"] };
const MAIL = { machine: "synthetic-server-01", tag: "example", domain: "example.org", mailbox: "ops@example.org", relay: "smtp.example.net:465", saslUser: "api_token" };
const CERT = { machine: "synthetic-server-01", names: ["*.example.org", "example.org"], contact: "ops@example.org", dns: "cloudflare" };

proves(["0002-linux-services-profiles FR-001"], "a profile is refused with every reason, and accepted where there is none", () => {
  const bad = parsePostgres({ machine: "Synthetic-server-01", version: 3, port: 70000, listen: [] });
  assert(bad.kind === "err");
  assertEquals(bad.error.map((e) => e.split(":")[0]), ["machine", "version", "port", "listen"]);
  assertEquals(parsePostgres({ ...PG, port: 80 }).kind, "err");
  assertEquals(parsePostgres(PG).kind, "ok");
  const relay = parseMailRelay({ ...MAIL, relay: "https://smtp.example.net/x" });
  assert(relay.kind === "err");
  assertEquals(parseMailRelay(MAIL).kind, "ok");
  assertEquals(parseCertificate({ ...CERT, names: [] }).kind, "err");
  assertEquals(parseCertificate({ ...CERT, dns: "route53" }).kind, "err");
  const cert = parseCertificate(CERT);
  assert(cert.kind === "ok");
  assertEquals(cert.value.directory, "https://acme-v02.api.letsencrypt.org/directory");
});

proves(["0002-linux-services-profiles FR-002"], "a profile that carries a secret is refused, and no rendered file has one", () => {
  const r = parseMailRelay({ ...MAIL, apiToken: "abc" });
  assert(r.kind === "err");
  assert(r.error.some((e) => e.includes("looks like a secret")));
  assertEquals(parsePostgres({ ...PG, password: "hunter2" }).kind, "err");
  const all = [postgresDropIn(PG), mainCf(MAIL), senderMap(MAIL), recipientMap(MAIL)];
  for (const text of all) assertEquals(findSecretLike(text as JsonValue), []);
  assert(mainCf(MAIL).includes("texthash:/etc/postfix/sasl_passwd"));
});

function ids(r: ReturnType<typeof postgresRequirements>): { ids: string[]; deps: string[][]; subjects: string[] } {
  assert(r.kind === "ok", r.kind === "err" ? r.error.join("; ") : "");
  return { ids: r.value.map((x) => x.id), deps: r.value.map((x) => [...x.dependsOn]), subjects: r.value.map((x) => JSON.stringify(x.subject)) };
}

proves(["0002-linux-services-profiles FR-003", "0002-linux-services-profiles FR-006"], "PostgreSQL's requirements are the package, the drop-in folder, the drop-in and the cluster's service, in order, for one machine", () => {
  const r = ids(postgresRequirements(PG));
  assertEquals(r.ids, ["services.postgresql-18.package", "services.postgresql-18.confd", "services.postgresql-18.config", "services.postgresql-18.service"]);
  assertEquals(r.deps, [[], ["services.postgresql-18.package"], ["services.postgresql-18.confd"], ["services.postgresql-18.config"]]);
  assertEquals(new Set(r.subjects).size, 1);
  assert(postgresDropIn(PG).includes("port = 5432"));
});

proves(["0002-linux-services-profiles FR-003"], "the drop-in is read by the real PostgreSQL server where it is installed", () => {
  const server = ["/usr/lib/postgresql/18/bin/postgres", "/usr/lib/postgresql/17/bin/postgres", "/usr/lib/postgresql/16/bin/postgres"].find((p) => existsSync(p));
  if (server === undefined) return;
  const dir = mkdtempSync(join(tmpdir(), "svc-pg-"));
  writeFileSync(join(dir, "postgresql.conf"), postgresDropIn({ ...PG, port: 5544, listen: ["localhost", "127.0.0.1"] }));
  const out = (name: string) => execFileSync(server, ["-C", name, "-D", dir, "-c", `config_file=${join(dir, "postgresql.conf")}`], { encoding: "utf8" }).trim();
  assertEquals([out("port"), out("listen_addresses"), out("log_connections")], ["5544", "localhost,127.0.0.1", "on"]);
});

proves(["0002-linux-services-profiles FR-004", "0002-linux-services-profiles FR-006"], "the mail relay is a null client that relays over implicit TLS, rewrites senders and sends local mail to the mailbox", () => {
  const r = ids(mailRelayRequirements(MAIL));
  assertEquals(r.ids, ["services.mail-relay.package", "services.mail-relay.main", "services.mail-relay.sender", "services.mail-relay.recipients", "services.mail-relay.service"]);
  assertEquals(r.deps[4], ["services.mail-relay.main", "services.mail-relay.sender", "services.mail-relay.recipients"]);
  const cf = mainCf(MAIL);
  for (const line of ["myhostname = synthetic-server-01.example.example.org", "mydestination =", "inet_interfaces = loopback-only", "relayhost = [smtp.example.net]:465", "smtp_tls_wrappermode = yes", "smtp_tls_security_level = secure"]) assert(cf.includes(line), line);
  assert(senderMap(MAIL).includes("${1}+synthetic-server-01.example@example.org"));
  assert(recipientMap(MAIL).includes("synthetic-server-01\\.example\\.example\\.org$/ ops@example.org"));
});

proves(["0002-linux-services-profiles FR-005", "0002-linux-services-profiles FR-006"], "the certificate's requirements install certbot and its plugin, configure DNS-01, issue once and renew by the timer, with the credentials a path and not a value", () => {
  const p = parseCertificate(CERT);
  assert(p.kind === "ok");
  const r = ids(certificateRequirements(p.value));
  assertEquals(r.ids.map((i) => i.split(".").pop()), ["certbot", "plugin", "cli", "issue-unit", "issue", "renewal"]);
  const unit = issueUnit(p.value);
  assert(unit.includes("ConditionPathExists=!/etc/letsencrypt/live/example.org/fullchain.pem"));
  assert(unit.includes("-d *.example.org -d example.org"));
  assert(!unit.includes("cloudflare_api_token"));
});

const rec = (name: string, content: string, extra: Partial<FoundRecord> = {}): FoundRecord => ({ id: `id-${name}-${content}`, type: "A", name, content, ttl: 300, proxied: false, comment: "", ...extra });

proves(["0002-linux-services-profiles FR-007"], "a plan changes only the records the profile claims and leaves the rest of the zone", () => {
  const want = [rec("a.example.org", "192.0.2.1"), rec("b.example.org", "192.0.2.2", { ttl: 60 }), rec("new.example.org", "192.0.2.9")];
  const found = [
    rec("a.example.org", "192.0.2.1", { comment: "managed by desired-os-state" }),
    rec("b.example.org", "192.0.2.20", { comment: "managed by desired-os-state" }),
    rec("gone.example.org", "192.0.2.3", { comment: "managed by desired-os-state" }),
    rec("others.example.org", "192.0.2.4"),
  ];
  const plan = planDns(want, found);
  assertEquals(plan.create.map((r) => r.name), ["new.example.org"]);
  assertEquals(plan.update.map((u) => u.record.name), ["b.example.org"]);
  assertEquals(plan.remove.map((r) => r.name), ["gone.example.org"]);
  assert(isEmpty(planDns([want[0]!], [found[0]!])));
});

proves(["0002-linux-services-profiles FR-008"], "the Cloudflare provider pages the list, applies a plan, sends the token in the header only and puts it in no error", async () => {
  const zone: Record<string, unknown>[] = Array.from({ length: 3 }, (_, i) => ({ id: `r${i}`, type: "A", name: `h${i}.example.org`, content: `192.0.2.${i}`, ttl: 300, proxied: false, comment: i === 0 ? "managed by desired-os-state" : null }));
  const seen: { method: string; url: string; auth: string | null; body: string }[] = [];
  const json = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(value));
  };
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://x");
      const method = req.method ?? "GET";
      seen.push({ method, url: url.pathname + url.search, auth: req.headers.authorization ?? null, body: Buffer.concat(chunks).toString("utf8") });
      if (req.headers.authorization !== "Bearer sekrit-value") return json(res, 403, { success: false, errors: [{ message: "bad token" }] });
      if (method === "GET") {
        const page = Number(url.searchParams.get("page"));
        return json(res, 200, { success: true, result: zone.slice((page - 1) * 2, page * 2), result_info: { page, total_pages: 2 } });
      }
      if (method === "POST" || (method === "DELETE" && url.pathname.endsWith("/r0"))) return json(res, 200, { success: true, result: {} });
      return json(res, 400, { success: false, errors: [{ message: "nope" }] });
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;
  try {
    const base = `http://127.0.0.1:${port}`;
    const dns = cloudflare({ zoneId: "z1", token: "sekrit-value", base });
    const found = await dns.list();
    assertEquals(found.map((f) => f.name), ["h0.example.org", "h1.example.org", "h2.example.org"]);
    assertEquals(found[0]?.comment, "managed by desired-os-state");
    await dns.apply({ create: [{ type: "A", name: "n.example.org", content: "192.0.2.50", ttl: 300, proxied: false }], update: [], remove: [found[0]!] });
    const posted = seen.find((s) => s.method === "POST");
    assert(posted?.body.includes("managed by desired-os-state") === true);
    assert(seen.every((s) => s.auth === "Bearer sekrit-value" && !s.url.includes("sekrit") && !s.body.includes("sekrit")));
    const wrong = cloudflare({ zoneId: "z1", token: "wrong-token", base });
    let message = "";
    try {
      await wrong.list();
    } catch (e) {
      message = (e as Error).message;
    }
    assert(message.includes("bad token") && !message.includes("wrong-token"));
  } finally {
    server.close();
  }
});

const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl";
const ACCESS = { machine: "synthetic-server-01", user: "ops", program: "opsfolio", keys: [{ name: "reader", publicKey: `${KEY} reader@example`, role: "read-only" }, { name: "admin", publicKey: KEY, role: "full", from: ["192.0.2.0/24"] }] };

proves(["0002-linux-services-profiles FR-009"], "each key of a tool-server access forces the program's mcp under restrict, a read-only key says so, and a key that is not one public key line is refused", () => {
  const p = parseMcpAccess(ACCESS);
  assert(p.kind === "ok", p.kind === "err" ? p.error.join("; ") : "");
  const keys = mcpAuthorizedKeys(p.value);
  assert(keys.kind === "ok");
  const lines = keys.value.split("\n").filter((l) => !l.startsWith("#") && l !== "");
  assertEquals(lines[0], `restrict,command="opsfolio mcp --read-only" ${KEY} reader@example`);
  assertEquals(lines[1], `restrict,from="192.0.2.0/24",command="opsfolio mcp" ${KEY}`);
  const r = mcpAccessRequirements(p.value);
  assertEquals(ids(r).ids, ["services.mcp-ops.ssh-dir", "services.mcp-ops.keys"]);
  for (const bad of [{ ...ACCESS, keys: [{ name: "k", publicKey: canaryText("openssh-private-key"), role: "full" }] }, { ...ACCESS, keys: [{ name: "k", publicKey: `command="x" ${KEY}`, role: "full" }] }, { ...ACCESS, program: 'x" --evil' }, { ...ACCESS, keys: [] }]) assertEquals(parseMcpAccess(bad).kind, "err");
});

proves(["0002-linux-services-profiles FR-009"], "the real ssh-keygen reads every line of the rendered authorized_keys", () => {
  try {
    execFileSync("ssh-keygen", ["-?"], { stdio: "ignore" });
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return;
  }
  const p = parseMcpAccess(ACCESS);
  assert(p.kind === "ok");
  const keys = mcpAuthorizedKeys(p.value);
  assert(keys.kind === "ok");
  const dir = mkdtempSync(join(tmpdir(), "svc-ak-"));
  writeFileSync(join(dir, "authorized_keys"), keys.value);
  const out = execFileSync("ssh-keygen", ["-l", "-f", join(dir, "authorized_keys")], { encoding: "utf8" });
  assertEquals(out.trim().split("\n").length, 2);
});
