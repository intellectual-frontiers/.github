/**
 * The vocabulary of Intellectual Frontiers Workspaces, IFWS (commons 0023-if-workspaces, 0024-ifws-host, 0025-ifws): a workspace and its repositories, the Git managers that
 * host them, the tools it may use, its policy, the plan that brings it to the state it should be in, the findings it reports, the files it generates and the modules of its command.
 *
 * @remarks
 * IFWS is the product, Mizan is only the specification and ontology strategy these specifications are written in, so the vocabulary has its own namespace (`ifws:`) and borrows
 * nothing from `mz:` but the audit records that say what each term rests on (`audit.ts`, 0018-standards-first FR-003). The code lists carry the facts the command branches on:
 * which Git manager supports which capability, which state of a repository allows a fast-forward, which kind of action is destructive or changes the host, how a severity maps to a
 * SARIF level, in which order modules are found and what each exit status is, so that the specifications, the tools and the tests read one source.
 *
 * @limits
 * The properties are not audited yet, like Mizan's own (0012-ontology FR-014): the audit holds every class and code-list class. The classes have no individuals but the code lists:
 * a workspace's own repositories, tools and policy are the manifest's typed values (0024-ifws-host FR-001), not ontology.
 *
 * @module
 */
import {
  classSchema,
  codes,
  DatatypeProperty,
  en,
  iriIn,
  many,
  namespace,
  named,
  ObjectProperty,
  one,
  ontologyOf,
  optional,
  OwlClass,
  OwlOntology,
  PROV,
  prov,
  range,
  rdfs,
  skos,
  vocabulary,
  xsd,
} from "../../ts/kernel/rdf.ts";
import { schema } from "../supply-chain/packaging/schema.auto.ts";

/** The namespace of IFWS's terms. */
export const IFWS = namespace("ifws", "https://www.intellectualfrontiers.com/ontology/ifws#");
/** The namespace of the versions of IFWS's ontology: `owl:versionIRI` names one of them. */
export const IFWSV = namespace("ifwsv", "https://www.intellectualfrontiers.com/ontology/ifws/");
/** The namespace of DCAT, whose catalog the tool catalog specializes. */
export const DCAT = namespace("dcat", "http://www.w3.org/ns/dcat#");
/** The terms of `dcat:` that IFWS states. */
export const dcat = vocabulary(DCAT, { Catalog: "rdfs:Class" });
/** The terms of PROV-O that IFWS states and the kernel does not hold: the plan. */
export const provPlan = vocabulary(PROV, { Plan: "rdfs:Class" });

/** The classes of the vocabulary, by local name: each has a record of its basis in `audit.ts`. */
export const CLASS_NAMES = [
  "Workspace",
  "Repository",
  "Worktree",
  "GitManager",
  "GitManagerKind",
  "GitCapability",
  "Tool",
  "ToolCatalog",
  "WorkspacePolicy",
  "WorkspaceState",
  "RepoObservation",
  "RepoState",
  "Plan",
  "Action",
  "ActionKind",
  "Finding",
  "Severity",
  "GeneratedFile",
  "StateRecord",
  "Module",
  "ModuleSource",
  "ExitStatus",
  "Setup",
] as const;

