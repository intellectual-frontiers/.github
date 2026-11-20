// Spec: 0004-toolchain-ontology FR-001, FR-002, FR-003, FR-004
/**
 * The source of pins over the packaging ontology: for a pin and a platform, the version, the address, the SHA-256, the format and the folder of the publisher's artifact, or the reason the
 * ontology gives that there is none (an unknown pin or platform, a pin not pinned, a platform unpinned with its reason, a malformed checksum). It holds no data of its own: the ontology is the
 * one place a version and a hash are written, and every download it gives is checked again by `defineDownload`.
 *
 * @example
 * ```ts
 * import { pinSourceFromOntology } from "./ontology.ts";
 * pinSourceFromOntology().lookup(pin, "linux-x64"); // a Result of a Download, or the ontology's reason
 * ```
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { describeDownloadError, downloadOf, parsePinId as ontologyPin, parsePlatformName as ontologyPlatform } from "@intellectual-frontiers/ontology/supply-chain/downloads";
import { defineDownload } from "@intellectual-frontiers/toolchain/governance";
import type { PinSource } from "@intellectual-frontiers/toolchain/logical";

/** A source of pins that reads the downloads of the packaging ontology. */
export function pinSourceFromOntology(): PinSource {
  return {
    lookup: (pin, platform) => {
      const p = ontologyPin(pin);
      if (p.kind === "err") return err(describeDownloadError(p.error));
      const w = ontologyPlatform(platform);
      if (w.kind === "err") return err(describeDownloadError(w.error));
      const d = downloadOf(p.value, w.value);
      if (d.kind === "err") return err(describeDownloadError(d.error));
      const made = defineDownload({ version: d.value.version, downloadUrl: d.value.downloadUrl, sha256: d.value.sha256, archiveFormat: d.value.archiveFormat, binPath: d.value.binPath });
      return made.kind === "ok" ? ok(made.value) : err(`the download of ${pin} on ${platform} is not valid: ${made.error.join("; ")}`);
    },
  };
}
