// Spec: 0002-linux-services-profiles FR-008
/**
 * The DNS provider that the fleet uses, Cloudflare, behind a port: the zone is read page by page and a plan is applied record by record, over HTTPS, with the token given in the header of the request and nowhere else. A token is in no error.
 *
 * @example
 * ```ts
 * import { cloudflare } from "./cloudflare.ts";
 * const dns = cloudflare({ zoneId: "z", token: "t", base: "http://127.0.0.1:1" });
 * typeof dns.list; // "function"
 * ```
 *
 * @module
 */
import { MARKER } from "@intellectual-frontiers/linux-services/governance";
import type { DnsRecord } from "@intellectual-frontiers/linux-services/governance";
import type { DnsPlan, FoundRecord } from "@intellectual-frontiers/linux-services/logical";

/** The port to the DNS of a name. */
export type DnsProvider = {
  readonly list: () => Promise<readonly FoundRecord[]>;
  readonly apply: (plan: DnsPlan) => Promise<void>;
};

/** What the Cloudflare provider is made with. */
export type CloudflareOptions = {
  readonly zoneId: string;
  /** The API token; used in the Authorization header of requests to `base` only. */
  readonly token: string;
  /** The address of the API; Cloudflare's own by default. */
  readonly base?: string;
};

type Wire = { id: string; type: string; name: string; content: string; ttl: number; proxied?: boolean; comment?: string | null };
type Page = { success: boolean; result: Wire[]; result_info?: { page: number; total_pages: number }; errors?: { message: string }[] };

/** The Cloudflare provider of a zone. */
export function cloudflare(options: CloudflareOptions): DnsProvider {
  const base = (options.base ?? "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
  const zone = `${base}/zones/${encodeURIComponent(options.zoneId)}/dns_records`;
  async function call(method: string, url: string, body?: unknown): Promise<Page> {
    const res = await fetch(url, { method, headers: { authorization: `Bearer ${options.token}`, "content-type": "application/json" }, redirect: "error", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text();
    let page: Page;
    try {
      page = JSON.parse(text) as Page;
    } catch {
      throw new Error(`cloudflare ${method} answered ${res.status} with something that is not JSON`);
    }
    if (!res.ok || !page.success) throw new Error(`cloudflare ${method} ${res.status}: ${(page.errors ?? []).map((e) => e.message).join("; ") || "refused"}`);
    return page;
  }
  const wire = (r: DnsRecord) => ({ type: r.type, name: r.name, content: r.content, ttl: r.ttl, proxied: r.proxied, comment: MARKER });
  return {
    list: async () => {
      const found: FoundRecord[] = [];
      for (let page = 1; ; page++) {
        const p = await call("GET", `${zone}?page=${page}&per_page=100`);
        for (const w of p.result) found.push({ id: w.id, type: w.type as DnsRecord["type"], name: w.name, content: w.content, ttl: w.ttl, proxied: w.proxied === true, comment: w.comment ?? "" });
        if (p.result_info === undefined || page >= p.result_info.total_pages) return found;
      }
    },
    apply: async (plan) => {
      for (const r of plan.create) await call("POST", zone, wire(r));
      for (const u of plan.update) await call("PUT", `${zone}/${encodeURIComponent(u.id)}`, wire(u.record));
      for (const r of plan.remove) await call("DELETE", `${zone}/${encodeURIComponent(r.id)}`);
    },
  };
}