/** The terms of IFWS's vocabulary: its classes and properties. */
export const ifws = vocabulary(IFWS, {
  Workspace: "owl:Class",
  Repository: "owl:Class",
  Worktree: "owl:Class",
  GitManager: "owl:Class",
  GitManagerKind: "owl:Class",
  GitCapability: "owl:Class",
  Tool: "owl:Class",
  ToolCatalog: "owl:Class",
  WorkspacePolicy: "owl:Class",
  WorkspaceState: "owl:Class",
  RepoObservation: "owl:Class",
  RepoState: "owl:Class",
  Plan: "owl:Class",
  Action: "owl:Class",
  ActionKind: "owl:Class",
  Finding: "owl:Class",
  Severity: "owl:Class",
  GeneratedFile: "owl:Class",
  StateRecord: "owl:Class",
  Module: "owl:Class",
  ModuleSource: "owl:Class",
  ExitStatus: "owl:Class",
  Setup: "owl:Class",
  // Workspace
  workspaceHome: "owl:DatatypeProperty",
  hasRepository: "owl:ObjectProperty",
  governedBy: "owl:ObjectProperty",
  usesCatalog: "owl:ObjectProperty",
  // Repository and worktree
  repoPath: "owl:DatatypeProperty",
  remoteUrl: "owl:DatatypeProperty",
  gitHost: "owl:DatatypeProperty",
  defaultBranch: "owl:DatatypeProperty",
  managedBy: "owl:ObjectProperty",
  worktreeOf: "owl:ObjectProperty",
  branchSlug: "owl:DatatypeProperty",
  // Git manager
  managerKind: "owl:ObjectProperty",
  managerHost: "owl:DatatypeProperty",
  supports: "owl:ObjectProperty",
  // Tool and catalog
  toolName: "owl:DatatypeProperty",
  toolVersion: "owl:DatatypeProperty",
  toolSha256: "owl:DatatypeProperty",
  toolOs: "owl:DatatypeProperty",
  toolArch: "owl:DatatypeProperty",
  toolUrl: "owl:DatatypeProperty",
  provides: "owl:DatatypeProperty",
  catalogs: "owl:ObjectProperty",
  // Policy
  requiresSignedCommits: "owl:DatatypeProperty",
  regulatedDomain: "owl:DatatypeProperty",
  unapprovedGraceDays: "owl:DatatypeProperty",
  allowedGitHost: "owl:DatatypeProperty",
  // State
  hasObservation: "owl:ObjectProperty",
  observedAt: "owl:DatatypeProperty",
  observationOf: "owl:ObjectProperty",
  inState: "owl:ObjectProperty",
  aheadBy: "owl:DatatypeProperty",
  behindBy: "owl:DatatypeProperty",
  stashCount: "owl:DatatypeProperty",
  fastForwardable: "owl:DatatypeProperty",
  holdsLocalWork: "owl:DatatypeProperty",
  defaultAction: "owl:ObjectProperty",
  // Plan and action
  plannedFor: "owl:ObjectProperty",
  hasAction: "owl:ObjectProperty",
  actionKind: "owl:ObjectProperty",
  actionTarget: "owl:DatatypeProperty",
  actionReason: "owl:DatatypeProperty",
  destructive: "owl:DatatypeProperty",
  hostChange: "owl:DatatypeProperty",
  // Finding
  severity: "owl:ObjectProperty",
  ruleId: "owl:DatatypeProperty",
  message: "owl:DatatypeProperty",
  subject: "owl:DatatypeProperty",
  firstSeenOn: "owl:DatatypeProperty",
  sarifLevel: "owl:DatatypeProperty",
  // Generated files and the state record
  generatedPath: "owl:DatatypeProperty",
  generatedBy: "owl:DatatypeProperty",
  contentSha256: "owl:DatatypeProperty",
  fileMode: "owl:DatatypeProperty",
  recordsFile: "owl:ObjectProperty",
  lastPlan: "owl:ObjectProperty",
  // Module and exit status
  moduleName: "owl:DatatypeProperty",
  moduleSummary: "owl:DatatypeProperty",
  moduleSource: "owl:ObjectProperty",
  precedence: "owl:DatatypeProperty",
  exitCode: "owl:DatatypeProperty",
  // Setup
  setupPlan: "owl:ObjectProperty",
  applied: "owl:DatatypeProperty",
  installs: "owl:ObjectProperty",
});

/** The local names of the terms the vocabulary holds, as a specification may name them: the classes and properties, then every key of a code list (see `mod.ts`). */
export const VOCABULARY_NAMES: readonly string[] = Object.keys(ifws);

// ---- the code lists

const CODE = { label: one(rdfs.label, range.langString), definition: optional(skos.definition, range.langString) } as const;

/** What a Git manager may offer through the one interface (commons 0023-if-workspaces FR-016, FR-017): the common capabilities and the ones a host may lack. */
export const gitCapabilities = codes(classSchema(ifws.GitCapability, CODE), IFWS, {
  CloneUrl: { label: en("clone URL"), definition: en("The URL a repository is cloned from, for a path of the workspace and the reverse.") },
  Credentials: {
    label: en("credentials"),
    definition: en("Authentication through a Git credential helper, the host's command-line tool or a token from the environment, never a secret stored in a file."),
  },
  DefaultBranch: { label: en("default branch"), definition: en("The name of the branch the remote presents as its default.") },
  SignedCommits: { label: en("signed commits"), definition: en("Whether a commit's signature, OpenPGP or SSH, can be seen as verified.") },
  ProtectedBranches: { label: en("protected branches"), definition: en("Whether a branch can be asked about as protected: no push, no force, review required.") },
  Issues: { label: en("issues"), definition: en("Issues of the repository, behind the interface.") },
  ChangeRequests: { label: en("change requests"), definition: en("A pull request (GitHub) or a merge request (GitLab), behind the interface.") },
  NestedGroups: { label: en("nested groups"), definition: en("Groups to any depth between the host and the repository (GitLab); a host without them has one owner level.") },
});

