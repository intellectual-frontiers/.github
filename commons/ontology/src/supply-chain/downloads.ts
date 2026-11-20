// Spec: 0001-ontologies FR-001
/**
 * What a download of a pinned program needs, read from the pins as typed values (commons 0002-packaging FR-017, FR-020): for a pin and a platform, the version, the address of the
 * publisher's artifact, its SHA-256, its format and the folder of its programs, or the reason the platform has no address. A reader that holds no version or hash of its own
 * (`commons/toolchain`) asks this module and nothing else.
 *
 * @remarks
 * A pin and a platform are named by branded values made only by `parsePinId` and `parsePlatformName`, which accept the names the ontology states and no others. The address
 * of a pin is stated once, with `{version}` where the pin's version stands; `expandAddress` of the vocabulary is the one place that puts it in.
 *
 * @limits
 * It reads; it neither downloads nor checks a hash against bytes. That a pin on a platform is well formed is the generator's check (FR-018), which names each rule broken.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import type { Named } from "@intellectual-frontiers/rdf";
import { type ARCHIVE_FORMATS, expandAddress } from "./packaging/packaging.ts";
import { checksums, pins, platforms } from "./packaging/pins.ts";

/** The name of a pinned program (`bun`, `mise`): one the ontology states. */
export type PinId = Brand<string, "PinId">;
/** The name of a platform (`linux-x64`, `macos-arm64`): one the ontology states. */
export type PlatformName = Brand<string, "PlatformName">;
/** 64 lower-case hexadecimal digits. */
export type Sha256Hex = Brand<string, "Sha256Hex">;
/** The format of what an address gives: a zip archive, a tar archive (plain or compressed) or the file itself. */
export type ArchiveFormat = (typeof ARCHIVE_FORMATS)[number];

/** What one pin needs on one platform to be downloaded. */
export type Download = {
  readonly version: string;
  /** The https address of the publisher's artifact, the version already in it. */
  readonly downloadUrl: string;
  readonly sha256: Sha256Hex;
  readonly archiveFormat: ArchiveFormat;
  /** The folder of the programs inside the unpacked artifact, relative to its root; empty for the root. */
  readonly binPath: string;
};

/** Why a download is not given. */
export type DownloadError =
  | { readonly kind: "unknown-pin"; readonly pin: string }
  | { readonly kind: "unknown-platform"; readonly platform: string }
  | { readonly kind: "not-pinned"; readonly pin: PinId; readonly platform: PlatformName }
  | { readonly kind: "unpinned"; readonly pin: PinId; readonly platform: PlatformName; readonly reason: string }
  | { readonly kind: "malformed"; readonly pin: PinId; readonly platform: PlatformName };

/** A name that is there, made into a `PinId`; nothing where there is none. */
function pinIdOf(name: string): PinId | undefined {
  return name === "" ? undefined : (name as PinId);
}

/** A name that is there, made into a `PlatformName`; nothing where there is none. */
function platformNameOf(name: string): PlatformName | undefined {
  return name === "" ? undefined : (name as PlatformName);
}

/** Lower-case hexadecimal digits, 64 of them, made into a `Sha256Hex`; nothing otherwise. */
function sha256HexOf(text: string): Sha256Hex | undefined {
  return /^[0-9a-f]{64}$/.test(text) ? (text as Sha256Hex) : undefined;
}

/** The pin each individual of the ontology is, by the name of its program. */
const pinNames: ReadonlyMap<string, PinId> = new Map(
  pins.flatMap((p) => {
    const id = pinIdOf(p.values.programName);
    return id === undefined ? [] : [[p.iri, id] as const];
  }),
);

/** The pin the ontology states under this name, or why there is none. */
export function parsePinId(text: string): Result<PinId, DownloadError> {
  for (const id of pinNames.values()) if (id === text) return ok(id);
  return err({ kind: "unknown-pin", pin: text });
}

/** The platform the ontology states under this name, or why there is none. */
export function parsePlatformName(text: string): Result<PlatformName, DownloadError> {
  for (const name of platformNames()) if (name === text) return ok(name);
  return err({ kind: "unknown-platform", platform: text });
}

/** Every pin the ontology states, by name. */
export function pinIds(): readonly PinId[] {
  return [...pinNames.values()];
}

/** Every platform the ontology states, by name. */
export function platformNames(): readonly PlatformName[] {
  return platforms.flatMap((p) => {
    const name = platformNameOf(p.values.platformName);
    return name === undefined ? [] : [name];
  });
}

const same = (a: Named, b: Named): boolean => a.iri === b.iri;

/** The download of a pin on a platform: its version, address, SHA-256, format and folder, or why the platform has none. */
export function downloadOf(pin: PinId, platform: PlatformName): Result<Download, DownloadError> {
  const pinned = pins.find((p) => pinNames.get(p.iri) === pin);
  const where = platforms.find((p) => p.values.platformName === platform);
  if (pinned === undefined) return err({ kind: "unknown-pin", pin });
  if (where === undefined) return err({ kind: "unknown-platform", platform });
  const sum = checksums.find((c) => same(c.values.forPin, pinned) && same(c.values.forPlatform, where));
  if (sum === undefined) return err({ kind: "not-pinned", pin, platform });
  const { downloadUrl, archiveFormat, binPath, unpinnedReason } = sum.values;
  if (downloadUrl === undefined || archiveFormat === undefined || binPath === undefined)
    return err({ kind: "unpinned", pin, platform, reason: unpinnedReason?.value ?? "" });
  const sha256 = sha256HexOf(sum.values.sha256);
  if (sha256 === undefined) return err({ kind: "malformed", pin, platform });
  return ok({
    version: pinned.values.version,
    downloadUrl: expandAddress(downloadUrl, pinned.values.version),
    sha256,
    archiveFormat,
    binPath,
  });
}

/** The sentence a reason is told in. */
export function describeDownloadError(e: DownloadError): string {
  switch (e.kind) {
    case "unknown-pin":
      return `the ontology pins no program called ${e.pin}`;
    case "unknown-platform":
      return `the ontology names no platform ${e.platform}`;
    case "not-pinned":
      return `${e.pin} is not pinned on ${e.platform}`;
    case "unpinned":
      return `${e.pin} is unpinned on ${e.platform}: ${e.reason}`;
    case "malformed":
      return `the checksum of ${e.pin} on ${e.platform} is not 64 lower-case hexadecimal digits`;
    default:
      return absurd(e);
  }
}
