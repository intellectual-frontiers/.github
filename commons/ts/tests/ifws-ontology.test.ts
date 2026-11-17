/**
 * The ontology of Intellectual Frontiers Workspaces (commons 0023-if-workspaces, 0024-ifws-host, 0025-ifws): the code lists hold the keys the specifications name and the facts the
 * command branches on, every class has a record of the standard it rests on, and the specifications name no term the ontology does not define. Pure functions over the typed
 * ontology and the text of the specifications, with no network and no program.
 *
 * @module
 */
import { fromFileUrl, dirname, resolve } from "../runtime/path.ts";
import { assert, assertEquals, proves } from "../runtime/test.ts";
import { triplesOf, turtle, validate } from "../kernel/rdf.ts";
import { termRecordsOf } from "../mizan/check.ts";
import { mizanFindings, authorityCitation, commonsAuthorities, rulePlugins } from "../mizan/rules.ts";
import { readSpecTexts } from "../mizan/spec-files.ts";
import { specTermFindings } from "../mizan/spec-terms.ts";
import { basisMissing, termFindings } from "../mizan/standards.ts";
import {
  actionKinds,
  AUDITED_ON,
  CLASS_NAMES,
  classes,
  CODE_LIST_CLASSES,
  codeLists,
  decisions,
  exitStatuses,
  file,
  files,
  gitCapabilities,
  gitManagerKinds,
  ifws,
  IFWS,
  moduleSources,
  repoStates,
  severities,
  termNames,
  terms,
} from "../../ontology/ifws/mod.ts";
import { bases, MZ, mz } from "../../ontology/mizan/mod.ts";

const SPEC_KIT = resolve(dirname(fromFileUrl(import.meta.url)), "..", "..", "spec-kit");
const keys = (list: object): readonly string[] => Object.keys(list);
const iris = (list: readonly { readonly iri: string }[]): readonly string[] => list.map((i) => i.iri).sort();

proves(
  ["0023-if-workspaces FR-044"],
  "every class and code-list class of the vocabulary has one record of its basis, and the audit's rules find nothing",
  () => {
    const classIris = iris(classes);
    assertEquals(classIris, iris(CLASS_NAMES.map((n) => ifws[n])));
    assertEquals(terms.map((t) => t.values.termIri).sort(), classIris);
    assertEquals(
      basisMissing(
        classIris,
        terms.map((t) => t.values.termIri),
      ),
      [],
    );
    for (const name of CODE_LIST_CLASSES) assert(CLASS_NAMES.includes(name), `${name} is a code-list class with no class record`);
    assertEquals(new Set(CODE_LIST_CLASSES).size, 7);
    // a term that rests on a standard names its term, one that does not says why and is due within 90 days of the audit
    assertEquals(termFindings(termRecordsOf(terms), AUDITED_ON), []);
    // the owner's decision of 2026-11-17 keeps every unaligned term so: each has a Decision that names it, and no day makes one due or overdue
    assertEquals(termFindings(termRecordsOf(terms), "2027-12-31"), []);
    const unaligned = terms.filter((t) => t.values.basis.iri === bases.Unaligned.iri);
    assertEquals(decisions.length, unaligned.length);
    for (const t of unaligned) {
      const d = decisions.find((x) => x.values.decisionOf.iri === t.iri);
      assert(d !== undefined && t.values.decision?.iri === d.iri, `${t.values.termIri} has a decision that names it`);
      assertEquals(d.values.decidedOn, "2026-11-17");
      assert((d.values.record ?? "").includes("issue #10") && (d.values.record ?? "").includes("2027-02-15"), t.values.termIri);
    }
    // ExitStatus says that its 0/1/2/3 follow the shell convention and not sysexits.h
    const exit = terms.find((t) => t.values.termIri === ifws.ExitStatus.iri);
    assert((exit?.values.justification ?? "").includes("sysexits.h") && (exit?.values.justification ?? "").includes("shell convention"));
    for (const t of terms) {
      assertEquals(t.values.addedOn === undefined, t.values.basis.iri !== bases.Unaligned.iri);
      assert(
        (t.values.definedBy ?? []).length === 1 && /^00(23|24|25)-[a-z-]+ FR-\d{3}$/.test(t.values.definedBy?.[0] ?? ""),
        t.values.termIri,
      );
    }
  },
);

proves(
  ["0023-if-workspaces FR-044"],
  "the standards the classes rest on are the ones looked up first: PROV-O, schema.org, DCAT, DOAP, ODRL, SARIF and Git",
  () => {
    const by = new Map(terms.map((t) => [t.values.termIri.slice(IFWS.iri.length), t.values.standardTerm]));
    assertEquals(by.get("Plan"), "http://www.w3.org/ns/prov#Plan");
    assertEquals(by.get("ToolCatalog"), "http://www.w3.org/ns/dcat#Catalog");
    assertEquals(by.get("Tool"), "https://schema.org/SoftwareApplication");
    assertEquals(by.get("Action"), "https://schema.org/Action");
    assertEquals(by.get("Setup"), "http://www.w3.org/ns/prov#Activity");
    assertEquals(by.get("GeneratedFile"), "http://www.w3.org/ns/prov#Entity");
    assertEquals(by.get("Repository"), "http://usefulinc.com/ns/doap#GitRepository");
    assertEquals(by.get("WorkspacePolicy"), "http://www.w3.org/ns/odrl/2/Policy");
    assert(by.get("Finding")?.endsWith("sarif-schema-2.1.0.json#/definitions/result"));
    assert(by.get("Severity")?.endsWith("sarif-schema-2.1.0.json#/definitions/result/properties/level"));
    assertEquals(by.get("Workspace"), undefined);
  },
);

