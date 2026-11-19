/**
 * The code lists of the vocabulary that the tests of the plan, the findings and the modules hold the code equal to, as typed values (what the ontology of Ergonex gave them when this library was ported).
 * Ergonex states its own vocabulary of these in its specifications; until its ontology is generated, these are the values the tests hold the code to.
 *
 * @module
 */

export const severities = {
  Informational: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Informational",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Severity",
    },
    values: {
      label: {
        kind: "lang",
        value: "informational",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "To be known, never failing a run.",
        language: "en",
      },
      sarifLevel: "note",
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Severity",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "informational",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "To be known, never failing a run.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#sarifLevel",
          curie: "ergonex:sarifLevel",
        },
        objects: ["note"],
        words: ["note", "warning", "error"],
      },
    ],
  },
  Warning: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Warning",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Severity",
    },
    values: {
      label: {
        kind: "lang",
        value: "warning",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "To be fixed; a run that has one exits with findings.",
        language: "en",
      },
      sarifLevel: "warning",
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Severity",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "warning",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "To be fixed; a run that has one exits with findings.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#sarifLevel",
          curie: "ergonex:sarifLevel",
        },
        objects: ["warning"],
        words: ["note", "warning", "error"],
      },
    ],
  },
  Error: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Error",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Severity",
    },
    values: {
      label: {
        kind: "lang",
        value: "error",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Wrong now; a run that has one exits with findings and a plan does not act on what it names.",
        language: "en",
      },
      sarifLevel: "error",
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Severity",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "error",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Wrong now; a run that has one exits with findings and a plan does not act on what it names.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#sarifLevel",
          curie: "ergonex:sarifLevel",
        },
        objects: ["error"],
        words: ["note", "warning", "error"],
      },
    ],
  },
} as const;

export const exitStatuses = {
  Ok: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Ok",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
    },
    values: {
      label: {
        kind: "lang",
        value: "ok",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The run did what was asked and has no warning or error.",
        language: "en",
      },
      exitCode: 0,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "ok",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The run did what was asked and has no warning or error.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#exitCode",
          curie: "ergonex:exitCode",
        },
        objects: [0],
      },
    ],
  },
  Findings: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Findings",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
    },
    values: {
      label: {
        kind: "lang",
        value: "findings",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The run ended and has at least one warning or error.",
        language: "en",
      },
      exitCode: 1,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "findings",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The run ended and has at least one warning or error.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#exitCode",
          curie: "ergonex:exitCode",
        },
        objects: [1],
      },
    ],
  },
  Usage: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Usage",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
    },
    values: {
      label: {
        kind: "lang",
        value: "usage",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The command line is wrong: an unknown command, option or argument.",
        language: "en",
      },
      exitCode: 2,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "usage",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The command line is wrong: an unknown command, option or argument.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#exitCode",
          curie: "ergonex:exitCode",
        },
        objects: [2],
      },
    ],
  },
  Environment: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Environment",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
    },
    values: {
      label: {
        kind: "lang",
        value: "environment",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The host cannot run it: a missing tool, an unwritable or absent home, an unsupported runtime.",
        language: "en",
      },
      exitCode: 3,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ExitStatus",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "environment",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The host cannot run it: a missing tool, an unwritable or absent home, an unsupported runtime.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#exitCode",
          curie: "ergonex:exitCode",
        },
        objects: [3],
      },
    ],
  },
} as const;

export const moduleSources = {
  BuiltIn: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#BuiltIn",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ModuleSource",
    },
    values: {
      label: {
        kind: "lang",
        value: "built-in",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "A typed module the command holds.",
        language: "en",
      },
      precedence: 1,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ModuleSource",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "built-in",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "A typed module the command holds.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#precedence",
          curie: "ergonex:precedence",
        },
        objects: [1],
      },
    ],
  },
  Registered: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Registered",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ModuleSource",
    },
    values: {
      label: {
        kind: "lang",
        value: "registered",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "A module the workspace names in `modules.auto.json`.",
        language: "en",
      },
      precedence: 2,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ModuleSource",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "registered",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "A module the workspace names in `modules.auto.json`.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#precedence",
          curie: "ergonex:precedence",
        },
        objects: [2],
      },
    ],
  },
  Path: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Path",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ModuleSource",
    },
    values: {
      label: {
        kind: "lang",
        value: "on the path",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "An executable named `ergonex-*` on the `PATH`, like Git's `git-foo`.",
        language: "en",
      },
      precedence: 3,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ModuleSource",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "on the path",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "An executable named `ergonex-*` on the `PATH`, like Git's `git-foo`.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#precedence",
          curie: "ergonex:precedence",
        },
        objects: [3],
      },
    ],
  },
} as const;