/** The kinds of action a plan holds (commons 0023-if-workspaces FR-023): whether the kind removes what exists, and whether it changes the host outside the workspace. */
export const actionKinds = codes(
  classSchema(ifws.ActionKind, {
    ...CODE,
    destructive: one(ifws.destructive, range.boolean),
    hostChange: one(ifws.hostChange, range.boolean),
  }),
  IFWS,
  {
    Clone: { label: en("clone"), definition: en("Clone a repository that is missing."), destructive: false, hostChange: false },
    FastForward: {
      label: en("fast-forward"),
      definition: en("Move a branch that is behind its remote forward, with no merge, rebase or reset."),
      destructive: false,
      hostChange: false,
    },
    CreateWorktree: { label: en("create worktree"), definition: en("Add a worktree of a repository for a branch."), destructive: false, hostChange: false },
    ConfigureRepo: {
      label: en("configure repository"),
      definition: en("Set a repository's local Git configuration: its hooks path, signing and, on Windows, long paths."),
      destructive: false,
      hostChange: false,
    },
    ConfigureHost: {
      label: en("configure host"),
      definition: en("Change the host outside the workspace: the Windows long-path setting, the global Git include or the shell snippet; only `ifws setup` may do it."),
      destructive: false,
      hostChange: true,
    },
    WriteGenerated: { label: en("write generated file"), definition: en("Write a generated file inside the workspace."), destructive: false, hostChange: false },
    RemoveGenerated: {
      label: en("remove generated file"),
      definition: en("Remove a generated file that the state record holds and nobody edited."),
      destructive: true,
      hostChange: false,
    },
    InstallTool: {
      label: en("install tool"),
      definition: en("Install a pinned artifact of the tool catalog into the workspace's tool store; only `ifws setup` may do it."),
      destructive: false,
      hostChange: true,
    },
    Skip: { label: en("skip"), definition: en("Do nothing, and say why."), destructive: false, hostChange: false },
    Refuse: { label: en("refuse"), definition: en("Do nothing because doing it would not be safe, and say why."), destructive: false, hostChange: false },
  },
);

/** The severities of a finding and the SARIF level each maps to (commons 0023-if-workspaces FR-035). */
export const severities = codes(classSchema(ifws.Severity, { ...CODE, sarifLevel: one(ifws.sarifLevel, range.oneOf(["note", "warning", "error"] as const)) }), IFWS, {
  Informational: { label: en("informational"), definition: en("To be known, never failing a run."), sarifLevel: "note" },
  Warning: { label: en("warning"), definition: en("To be fixed; a run that has one exits with findings."), sarifLevel: "warning" },
  Error: { label: en("error"), definition: en("Wrong now; a run that has one exits with findings and a plan does not act on what it names."), sarifLevel: "error" },
});

/** The observed state of one repository against its remote and its folder (commons 0023-if-workspaces FR-022). */
export const repoStates = codes(
  classSchema(ifws.RepoState, {
    ...CODE,
    defaultAction: one(ifws.defaultAction, range.ref<"ifws:ActionKind">()),
    fastForwardable: one(ifws.fastForwardable, range.boolean),
    holdsLocalWork: one(ifws.holdsLocalWork, range.boolean),
  }),
  IFWS,
  {
    Missing: {
      label: en("missing"),
      definition: en("Nothing is at the repository's path."),
      defaultAction: actionKinds.Clone,
      fastForwardable: false,
      holdsLocalWork: false,
    },
    Clean: {
      label: en("clean"),
      definition: en("The branch equals its remote and the working tree has no change."),
      defaultAction: actionKinds.Skip,
      fastForwardable: false,
      holdsLocalWork: false,
    },
    Dirty: {
      label: en("dirty"),
      definition: en("The working tree has uncommitted or untracked changes."),
      defaultAction: actionKinds.Skip,
      fastForwardable: false,
      holdsLocalWork: true,
    },
    Ahead: {
      label: en("ahead"),
      definition: en("The branch has commits its remote does not."),
      defaultAction: actionKinds.Skip,
      fastForwardable: false,
      holdsLocalWork: true,
    },
    Behind: {
      label: en("behind"),
      definition: en("The remote has commits the branch does not, and the branch has none of its own."),
      defaultAction: actionKinds.FastForward,
      fastForwardable: true,
      holdsLocalWork: false,
    },
    Diverged: {
      label: en("diverged"),
      definition: en("Both the branch and its remote have commits the other lacks."),
      defaultAction: actionKinds.Skip,
      fastForwardable: false,
      holdsLocalWork: true,
    },
    Locked: {
      label: en("locked"),
      definition: en("A Git lock file is present: another process may be working in the repository."),
      defaultAction: actionKinds.Skip,
      fastForwardable: false,
      holdsLocalWork: true,
    },
    Detached: {
      label: en("detached"),
      definition: en("HEAD is on no branch."),
      defaultAction: actionKinds.Skip,
      fastForwardable: false,
      holdsLocalWork: true,
    },
    WrongRemote: {
      label: en("wrong remote"),
      definition: en("The repository at the path has a remote other than the one the manifest names."),
      defaultAction: actionKinds.Refuse,
      fastForwardable: false,
      holdsLocalWork: true,
    },
    NotARepo: {
      label: en("not a repository"),
      definition: en("Something other than a Git repository is at the path."),
      defaultAction: actionKinds.Refuse,
      fastForwardable: false,
      holdsLocalWork: true,
    },
  },
);

