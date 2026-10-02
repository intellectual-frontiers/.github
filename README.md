# Intellectual Frontiers — `.github`

This is the public root of Intellectual Frontiers' Eidolon — the company's
own account of what it is and how it works, specified rather than merely
described. See
[`0001-eidolon-architecture`](spec-kit/specs/0001-eidolon-architecture/spec.md)
for the full architecture: the three-repository Eidolon, its namespaces, its
confidentiality model, its facts model, and how it governs itself.

## Layout

```
spec-kit/
  specs/            one testable spec per NNNN-slug, numbered independently
                    in each repository
ontology/
  ifcore.ttl        core company ontology (the ifcore: namespace)
  ifweb.ttl         web content shapes (the ifweb: namespace) — empty until
                    a spec establishes content shapes
design-systems/
  README.md         what a design system is, engineering stance, how to
                     use any one of them
  <slug>/           one self-contained design system per directory, each
                     registered in ifcore.ttl (0014-design-systems)
```

## Working order

A new capability or concept is established in a spec before it is
represented in the ontology, and in the ontology before it is implemented
anywhere else — code, content, or process (spec 0001, FR-037). This
repository does not build ahead of that order: `ifweb.ttl` is empty today
for exactly this reason, and stays that way until a spec defines what
belongs in it.