export const actionKinds = {
  Clone: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Clone",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "clone",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Clone a repository that is missing.",
        language: "en",
      },
      destructive: false,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "clone",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Clone a repository that is missing.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
  FastForward: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#FastForward",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "fast-forward",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Move a branch that is behind its remote forward, with no merge, rebase or reset.",
        language: "en",
      },
      destructive: false,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "fast-forward",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Move a branch that is behind its remote forward, with no merge, rebase or reset.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
  CreateWorktree: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#CreateWorktree",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "create worktree",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Add a worktree of a repository for a branch.",
        language: "en",
      },
      destructive: false,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "create worktree",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Add a worktree of a repository for a branch.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
  ConfigureRepo: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ConfigureRepo",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "configure repository",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Set a repository's local Git configuration: its hooks path, signing and, on Windows, long paths.",
        language: "en",
      },
      destructive: false,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "configure repository",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Set a repository's local Git configuration: its hooks path, signing and, on Windows, long paths.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
  ConfigureHost: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ConfigureHost",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "configure host",
        language: "en",
      },
      definition: {
        kind: "lang",
        value:
          "Change the host outside the workspace: the Windows long-path setting, the global Git include or the shell snippet; only `ergonex setup` may do it.",
        language: "en",
      },
      destructive: false,
      hostChange: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "configure host",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value:
              "Change the host outside the workspace: the Windows long-path setting, the global Git include or the shell snippet; only `ergonex setup` may do it.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [true],
      },
    ],
  },
  WriteGenerated: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#WriteGenerated",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "write generated file",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Write a generated file inside the workspace.",
        language: "en",
      },
      destructive: false,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "write generated file",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Write a generated file inside the workspace.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
  RemoveGenerated: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RemoveGenerated",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "remove generated file",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Remove a generated file that the state record holds and nobody edited.",
        language: "en",
      },
      destructive: true,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "remove generated file",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Remove a generated file that the state record holds and nobody edited.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [true],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
  InstallTool: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#InstallTool",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "install tool",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Install a pinned artifact of the tool catalog into the workspace's tool store; only `ergonex setup` may do it.",
        language: "en",
      },
      destructive: false,
      hostChange: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "install tool",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Install a pinned artifact of the tool catalog into the workspace's tool store; only `ergonex setup` may do it.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [true],
      },
    ],
  },
  Skip: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "skip",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Do nothing, and say why.",
        language: "en",
      },
      destructive: false,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "skip",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Do nothing, and say why.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
  Refuse: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Refuse",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
    },
    values: {
      label: {
        kind: "lang",
        value: "refuse",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Do nothing because doing it would not be safe, and say why.",
        language: "en",
      },
      destructive: false,
      hostChange: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "refuse",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Do nothing because doing it would not be safe, and say why.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
          curie: "ergonex:destructive",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
          curie: "ergonex:hostChange",
        },
        objects: [false],
      },
    ],
  },
} as const;

