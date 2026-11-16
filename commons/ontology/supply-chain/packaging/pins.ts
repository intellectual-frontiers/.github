/**
 * The platforms a harness runs on and the downloads it pins (commons 0002-packaging FR-014, FR-015): one version and one SHA-256 per platform for each program a script fetches
 * before any harness exists. The shell fragment and the env file are generated from this; change a pin here and nowhere else.
 *
 * @module
 */
import { en, type OntologyFile, RDFS, SKOS, term } from "../../../ts/kernel/rdf.ts";
import { Checksum, PinnedDownload, Platform, PM, PMID } from "./packaging.ts";

/** The platform `platform-linux-x64`. */
export const platformLinuxX64 = Platform.make(term(PMID, "platform-linux-x64"), {
  label: en("Linux, x86-64"),
  platformName: "linux-x64",
  operatingSystem: "linux",
  processor: "x86_64",
  pinSuffix: "X86_64",
});

/** The platform `platform-linux-arm64`. */
export const platformLinuxArm64 = Platform.make(term(PMID, "platform-linux-arm64"), {
  label: en("Linux, 64-bit Arm"),
  platformName: "linux-arm64",
  operatingSystem: "linux",
  processor: "aarch64",
  pinSuffix: "AARCH64",
});

/** The platform `platform-macos-x64`. */
export const platformMacosX64 = Platform.make(term(PMID, "platform-macos-x64"), {
  label: en("macOS, Intel"),
  platformName: "macos-x64",
  operatingSystem: "macos",
  processor: "x86_64",
  pinSuffix: "MACOS_X64",
});

/** The platform `platform-windows-x64`. */
export const platformWindowsX64 = Platform.make(term(PMID, "platform-windows-x64"), {
  label: en("Windows, x86-64"),
  platformName: "windows-x64",
  operatingSystem: "windows",
  processor: "x86_64",
  pinSuffix: "WINDOWS_X64",
});

/** The platform `platform-macos-arm64`. */
export const platformMacosArm64 = Platform.make(term(PMID, "platform-macos-arm64"), {
  label: en("macOS, Apple silicon"),
  platformName: "macos-arm64",
  operatingSystem: "macos",
  processor: "aarch64",
  pinSuffix: "MACOS_ARM64",
});

/** The pinned download `pin-mise`. */
export const pinMise = PinnedDownload.make(term(PMID, "pin-mise"), {
  label: en("mise, the one program archon installs everything else with"),
  programName: "mise",
  pinKey: "MISE",
  version: "2026.10.3",
  note: en("Read before any Python exists."),
});

/** The pinned download `pin-python`. */
export const pinPython = PinnedDownload.make(term(PMID, "pin-python"), { label: en("the Python archon runs on"), programName: "python", pinKey: "PYTHON", version: "3.14.8" });

/** The pinned download `pin-uv`. */
export const pinUv = PinnedDownload.make(term(PMID, "pin-uv"), { label: en("uv, the launcher archon starts Python with"), programName: "uv", pinKey: "UV", version: "0.12.23" });

/** The pinned download `pin-rustup-init`. */
export const pinRustupInit = PinnedDownload.make(term(PMID, "pin-rustup-init"), {
  label: en("rustup-init, the installer of rustup, through which erga gets the Rust toolchain its rust-toolchain.toml names"),
  programName: "rustup-init",
  pinKey: "RUSTUP_INIT",
  version: "1.29.2",
  note: en(
    "From https://static.rust-lang.org/rustup/archive/VERSION/TARGET/rustup-init, checked against the .sha256 beside it (erga 009-machine-bootstrap FR-025, FR-026, FR-078).",
  ),
});

/** The pinned download `pin-gh`. */
export const pinGh = PinnedDownload.make(term(PMID, "pin-gh"), {
  label: en("gh, GitHub's command line, from the publisher's release on every platform"),
  programName: "gh",
  pinKey: "GH",
  version: "2.102.0",
  note: en(
    "The publisher's own release, put in the account's own folder; no package manager installs it (erga 009-machine-bootstrap FR-091). The checksum is the one the publisher states.",
  ),
});

