/**
 * Tests of `crypt.ts` (commons 0001-crypto FR-003): SHA-512 crypt gives what glibc's crypt(3) gives, and a salt from bytes is of crypt's alphabet.
 *
 * @module
 */
import fc from "fast-check";
import { CRYPT_ROUNDS, cryptSalt, sha512Crypt, verifySha512Crypt } from "../src/crypt.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const CRYPT = "0001-crypto FR-003";

proves([CRYPT], "SHA-512 crypt gives what glibc's crypt(3) gives, rounds clamped as glibc clamps them", async () => {
  const glibc: readonly (readonly [string, string, number | undefined, string])[] = [
    [
      "Hello world!",
      "saltstring",
      undefined,
      "$6$saltstring$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaS35inz1",
    ],
    [
      "Hello world!",
      "saltstringsaltstring",
      10000,
      "$6$rounds=10000$saltstringsaltst$OW1/O6BYHV6BcXZu8QVeXbDWra3Oeqh0sbHbbMCVNSnCM/UrjmM0Dp8vOuZeHBy/YTBmSK6H9qs/y3RnOaw5v.",
    ],
    [
      "This is just a test",
      "toolongsaltstring",
      5000,
      "$6$rounds=5000$toolongsaltstrin$lQ8jolhgVRVhY4b5pZKaysCLi0QBxGoNeKQzQ3glMhwllF7oGDZxUhx1yxdYcz/e1JSbq3y6JMxxl8audkUEm0",
    ],
    [
      "the minimum number is still observed",
      "roundstoolow",
      10,
      "$6$rounds=1000$roundstoolow$kUMsbe306n21p9R.FRkW3IGn.S9NPN0x50YhH1xhLsPuWGsUSklZt58jaTfF4ZEQpyUNGc0dqbpBYYBaHHrsX.",
    ],
  ];
  for (const [password, salt, rounds, hash] of glibc) {
    assertEquals(await sha512Crypt(password, salt, rounds), hash);
    assert(await verifySha512Crypt(password, hash));
    assert(!(await verifySha512Crypt(`${password}x`, hash)));
  }
  assert(!(await verifySha512Crypt("x", "$1$md5$notours")));
  assertEquals(CRYPT_ROUNDS.default, 5000);
});

proves(
  [CRYPT, "0001-core FR-004"],
  "a salt from bytes is of crypt's alphabet, and a password hashed with it verifies",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 20 }), fc.string({ maxLength: 12 }), async (bytes, password) => {
        const salt = cryptSalt(bytes);
        assert(/^[./0-9A-Za-z]{1,16}$/.test(salt), salt);
        assert(await verifySha512Crypt(password, await sha512Crypt(password, salt, 1000)));
      }),
      { numRuns: 15 },
    );
  },
);