/** The kinds of Git manager, and what each supports (commons 0023-if-workspaces FR-016, FR-017): a capability a kind does not list is unsupported. */
export const gitManagerKinds = codes(classSchema(ifws.GitManagerKind, { ...CODE, supports: many(ifws.supports, range.ref<"ifws:GitCapability">()) }), IFWS, {
  Github: {
    label: en("GitHub"),
    definition: en("GitHub, public and private repositories: an owner and a repository."),
    supports: [
      gitCapabilities.CloneUrl,
      gitCapabilities.Credentials,
      gitCapabilities.DefaultBranch,
      gitCapabilities.SignedCommits,
      gitCapabilities.ProtectedBranches,
      gitCapabilities.Issues,
      gitCapabilities.ChangeRequests,
    ],
  },
  Gitlab: {
    label: en("GitLab"),
    definition: en("GitLab, public and private repositories, in groups to any depth."),
    supports: [
      gitCapabilities.CloneUrl,
      gitCapabilities.Credentials,
      gitCapabilities.DefaultBranch,
      gitCapabilities.SignedCommits,
      gitCapabilities.ProtectedBranches,
      gitCapabilities.Issues,
      gitCapabilities.ChangeRequests,
      gitCapabilities.NestedGroups,
    ],
  },
  Git: {
    label: en("plain Git"),
    definition: en("Any other Git remote: what Git itself offers and nothing a host adds."),
    supports: [gitCapabilities.CloneUrl, gitCapabilities.Credentials, gitCapabilities.DefaultBranch, gitCapabilities.SignedCommits],
  },
});

/** Where a module of the command is found, in the order it is looked for (commons 0025-ifws FR-004). */
export const moduleSources = codes(classSchema(ifws.ModuleSource, { ...CODE, precedence: one(ifws.precedence, range.integer) }), IFWS, {
  BuiltIn: { label: en("built-in"), definition: en("A typed module the command holds."), precedence: 1 },
  Registered: { label: en("registered"), definition: en("A module the workspace names in `modules.auto.json`."), precedence: 2 },
  Path: { label: en("on the path"), definition: en("An executable named `ifws-*` on the `PATH`, like Git's `git-foo`."), precedence: 3 },
});

/** The statuses a run exits with (commons 0025-ifws FR-010). */
export const exitStatuses = codes(classSchema(ifws.ExitStatus, { ...CODE, exitCode: one(ifws.exitCode, range.integer) }), IFWS, {
  Ok: { label: en("ok"), definition: en("The run did what was asked and has no warning or error."), exitCode: 0 },
  Findings: { label: en("findings"), definition: en("The run ended and has at least one warning or error."), exitCode: 1 },
  Usage: { label: en("usage"), definition: en("The command line is wrong: an unknown command, option or argument."), exitCode: 2 },
  Environment: { label: en("environment"), definition: en("The host cannot run it: a missing tool, an unwritable or absent home, an unsupported runtime."), exitCode: 3 },
});

// ---- the class schemas the data is made with

/** The schema of a tool of the catalog (`ifws:Tool`): a pinned artifact for one operating system and architecture. */
export const Tool = classSchema(ifws.Tool, {
  toolName: one(ifws.toolName, range.string),
  toolVersion: one(ifws.toolVersion, range.string),
  toolOs: one(ifws.toolOs, range.oneOf(["linux", "macos", "windows"] as const)),
  toolArch: one(ifws.toolArch, range.oneOf(["x64", "arm64"] as const)),
  toolUrl: one(ifws.toolUrl, range.string),
  toolSha256: one(ifws.toolSha256, range.string),
  provides: many(ifws.provides, range.string),
});

/** The schema of a workspace's policy (`ifws:WorkspacePolicy`). */
export const WorkspacePolicy = classSchema(ifws.WorkspacePolicy, {
  requiresSignedCommits: one(ifws.requiresSignedCommits, range.boolean),
  regulatedDomain: many(ifws.regulatedDomain, range.string),
  unapprovedGraceDays: one(ifws.unapprovedGraceDays, range.integer),
  allowedGitHost: many(ifws.allowedGitHost, range.string),
});

/** The schema of a finding (`ifws:Finding`): the rule that found it, how serious it is, what it is about and the day it was first seen. */
export const Finding = classSchema(ifws.Finding, {
  ruleId: one(ifws.ruleId, range.string),
  severity: one(ifws.severity, range.ref<"ifws:Severity">()),
  message: one(ifws.message, range.string),
  subject: one(ifws.subject, range.string),
  firstSeenOn: many(ifws.firstSeenOn, range.string),
});