/** The pinned download `pin-jq`. */
export const pinJq = PinnedDownload.make(term(PMID, "pin-jq"), {
  label: en("jq, from the publisher's release on every platform"),
  programName: "jq",
  pinKey: "JQ",
  version: "1.8.2",
  note: en(
    "The publisher's own release, put in the account's own folder; no package manager installs it (erga 009-machine-bootstrap FR-091). The checksum is the one the publisher states.",
  ),
});

/** The pinned download `pin-bun`. */
export const pinBun = PinnedDownload.make(term(PMID, "pin-bun"), {
  label: en("Bun, the one tool binary of IFC TypeScript: it installs, formats, lints, tests and packs"),
  programName: "bun",
  pinKey: "BUN",
  version: "1.4.4",
  note: en(
    "From https://github.com/oven-sh/bun/releases/download/bun-vVERSION/bun-TARGET.zip (TARGET linux-x64, linux-aarch64, darwin-x64, darwin-aarch64, windows-x64), checksums from the release's SHASUMS256.txt. IFC TypeScript's CI takes its version from here (commons 0005-typescript-runtime FR-026).",
  ),
});

/** The pinned download `pin-otelcol-contrib`. */
export const pinOtelcolContrib = PinnedDownload.make(term(PMID, "pin-otelcol-contrib"), {
  label: en("The OpenTelemetry Collector (contrib distribution), which IFC TypeScript's CI sends its OTLP to and reads back from its file exporter"),
  programName: "otelcol-contrib",
  pinKey: "OTELCOL_CONTRIB",
  version: "0.165.0",
  note: en(
    "From https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/vVERSION/otelcol-contrib_VERSION_linux_amd64.tar.gz. Used only by the conformance job on Linux x64 (commons 0006-signals FR-020); the checksum was taken from the release asset when it was pinned.",
  ),
});

/** The platforms a harness runs on. */
export const platforms = [
  platformLinuxX64,
  platformLinuxArm64,
  platformMacosX64,
  platformWindowsX64,
  platformMacosArm64,
] as const;

/** The downloads a script pins before any harness exists. */
export const pins = [
  pinMise,
  pinPython,
  pinUv,
  pinRustupInit,
  pinGh,
  pinJq,
  pinBun,
  pinOtelcolContrib,
] as const;