proves(
  ["0023-if-workspaces FR-044"],
  "the ontology is well formed: no individual twice, each value in its range, and Turtle can be written for it",
  () => {
    assertEquals(validate(file.individuals), []);
    assertEquals(files, [file]);
    const text = turtle({ prefixes: file.prefixes, triples: triplesOf(file.individuals) });
    assert(text.includes("ifws:Plan"));
    assert(text.includes("rdfs:subClassOf prov:Plan"));
    assert(text.includes("rdfs:subClassOf schema:Action"));
    assert(text.includes("rdfs:subClassOf dcat:Catalog"));
  },
);

proves(
  ["0023-if-workspaces FR-044", "0024-ifws-host FR-004", "0025-ifws FR-003"],
  "the three specifications name only terms the ontology defines, and follow Mizan's rules for requirements, scenarios and authorities",
  () => {
    const specs = readSpecTexts(SPEC_KIT).filter((s) => ["0023-if-workspaces", "0024-ifws-host", "0025-ifws"].includes(s.slug));
    assertEquals(
      specs.map((s) => s.slug),
      ["0023-if-workspaces", "0024-ifws-host", "0025-ifws"],
    );
    const known = { ifws: termNames, mz: new Set(keys(mz)) };
    assertEquals(
      specTermFindings(specs, known).map((f) => f.key),
      [],
    );
    const rules = [...rulePlugins.filter((p) => p.id !== "mizan/authority-citation"), authorityCitation(commonsAuthorities)];
    assertEquals(
      mizanFindings(specs, rules).map((f) => f.key),
      [],
    );
    // the keys of the code lists the specifications name are in the ontology
    const named = new Set(specs.flatMap((s) => [...s.spec.matchAll(/`ifws:([A-Za-z]+)`/g)].map((m) => m[1] ?? "")));
    for (const n of named) assert(termNames.has(n), `ifws:${n} is named and not defined`);
    for (const n of [
      "Clone",
      "FastForward",
      "Skip",
      "Refuse",
      "Missing",
      "NotARepo",
      "Informational",
      "Warning",
      "Error",
      "Ok",
      "Findings",
      "Usage",
      "Environment",
      "BuiltIn",
      "Registered",
      "Path",
    ])
      assert(named.has(n), `ifws:${n} is not named by a specification`);
  },
);

proves(
  ["0023-if-workspaces FR-016"],
  "a Git manager is GitHub, GitLab or plain Git, and all three offer the four common capabilities",
  () => {
    assertEquals(keys(gitManagerKinds), ["Github", "Gitlab", "Git"]);
    const common = [gitCapabilities.CloneUrl, gitCapabilities.Credentials, gitCapabilities.DefaultBranch, gitCapabilities.SignedCommits];
    for (const kind of Object.values(gitManagerKinds))
      for (const c of common)
        assert(
          (kind.values.supports ?? []).some((s) => s.iri === c.iri),
          `${kind.iri} lacks ${c.iri}`,
        );
    assertEquals(keys(gitCapabilities), [
      "CloneUrl",
      "Credentials",
      "DefaultBranch",
      "SignedCommits",
      "ProtectedBranches",
      "Issues",
      "ChangeRequests",
      "NestedGroups",
    ]);
    for (const kind of [gitManagerKinds.Github, gitManagerKinds.Gitlab])
      for (const c of [gitCapabilities.ProtectedBranches, gitCapabilities.Issues, gitCapabilities.ChangeRequests])
        assert((kind.values.supports ?? []).some((s) => s.iri === c.iri));
  },
);

proves(
  ["0023-if-workspaces FR-016", "0023-if-workspaces FR-017"],
  "what a kind does not list is unsupported: only GitLab has nested groups, plain Git has no host features",
  () => {
    const unsupported = (kind: keyof typeof gitManagerKinds): readonly string[] => {
      const have = new Set((gitManagerKinds[kind].values.supports ?? []).map((s) => s.iri));
      return Object.entries(gitCapabilities)
        .filter(([, c]) => !have.has(c.iri))
        .map(([name]) => name);
    };
    assertEquals(unsupported("Github"), ["NestedGroups"]);
    assertEquals(unsupported("Gitlab"), []);
    assertEquals(unsupported("Git"), ["ProtectedBranches", "Issues", "ChangeRequests", "NestedGroups"]);
  },
);

