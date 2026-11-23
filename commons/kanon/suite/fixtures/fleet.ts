/**
 * A worked fixture of a host with two dialect instances and plugins (commons kanon 0001-kanon-checker FR-010 to FR-014): the host `fleet`, its dialects `ansible` and `dsc` (each a package of its
 * own), its plugins `server` and `device` (which depends on `server`), the files each holds, and a layered model whose requirement is accounted for in each dialect. It is data and builders for the
 * tests, and the example an author of a host reads: the `kanon` field of each manifest is the form `decodeTable` reads.
 *
 * @module
 */
import {
  decodeTable,
  type Disposition,
  type ElementId,
  type ExportsMap,
  type InstanceName,
  type LayeredModel,
  parseElementId,
  parseInstanceName,
  type SourceFile,
  type Table,
} from "../../src/mod.ts";

export const HOST = "@intellectual-frontiers/fleet";
export const ANSIBLE = "@intellectual-frontiers/fleet-dialect-ansible";
export const DSC = "@intellectual-frontiers/fleet-dialect-dsc";
export const SERVER = "@intellectual-frontiers/fleet-server";
export const DEVICE = "@intellectual-frontiers/fleet-device";

/** The `kanon` field of the host's manifest. */
export const HOST_FORM = {
  package: HOST,
  family: { dialect: "{host}-dialect-{name}", plugin: "{host}-{name}", contract: "./plugin" },
  units: [
    { folder: "./", own: true },
    { folder: "src/governance/", layer: "governance" },
    { folder: "src/logical/", layer: "logical" },
    { folder: "src/physical/dialect/", layer: "physical" },
    { folder: "src/physical/plugin/", layer: "physical" },
    { folder: "src/physical/surfaces/", layer: "physical", instances: true },
    { folder: "suite/", own: true },
  ],
  instances: [
    { name: "ansible", instanceOf: "src/physical/dialect/", placement: "package" },
    { name: "dsc", instanceOf: "src/physical/dialect/", placement: "package" },
  ],
  plugins: [{ noun: "server" }, { noun: "device", dependsOn: ["server"] }],
};

/** The `kanon` field of an extension's manifest: it names its host and holds its own units. */
export const extensionForm = (name: string): unknown => ({
  package: name,
  extends: HOST,
  units: [
    { folder: "src/", layer: "physical" },
    { folder: "suite/", own: true },
  ],
});