/** The schema of a step of a plan (`ifws:Action`). */
export const Action = classSchema(ifws.Action, {
  actionKind: one(ifws.actionKind, range.ref<"ifws:ActionKind">()),
  actionTarget: one(ifws.actionTarget, range.string),
  actionReason: many(ifws.actionReason, range.string),
});

/** The schema of a generated file (`ifws:GeneratedFile`). */
export const GeneratedFile = classSchema(ifws.GeneratedFile, {
  generatedPath: one(ifws.generatedPath, range.string),
  generatedBy: one(ifws.generatedBy, range.string),
  contentSha256: one(ifws.contentSha256, range.string),
  fileMode: one(ifws.fileMode, range.oneOf(["0644", "0755"] as const)),
});

/** The schema of a module of the command (`ifws:Module`). */
export const Module = classSchema(ifws.Module, {
  moduleName: one(ifws.moduleName, range.string),
  moduleSummary: one(ifws.moduleSummary, range.string),
  moduleSource: one(ifws.moduleSource, range.ref<"ifws:ModuleSource">()),
});

// ---- the classes, each with its label and definition

/** The classes, each with its label and definition. */
export const classes = [
  OwlClass.make(ifws.Workspace, {
    label: en("Workspace"),
    definition: en("The one root folder of Intellectual Frontiers Workspaces: the repositories, worktrees, tools, policy and generated files under it, and nothing outside it."),
  }),
  OwlClass.make(ifws.Repository, {
    label: en("Repository"),
    definition: en("A Git repository cloned into the workspace at the path that mirrors its remote URL."),
  }),
  OwlClass.make(ifws.Worktree, {
    label: en("Worktree"),
    definition: en("A Git worktree of a repository, made for one branch when another person or agent, or uncommitted work, is on the repository."),
  }),
  OwlClass.make(ifws.GitManager, {
    label: en("Git manager"),
    definition: en("The one interface to a Git host: its clone URL, credentials, default branch, protected branches, issues, change requests and signed commits, with `unsupported` where a host lacks one."),
  }),
  OwlClass.make(ifws.GitManagerKind, { label: en("Git manager kind"), definition: en("GitHub, GitLab or plain Git, with the capabilities each supports.") }),
  OwlClass.make(ifws.GitCapability, { label: en("Git capability"), definition: en("One thing a Git manager may offer through the interface.") }),
  OwlClass.make(ifws.Tool, {
    label: en("Tool"),
    subClassOf: [schema.SoftwareApplication],
    definition: en("A program the workspace may use: its name, version and, for one operating system and architecture, the artifact's URL and SHA-256."),
  }),
  OwlClass.make(ifws.ToolCatalog, {
    label: en("Tool catalog"),
    subClassOf: [dcat.Catalog],
    definition: en("The tools a workspace approves, each pinned to a version and a hash; a tool outside it is a finding."),
  }),
  OwlClass.make(ifws.WorkspacePolicy, {
    label: en("Workspace policy"),
    definition: en("What the workspace requires: signed commits, the regulated domain it claims, the days an unapproved tool or module is only informational and the Git hosts it allows."),
  }),
  OwlClass.make(ifws.WorkspaceState, {
    label: en("Workspace state"),
    subClassOf: [prov.Entity],
    definition: en("What was observed of the workspace on one day: the observation of each of its repositories."),
  }),
  OwlClass.make(ifws.RepoObservation, {
    label: en("Repository observation"),
    definition: en("The state of one repository at a time: its state, how many commits it is ahead or behind and how many stashes it holds."),
  }),
  OwlClass.make(ifws.RepoState, { label: en("Repository state"), definition: en("Missing, clean, dirty, ahead, behind, diverged, locked, detached, on the wrong remote or not a repository.") }),
  OwlClass.make(ifws.Plan, {
    label: en("Plan"),
    subClassOf: [provPlan.Plan],
    definition: en("The actions that would bring the workspace from its observed state to the one its manifest states; making it changes nothing."),
  }),
  OwlClass.make(ifws.Action, {
    label: en("Action"),
    subClassOf: [schema.Action],
    definition: en("One step of a plan: its kind, what it acts on and, for a skip or a refusal, why."),
  }),
  OwlClass.make(ifws.ActionKind, { label: en("Action kind"), definition: en("Clone, fast-forward, create a worktree, configure a repository, write or remove a generated file, install a tool, skip or refuse.") }),
  OwlClass.make(ifws.Finding, {
    label: en("Finding"),
    definition: en("What a check reports: the rule, a severity, what it is about and the day it was first seen; it is written as a SARIF result."),
  }),
  OwlClass.make(ifws.Severity, { label: en("Severity"), definition: en("Informational, warning or error, each with the SARIF level it is written as.") }),
  OwlClass.make(ifws.GeneratedFile, {
    label: en("Generated file"),
    subClassOf: [prov.Entity],
    definition: en("A file a typed template makes inside the workspace, named `.auto.`, with a header that names its generator, never edited by hand."),
  }),
  OwlClass.make(ifws.StateRecord, {
    label: en("State record"),
    subClassOf: [prov.Entity],
    definition: en("The record of what the last run wrote: the hash of each generated file, the last plan and the day each unapproved tool or module was first seen."),
  }),
  OwlClass.make(ifws.Module, {
    label: en("Module"),
    subClassOf: [schema.SoftwareApplication],
    definition: en("A part of the command, `ifws-<name>`: built in, registered by the workspace or an executable on the path."),
  }),
  OwlClass.make(ifws.ModuleSource, { label: en("Module source"), definition: en("Built-in, registered or on the path, in the order a module is looked for.") }),
  OwlClass.make(ifws.ExitStatus, { label: en("Exit status"), definition: en("What a run exits with: 0 ok, 1 findings, 2 usage, 3 environment.") }),
  OwlClass.make(ifws.Setup, {
    label: en("Setup"),
    subClassOf: [prov.Activity],
    definition: en("The one run that may install a pinned tool or change the host: its plan, and whether it was applied or only shown."),
  }),
] as const;

