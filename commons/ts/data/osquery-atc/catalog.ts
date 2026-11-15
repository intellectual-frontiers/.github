/**
 * An example of what an osquery-based service manages with ATC: the settings it enforces on a host and the applications it allows,
 * kept as typed rows, built into a SQLite database the service ships to the host, and exposed to osquery as two tables (commons
 * 0009-sql-aide FR-056, FR-057). A service writes its own model the same way.
 *
 * @module
 */
import { boolean, dataOf, oneOf, pk, table, text } from "../sql-aide/mod.ts";
import { atcTable } from "./atc.ts";

/** A setting the service enforces on a host, with the value it wants. */
export const policySetting = table(
  "policy_setting",
  {
    /** The setting's name, as the service knows it. */
    setting_key: pk.text(),
    /** The value the service wants the setting to have, as text. */
    value: text(),
    /** What the setting is about. */
    category: oneOf(["security", "privacy", "update"]),
    /** Whether the service puts the value back where it finds another. */
    enforced: boolean(),
  },
  { owner: "osquery-atc" },
);

/** An application the service allows on a host. */
export const allowedApplication = table(
  "allowed_application",
  {
    /** The application's identifier: a bundle identifier on macOS, a package name elsewhere. */
    application_id: pk.text(),
    /** The name a person knows it by. */
    display_name: text(),
    /** Who publishes it, where that is known. */
    publisher: text().nullable(),
  },
  { owner: "osquery-atc" },
);

/** Where the database is kept on a POSIX host. */
export const POSIX_PATH = "/var/osquery/atc/managed.auto.sqlite.db";
/** Where the database is kept on a Windows host. */
export const WINDOWS_PATH = "C:\\ProgramData\\osquery\\atc\\managed.auto.sqlite.db";

/** The rows of the settings: what the service enforces. */
export const policySettings = dataOf(policySetting, [
  { setting_key: "screen_lock_minutes", value: "5", category: "security", enforced: true },
  { setting_key: "telemetry", value: "off", category: "privacy", enforced: true },
  { setting_key: "auto_update", value: "daily", category: "update", enforced: false },
]);

/** The rows of the allowed applications. */
export const allowedApplications = dataOf(allowedApplication, [
  { application_id: "org.mozilla.firefox", display_name: "Firefox", publisher: "Mozilla" },
  { application_id: "com.example.agent", display_name: "Example Agent", publisher: null },
]);

/** The settings, as osquery reads them on macOS and Linux. */
export const managedSettings = atcTable("managed_settings", policySetting, {
  path: POSIX_PATH,
  columns: ["setting_key", "value", "category", "enforced"],
  platform: "posix",
});

/** The allowed applications, as osquery reads them on Windows. */
export const managedApplications = atcTable("managed_applications", allowedApplication, {
  path: WINDOWS_PATH,
  columns: ["application_id", "display_name", "publisher"],
  platform: "windows",
});

/** The tables of the database. */
export const catalogTables = [policySetting, allowedApplication] as const;

/** The rows of the database. */
export const catalogData = [policySettings, allowedApplications] as const;

/** The ATC entries of the example. */
export const catalogAtc = [managedSettings, managedApplications] as const;
