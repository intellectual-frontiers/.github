# Kanon

Kanon is a pattern for a library that **states a rule once and carries it into several implementations**, and a small program that checks that the pattern was followed. A library built this way has three layers: **Governance** states what a thing is and may do, the **Logical** layer derives the model a program reasons with, and the **Physical** layer makes a table, command, tool, route or page from that model. Imports run one way, every element traces to the statement it came from, and every promise Governance makes ends enforced, carried as data, or named with a reason as not yet enforced.

## Why it exists

Kanon exists **to give AI agents guardrails and to reduce the likelihood of drift**, and because it is a good pattern for **medium and high complexity libraries that allow extensions and plugins on a tiny core**. In an era in which agents write a large share of the code, constraints that a program checks keep an agent on its task, tell it specifically when it leaves it, and stop a rule from being restated in five places. [Why Kanon exists](kanon-why.md) makes the argument in full.

## Three ways to read this group

The group is written so that each reader can stop when they have what they need.

**Technical executives and architects.** You want to know what it is, what it buys, what it costs and when not to use it.

1. [Why Kanon exists](kanon-why.md)
2. [Kanon in one page](kanon-one-page.md)
3. [What consumers gain](kanon-gains.md), which starts with a one-page brief you can share on its own
4. [Weaknesses, and how to avoid them](kanon-weaknesses.md)
5. [Decision guide and FAQ](kanon-decision-guide.md)

**Senior engineers and library authors.** You want to see how it works in real code.

- Add [One rule through three layers](kanon-worked-example.md), [The trace graph and nothing silently dropped](kanon-trace-and-dropped.md), [Imports run one way](kanon-imports.md) and [Families, hosts and plugins](kanon-families.md).

**Mid-level engineers and people adopting it.** You want to build with it.

- Add [Adopting Kanon in a library](kanon-adopting.md), which builds a small library step by step, [Content and renditions](kanon-content.md), and the [Glossary and sources](kanon-glossary.md).

## The pages

| Page | What it answers |
| --- | --- |
| [Why Kanon exists](kanon-why.md) | Why guardrails, why drift, why a tiny core and extensions |
| [Kanon in one page](kanon-one-page.md) | The three layers, the six rules and the vocabulary |
| [One rule through three layers](kanon-worked-example.md) | The real code of Headless, from one fact to three surfaces |
| [The trace graph and nothing silently dropped](kanon-trace-and-dropped.md) | How a promise is accounted for, with the real matrix |
| [Imports run one way](kanon-imports.md) | The table, the check and the findings it prints |
| [Families, hosts and plugins](kanon-families.md) | A tiny core with extensions: AnyFS and Desired OS State |
| [Content and renditions](kanon-content.md) | The same pattern for claims published in several media |
| [Adopting Kanon in a library](kanon-adopting.md) | A runnable example, step by step |
| [What consumers gain](kanon-gains.md) | The executive brief and the benefits by reader, with evidence |
| [Weaknesses and how to avoid them](kanon-weaknesses.md) | Twelve weaknesses, each with its guardrail |
| [Decision guide and FAQ](kanon-decision-guide.md) | When to adopt, how far to go, and the skeptic's questions |
| [Glossary and sources](kanon-glossary.md) | Every term, every code and every source |

## What is built, and what is a draft

The checker, the trace graph, the check of dropped annotations, the matrix, the family rules and the bundle of a published model are built in the library [`@intellectual-frontiers/kanon`](../../kanon/), and 58 library manifests in this repository declare a table and pass the check. The specification, [0033-kanon](../../spec-kit/specs/0033-kanon/spec.md), is a Draft, and the content method it serves is a draft too. Each page says which is which.

## Where it sits

Kanon is the rule of one library. [Mizan](concept-mizan.md) is the method for a whole harness, and its [ladder](mizan-ladder.md) is the same one-way rule applied to the rungs of a harness. A rung is never a layer.