proves(
  ["0023-if-workspaces FR-022"],
  "a repository is in one of ten states, and the action of each is the one the specification names",
  () => {
    assertEquals(keys(repoStates), [
      "Missing",
      "Clean",
      "Dirty",
      "Ahead",
      "Behind",
      "Diverged",
      "Locked",
      "Detached",
      "WrongRemote",
      "NotARepo",
    ]);
    const action = Object.fromEntries(Object.entries(repoStates).map(([k, s]) => [k, s.values.defaultAction.iri.slice(IFWS.iri.length)]));
    assertEquals(action, {
      Missing: "Clone",
      Clean: "Skip",
      Dirty: "Skip",
      Ahead: "Skip",
      Behind: "FastForward",
      Diverged: "Skip",
      Locked: "Skip",
      Detached: "Skip",
      WrongRemote: "Refuse",
      NotARepo: "Refuse",
    });
  },
);

proves(
  ["0023-if-workspaces FR-026", "0023-if-workspaces FR-027"],
  "only a repository that is behind may be fast-forwarded, and only a clean, behind or missing one holds no work to lose",
  () => {
    assertEquals(
      Object.entries(repoStates)
        .filter(([, s]) => s.values.fastForwardable)
        .map(([k]) => k),
      ["Behind"],
    );
    assertEquals(
      Object.entries(repoStates)
        .filter(([, s]) => !s.values.holdsLocalWork)
        .map(([k]) => k),
      ["Missing", "Clean", "Behind"],
    );
    for (const s of Object.values(repoStates))
      assertEquals(s.values.fastForwardable, s.values.defaultAction.iri === actionKinds.FastForward.iri);
    // a state that holds work is never cloned over or fast-forwarded
    for (const s of Object.values(repoStates))
      if (s.values.holdsLocalWork)
        assert(s.values.defaultAction.iri === actionKinds.Skip.iri || s.values.defaultAction.iri === actionKinds.Refuse.iri);
  },
);

proves(["0023-if-workspaces FR-023"], "an action is one of ten kinds", () => {
  assertEquals(keys(actionKinds), [
    "Clone",
    "FastForward",
    "CreateWorktree",
    "ConfigureRepo",
    "ConfigureHost",
    "WriteGenerated",
    "RemoveGenerated",
    "InstallTool",
    "Skip",
    "Refuse",
  ]);
});

proves(
  ["0023-if-workspaces FR-029", "0023-if-workspaces FR-030"],
  "only removing a generated file is destructive, and only installing a tool and configuring the host change the host",
  () => {
    assertEquals(
      Object.entries(actionKinds)
        .filter(([, k]) => k.values.destructive)
        .map(([n]) => n),
      ["RemoveGenerated"],
    );
    assertEquals(
      Object.entries(actionKinds)
        .filter(([, k]) => k.values.hostChange)
        .map(([n]) => n),
      ["ConfigureHost", "InstallTool"],
    );
  },
);

proves(
  ["0023-if-workspaces FR-035"],
  "a finding's severity is informational, warning or error, written as the SARIF level note, warning or error",
  () => {
    assertEquals(keys(severities), ["Informational", "Warning", "Error"]);
    assertEquals(
      Object.values(severities).map((s) => s.values.sarifLevel),
      ["note", "warning", "error"],
    );
  },
);

proves(["0025-ifws FR-004"], "modules are looked for built-in first, then registered, then on the path", () => {
  assertEquals(keys(moduleSources), ["BuiltIn", "Registered", "Path"]);
  assertEquals(
    Object.values(moduleSources)
      .map((s) => s.values.precedence)
      .sort((a, b) => a - b),
    [1, 2, 3],
  );
  const order = Object.entries(moduleSources)
    .sort(([, a], [, b]) => a.values.precedence - b.values.precedence)
    .map(([n]) => n);
  assertEquals(order, ["BuiltIn", "Registered", "Path"]);
});

proves(["0025-ifws FR-010"], "a run exits 0 ok, 1 findings, 2 usage or 3 environment", () => {
  assertEquals(Object.fromEntries(Object.entries(exitStatuses).map(([n, s]) => [n, s.values.exitCode])), {
    Ok: 0,
    Findings: 1,
    Usage: 2,
    Environment: 3,
  });
});

proves(["0023-if-workspaces FR-044"], "IFWS has its own namespace, and the code lists are the ones the audit names", () => {
  assertEquals(IFWS.iri, "https://www.intellectualfrontiers.com/ontology/ifws#");
  assertEquals(IFWS.prefix, "ifws");
  assert(IFWS.iri !== MZ.iri);
  assertEquals([...keys(codeLists)].sort(), [
    "ActionKind",
    "ExitStatus",
    "GitCapability",
    "GitManagerKind",
    "ModuleSource",
    "RepoState",
    "Severity",
  ]);
  for (const [name, list] of Object.entries(codeLists))
    for (const individual of Object.values(list) as readonly { readonly class: { readonly iri: string } }[])
      assert(individual.class.iri === ifws[name as keyof typeof codeLists].iri, name);
});
