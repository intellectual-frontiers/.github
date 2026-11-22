/**
 * Tests of the redactor's rule about references (commons headless 0008-exit-style-consent FR-003): the value of a declared key is not replaced where it is a reference that a shell or a script expands (`$(command)`, `${name}`, `$name`, `($expression)`, with or without a quote before it), because
 * a reference is where a secret comes from and is not one; so a program that prints a script that sets its token from a command prints that script whole. A literal in quotes and a literal that is no reference are still replaced. Found by sourcing the snippet of `ergonex shell print`
 * in a real bash, PowerShell and Nushell, which the redactor had turned into broken code (the assignment of the token was replaced by `***`).
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { redact } from "@intellectual-frontiers/headless/governance";

const keys = { keys: ["ERGONEX_GITHUB_TOKEN"] } as const;

proves(["0008-exit-style-consent FR-003"], "a value that a shell or a script expands is a reference and is left, and a literal value is still replaced", () => {
  for (const code of [
    'if ERGONEX_GITHUB_TOKEN="$(gh auth token 2>/dev/null)" && [ -n "$ERGONEX_GITHUB_TOKEN" ]; then',
    "export ERGONEX_GITHUB_TOKEN=$(gh auth token)",
    'ERGONEX_GITHUB_TOKEN="${FROM_VAULT}"',
    "ERGONEX_GITHUB_TOKEN=$FROM_VAULT",
    '{ $env:ERGONEX_GITHUB_TOKEN = "$ergonexToken".Trim() }',
    "{ $env.ERGONEX_GITHUB_TOKEN = ($result.stdout | str trim) }",
  ])
    assertEquals(redact(code, [], keys), code, code);
  assertEquals(redact('ERGONEX_GITHUB_TOKEN="abc.def"', [], keys), "ERGONEX_GITHUB_TOKEN=***", "a literal in quotes is replaced");
  assertEquals(redact("ERGONEX_GITHUB_TOKEN=abc.def and more", [], keys), "ERGONEX_GITHUB_TOKEN=*** and more", "a literal is replaced");
  assertEquals(redact("ERGONEX_GITHUB_TOKEN=ghx-not-a-shape and more", [], keys), "ERGONEX_GITHUB_TOKEN=*** and more");
  // redacting twice is redacting once
  const once = redact('ERGONEX_GITHUB_TOKEN="abc" and ERGONEX_GITHUB_TOKEN="$(gh auth token)"', [], keys);
  assertEquals(redact(once, [], keys), once);
});
