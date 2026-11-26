# Mizan and GitHub Spec Kit

Should we move to GitHub Spec Kit, or to another well-known format? We looked at what each does and does not do, and decided: use Spec Kit as the method, and keep a thin profile for what it does not do.

## What we found

GitHub Spec Kit gives `.specify/`, a constitution, the `/speckit-*` commands, and a `specs/NNN-name/` folder with `spec.md`, `plan.md` and `tasks.md`. Commons' own format adds a register of numbers and a register of proofs, and is named Mizan so that it does not collide with Spec Kit.

- **What Spec Kit gives us.** 
- **What it does not give us.** 

**The decision.** **Adopt Spec Kit as the method. Do not adopt it as the conformance standard.** Mizan is a *profile*: it keeps Spec Kit's commands, constitution and feature files, and adds only the registers, the tracing, the ladder, the requirement syntax and the standards rules. Replacing our register and tracing with Spec Kit's would lose the thing the compliance chain depends on.

## Where it lives

Commons' own format is `0003-mizan`, its checker `commons/tools/mizan-check.ts`. The folder `commons/spec-kit/` keeps its name for the natural-language specifications; Mizan's documentation says that it holds the Mizan profile. **Built**

## Why not another format?

| Alternative | What it is good for | Why not instead of Mizan |
| --- | --- | --- |
| OpenSpec, Kiro-style specs | Agent-driven spec workflows | Same gap as Spec Kit: no proof register, no tracing, no standards rules. We borrow ideas (EARS) instead. |
| Architecture decision records | Recording one decision | Not requirements. We keep a typed `Decision` for terms that are `unaligned`. |
| OSCAL | Controls, assessment, evidence | Exactly right for controls, wrong for describing features. We map the proof register to OSCAL where it can say it. |
| Gherkin / Cucumber | Executable scenarios | We use its Given, When, Then shape for scenarios; our tests are TypeScript with `proves(...)`. |
| TLA+, Alloy | Formal models | Valuable for some systems, not for everything. Not ruled out for a specification that needs it. |

## What Mizan adds, and what Spec Kit keeps

The profile adds what Spec Kit does not state: the gapless `registry.tsv` and the proof register `enforcement.tsv`, the tracing of source files, tests and ontology terms to requirements, the ladder, the requirement syntax (RFC 2119 and EARS) and the standards rules. IFCCM departs from Spec Kit's words in one place: the unit of change is a **capability**, not a feature, and what Spec Kit calls a feature is a capability here. The specifications of IFCCM and IFQS (`0020` to `0022`) are themselves written in Mizan's form.

Spec Kit moves quickly (a newer command for converging already supersedes an older one), so each Mizan specification says which version of Spec Kit's templates it follows where it departs from them.
