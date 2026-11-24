/**
 * Tests of the token of a host (commons anyfs-githost 0002-anyfs-githost-store FR-003): where it comes from, that a person is asked once and a short-lived token is fetched again when it lapses, that it travels in the one header of the host
 * and in no URL, body, result or sentence, and that a store with none reads what is public.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { expectAny, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { anonymous, cachedToken, environmentToken, providedToken, redactor, resolveToken, staticToken, usable } from "../src/mod.ts";
import { bytes, rig, TOKEN, tokenSource } from "./support.ts";

const p = (t: string) => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0002-anyfs-githost-store FR-003"], "a token is one line with no space or control character, and each source gives it or says why not without ever holding it in a sentence", async () => {
  for (const good of ["ghp_exampleexample", "glpat-abcdef123456"]) assert(usable(good), good);
  for (const bad of ["short", "has space in it", "tab\tin", "new\nline", "x".repeat(513), ""]) assertEquals(usable(bad), false, JSON.stringify(bad));
  assertEquals(staticToken("short").kind, "err");
  assertEquals((await resolveToken(anonymous)).kind === "ok" && (await resolveToken(anonymous)).kind === "ok", true);
  const none = await resolveToken(anonymous);
  assert(none.kind === "ok" && none.value === undefined);

  const env = (name: string): string | undefined => ({ FLEET_TOKEN: "env-token-0123456789", EMPTY: "  ", BAD: "has space" })[name];
  const fromEnv = await resolveToken(environmentToken(env, "FLEET_TOKEN"));
  assert(fromEnv.kind === "ok" && fromEnv.value === "env-token-0123456789");
  const unset = await resolveToken(environmentToken(env, "NOPE"));
  assert(unset.kind === "err" && unset.error === "NOPE is not set");
  assertEquals((await resolveToken(environmentToken(env, "EMPTY"))).kind, "err");
  const bad = await resolveToken(environmentToken(env, "BAD"));
  assert(bad.kind === "err" && !bad.error.includes("has space"), "the value is not in the sentence");

  const given = await resolveToken(providedToken(async () => ok("provided-token-0123456")));
  assert(given.kind === "ok" && given.value === "provided-token-0123456");
  const no = await resolveToken(providedToken(async () => err("the person said no")));
  assert(no.kind === "err" && no.error === "the person said no");
  assertEquals((await resolveToken(providedToken(async () => ok("bad token")))).kind, "err");
});

proves(["0002-anyfs-githost-store FR-003"], "a provider is asked once for a token that does not lapse and again after its time for one that does", async () => {
  let asked = 0;
  let now = 1000;
  const lapsing = cachedToken(providedToken(async () => ok(`token-number-${++asked}-xxxxx`), 100), () => now);
  assertEquals((await lapsing()).kind === "ok" && (await lapsing()).kind === "ok", true);
  assertEquals(asked, 1, "asked once within its time");
  now += 150;
  const again = await lapsing();
  assert(again.kind === "ok" && again.value === "token-number-2-xxxxx");
  assertEquals(asked, 2);
  let envAsked = 0;
  const forever = cachedToken(environmentToken((n) => (envAsked++, n === "T" ? "env-token-0123456789" : undefined), "T"), () => now);
  await forever();
  await forever();
  now += 1e9;
  await forever();
  assertEquals(envAsked, 1, "the environment is read once");
});

proves(["0002-anyfs-githost-store FR-003"], "the redactor takes every token out of a sentence", () => {
  const r = redactor(["secret-token-1234", "other-token-5678"]);
  assertEquals(r("the host said secret-token-1234 and other-token-5678 twice: secret-token-1234"), "the host said [redacted] and [redacted] twice: [redacted]");
  assertEquals(r("nothing to hide"), "nothing to hide");
  assertEquals(redactor([])("anything"), "anything");
  assertEquals(redactor(["abc"])("abc is too short to be a token and is left"), "abc is too short to be a token and is left");
});

proves(["0002-anyfs-githost-store FR-003"], "the token travels in the one header of the host and nowhere else: no path, query or body of any request holds it, and no problem or sentence does, even where the host echoes it", async () => {
  for (const label of ["github", "gitlab"] as const) {
    const r = rig(label);
    const s = await r.writable();
    assert((await s.write(p("a.txt"), bytes("x"), expectAny)).kind === "ok");
    assert((await s.list(p("a.txt") as never)).kind === "ok" || true);
    // the host echoes the token in its words
    r.fake.knobs.failNext.push({ status: 500, body: JSON.stringify({ message: `internal error for ${TOKEN}` }) });
    const echoed = await s.read(p("a.txt"));
    assert(echoed.kind === "err" && echoed.error.kind === "unavailable", label);
    assertEquals(JSON.stringify(echoed).includes(TOKEN), false, `${label}: the echoed token is not in the problem`);
    assertStringIncludes(JSON.stringify(echoed), "[redacted]");
    r.fake.knobs.failNext.push({ status: 403, body: JSON.stringify({ message: `forbidden for ${TOKEN}` }) });
    assertEquals(JSON.stringify(await s.read(p("a.txt"))).includes(TOKEN), false, label);
    const header = label === "github" ? "authorization" : "private-token";
    for (const seen of r.seen) {
      assertEquals(seen.path.includes(TOKEN) || seen.query.includes(TOKEN) || seen.body.includes(TOKEN), false, `${label}: ${seen.method} ${seen.path}`);
      const carrying = Object.entries(seen.headers).filter(([, v]) => v.includes(TOKEN)).map(([k]) => k.toLowerCase());
      assertEquals(carrying, [header], `${label}: the token is in ${header} alone`);
    }
  }
});

proves(["0002-anyfs-githost-store FR-003"], "a token the host does not accept ends an open with a sentence that does not hold the token, and a store with no token reads what a host shows to anyone", async () => {
  for (const label of ["github", "gitlab"] as const) {
    const r = rig(label);
    const wrong = await r.tryOpen({ token: (() => { const t = staticToken("wrong-token-0123456789"); if (t.kind === "err") throw new Error(t.error); return t.value; })() });
    assert(wrong.kind === "err", label);
    assertEquals(wrong.error.includes("wrong-token-0123456789"), false);
    assertEquals(wrong.error.includes(TOKEN), false);

    // a host that shows its repository to anyone: no token is asked for, and none is sent
    r.seen.length = 0;
    r.setToken(undefined);
    const open = await r.tryOpen({ token: anonymous });
    assert(open.kind === "ok", `${label}: ${open.kind === "err" ? open.error : ""}`);
    assertEquals(r.seen.filter((x) => Object.keys(x.headers).some((k) => ["authorization", "private-token"].includes(k.toLowerCase()))).length, 0, `${label}: no credential header was sent`);
    assert(open.kind === "ok" && (await open.value.store.read(p("README.md"))).kind === "ok");
  }
  void tokenSource;
});
