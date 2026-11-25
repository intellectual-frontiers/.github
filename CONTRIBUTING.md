# Contributing

Thank you for helping. This repository is source-available: the code is public, it is licensed to the public under the [PolyForm Noncommercial License 1.0.0](LICENSE), and Intellectual Frontiers LLC also offers commercial licenses ([`COMMERCIAL.md`](COMMERCIAL.md)).
What you contribute is licensed to the LLC as this page says.

## What you agree to

By contributing, you agree that:

1. You wrote the contribution, or you have the right to submit it, and it contains nothing you may not license.
2. You license the contribution to Intellectual Frontiers LLC, perpetually, worldwide and free of charge, to use, change, sublicense and distribute it, and to license it to others **under the PolyForm Noncommercial License 1.0.0 and under commercial licenses**, whatever their terms.
3. You keep your own copyright in it.
4. You say so with a sign-off: every commit carries a `Signed-off-by:` line, which `git commit -s` adds, and which states the [Developer Certificate of Origin 1.1](https://developercertificate.org/) is true of the commit.

## How to contribute

- Work spec first: change the specification (`commons/spec-kit/`, or a library's own `spec-kit/`), then the code, then the tests. [`AGENTS.md`](AGENTS.md) says the rules and the loop (`bun run dev:check`).
- Every commit is signed off (`git commit -s`) and names its issue on a line of its own: `Refs #N`.
- A new library runs `bun commons/libraries/src/license.ts` once, which writes its `LICENSE`.
- Never put a secret, a token or a person's data in this repository: it is public.

## Names

The names Mizan, Kanon and Archon and the logos are not licensed by contributing; see [`NOTICE`](NOTICE).