export const repoStates = {
  Missing: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Missing",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "missing",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Nothing is at the repository's path.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Clone",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "clone",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Clone a repository that is missing.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "clone",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Clone a repository that is missing.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "missing",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Nothing is at the repository's path.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Clone",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "clone",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Clone a repository that is missing.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "clone",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Clone a repository that is missing.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [false],
      },
    ],
  },
  Clean: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Clean",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "clean",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The branch equals its remote and the working tree has no change.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "skip",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "skip",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "clean",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The branch equals its remote and the working tree has no change.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "skip",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "skip",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [false],
      },
    ],
  },
  Dirty: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Dirty",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "dirty",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The working tree has uncommitted or untracked changes.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "skip",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "skip",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "dirty",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The working tree has uncommitted or untracked changes.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "skip",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "skip",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [true],
      },
    ],
  },
  Ahead: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Ahead",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "ahead",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The branch has commits its remote does not.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "skip",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "skip",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "ahead",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The branch has commits its remote does not.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "skip",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "skip",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [true],
      },
    ],
  },
  Behind: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Behind",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "behind",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The remote has commits the branch does not, and the branch has none of its own.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#FastForward",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "fast-forward",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Move a branch that is behind its remote forward, with no merge, rebase or reset.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "fast-forward",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Move a branch that is behind its remote forward, with no merge, rebase or reset.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: true,
      holdsLocalWork: false,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "behind",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The remote has commits the branch does not, and the branch has none of its own.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#FastForward",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "fast-forward",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Move a branch that is behind its remote forward, with no merge, rebase or reset.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "fast-forward",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Move a branch that is behind its remote forward, with no merge, rebase or reset.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [true],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [false],
      },
    ],
  },
  Diverged: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Diverged",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "diverged",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Both the branch and its remote have commits the other lacks.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "skip",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "skip",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "diverged",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Both the branch and its remote have commits the other lacks.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "skip",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "skip",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [true],
      },
    ],
  },
  Locked: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Locked",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "locked",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "A Git lock file is present: another process may be working in the repository.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "skip",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "skip",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "locked",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "A Git lock file is present: another process may be working in the repository.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "skip",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "skip",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [true],
      },
    ],
  },
  Detached: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Detached",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "detached",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "HEAD is on no branch.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "skip",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "skip",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "detached",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "HEAD is on no branch.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Skip",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "skip",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "skip",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [true],
      },
    ],
  },
  WrongRemote: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#WrongRemote",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "wrong remote",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "The repository at the path has a remote other than the one the manifest names.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Refuse",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "refuse",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing because doing it would not be safe, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "refuse",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing because doing it would not be safe, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "wrong remote",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "The repository at the path has a remote other than the one the manifest names.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Refuse",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "refuse",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing because doing it would not be safe, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "refuse",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing because doing it would not be safe, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [true],
      },
    ],
  },
  NotARepo: {
    kind: "named",
    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#NotARepo",
    class: {
      kind: "named",
      iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
    },
    values: {
      label: {
        kind: "lang",
        value: "not a repository",
        language: "en",
      },
      definition: {
        kind: "lang",
        value: "Something other than a Git repository is at the path.",
        language: "en",
      },
      defaultAction: {
        kind: "named",
        iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Refuse",
        class: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
        },
        values: {
          label: {
            kind: "lang",
            value: "refuse",
            language: "en",
          },
          definition: {
            kind: "lang",
            value: "Do nothing because doing it would not be safe, and say why.",
            language: "en",
          },
          destructive: false,
          hostChange: false,
        },
        statements: [
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            },
            objects: [
              {
                kind: "named",
                iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2000/01/rdf-schema#label",
              curie: "rdfs:label",
            },
            objects: [
              {
                kind: "lang",
                value: "refuse",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "http://www.w3.org/2004/02/skos/core#definition",
              curie: "skos:definition",
            },
            objects: [
              {
                kind: "lang",
                value: "Do nothing because doing it would not be safe, and say why.",
                language: "en",
              },
            ],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
              curie: "ergonex:destructive",
            },
            objects: [false],
          },
          {
            predicate: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
              curie: "ergonex:hostChange",
            },
            objects: [false],
          },
        ],
      },
      fastForwardable: false,
      holdsLocalWork: true,
    },
    statements: [
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#RepoState",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2000/01/rdf-schema#label",
          curie: "rdfs:label",
        },
        objects: [
          {
            kind: "lang",
            value: "not a repository",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "http://www.w3.org/2004/02/skos/core#definition",
          curie: "skos:definition",
        },
        objects: [
          {
            kind: "lang",
            value: "Something other than a Git repository is at the path.",
            language: "en",
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#defaultAction",
          curie: "ergonex:defaultAction",
        },
        objects: [
          {
            kind: "named",
            iri: "https://www.intellectualfrontiers.com/ontology/ergonex#Refuse",
            class: {
              kind: "named",
              iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
            },
            values: {
              label: {
                kind: "lang",
                value: "refuse",
                language: "en",
              },
              definition: {
                kind: "lang",
                value: "Do nothing because doing it would not be safe, and say why.",
                language: "en",
              },
              destructive: false,
              hostChange: false,
            },
            statements: [
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                },
                objects: [
                  {
                    kind: "named",
                    iri: "https://www.intellectualfrontiers.com/ontology/ergonex#ActionKind",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2000/01/rdf-schema#label",
                  curie: "rdfs:label",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "refuse",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "http://www.w3.org/2004/02/skos/core#definition",
                  curie: "skos:definition",
                },
                objects: [
                  {
                    kind: "lang",
                    value: "Do nothing because doing it would not be safe, and say why.",
                    language: "en",
                  },
                ],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#destructive",
                  curie: "ergonex:destructive",
                },
                objects: [false],
              },
              {
                predicate: {
                  kind: "named",
                  iri: "https://www.intellectualfrontiers.com/ontology/ergonex#hostChange",
                  curie: "ergonex:hostChange",
                },
                objects: [false],
              },
            ],
          },
        ],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#fastForwardable",
          curie: "ergonex:fastForwardable",
        },
        objects: [false],
      },
      {
        predicate: {
          kind: "named",
          iri: "https://www.intellectualfrontiers.com/ontology/ergonex#holdsLocalWork",
          curie: "ergonex:holdsLocalWork",
        },
        objects: [true],
      },
    ],
  },
} as const;
