/**
 * AUTO-GENERATED from the TSDoc comments of osquery-atc/catalog.ts; do not edit: change the comments and write the map again.
 *
 * @module
 */

/** The documentation of osquery-atc/catalog.ts, by the name of each exported constant. */
export const docs = {
  POSIX_PATH: {
    summary: "Where the database is kept on a POSIX host.",
    members: {},
  },
  WINDOWS_PATH: {
    summary: "Where the database is kept on a Windows host.",
    members: {},
  },
  allowedApplication: {
    summary: "An application the service allows on a host.",
    members: {
      application_id: "The application's identifier: a bundle identifier on macOS, a package name elsewhere.",
      display_name: "The name a person knows it by.",
      publisher: "Who publishes it, where that is known.",
    },
  },
  allowedApplications: {
    summary: "The rows of the allowed applications.",
    members: {},
  },
  catalogAtc: {
    summary: "The ATC entries of the example.",
    members: {},
  },
  catalogData: {
    summary: "The rows of the database.",
    members: {},
  },
  catalogTables: {
    summary: "The tables of the database.",
    members: {},
  },
  managedApplications: {
    summary: "The allowed applications, as osquery reads them on Windows.",
    members: {},
  },
  managedSettings: {
    summary: "The settings, as osquery reads them on macOS and Linux.",
    members: {},
  },
  policySetting: {
    summary: "A setting the service enforces on a host, with the value it wants.",
    members: {
      category: "What the setting is about.",
      enforced: "Whether the service puts the value back where it finds another.",
      setting_key: "The setting's name, as the service knows it.",
      value: "The value the service wants the setting to have, as text.",
    },
  },
  policySettings: {
    summary: "The rows of the settings: what the service enforces.",
    members: {},
  },
} as const;
