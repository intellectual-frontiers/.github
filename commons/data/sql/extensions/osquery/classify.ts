// Spec: 0058-sql-osquery FR-003
/**
 * What osquery's tables say of people (commons data 0058-sql-osquery FR-003): the tables and columns that hold personal data, by the category of the W3C Data Privacy Vocabulary (DPV-PD) that governance names, and what they are held for. The
 * rules are a table of data, written once and read by the importer; a table or column that is in no rule is not personal.
 *
 * @module
 */
import type { vocabularies } from "@intellectual-frontiers/data/governance";

/** A category of personal data of DPV-PD. */
type PdTerm = NonNullable<Parameters<typeof vocabularies.privacy.dpvClassOf>[0]>;

/** How a table or a column of osquery is classified. */
export interface Classification {
  readonly category: PdTerm;
  readonly purposes: readonly string[];
}

const ASSESS = ["machine inventory and security assessment"] as const;
const ACCESS = ["who may reach the machine, and when they did"] as const;

/** The columns of a table that are personal, by name, and the category of each; `*` is every column of the table that has no rule of its own. */
export interface TableRule {
  readonly columns: { readonly [column: string]: Classification };
}

const c = (category: PdTerm, purposes: readonly string[] = ASSESS): Classification => ({ category, purposes });

/** The tables whose columns are personal, with the category of each column that is. */
export const PERSONAL: { readonly [table: string]: TableRule } = {
  users: { columns: { username: c("Username", ACCESS), uid: c("AccountIdentifier", ACCESS), description: c("Name", ACCESS), directory: c("HomeLocation", ACCESS), uuid: c("AccountIdentifier", ACCESS) } },
  logged_in_users: { columns: { user: c("Username", ACCESS), host: c("IPAddress", ACCESS), tty: c("DeviceBased", ACCESS) } },
  last: { columns: { username: c("Username", ACCESS), host: c("IPAddress", ACCESS) } },
  user_groups: { columns: { uid: c("AccountIdentifier", ACCESS), gid: c("GroupMembership", ACCESS) } },
  groups: { columns: { groupname: c("GroupMembership", ACCESS) } },
  user_ssh_keys: { columns: { uid: c("AccountIdentifier", ACCESS), path: c("Identifying", ACCESS) } },
  authorized_keys: { columns: { uid: c("AccountIdentifier", ACCESS), key_file: c("Identifying", ACCESS), comment: c("Identifying", ACCESS) } },
  known_hosts: { columns: { uid: c("AccountIdentifier", ACCESS), key_file: c("Identifying", ACCESS) } },
  shell_history: { columns: { uid: c("AccountIdentifier"), command: c("Identifying"), history_file: c("Identifying") } },
  chrome_extensions: { columns: { uid: c("AccountIdentifier"), name: c("BrowserFingerprint"), identifier: c("BrowserFingerprint"), path: c("BrowserFingerprint"), description: c("BrowserFingerprint") } },
  firefox_addons: { columns: { uid: c("AccountIdentifier"), name: c("BrowserFingerprint"), identifier: c("BrowserFingerprint"), path: c("BrowserFingerprint") } },
  safari_extensions: { columns: { uid: c("AccountIdentifier"), name: c("BrowserFingerprint"), identifier: c("BrowserFingerprint"), path: c("BrowserFingerprint") } },
  browser_plugins: { columns: { uid: c("AccountIdentifier"), name: c("BrowserFingerprint"), identifier: c("BrowserFingerprint"), path: c("BrowserFingerprint") } },
  ie_extensions: { columns: { name: c("BrowserFingerprint"), path: c("BrowserFingerprint") } },
  account_policy_data: { columns: { uid: c("AccountIdentifier", ACCESS) } },
  interface_addresses: { columns: { address: c("IPAddress"), mask: c("IPAddress"), broadcast: c("IPAddress"), point_to_point: c("IPAddress") } },
  interface_details: { columns: { mac: c("MACAddress") } },
  arp_cache: { columns: { address: c("IPAddress"), mac: c("MACAddress") } },
  wifi_networks: { columns: { ssid: c("Identifying"), network_name: c("Identifying") } },
  wifi_status: { columns: { ssid: c("Identifying"), bssid: c("MACAddress") } },
  dns_resolvers: { columns: { address: c("IPAddress") } },
  etc_hosts: { columns: { address: c("IPAddress"), hostnames: c("Identifying") } },
  listening_ports: { columns: { address: c("IPAddress") } },
  process_open_sockets: { columns: { local_address: c("IPAddress"), remote_address: c("IPAddress") } },
};

/**
 * The classification of a column of a table, or none where it is not personal.
 *
 * @param table - the table's name
 * @param column - the column's name
 */
export const classify = (table: string, column: string): Classification | undefined => PERSONAL[table]?.columns[column];
