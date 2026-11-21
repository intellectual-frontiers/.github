/**
 * Tests of the plugin `dns` (commons archon-dns 0002-dns-command): the plugin composes into the command `archon` with its two verbs, a zone that is not for the plugin to change is refused with the fleet's own code, exit and words, and, against a provider of the library `linux-services` that talks to
 * an API on a local socket, the whole of it through the command: the plan with its hash and nothing changed by it, an apply of a hash that is not the plan's refused, a removal that needs `--allow-removal yes`, the approved plan applied and the plan after it empty, and a provider that fails ending with 3 and no token in what it says. Every name is made up.
 *
 * @module
 */
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { assemble, main } from "@intellectual-frontiers/archon/cli";
import { err, ok } from "@intellectual-frontiers/core";
import { verbIds } from "@intellectual-frontiers/headless/logical";
import { cloudflare } from "@intellectual-frontiers/linux-services/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { value } from "@intellectual-frontiers/terminal/args";
import { dnsPlugin, type DnsPluginConfig } from "../src/mod.ts";

async function run(config: DnsPluginConfig, argv: readonly string[]) {
  const plugin = dnsPlugin(config);
  if (plugin.kind === "err") throw new Error(JSON.stringify(plugin.error));
  const out: string[] = [];
  const errs: string[] = [];
  const code = await main([plugin.value], "0.1.0", argv, { env: () => undefined, out: (t) => void out.push(t), err: (t) => void errs.push(t) });
  return { code, out: out.join(""), err: errs.join("") };
}

type Rec = { id: string; type: string; name: string; content: string; ttl: number; proxied: boolean; comment: string | null };

/** A zone on a local socket that speaks the part of Cloudflare's API the provider uses. */
async function zoneServer(initial: Rec[], token: string) {
  const zone = [...initial];
  let next = 100;
  const server = createServer((req, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const send = (status: number, body: unknown) => (res.writeHead(status, { "content-type": "application/json" }), res.end(JSON.stringify(body)));
      if (req.headers.authorization !== `Bearer ${token}`) return send(403, { success: false, errors: [{ message: "bad token" }] });
      const url = new URL(req.url ?? "/", "http://x");
      const id = url.pathname.split("/dns_records/")[1];
      const body = chunks.length > 0 ? (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Omit<Rec, "id">) : undefined;
      if (req.method === "GET") return send(200, { success: true, result: zone, result_info: { page: 1, total_pages: 1 } });
      if (req.method === "POST" && body !== undefined) return zone.push({ ...body, id: `n${next++}` }), send(200, { success: true, result: {} });
      if (req.method === "PUT" && body !== undefined && id !== undefined) return zone.splice(zone.findIndex((z) => z.id === id), 1, { ...body, id }), send(200, { success: true, result: {} });
      if (req.method === "DELETE" && id !== undefined) return zone.splice(zone.findIndex((z) => z.id === id), 1), send(200, { success: true, result: {} });
      return send(400, { success: false, errors: [{ message: "nope" }] });
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { zone, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}

const WANT = [{ type: "A" as const, name: "a.example.org", content: "192.0.2.1", ttl: 300, proxied: false }, { type: "A" as const, name: "b.example.org", content: "192.0.2.2", ttl: 300, proxied: false }];
const config = (base: string, token: string, wanted = WANT): DnsPluginConfig => ({
  version: "0.1.0",
  options: { fleet: value<never>({ help: "The fleet's own option.", valueName: "NAME", default: "" }) },
  subject: async () => ok({ wanted, provider: cloudflare({ zoneId: "z", token, base }) }),
});

proves(["0002-dns-command FR-001"], "the plugin composes with the verbs plan and apply, and a zone that is not for it to change is refused with the fleet's own code, exit and words, and the options the fleet gave reach its function", async () => {
  const p = dnsPlugin({ version: "0.1.0", subject: async () => err({ message: "x", code: "E-X", exit: "findings" }) });
  assert(p.kind === "ok");
  const composed = assemble([p.value], "0.1.0");
  assert(composed.kind === "ok");
  assertEquals(verbIds(composed.value.program).filter((v) => v.includes("dns")), ["archon dns apply", "archon dns plan"]);
  const seen: Array<[string, Record<string, string>]> = [];
  const refused = await run({ ...config("http://127.0.0.1:1", "t"), subject: async (zone, o) => (seen.push([zone, { ...o }]), err({ message: "example.org is not the fleet's zone", code: "E-NOT-OURS", exit: "findings" })) }, ["dns", "plan", "--zone", "example.org", "--fleet", "lab"]);
  assertEquals(refused.code, 1);
  assert((refused.out + refused.err).includes("E-NOT-OURS") && (refused.out + refused.err).includes("not the fleet's zone"));
  assertEquals(seen, [["example.org", { fleet: "lab" }]]);
});

proves(["0002-dns-command FR-002", "0002-dns-command FR-003", "0002-dns-command FR-004"], "plan reads only and prints a hash, an apply of another hash or of a zone that changed is refused, a removal needs its flag, the approved plan is applied and the plan after it is empty", async () => {
  const s = await zoneServer([
    { id: "r1", type: "A", name: "a.example.org", content: "192.0.2.1", ttl: 300, proxied: false, comment: "managed by archon" },
    { id: "r2", type: "A", name: "old.example.org", content: "192.0.2.9", ttl: 300, proxied: false, comment: "managed by archon" },
    { id: "r3", type: "A", name: "others.example.org", content: "192.0.2.77", ttl: 300, proxied: false, comment: null },
  ], "tok-secret");
  try {
    const c = config(s.base, "tok-secret");
    const before = JSON.stringify(s.zone);
    const planned = await run(c, ["dns", "plan", "--zone", "example.org"]);
    assertEquals(planned.code, 4);
    assert(planned.out.includes("+ A b.example.org 192.0.2.2") && planned.out.includes("- A old.example.org 192.0.2.9"));
    assertEquals(JSON.stringify(s.zone), before, "plan changed nothing");
    const hash = /sha256:[0-9a-f]{64}/.exec(planned.out)?.[0] ?? "";
    assert(hash !== "");
    const wrong = await run(c, ["dns", "apply", "--zone", "example.org", "--plan-hash", "sha256:" + "0".repeat(64), "--allow-removal", "yes"]);
    assertEquals(wrong.code, 1);
    assert((wrong.out + wrong.err).includes("the plan changed"));
    const noRemoval = await run(c, ["dns", "apply", "--zone", "example.org", "--plan-hash", hash]);
    assertEquals(noRemoval.code, 2);
    assertEquals(JSON.stringify(s.zone), before, "nothing changed by a refusal");
    const done = await run(c, ["dns", "apply", "--zone", "example.org", "--plan-hash", hash, "--allow-removal", "yes"]);
    assertEquals(done.code, 0, done.out + done.err);
    assert(done.out.includes("the plan after the apply is empty"));
    assertEquals(s.zone.map((z) => z.name).sort(), ["a.example.org", "b.example.org", "others.example.org"]);
    assertEquals((await run(c, ["dns", "plan", "--zone", "example.org"])).code, 0);
  } finally {
    s.close();
  }
});

proves(["0002-dns-command FR-004"], "a provider that fails ends the command with 3 and the reason, with the token in none of what is printed", async () => {
  const s = await zoneServer([], "right-token");
  try {
    const r = await run(config(s.base, "wrong-token-value"), ["dns", "plan", "--zone", "example.org"]);
    assertEquals(r.code, 3);
    assert((r.out + r.err).includes("bad token") && !(r.out + r.err).includes("wrong-token-value"));
  } finally {
    s.close();
  }
});
