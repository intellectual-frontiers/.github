// Spec: 0002-redfish-connector FR-012
/**
 * What touches the world for Redfish (0002-redfish-connector FR-012): the read port of a controller over the HTTP read port of Integrations with HTTP basic authentication from the credential (the user and the password the vault gave), on the transport the caller gives (which is
 * where the certificate pin is kept). The port cannot write: the guard of the read port allows only safe methods, and the session endpoint is not used.
 *
 * @module
 */
import { secretOf, type ReadPort, type Secret } from "@intellectual-frontiers/integrations/logical";
import { httpReadPort } from "@intellectual-frontiers/integrations/http";
import type { Transport } from "@intellectual-frontiers/net/http-client";

/** What the read port of a controller is made of. */
export type RedfishPortOptions = { readonly transport: Transport; readonly base: string; readonly user: string; readonly password: Secret };

/** The read port of one controller, authorized by HTTP basic authentication. */
export function redfishReadPort(o: RedfishPortOptions): ReadPort {
  const basic = secretOf(`${btoa(`${o.user}:${o.password.reveal()}`)}`);
  return httpReadPort({ transport: o.transport, base: o.base, auth: { kind: "bearer", secret: basic, scheme: "Basic" }, headers: { accept: "application/json" } });
}
