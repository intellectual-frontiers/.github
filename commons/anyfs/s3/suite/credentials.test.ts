/**
 * Tests of the sources of keys (commons anyfs-s3 0002-anyfs-s3-store FR-005): a pair given in code, the environment through a function, and a provider that is asked again only after its time; a secret asked of a
 * person through the credential port of Headless; and no sentence, no URL and no recorded request that holds a key.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { err, ok } from "@intellectual-frontiers/core";
import { secretOf } from "@intellectual-frontiers/headless/logical";
import { cachedCredentials, environmentCredentials, promptedCredentials, providedCredentials, resolveCredentials, staticCredentials } from "../src/mod.ts";

proves(["0002-anyfs-s3-store FR-005"], "a static pair is refused where the id or the secret could not be a key, and is given as it is where it could", async () => {
  assertEquals(staticCredentials("ab", "long-enough-secret").kind, "err");
  assertEquals(staticCredentials("AKID EXAMPLE", "long-enough-secret").kind, "err");
  assertEquals(staticCredentials("AKIDEXAMPLE", "short").kind, "err");
  assertEquals(staticCredentials("AKIDEXAMPLE", "has a space in it").kind, "err");
  const c = staticCredentials("AKIDEXAMPLE", "long-enough-secret", "token");
  assert(c.kind === "ok");
  assertEquals(await resolveCredentials(c.value), { kind: "ok", value: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "long-enough-secret", sessionToken: "token" } });
});

proves(["0002-anyfs-s3-store FR-005"], "the environment is read only through the function it is given, and a pair that is not both there is said and holds no key", async () => {
  const env = (vars: Record<string, string>) => environmentCredentials((name) => vars[name]);
  assertEquals(await resolveCredentials(env({ AWS_ACCESS_KEY_ID: "AKIDEXAMPLE", AWS_SECRET_ACCESS_KEY: "s3cr3t-s3cr3t", AWS_SESSION_TOKEN: "t" })), { kind: "ok", value: { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "s3cr3t-s3cr3t", sessionToken: "t" } });
  const none = await resolveCredentials(env({ AWS_ACCESS_KEY_ID: "AKIDEXAMPLE" }));
  assert(none.kind === "err");
  assertEquals(none.error.includes("AKIDEXAMPLE"), false);
});

proves(["0002-anyfs-s3-store FR-005"], "a provider is asked again only after its time, a static pair never, and a provider that fails is not remembered", async () => {
  let now = 0;
  let asked = 0;
  const provider = providedCredentials(async () => ok({ accessKeyId: `AKID${asked++}`, secretAccessKey: "secret-secret" }), 1000);
  const get = cachedCredentials(provider, () => now);
  assertEquals((await get()).kind === "ok" && (await get()).kind === "ok" && asked, 1);
  now = 1500;
  await get();
  assertEquals(asked, 2);
  let fails = 0;
  const flaky = cachedCredentials(providedCredentials(async () => (fails++ === 0 ? err("down") : ok({ accessKeyId: "AKIDOK", secretAccessKey: "secret-secret" })), 1000), () => 0);
  assertEquals((await flaky()).kind, "err");
  assertEquals((await flaky()).kind, "ok");
});

proves(["0002-anyfs-s3-store FR-005"], "a secret is asked of a person through the credential port once, never written anywhere, and a refusal is a reason that holds no key", async () => {
  let questions = 0;
  const port = {
    ask: async (request: { readonly id: string; readonly prompt: string }) => {
      questions++;
      assertEquals(request.id, "s3-secret-key");
      assertEquals(request.prompt.includes("typed-secret"), false);
      return ok(secretOf("typed-secret-value"));
    },
  };
  const source = promptedCredentials(port as never, "AKIDEXAMPLE");
  assert(source.kind === "ok");
  const get = cachedCredentials(source.value, () => 0);
  const first = await get();
  assert(first.kind === "ok");
  assertEquals(first.value.secretAccessKey, "typed-secret-value");
  assertEquals(JSON.stringify(source.value).includes("typed-secret-value"), false);
  await get();
  assertEquals(questions, 1);
  const refusing = promptedCredentials({ ask: async () => err({ kind: "cancelled" }) } as never, "AKIDEXAMPLE");
  assert(refusing.kind === "ok");
  const r = await resolveCredentials(refusing.value);
  assert(r.kind === "err");
  assertEquals(r.error.includes("AKIDEXAMPLE"), false);
  assertEquals(promptedCredentials(port as never, "x").kind, "err");
});
