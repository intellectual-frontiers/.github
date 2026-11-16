/**
 * The system families of the packaging ontology (commons 0002-packaging FR-002, FR-004, FR-007): how each is detected, the managers it has, whether a harness
 * acts on it and how far it has been tried.
 *
 * Seeded from the tables of sigoden/upt (https://github.com/sigoden/upt), dual-licensed MIT or Apache-2.0, copyright its authors; see tests/fixtures/upt/README.md.
 * What archon (a harness) runs, and what it knows about privileges and package names, is added to it. A command with pm:origin "memory", and every needsAdministrator value,
 * is written from knowledge and unverified: nothing acts on it until its family is supported and the command carries pm:verifiedOn.
 * `oubes`, which upt lists with the Red Hat family, is not an os-release ID this repository recognises and is left out.
 *
 * @module
 */
import { DCTERMS, en, type OntologyFile, RDFS, SKOS, term, XSD } from "../../../ts/kernel/rdf.ts";
import {
  managerApk,
  managerApt,
  managerBrew,
  managerCards,
  managerChoco,
  managerDnf,
  managerEmerge,
  managerEopkg,
  managerFreebsdPkg,
  managerNixEnv,
  managerOpkg,
  managerPacman,
  managerPkgman,
  managerPort,
  managerPrtGet,
  managerScoop,
  managerSlackpkg,
  managerTermuxPkg,
  managerUrpm,
  managerWinget,
  managerXbps,
  managerYum,
  managerZypper,
} from "./managers.ts";
import { assurances, Family, PM, PMID, supportStatuses } from "./packaging.ts";