/** A table, decoded once: a fixture that is not a table is a mistake of the test. */
export function table(form: unknown): Table {
  const r = decodeTable(form);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

export const HOST_TABLE = table(HOST_FORM);
export const ANSIBLE_TABLE = table(extensionForm(ANSIBLE));
export const SERVER_TABLE = table(extensionForm(SERVER));
export const DEVICE_TABLE = table(extensionForm(DEVICE));

/** The `exports` of the host's package. */
export const HOST_EXPORTS: ExportsMap = {
  ".": "./src/governance/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./dialect": "./src/physical/dialect/mod.ts",
  "./plugin": "./src/physical/plugin/mod.ts",
};

/** The `exports` of an extension's package. */
export const EXT_EXPORTS: ExportsMap = { ".": "./src/mod.ts" };

const at = (path: string, text: string): SourceFile => ({ path, text });

/** The files of the host: no import of a member of its family. */
export const HOST_FILES: readonly SourceFile[] = [
  at("src/governance/mod.ts", "export const g = 1;\n"),
  at("src/logical/mod.ts", `import { g } from "${HOST}/governance";\nexport const l = g;\n`),
  at("src/physical/dialect/mod.ts", `import { l } from "${HOST}/logical";\nexport const port = l;\n`),
  at("src/physical/plugin/mod.ts", `import { l } from "${HOST}/logical";\nexport const contract = l;\n`),
  at("src/physical/surfaces/cli/mod.ts", `import { l } from "${HOST}/logical";\nexport const cli = l;\n`),
  at("suite/host.test.ts", `import { cli } from "${HOST}";\n`),
];

/** The files of a dialect: it extends the layers it may and the port, through the host's exports. */
export const ANSIBLE_FILES: readonly SourceFile[] = [
  at(
    "src/mod.ts",
    `import { port } from "${HOST}/dialect";\nimport { l } from "${HOST}/logical";\nimport { g } from "${HOST}/governance";\nexport const ansible = [port, l, g];\n`,
  ),
];

/** The files of the plugin `server`: through the exports and the contract. */
export const SERVER_FILES: readonly SourceFile[] = [
  at("src/mod.ts", `import { contract } from "${HOST}/plugin";\nimport { l } from "${HOST}/logical";\nexport const server = [contract, l];\n`),
];

/** The files of the plugin `device`, which declares a dependency on `server`. */
export const DEVICE_FILES: readonly SourceFile[] = [
  at("src/mod.ts", `import { contract } from "${HOST}/plugin";\nimport { server } from "${SERVER}";\nexport const device = [contract, server];\n`),
];

function id(text: string): ElementId {
  const r = parseElementId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}
function instance(text: string): InstanceName {
  const r = parseInstanceName(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

export const ANSIBLE_NAME = instance("ansible");
export const DSC_NAME = instance("dsc");
export const SSH_KEYS = id("governance:ssh-keys");
export const PLAY = id("ansible:authorized-keys");
export const DSC_RESOURCE = id("dsc:ssh-keys");

/** The dispositions of the model: the keys requirement is expressed by each dialect, the audit annotation is carried by one and unexpressed in the other. */
export const DISPOSITIONS: readonly Disposition[] = [
  { element: SSH_KEYS, annotation: "effect", outcome: "expressed", target: PLAY, instance: ANSIBLE_NAME },
  { element: SSH_KEYS, annotation: "effect", outcome: "expressed", target: DSC_RESOURCE, instance: DSC_NAME },
  { element: SSH_KEYS, annotation: "audit", outcome: "carried", target: PLAY, instance: ANSIBLE_NAME },
  { element: SSH_KEYS, annotation: "audit", outcome: "unexpressed", reason: "DSC has no audit trail for a file resource", instance: DSC_NAME },
];

/** The layered model of the fixture host: one requirement with two annotations, and one element of each dialect. */
export function model(dispositions: readonly Disposition[] = DISPOSITIONS): LayeredModel {
  return {
    name: "fleet",
    library: "fleet",
    title: "Fleet",
    summary: "A host with two dialects.",
    layers: [
      { id: "governance", title: "Governance", summary: "What it is.", kinds: ["requirement"] },
      { id: "logical", title: "Logical", summary: "The order.", kinds: ["order"] },
      { id: "physical", title: "Physical", summary: "The dialects.", kinds: ["play", "resource"] },
    ],
    elements: [
      {
        id: SSH_KEYS,
        layer: "governance",
        kind: "requirement",
        name: "Admin SSH keys",
        definition: "The administrators' authorized keys are those the fleet declares.",
        source: { file: "src/governance/keys.ts", line: 4 },
        properties: { effect: "write", audit: true },
      },
      {
        id: id("order:ssh-keys"),
        layer: "logical",
        kind: "order",
        name: "SSH keys order",
        definition: "Keys to install.",
        source: { file: "src/order.ts", line: 1 },
        properties: {},
      },
      {
        id: PLAY,
        layer: "physical",
        kind: "play",
        name: "authorized keys",
        definition: "An Ansible task that sets them.",
        source: { file: "src/play.ts", line: 1 },
        properties: {},
        instance: ANSIBLE_NAME,
      },
      {
        id: DSC_RESOURCE,
        layer: "physical",
        kind: "resource",
        name: "ssh keys",
        definition: "A DSC resource that sets them.",
        source: { file: "src/resource.ts", line: 1 },
        properties: {},
        instance: DSC_NAME,
      },
    ],
    trace: [
      { from: SSH_KEYS, to: id("order:ssh-keys"), how: "plans" },
      { from: id("order:ssh-keys"), to: PLAY, how: "renders" },
      { from: id("order:ssh-keys"), to: DSC_RESOURCE, how: "renders" },
    ],
    findings: [],
    dispositions,
    instances: [ANSIBLE_NAME, DSC_NAME],
  };
}
