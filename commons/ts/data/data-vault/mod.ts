/**
 * Data Vault for IFC SQL Aide: hubs, satellites and links as generic functions (commons 0009-sql-aide FR-048).
 *
 * @example
 * ```ts
 * import { text } from "../sql-aide/mod.ts";
 * import { hub, link, satellite } from "./mod.ts";
 * const customer = hub("customer", { customer_number: text() });
 * const order = hub("order", { order_number: text() });
 * const customerContact = satellite(customer, "contact", { email: text().nullable() });
 * const customerOrder = link("customer_order", { customer, order });
 * ```
 *
 * @module
 */
export { exceptionDiagnostic, exceptionHub, recordException } from "./exception.ts";
export { loadHub, loadLink, loadSatellite } from "./load.ts";
export type { LinkInput, SatelliteAttributes, VaultLoad } from "./load.ts";
export { hub, link, satellite } from "./vault.ts";
export type {
  AnyHub,
  Hub,
  HubColumns,
  HubId,
  HubKey,
  HubTable,
  LinkColumns,
  LinkTable,
  SatelliteColumns,
  SatelliteTable,
  VaultColumns,
} from "./vault.ts";