/** The family `family-windows`. */
export const familyWindows = Family.make(term(PMID, "family-windows"), {
  label: en("Windows"),
  identifier: "windows",
  detectSource: "platform",
  detectedBy: ["windows"],
  usesManager: [managerScoop, managerChoco, managerWinget],
  preferredManager: managerScoop,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-macos`. */
export const familyMacos = Family.make(term(PMID, "family-macos"), {
  label: en("macOS"),
  identifier: "macos",
  detectSource: "platform",
  detectedBy: ["macos"],
  unameName: "Darwin",
  usesManager: [managerBrew, managerPort],
  supportStatus: supportStatuses.Supported,
  assurance: assurances.Untested,
  harnessInstallsPackages: false,
  removalHint: "delete the user in System Settings, Users & Groups, with its home folder",
  note: "Written against stand-ins on Linux; no run on a Mac yet (0136-machine-bootstrap OQ-7).",
});

/** The family `family-debian`. */
export const familyDebian = Family.make(term(PMID, "family-debian"), {
  label: en("Debian family"),
  identifier: "debian",
  detectSource: "os-release",
  detectedBy: ["ubuntu", "debian", "linuxmint", "pop", "deepin", "elementary", "kali", "raspbian", "aosc", "zorin", "antix", "devuan", "bodhi", "lxle", "sparky"],
  usesManager: [managerApt],
  preferredManager: managerApt,
  supportStatus: supportStatuses.Supported,
  assurance: assurances.Verified,
  harnessInstallsPackages: true,
  removalHint: "sudo deluser --remove-home NAME",
  adminInstall: "apt-get install -y {packages}",
  verifiedOn: "Debian 13 under WSL 2, by archon-bootstrap.sh and archon update, 2026-10-16",
  note: "Debian is verified on Debian 13 under WSL 2. Ubuntu and Debian 12 are exercised by the container tests only.",
});

/** The family `family-redhat`. */
export const familyRedhat = Family.make(term(PMID, "family-redhat"), {
  label: en("Red Hat family"),
  identifier: "redhat",
  detectSource: "os-release",
  detectedBy: ["fedora", "redhat", "rhel", "amzn", "ol", "almalinux", "rocky", "centos", "qubes", "eurolinux"],
  usesManager: [managerDnf, managerYum],
  preferredManager: managerDnf,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
  note: "archon's runtime can use dnf to install the libraries a program links against, untested; no script acts on this family.",
});

/** The family `family-arch`. */
export const familyArch = Family.make(term(PMID, "family-arch"), {
  label: en("Arch family"),
  identifier: "arch",
  detectSource: "os-release",
  detectedBy: ["arch", "manjaro", "endeavouros", "arcolinux", "garuda", "antergos", "kaos"],
  usesManager: [managerPacman],
  preferredManager: managerPacman,
  supportStatus: supportStatuses.Supported,
  assurance: assurances.StandIn,
  harnessInstallsPackages: true,
  removalHint: "sudo userdel -r NAME",
  adminInstall: "pacman -S --needed {packages}",
  note: "Arch Linux is exercised in a container with stand-ins for pacman; Omarchy (ID_LIKE=arch) is untested (0136-machine-bootstrap OQ-6).",
});

/** The family `family-alpine`. */
export const familyAlpine = Family.make(term(PMID, "family-alpine"), {
  label: en("Alpine family"),
  identifier: "alpine",
  detectSource: "os-release",
  detectedBy: ["alpine", "postmarket"],
  usesManager: [managerApk],
  preferredManager: managerApk,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
  note: "archon's runtime can use apk to install the libraries a program links against, untested; no script acts on this family.",
});

/** The family `family-suse`. */
export const familySuse = Family.make(term(PMID, "family-suse"), {
  label: en("SUSE family"),
  identifier: "suse",
  detectSource: "os-release",
  detectedBy: ["opensuse", "opensuse-leap", "opensuse-tumbleweed"],
  usesManager: [managerZypper],
  preferredManager: managerZypper,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-nixos`. */
export const familyNixos = Family.make(term(PMID, "family-nixos"), {
  label: en("NixOS"),
  identifier: "nixos",
  detectSource: "os-release",
  detectedBy: ["nixos"],
  usesManager: [managerNixEnv],
  preferredManager: managerNixEnv,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-gentoo`. */
export const familyGentoo = Family.make(term(PMID, "family-gentoo"), {
  label: en("Gentoo family"),
  identifier: "gentoo",
  detectSource: "os-release",
  detectedBy: ["gentoo", "funtoo"],
  usesManager: [managerEmerge],
  preferredManager: managerEmerge,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-void`. */
export const familyVoid = Family.make(term(PMID, "family-void"), {
  label: en("Void Linux"),
  identifier: "void",
  detectSource: "os-release",
  detectedBy: ["void"],
  usesManager: [managerXbps],
  preferredManager: managerXbps,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-mageia`. */
export const familyMageia = Family.make(term(PMID, "family-mageia"), {
  label: en("Mageia"),
  identifier: "mageia",
  detectSource: "os-release",
  detectedBy: ["mageia"],
  usesManager: [managerUrpm],
  preferredManager: managerUrpm,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-slackware`. */
export const familySlackware = Family.make(term(PMID, "family-slackware"), {
  label: en("Slackware"),
  identifier: "slackware",
  detectSource: "os-release",
  detectedBy: ["slackware"],
  usesManager: [managerSlackpkg],
  preferredManager: managerSlackpkg,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-solus`. */
export const familySolus = Family.make(term(PMID, "family-solus"), {
  label: en("Solus"),
  identifier: "solus",
  detectSource: "os-release",
  detectedBy: ["solus"],
  usesManager: [managerEopkg],
  preferredManager: managerEopkg,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-openwrt`. */
export const familyOpenwrt = Family.make(term(PMID, "family-openwrt"), {
  label: en("OpenWrt"),
  identifier: "openwrt",
  detectSource: "os-release",
  detectedBy: ["openwrt"],
  usesManager: [managerOpkg],
  preferredManager: managerOpkg,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-nutyx`. */
export const familyNutyx = Family.make(term(PMID, "family-nutyx"), {
  label: en("NuTyX"),
  identifier: "nutyx",
  detectSource: "os-release",
  detectedBy: ["nutyx"],
  usesManager: [managerCards],
  preferredManager: managerCards,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-crux`. */
export const familyCrux = Family.make(term(PMID, "family-crux"), {
  label: en("CRUX"),
  identifier: "crux",
  detectSource: "os-release",
  detectedBy: ["crux"],
  usesManager: [managerPrtGet],
  preferredManager: managerPrtGet,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-freebsd`. */
export const familyFreebsd = Family.make(term(PMID, "family-freebsd"), {
  label: en("FreeBSD family"),
  identifier: "freebsd",
  detectSource: "os-release",
  detectedBy: ["freebsd", "ghostbsd"],
  unameName: "FreeBSD",
  usesManager: [managerFreebsdPkg],
  preferredManager: managerFreebsdPkg,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-android`. */
export const familyAndroid = Family.make(term(PMID, "family-android"), {
  label: en("Android (Termux)"),
  identifier: "android",
  detectSource: "platform",
  detectedBy: ["android"],
  unameName: "Android",
  usesManager: [managerTermuxPkg],
  preferredManager: managerTermuxPkg,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-haiku`. */
export const familyHaiku = Family.make(term(PMID, "family-haiku"), {
  label: en("Haiku"),
  identifier: "haiku",
  detectSource: "platform",
  detectedBy: ["haiku"],
  unameName: "Haiku",
  usesManager: [managerPkgman],
  preferredManager: managerPkgman,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-msys2`. */
export const familyMsys2 = Family.make(term(PMID, "family-msys2"), {
  label: en("Windows (MSYS2)"),
  identifier: "msys2",
  detectSource: "platform",
  detectedBy: ["windows/msys2"],
  usesManager: [managerPacman],
  preferredManager: managerPacman,
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The family `family-any`. */
export const familyAny = Family.make(term(PMID, "family-any"), {
  label: en("Any other computer"),
  identifier: "any",
  detectSource: "any",
  detectedBy: ["*"],
  usesManager: [managerApt, managerDnf, managerPacman],
  supportStatus: supportStatuses.Catalogued,
  assurance: assurances.NoAssurance,
});

/** The system families. */
export const families = [
  familyWindows,
  familyMacos,
  familyDebian,
  familyRedhat,
  familyArch,
  familyAlpine,
  familySuse,
  familyNixos,
  familyGentoo,
  familyVoid,
  familyMageia,
  familySlackware,
  familySolus,
  familyOpenwrt,
  familyNutyx,
  familyCrux,
  familyFreebsd,
  familyAndroid,
  familyHaiku,
  familyMsys2,
  familyAny,
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = { name: "families", prefixes: [DCTERMS, PM, PMID, RDFS, SKOS, XSD], individuals: [...families] };