const WORKSPACE = ifws.Workspace;

/** The properties, each with its domain, range and definition. */
export const properties = [
  DatatypeProperty.make(ifws.workspaceHome, { domain: WORKSPACE, range: xsd.string, definition: en("The workspace's root folder, as `$IFC_WORKSPACES_HOME` or `--home` gives it.") }),
  ObjectProperty.make(ifws.hasRepository, { domain: WORKSPACE, range: ifws.Repository, definition: en("A repository of the workspace.") }),
  ObjectProperty.make(ifws.governedBy, { domain: WORKSPACE, range: ifws.WorkspacePolicy, definition: en("The policy the workspace is held to.") }),
  ObjectProperty.make(ifws.usesCatalog, { domain: WORKSPACE, range: ifws.ToolCatalog, definition: en("The catalog of tools the workspace approves.") }),
  DatatypeProperty.make(ifws.repoPath, { domain: ifws.Repository, range: xsd.string, definition: en("The repository's path under the root, `/`-separated: the Git host, the path of the remote and the repository.") }),
  DatatypeProperty.make(ifws.remoteUrl, { domain: ifws.Repository, range: xsd.string, definition: en("The URL the repository is cloned from.") }),
  DatatypeProperty.make(ifws.gitHost, { domain: ifws.Repository, range: xsd.string, definition: en("The name of the Git host, in lower case, the first segment of the repository's path.") }),
  DatatypeProperty.make(ifws.defaultBranch, { domain: ifws.Repository, range: xsd.string, definition: en("The branch the remote presents as its default.") }),
  ObjectProperty.make(ifws.managedBy, { domain: ifws.Repository, range: ifws.GitManager, definition: en("The Git manager that serves the repository's host.") }),
  ObjectProperty.make(ifws.worktreeOf, { domain: ifws.Worktree, range: ifws.Repository, definition: en("The repository the worktree is of.") }),
  DatatypeProperty.make(ifws.branchSlug, { domain: ifws.Worktree, range: xsd.string, definition: en("The branch's name made into one portable path segment: the last segment of the worktree's path.") }),
  ObjectProperty.make(ifws.managerKind, { domain: ifws.GitManager, range: ifws.GitManagerKind, definition: en("GitHub, GitLab or plain Git.") }),
  DatatypeProperty.make(ifws.managerHost, { domain: ifws.GitManager, range: xsd.string, definition: en("The host name the manager serves, `github.com` or a host a manifest names.") }),
  ObjectProperty.make(ifws.supports, { domain: ifws.GitManagerKind, range: ifws.GitCapability, definition: en("A capability the kind of Git manager supports; one it does not list is unsupported.") }),
  DatatypeProperty.make(ifws.toolName, { domain: ifws.Tool, range: xsd.string, definition: en("The tool's name.") }),
  DatatypeProperty.make(ifws.toolVersion, { domain: ifws.Tool, range: xsd.string, definition: en("The one version pinned, never `latest` and never a range.") }),
  DatatypeProperty.make(ifws.toolSha256, { domain: ifws.Tool, range: xsd.string, definition: en("The SHA-256 of the artifact, in lower-case hexadecimal.") }),
  DatatypeProperty.make(ifws.toolOs, { domain: ifws.Tool, range: xsd.string, definition: en("The operating system the artifact is for: linux, macos or windows.") }),
  DatatypeProperty.make(ifws.toolArch, { domain: ifws.Tool, range: xsd.string, definition: en("The processor architecture the artifact is for: x64 or arm64.") }),
  DatatypeProperty.make(ifws.toolUrl, { domain: ifws.Tool, range: xsd.string, definition: en("The `https` URL the artifact is fetched from.") }),
  DatatypeProperty.make(ifws.provides, { domain: ifws.Tool, range: xsd.string, definition: en("A command or a capability the tool provides.") }),
  ObjectProperty.make(ifws.catalogs, { domain: ifws.ToolCatalog, range: ifws.Tool, definition: en("A tool the catalog approves.") }),
  DatatypeProperty.make(ifws.requiresSignedCommits, { domain: ifws.WorkspacePolicy, range: xsd.boolean, definition: en("Whether a commit that is not signed and verified is an error; true for a regulated domain.") }),
  DatatypeProperty.make(ifws.regulatedDomain, { domain: ifws.WorkspacePolicy, range: xsd.string, definition: en("A regulated domain the workspace claims, such as the one of the FDA's QMSR.") }),
  DatatypeProperty.make(ifws.unapprovedGraceDays, { domain: ifws.WorkspacePolicy, range: xsd.integer, definition: en("The days a tool or module outside the catalog is informational, counted from the day it was first seen; 90 unless the policy lowers it.") }),
  DatatypeProperty.make(ifws.allowedGitHost, { domain: ifws.WorkspacePolicy, range: xsd.string, definition: en("A Git host a repository may be cloned from; with none, any.") }),
  ObjectProperty.make(ifws.hasObservation, { domain: ifws.WorkspaceState, range: ifws.RepoObservation, definition: en("The observation of one repository.") }),
  DatatypeProperty.make(ifws.observedAt, { domain: ifws.WorkspaceState, range: xsd.string, definition: en("The day (YYYY-MM-DD) of the observation.") }),
  ObjectProperty.make(ifws.observationOf, { domain: ifws.RepoObservation, range: ifws.Repository, definition: en("The repository observed.") }),
  ObjectProperty.make(ifws.inState, { domain: ifws.RepoObservation, range: ifws.RepoState, definition: en("The state the repository was in.") }),
  DatatypeProperty.make(ifws.aheadBy, { domain: ifws.RepoObservation, range: xsd.integer, definition: en("The commits the branch has that its remote does not.") }),
  DatatypeProperty.make(ifws.behindBy, { domain: ifws.RepoObservation, range: xsd.integer, definition: en("The commits the remote has that the branch does not.") }),
  DatatypeProperty.make(ifws.stashCount, { domain: ifws.RepoObservation, range: xsd.integer, definition: en("The entries of the repository's stash.") }),
  DatatypeProperty.make(ifws.fastForwardable, { domain: ifws.RepoState, range: xsd.boolean, definition: en("Whether a plan may hold a fast-forward of a repository in this state: only where the branch is behind and holds nothing of its own.") }),
  DatatypeProperty.make(ifws.holdsLocalWork, { domain: ifws.RepoState, range: xsd.boolean, definition: en("Whether the folder may hold work that exists nowhere else, so that nothing may remove it; true wherever it is not known to be clean.") }),
  ObjectProperty.make(ifws.defaultAction, { domain: ifws.RepoState, range: ifws.ActionKind, definition: en("The kind of action a plan holds for a repository in this state, before a policy changes it.") }),
  ObjectProperty.make(ifws.plannedFor, { domain: ifws.Plan, range: WORKSPACE, definition: en("The workspace the plan is for.") }),
  ObjectProperty.make(ifws.hasAction, { domain: ifws.Plan, range: ifws.Action, definition: en("A step of the plan, in order.") }),
  ObjectProperty.make(ifws.actionKind, { domain: ifws.Action, range: ifws.ActionKind, definition: en("The kind of action.") }),
  DatatypeProperty.make(ifws.actionTarget, { domain: ifws.Action, range: xsd.string, definition: en("What the action acts on: a path under the root, or a tool's name and version.") }),
  DatatypeProperty.make(ifws.actionReason, { domain: ifws.Action, range: xsd.string, definition: en("Why a step is skipped or refused.") }),
  DatatypeProperty.make(ifws.destructive, { domain: ifws.ActionKind, range: xsd.boolean, definition: en("Whether the kind removes what exists: it runs only when asked for, and a dry run shows it first.") }),
  DatatypeProperty.make(ifws.hostChange, { domain: ifws.ActionKind, range: xsd.boolean, definition: en("Whether the kind changes the host outside the workspace's own files: only `ifws setup` may carry it out.") }),
  ObjectProperty.make(ifws.severity, { domain: ifws.Finding, range: ifws.Severity, definition: en("How serious the finding is.") }),
  DatatypeProperty.make(ifws.ruleId, { domain: ifws.Finding, range: xsd.string, definition: en("The identifier of the rule that found it, `ifws/` and a name: the SARIF `ruleId`.") }),
  DatatypeProperty.make(ifws.message, { domain: ifws.Finding, range: xsd.string, definition: en("One sentence saying what is wrong and what to do.") }),
  DatatypeProperty.make(ifws.subject, { domain: ifws.Finding, range: xsd.string, definition: en("What the finding is about: a path under the root, a tool or a module.") }),
  DatatypeProperty.make(ifws.firstSeenOn, { domain: ifws.Finding, range: xsd.string, definition: en("The day (YYYY-MM-DD) the finding was first seen, from which an informational finding turns into a warning.") }),
  DatatypeProperty.make(ifws.sarifLevel, { domain: ifws.Severity, range: xsd.string, definition: en("The SARIF `level` the severity is written as: note, warning or error.") }),
  DatatypeProperty.make(ifws.generatedPath, { domain: ifws.GeneratedFile, range: xsd.string, definition: en("The file's path under the root, `/`-separated, with `.auto.` in its name.") }),
  DatatypeProperty.make(ifws.generatedBy, { domain: ifws.GeneratedFile, range: xsd.string, definition: en("The template that made it, by name.") }),
  DatatypeProperty.make(ifws.contentSha256, { domain: ifws.GeneratedFile, range: xsd.string, definition: en("The SHA-256 of the bytes written, in lower-case hexadecimal.") }),
  DatatypeProperty.make(ifws.fileMode, { domain: ifws.GeneratedFile, range: xsd.string, definition: en("The mode the file is written with: 0644 or, for a script, 0755.") }),
  ObjectProperty.make(ifws.recordsFile, { domain: ifws.StateRecord, range: ifws.GeneratedFile, definition: en("A generated file the record holds the hash of.") }),
  ObjectProperty.make(ifws.lastPlan, { domain: ifws.StateRecord, range: ifws.Plan, definition: en("The plan of the last run that wrote.") }),
  DatatypeProperty.make(ifws.moduleName, { domain: ifws.Module, range: xsd.string, definition: en("The module's name, the part after `ifws-`: lower-case letters, digits and hyphens.") }),
  DatatypeProperty.make(ifws.moduleSummary, { domain: ifws.Module, range: xsd.string, definition: en("One line saying what the module does.") }),
  ObjectProperty.make(ifws.moduleSource, { domain: ifws.Module, range: ifws.ModuleSource, definition: en("Where the module was found.") }),
  DatatypeProperty.make(ifws.precedence, { domain: ifws.ModuleSource, range: xsd.integer, definition: en("The order the source is looked in: the lowest first.") }),
  DatatypeProperty.make(ifws.exitCode, { domain: ifws.ExitStatus, range: xsd.integer, definition: en("The number the process exits with.") }),
  ObjectProperty.make(ifws.setupPlan, { domain: ifws.Setup, range: ifws.Plan, definition: en("The plan the setup showed, and carried out where it was applied.") }),
  DatatypeProperty.make(ifws.applied, { domain: ifws.Setup, range: xsd.boolean, definition: en("Whether the setup changed anything; false for a dry run, which is the default.") }),
  ObjectProperty.make(ifws.installs, { domain: ifws.Setup, range: ifws.Tool, definition: en("A tool the setup installed.") }),
] as const;

/** The ontology itself: its label, description and version. */
export const ifwsOntology = OwlOntology.make(ontologyOf(IFWS), {
  label: en("Intellectual Frontiers Workspaces"),
  description: en("The vocabulary of Intellectual Frontiers Workspaces: the workspace and its repositories, Git managers, tools, policy, plans, findings, generated files and modules."),
  versionInfo: "1",
  versionIri: named<"owl:Ontology">(iriIn(IFWSV, "1")),
});

/** The code lists, by the class each is of. */
export const codeLists = {
  GitCapability: gitCapabilities,
  ActionKind: actionKinds,
  Severity: severities,
  RepoState: repoStates,
  GitManagerKind: gitManagerKinds,
  ModuleSource: moduleSources,
  ExitStatus: exitStatuses,
} as const;

/** The classes whose individuals are a code list: each has a record in the audit like any class. */
export const CODE_LIST_CLASSES = Object.keys(codeLists) as readonly (keyof typeof codeLists)[];

/** Every local name a specification may use after `ifws:`: the vocabulary's terms and the keys of each code list. */
export const termNames: ReadonlySet<string> = new Set([...VOCABULARY_NAMES, ...Object.values(codeLists).flatMap((list) => Object.keys(list))]);
