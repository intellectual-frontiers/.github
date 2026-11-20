/**
 * Tests of `http.ts`: `Link` headers as GitHub, GitLab and Okta send them, `Retry-After` in both its forms, and safe methods.
 *
 * @module
 */
import fc from "fast-check";
import { isSafeMethod, nextLink, parseLinkHeader, retryAfterMs } from "../src/http.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const FR = "0001-formats FR-019";

proves([FR], "Link headers are read into their links, and rel=next is found among them", () => {
  const gh = '<https://api.github.com/repos?page=2>; rel="next", <https://api.github.com/repos?page=5>; rel="last"';
  assertEquals(nextLink(gh), "https://api.github.com/repos?page=2");
  assertEquals(nextLink(gh, "last"), "https://api.github.com/repos?page=5");
  assertEquals(nextLink(gh, "prev"), undefined);
  assertEquals(nextLink(null), undefined);
  assertEquals(nextLink('</items?after=x>; rel="next"', "next", "https://okta.example/api/v1/users"), "https://okta.example/items?after=x");
  assertEquals(nextLink('<https://a/2>; rel="prev next"'), "https://a/2");
  assertEquals(nextLink("<https://a/2>; REL=next"), "https://a/2");
  assertEquals(parseLinkHeader('<https://a/x>; rel="next"; title="a, b; c"; type=text/html'), [
    { target: "https://a/x", params: { rel: "next", title: "a, b; c", type: "text/html" } },
  ]);
  assertEquals(parseLinkHeader("not a link"), []);
});

proves([FR, "0005-typescript-runtime FR-014"], "a Link header written from links reads back to the same targets and rels", () => {
  const url = fc.webUrl({ withQueryParameters: true }).filter((u) => !u.includes(">") && !u.includes(","));
  const rel = fc.constantFrom("next", "prev", "last", "first");
  fc.assert(
    fc.property(fc.array(fc.tuple(url, rel), { maxLength: 4 }), (links) => {
      const header = links.map(([u, r]) => `<${u}>; rel="${r}"`).join(", ");
      assertEquals(
        parseLinkHeader(header).map((l) => [l.target, l.params["rel"]]),
        links,
      );
    }),
  );
});

proves([FR], "Retry-After as seconds and as an HTTP date, never negative", () => {
  const now = Date.parse("Sun, 15 Nov 2026 12:00:00 GMT");
  assertEquals(retryAfterMs("120", now), 120_000);
  assertEquals(retryAfterMs(" 0 ", now), 0);
  assertEquals(retryAfterMs("Sun, 15 Nov 2026 12:00:30 GMT", now), 30_000);
  assertEquals(retryAfterMs("Sun, 15 Nov 2026 11:00:00 GMT", now), 0);
  assertEquals(retryAfterMs("-5", now), undefined);
  assertEquals(retryAfterMs("1.5", now), undefined);
  assertEquals(retryAfterMs("soon", now), undefined);
  assertEquals(retryAfterMs(null, now), undefined);
});

proves([FR], "only GET, HEAD, OPTIONS and TRACE are safe", () => {
  for (const m of ["GET", "head", "Options", "TRACE"]) assert(isSafeMethod(m), m);
  for (const m of ["POST", "PUT", "PATCH", "DELETE", "CONNECT"]) assert(!isSafeMethod(m), m);
});