/** The SHA-256 of each pinned download on each platform. */
export const checksums = [
  Checksum.make(term(PMID, "sum-mise-linux-x64"), { forPin: pinMise, forPlatform: platformLinuxX64, sha256: "ff0870ddad7f8c5ba673ceb3e7659f0353da8263eabe8b82220f5816a772c786" }),
  Checksum.make(term(PMID, "sum-mise-linux-arm64"), {
    forPin: pinMise,
    forPlatform: platformLinuxArm64,
    sha256: "a5141f834d883239c2542b9a2136e75428779b2040206537399714d8c534d91f",
  }),
  Checksum.make(term(PMID, "sum-mise-macos-arm64"), {
    forPin: pinMise,
    forPlatform: platformMacosArm64,
    sha256: "5372494c3027260ddf8efa79504c4d968bbe671a58248ec575f57e1472e5d9c2",
  }),
  Checksum.make(term(PMID, "sum-uv-linux-x64"), { forPin: pinUv, forPlatform: platformLinuxX64, sha256: "9167d72b3319674b6303c4cbe071854bba13ebdf3d76b1a7cbdc175471fb66d6" }),
  Checksum.make(term(PMID, "sum-uv-linux-arm64"), { forPin: pinUv, forPlatform: platformLinuxArm64, sha256: "6524bd338177ed50d035d39354e12545e993bbeba2ecbddf0480c5b3a81d313f" }),
  Checksum.make(term(PMID, "sum-uv-macos-arm64"), { forPin: pinUv, forPlatform: platformMacosArm64, sha256: "50487ae565ccd96e499056b4674d438f4c53170202617b4c759defe0c6a1b544" }),
  Checksum.make(term(PMID, "sum-rustup-init-linux-x64"), {
    forPin: pinRustupInit,
    forPlatform: platformLinuxX64,
    sha256: "5be191e8c70a5007074254cb74d78dbfdd25cd5a61c27de7b8e5410122ec24f4",
  }),
  Checksum.make(term(PMID, "sum-rustup-init-linux-arm64"), {
    forPin: pinRustupInit,
    forPlatform: platformLinuxArm64,
    sha256: "a9c168dbea81a84671c6b7a5c1795cb0eb699020110d107ddfca427bd797e697",
  }),
  Checksum.make(term(PMID, "sum-rustup-init-macos-arm64"), {
    forPin: pinRustupInit,
    forPlatform: platformMacosArm64,
    sha256: "f7c7e11eb2e07f006e532a8aaac77b32f4527d305ac386c0c633ca6133d35ca9",
  }),
  Checksum.make(term(PMID, "sum-gh-linux-x64"), { forPin: pinGh, forPlatform: platformLinuxX64, sha256: "bb766f710eef8ede859c18578c72c327597cd4c8a85b06001b1f3843c6019386" }),
  Checksum.make(term(PMID, "sum-gh-linux-arm64"), { forPin: pinGh, forPlatform: platformLinuxArm64, sha256: "7862c86c72f43df3a2d93ddde6f473285b4e2af61b494849846827e513ef6484" }),
  Checksum.make(term(PMID, "sum-gh-macos-arm64"), { forPin: pinGh, forPlatform: platformMacosArm64, sha256: "da922c20d1792e5b2cbf375593d7a658acf034c12c84e007e71c76ef959c337e" }),
  Checksum.make(term(PMID, "sum-jq-linux-x64"), { forPin: pinJq, forPlatform: platformLinuxX64, sha256: "b1c22172dd303f3be49e935aa56aa48a8b7a46e0bc838b4997d3bb451495870f" }),
  Checksum.make(term(PMID, "sum-jq-linux-arm64"), { forPin: pinJq, forPlatform: platformLinuxArm64, sha256: "8b85c817833814ddca00a144c33705546355afccf0cf39b188f3cdb48b852309" }),
  Checksum.make(term(PMID, "sum-jq-macos-arm64"), { forPin: pinJq, forPlatform: platformMacosArm64, sha256: "2d75340ba57a4b4b4c8708a21c2dc8e958a48aaa8bba13b27f77f6e4c0eca07e" }),
  Checksum.make(term(PMID, "sum-bun-linux-x64"), { forPin: pinBun, forPlatform: platformLinuxX64, sha256: "bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c" }),
  Checksum.make(term(PMID, "sum-bun-linux-arm64"), { forPin: pinBun, forPlatform: platformLinuxArm64, sha256: "baa6bb36f51d6e58561e02bbea825038a9df454f673d6d776e8bbf86f8c7850e" }),
  Checksum.make(term(PMID, "sum-bun-macos-x64"), { forPin: pinBun, forPlatform: platformMacosX64, sha256: "50a3491f73abc2fe81673171a85762d3bc2cc1680ccecadd983de99adf77977e" }),
  Checksum.make(term(PMID, "sum-bun-macos-arm64"), { forPin: pinBun, forPlatform: platformMacosArm64, sha256: "c240d7f0ccb90c263a849fcdb09b7ee62630d921348ed6aafda86b9d577bc510" }),
  Checksum.make(term(PMID, "sum-bun-windows-x64"), { forPin: pinBun, forPlatform: platformWindowsX64, sha256: "cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5" }),
  Checksum.make(term(PMID, "sum-otelcol-contrib-linux-x64"), {
    forPin: pinOtelcolContrib,
    forPlatform: platformLinuxX64,
    sha256: "bd6e73d94bf3359ad6fac25529a8ee308adb9b0b8a0e8af034ed3891fbe5aa33",
  }),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = { name: "pins", prefixes: [PM, PMID, RDFS, SKOS], individuals: [...platforms, ...pins, ...checksums] };
