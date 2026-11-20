/**
 * The package managers of the packaging ontology (commons 0002-packaging FR-002, FR-003, FR-005, FR-006), the commands that drive each, as templates of words,
 * and the commands no harness may run, each with its reason.
 *
 * Seeded from the tables of sigoden/upt (https://github.com/sigoden/upt), dual-licensed MIT or Apache-2.0, copyright its authors; see tests/fixtures/upt/README.md.
 * What the engine that `commons/archon` (0034-archon) replaced ran, and what it knew about privileges and package names, is added to it. A command with pm:origin "memory", and every needsAdministrator value,
 * is written from knowledge and unverified: nothing acts on it until its family is supported and the command carries pm:verifiedOn.
 *
 * @module
 */
import { DCTERMS, en, type OntologyFile, RDFS, SKOS, term, XSD } from "@intellectual-frontiers/rdf";
import { Command, Manager, managerKinds, operations, PM, PMID, Prohibition } from "./packaging.ts";

/** The manager `manager-apk`. */
export const managerApk = Manager.make(term(PMID, "manager-apk"), {
  label: en("apk"),
  identifier: "apk",
  executable: "apk",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  purlType: "apk",
});

/** The manager `manager-apt`. */
export const managerApt = Manager.make(term(PMID, "manager-apt"), {
  label: en("apt"),
  identifier: "apt",
  executable: "apt-get",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  environment: "DEBIAN_FRONTEND=noninteractive",
  purlType: "deb",
});

/** The manager `manager-brew`. */
export const managerBrew = Manager.make(term(PMID, "manager-brew"), {
  label: en("brew"),
  identifier: "brew",
  executable: "brew",
  kind: managerKinds.SystemKind,
  needsAdministrator: false,
  purlType: "brew",
});

/** The manager `manager-cards`. */
export const managerCards = Manager.make(term(PMID, "manager-cards"), {
  label: en("cards"),
  identifier: "cards",
  executable: "cards",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-choco`. */
export const managerChoco = Manager.make(term(PMID, "manager-choco"), {
  label: en("choco"),
  identifier: "choco",
  executable: "choco",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-dnf`. */
export const managerDnf = Manager.make(term(PMID, "manager-dnf"), {
  label: en("dnf"),
  identifier: "dnf",
  executable: "dnf",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  purlType: "rpm",
});

/** The manager `manager-emerge`. */
export const managerEmerge = Manager.make(term(PMID, "manager-emerge"), {
  label: en("emerge"),
  identifier: "emerge",
  executable: "emerge",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-eopkg`. */
export const managerEopkg = Manager.make(term(PMID, "manager-eopkg"), {
  label: en("eopkg"),
  identifier: "eopkg",
  executable: "eopkg",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-flatpak`. */
export const managerFlatpak = Manager.make(term(PMID, "manager-flatpak"), {
  label: en("flatpak"),
  identifier: "flatpak",
  executable: "flatpak",
  kind: managerKinds.UniversalKind,
  needsAdministrator: false,
});

/** The manager `manager-guix`. */
export const managerGuix = Manager.make(term(PMID, "manager-guix"), {
  label: en("guix"),
  identifier: "guix",
  executable: "guix",
  kind: managerKinds.UniversalKind,
  needsAdministrator: true,
});

/** The manager `manager-nala`. */
export const managerNala = Manager.make(term(PMID, "manager-nala"), {
  label: en("nala"),
  identifier: "nala",
  executable: "nala",
  kind: managerKinds.HelperKind,
  needsAdministrator: true,
  environment: "DEBIAN_FRONTEND=noninteractive",
  purlType: "deb",
});

/** The manager `manager-nix-env`. */
export const managerNixEnv = Manager.make(term(PMID, "manager-nix-env"), {
  label: en("nix-env"),
  identifier: "nix-env",
  executable: "nix-env",
  kind: managerKinds.SystemKind,
  needsAdministrator: false,
});

/** The manager `manager-opkg`. */
export const managerOpkg = Manager.make(term(PMID, "manager-opkg"), {
  label: en("opkg"),
  identifier: "opkg",
  executable: "opkg",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-pacman`. */
export const managerPacman = Manager.make(term(PMID, "manager-pacman"), {
  label: en("pacman"),
  identifier: "pacman",
  executable: "pacman",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  purlType: "alpm",
});

/** The manager `manager-freebsd-pkg`. */
export const managerFreebsdPkg = Manager.make(term(PMID, "manager-freebsd-pkg"), {
  label: en("pkg"),
  identifier: "freebsd-pkg",
  executable: "pkg",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-termux-pkg`. */
export const managerTermuxPkg = Manager.make(term(PMID, "manager-termux-pkg"), {
  label: en("pkg(termux)"),
  identifier: "termux-pkg",
  executable: "pkg",
  kind: managerKinds.SystemKind,
  needsAdministrator: false,
});

/** The manager `manager-pkgman`. */
export const managerPkgman = Manager.make(term(PMID, "manager-pkgman"), {
  label: en("pkgman"),
  identifier: "pkgman",
  executable: "pkgman",
  kind: managerKinds.SystemKind,
  needsAdministrator: false,
});

/** The manager `manager-prt-get`. */
export const managerPrtGet = Manager.make(term(PMID, "manager-prt-get"), {
  label: en("prt-get"),
  identifier: "prt-get",
  executable: "prt-get",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-scoop`. */
export const managerScoop = Manager.make(term(PMID, "manager-scoop"), {
  label: en("scoop"),
  identifier: "scoop",
  executable: "scoop",
  kind: managerKinds.SystemKind,
  needsAdministrator: false,
});

/** The manager `manager-slackpkg`. */
export const managerSlackpkg = Manager.make(term(PMID, "manager-slackpkg"), {
  label: en("slackpkg"),
  identifier: "slackpkg",
  executable: "slackpkg",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-snap`. */
export const managerSnap = Manager.make(term(PMID, "manager-snap"), {
  label: en("snap"),
  identifier: "snap",
  executable: "snap",
  kind: managerKinds.UniversalKind,
  needsAdministrator: true,
});

/** The manager `manager-urpm`. */
export const managerUrpm = Manager.make(term(PMID, "manager-urpm"), {
  label: en("urpm"),
  identifier: "urpm",
  executable: "urpmi",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  purlType: "rpm",
});

/** The manager `manager-winget`. */
export const managerWinget = Manager.make(term(PMID, "manager-winget"), {
  label: en("winget"),
  identifier: "winget",
  executable: "winget",
  kind: managerKinds.SystemKind,
  needsAdministrator: false,
});

/** The manager `manager-xbps`. */
export const managerXbps = Manager.make(term(PMID, "manager-xbps"), {
  label: en("xbps"),
  identifier: "xbps",
  executable: "xbps-install",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
});

/** The manager `manager-yay`. */
export const managerYay = Manager.make(term(PMID, "manager-yay"), {
  label: en("yay"),
  identifier: "yay",
  executable: "yay",
  kind: managerKinds.HelperKind,
  needsAdministrator: false,
  purlType: "alpm",
  harnessUse: "never",
});

/** The manager `manager-yum`. */
export const managerYum = Manager.make(term(PMID, "manager-yum"), {
  label: en("yum"),
  identifier: "yum",
  executable: "yum",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  purlType: "rpm",
});

/** The manager `manager-zypper`. */
export const managerZypper = Manager.make(term(PMID, "manager-zypper"), {
  label: en("zypper"),
  identifier: "zypper",
  executable: "zypper",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  purlType: "rpm",
});

/** The manager `manager-mise`. */
export const managerMise = Manager.make(term(PMID, "manager-mise"), {
  label: en("mise"),
  identifier: "mise",
  executable: "mise",
  kind: managerKinds.ToolKind,
  needsAdministrator: false,
  note: "A tool manager: it installs the tools of an account or a project in the account's own folder, at the versions it is told, and is no family's manager. Every command of it is from memory and unverified.",
});

/** The manager `manager-port`. */
export const managerPort = Manager.make(term(PMID, "manager-port"), {
  label: en("port"),
  identifier: "port",
  executable: "port",
  kind: managerKinds.SystemKind,
  needsAdministrator: true,
  note: "MacPorts: upt names it for macOS but gives no commands, so none are recorded.",
});

/** The package managers. */
export const managers = [
  managerApk,
  managerApt,
  managerBrew,
  managerCards,
  managerChoco,
  managerDnf,
  managerEmerge,
  managerEopkg,
  managerFlatpak,
  managerGuix,
  managerNala,
  managerNixEnv,
  managerOpkg,
  managerPacman,
  managerFreebsdPkg,
  managerTermuxPkg,
  managerPkgman,
  managerPrtGet,
  managerScoop,
  managerSlackpkg,
  managerSnap,
  managerUrpm,
  managerWinget,
  managerXbps,
  managerYay,
  managerYum,
  managerZypper,
  managerPort,
  managerMise,
] as const;

/** The commands of the managers, as templates of words. */
export const commands = [
  Command.make(term(PMID, "cmd-apk-install"), {
    commandOf: managerApk,
    operation: operations.Install,
    template: "apk add {packages}",
    nonInteractive: "apk add --no-cache {packages}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-apk-remove"), {
    commandOf: managerApk,
    operation: operations.Remove,
    template: "apk del {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apk-upgrade"), {
    commandOf: managerApk,
    operation: operations.Upgrade,
    template: "apk upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apk-search"), {
    commandOf: managerApk,
    operation: operations.Search,
    template: "apk search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apk-info"), {
    commandOf: managerApk,
    operation: operations.Info,
    template: "apk info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apk-refresh"), {
    commandOf: managerApk,
    operation: operations.Refresh,
    template: "apk update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apk-upgrade-all"), {
    commandOf: managerApk,
    operation: operations.UpgradeAll,
    template: "apk upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apk-list-installed"), {
    commandOf: managerApk,
    operation: operations.ListInstalled,
    template: "apk list --installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apt-install"), {
    commandOf: managerApt,
    operation: operations.Install,
    template: "apt install {packages}",
    nonInteractive: "apt-get install -y {packages}",
    origin: "archon",
    verifiedOn: "Debian 13 under WSL 2, by archon-bootstrap.sh and archon update, 2026-10-16",
  }),
  Command.make(term(PMID, "cmd-apt-remove"), {
    commandOf: managerApt,
    operation: operations.Remove,
    template: "apt remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apt-upgrade"), {
    commandOf: managerApt,
    operation: operations.Upgrade,
    template: "apt install --only-upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apt-search"), {
    commandOf: managerApt,
    operation: operations.Search,
    template: "apt search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apt-info"), {
    commandOf: managerApt,
    operation: operations.Info,
    template: "apt show {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apt-refresh"), {
    commandOf: managerApt,
    operation: operations.Refresh,
    template: "apt update",
    nonInteractive: "apt-get update",
    origin: "archon",
    verifiedOn: "Debian 13 under WSL 2, by archon-bootstrap.sh and archon update, 2026-10-16",
  }),
  Command.make(term(PMID, "cmd-apt-upgrade-all"), {
    commandOf: managerApt,
    operation: operations.UpgradeAll,
    template: "apt upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apt-list-installed"), {
    commandOf: managerApt,
    operation: operations.ListInstalled,
    template: "apt list --installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-apt-query-installed"), {
    commandOf: managerApt,
    operation: operations.QueryInstalled,
    template: "dpkg-query -W -f=${Status} {package}",
    missingExitStatus: 1,
    origin: "archon",
    verifiedOn: "Debian 13 under WSL 2, by archon-bootstrap.sh and archon update, 2026-10-16",
  }),
  Command.make(term(PMID, "cmd-apt-query-candidate"), {
    commandOf: managerApt,
    operation: operations.QueryCandidate,
    template: "apt-cache policy {package}",
    origin: "archon",
    verifiedOn: "Debian 13 under WSL 2, by archon-bootstrap.sh and archon update, 2026-10-16",
  }),
  Command.make(term(PMID, "cmd-brew-install"), {
    commandOf: managerBrew,
    operation: operations.Install,
    template: "brew install {packages}",
    nonInteractive: "brew install {packages}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-brew-remove"), {
    commandOf: managerBrew,
    operation: operations.Remove,
    template: "brew uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-brew-upgrade"), {
    commandOf: managerBrew,
    operation: operations.Upgrade,
    template: "brew upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-brew-search"), {
    commandOf: managerBrew,
    operation: operations.Search,
    template: "brew search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-brew-info"), {
    commandOf: managerBrew,
    operation: operations.Info,
    template: "brew info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-brew-refresh"), {
    commandOf: managerBrew,
    operation: operations.Refresh,
    template: "brew update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-brew-upgrade-all"), {
    commandOf: managerBrew,
    operation: operations.UpgradeAll,
    template: "brew upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-brew-list-installed"), {
    commandOf: managerBrew,
    operation: operations.ListInstalled,
    template: "brew list",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-install"), {
    commandOf: managerCards,
    operation: operations.Install,
    template: "cards install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-remove"), {
    commandOf: managerCards,
    operation: operations.Remove,
    template: "cards remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-upgrade"), {
    commandOf: managerCards,
    operation: operations.Upgrade,
    template: "cards install --upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-search"), {
    commandOf: managerCards,
    operation: operations.Search,
    template: "cards search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-info"), {
    commandOf: managerCards,
    operation: operations.Info,
    template: "cards info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-refresh"), {
    commandOf: managerCards,
    operation: operations.Refresh,
    template: "cards sync",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-upgrade-all"), {
    commandOf: managerCards,
    operation: operations.UpgradeAll,
    template: "cards upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-cards-list-installed"), {
    commandOf: managerCards,
    operation: operations.ListInstalled,
    template: "cards list",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-choco-install"), {
    commandOf: managerChoco,
    operation: operations.Install,
    template: "choco install {packages}",
    nonInteractive: "choco install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-choco-remove"), {
    commandOf: managerChoco,
    operation: operations.Remove,
    template: "choco uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-choco-upgrade"), {
    commandOf: managerChoco,
    operation: operations.Upgrade,
    template: "choco upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-choco-search"), {
    commandOf: managerChoco,
    operation: operations.Search,
    template: "choco search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-choco-info"), {
    commandOf: managerChoco,
    operation: operations.Info,
    template: "choco info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-choco-upgrade-all"), {
    commandOf: managerChoco,
    operation: operations.UpgradeAll,
    template: "choco upgrade all",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-choco-list-installed"), {
    commandOf: managerChoco,
    operation: operations.ListInstalled,
    template: "choco list",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-install"), {
    commandOf: managerDnf,
    operation: operations.Install,
    template: "dnf install {packages}",
    nonInteractive: "dnf install -y {packages}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-dnf-remove"), {
    commandOf: managerDnf,
    operation: operations.Remove,
    template: "dnf remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-upgrade"), {
    commandOf: managerDnf,
    operation: operations.Upgrade,
    template: "dnf upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-search"), {
    commandOf: managerDnf,
    operation: operations.Search,
    template: "dnf search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-info"), {
    commandOf: managerDnf,
    operation: operations.Info,
    template: "dnf info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-refresh"), {
    commandOf: managerDnf,
    operation: operations.Refresh,
    template: "dnf check-update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-upgrade-all"), {
    commandOf: managerDnf,
    operation: operations.UpgradeAll,
    template: "dnf update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-list-installed"), {
    commandOf: managerDnf,
    operation: operations.ListInstalled,
    template: "dnf list --installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-emerge-install"), {
    commandOf: managerEmerge,
    operation: operations.Install,
    template: "emerge {packages}",
    nonInteractive: "emerge --ask=n {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-emerge-remove"), {
    commandOf: managerEmerge,
    operation: operations.Remove,
    template: "emerge --depclean {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-emerge-upgrade"), {
    commandOf: managerEmerge,
    operation: operations.Upgrade,
    template: "emerge --update {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-emerge-search"), {
    commandOf: managerEmerge,
    operation: operations.Search,
    template: "emerge --search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-emerge-info"), {
    commandOf: managerEmerge,
    operation: operations.Info,
    template: "emerge --info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-emerge-refresh"), {
    commandOf: managerEmerge,
    operation: operations.Refresh,
    template: "emerge --sync",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-emerge-upgrade-all"), {
    commandOf: managerEmerge,
    operation: operations.UpgradeAll,
    template: "emerge -vuDN @world",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-emerge-list-installed"), {
    commandOf: managerEmerge,
    operation: operations.ListInstalled,
    template: "qlist -lv",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-eopkg-install"), {
    commandOf: managerEopkg,
    operation: operations.Install,
    template: "eopkg install {packages}",
    nonInteractive: "eopkg install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-eopkg-remove"), {
    commandOf: managerEopkg,
    operation: operations.Remove,
    template: "eopkg remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-eopkg-upgrade"), {
    commandOf: managerEopkg,
    operation: operations.Upgrade,
    template: "eopkg upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-eopkg-search"), {
    commandOf: managerEopkg,
    operation: operations.Search,
    template: "eopkg search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-eopkg-info"), {
    commandOf: managerEopkg,
    operation: operations.Info,
    template: "eopkg info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-eopkg-refresh"), {
    commandOf: managerEopkg,
    operation: operations.Refresh,
    template: "eopkg update-repo",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-eopkg-upgrade-all"), {
    commandOf: managerEopkg,
    operation: operations.UpgradeAll,
    template: "eopkg upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-eopkg-list-installed"), {
    commandOf: managerEopkg,
    operation: operations.ListInstalled,
    template: "eopkg list-installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-flatpak-install"), {
    commandOf: managerFlatpak,
    operation: operations.Install,
    template: "flatpak install {packages}",
    nonInteractive: "flatpak install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-flatpak-remove"), {
    commandOf: managerFlatpak,
    operation: operations.Remove,
    template: "flatpak uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-flatpak-upgrade"), {
    commandOf: managerFlatpak,
    operation: operations.Upgrade,
    template: "flatpak update {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-flatpak-search"), {
    commandOf: managerFlatpak,
    operation: operations.Search,
    template: "flatpak search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-flatpak-info"), {
    commandOf: managerFlatpak,
    operation: operations.Info,
    template: "flatpak info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-flatpak-upgrade-all"), {
    commandOf: managerFlatpak,
    operation: operations.UpgradeAll,
    template: "flatpak update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-flatpak-list-installed"), {
    commandOf: managerFlatpak,
    operation: operations.ListInstalled,
    template: "flatpak list",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-install"), {
    commandOf: managerGuix,
    operation: operations.Install,
    template: "guix install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-remove"), {
    commandOf: managerGuix,
    operation: operations.Remove,
    template: "guix remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-upgrade"), {
    commandOf: managerGuix,
    operation: operations.Upgrade,
    template: "guix upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-search"), {
    commandOf: managerGuix,
    operation: operations.Search,
    template: "guix search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-info"), {
    commandOf: managerGuix,
    operation: operations.Info,
    template: "guix show {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-refresh"), {
    commandOf: managerGuix,
    operation: operations.Refresh,
    template: "guix refresh",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-upgrade-all"), {
    commandOf: managerGuix,
    operation: operations.UpgradeAll,
    template: "guix upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-guix-list-installed"), {
    commandOf: managerGuix,
    operation: operations.ListInstalled,
    template: "guix package --list-installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nala-install"), {
    commandOf: managerNala,
    operation: operations.Install,
    template: "nala install {packages}",
    nonInteractive: "nala install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-nala-remove"), {
    commandOf: managerNala,
    operation: operations.Remove,
    template: "nala remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nala-upgrade"), {
    commandOf: managerNala,
    operation: operations.Upgrade,
    template: "nala install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nala-search"), {
    commandOf: managerNala,
    operation: operations.Search,
    template: "nala search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nala-info"), {
    commandOf: managerNala,
    operation: operations.Info,
    template: "nala show {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nala-refresh"), {
    commandOf: managerNala,
    operation: operations.Refresh,
    template: "nala update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nala-upgrade-all"), {
    commandOf: managerNala,
    operation: operations.UpgradeAll,
    template: "nala upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nala-list-installed"), {
    commandOf: managerNala,
    operation: operations.ListInstalled,
    template: "nala list --installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-install"), {
    commandOf: managerNixEnv,
    operation: operations.Install,
    template: "nix-env --install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-remove"), {
    commandOf: managerNixEnv,
    operation: operations.Remove,
    template: "nix-env --uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-upgrade"), {
    commandOf: managerNixEnv,
    operation: operations.Upgrade,
    template: "nix-env --upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-search"), {
    commandOf: managerNixEnv,
    operation: operations.Search,
    template: "nix-env -qaP {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-info"), {
    commandOf: managerNixEnv,
    operation: operations.Info,
    template: "nix-env -qa --description {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-refresh"), {
    commandOf: managerNixEnv,
    operation: operations.Refresh,
    template: "nix-channel --update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-upgrade-all"), {
    commandOf: managerNixEnv,
    operation: operations.UpgradeAll,
    template: "nix-env --upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-nix-env-list-installed"), {
    commandOf: managerNixEnv,
    operation: operations.ListInstalled,
    template: "nix-env --query --installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-install"), {
    commandOf: managerOpkg,
    operation: operations.Install,
    template: "opkg install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-remove"), {
    commandOf: managerOpkg,
    operation: operations.Remove,
    template: "opkg remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-upgrade"), {
    commandOf: managerOpkg,
    operation: operations.Upgrade,
    template: "opkg upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-search"), {
    commandOf: managerOpkg,
    operation: operations.Search,
    template: "opkg find {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-info"), {
    commandOf: managerOpkg,
    operation: operations.Info,
    template: "opkg info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-refresh"), {
    commandOf: managerOpkg,
    operation: operations.Refresh,
    template: "opkg update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-upgrade-all"), {
    commandOf: managerOpkg,
    operation: operations.UpgradeAll,
    template: "opkg upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-opkg-list-installed"), {
    commandOf: managerOpkg,
    operation: operations.ListInstalled,
    template: "opkg list --installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pacman-install"), {
    commandOf: managerPacman,
    operation: operations.Install,
    template: "pacman -S {packages}",
    nonInteractive: "pacman -S --needed --noconfirm {packages}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-pacman-remove"), {
    commandOf: managerPacman,
    operation: operations.Remove,
    template: "pacman -Rs {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pacman-upgrade"), {
    commandOf: managerPacman,
    operation: operations.Upgrade,
    template: "pacman -S {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pacman-search"), {
    commandOf: managerPacman,
    operation: operations.Search,
    template: "pacman -Ss {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pacman-info"), {
    commandOf: managerPacman,
    operation: operations.Info,
    template: "pacman -Si {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pacman-upgrade-all"), {
    commandOf: managerPacman,
    operation: operations.UpgradeAll,
    template: "pacman -Syu",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pacman-list-installed"), {
    commandOf: managerPacman,
    operation: operations.ListInstalled,
    template: "pacman -Q",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pacman-query-installed"), {
    commandOf: managerPacman,
    operation: operations.QueryInstalled,
    template: "pacman -Qi {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-pacman-query-candidate"), {
    commandOf: managerPacman,
    operation: operations.QueryCandidate,
    template: "pacman -Si {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-install"), {
    commandOf: managerFreebsdPkg,
    operation: operations.Install,
    template: "pkg install {packages}",
    nonInteractive: "pkg install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-remove"), {
    commandOf: managerFreebsdPkg,
    operation: operations.Remove,
    template: "pkg remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-upgrade"), {
    commandOf: managerFreebsdPkg,
    operation: operations.Upgrade,
    template: "pkg install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-search"), {
    commandOf: managerFreebsdPkg,
    operation: operations.Search,
    template: "pkg search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-info"), {
    commandOf: managerFreebsdPkg,
    operation: operations.Info,
    template: "pkg info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-refresh"), {
    commandOf: managerFreebsdPkg,
    operation: operations.Refresh,
    template: "pkg update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-upgrade-all"), {
    commandOf: managerFreebsdPkg,
    operation: operations.UpgradeAll,
    template: "pkg upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-freebsd-pkg-list-installed"), {
    commandOf: managerFreebsdPkg,
    operation: operations.ListInstalled,
    template: "pkg info --all",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-install"), {
    commandOf: managerTermuxPkg,
    operation: operations.Install,
    template: "pkg install {packages}",
    nonInteractive: "pkg install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-remove"), {
    commandOf: managerTermuxPkg,
    operation: operations.Remove,
    template: "pkg uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-upgrade"), {
    commandOf: managerTermuxPkg,
    operation: operations.Upgrade,
    template: "pkg install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-search"), {
    commandOf: managerTermuxPkg,
    operation: operations.Search,
    template: "pkg search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-info"), {
    commandOf: managerTermuxPkg,
    operation: operations.Info,
    template: "pkg show {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-refresh"), {
    commandOf: managerTermuxPkg,
    operation: operations.Refresh,
    template: "pkg update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-upgrade-all"), {
    commandOf: managerTermuxPkg,
    operation: operations.UpgradeAll,
    template: "pkg upgrade",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-termux-pkg-list-installed"), {
    commandOf: managerTermuxPkg,
    operation: operations.ListInstalled,
    template: "pkg list-installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pkgman-install"), {
    commandOf: managerPkgman,
    operation: operations.Install,
    template: "pkgman install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pkgman-remove"), {
    commandOf: managerPkgman,
    operation: operations.Remove,
    template: "pkgman uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pkgman-upgrade"), {
    commandOf: managerPkgman,
    operation: operations.Upgrade,
    template: "pkgman update {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pkgman-search"), {
    commandOf: managerPkgman,
    operation: operations.Search,
    template: "pkgman search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pkgman-refresh"), {
    commandOf: managerPkgman,
    operation: operations.Refresh,
    template: "pkgman refresh",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pkgman-upgrade-all"), {
    commandOf: managerPkgman,
    operation: operations.UpgradeAll,
    template: "pkgman update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-pkgman-list-installed"), {
    commandOf: managerPkgman,
    operation: operations.ListInstalled,
    template: "pkgman search -i -a",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-install"), {
    commandOf: managerPrtGet,
    operation: operations.Install,
    template: "prt-get install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-remove"), {
    commandOf: managerPrtGet,
    operation: operations.Remove,
    template: "prt-get remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-upgrade"), {
    commandOf: managerPrtGet,
    operation: operations.Upgrade,
    template: "prt-get update {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-search"), {
    commandOf: managerPrtGet,
    operation: operations.Search,
    template: "prt-get search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-info"), {
    commandOf: managerPrtGet,
    operation: operations.Info,
    template: "prt-get info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-refresh"), {
    commandOf: managerPrtGet,
    operation: operations.Refresh,
    template: "ports -u",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-upgrade-all"), {
    commandOf: managerPrtGet,
    operation: operations.UpgradeAll,
    template: "prt-get sysup",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-prt-get-list-installed"), {
    commandOf: managerPrtGet,
    operation: operations.ListInstalled,
    template: "prt-get listinst",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-install"), {
    commandOf: managerScoop,
    operation: operations.Install,
    template: "scoop install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-remove"), {
    commandOf: managerScoop,
    operation: operations.Remove,
    template: "scoop uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-upgrade"), {
    commandOf: managerScoop,
    operation: operations.Upgrade,
    template: "scoop update {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-search"), {
    commandOf: managerScoop,
    operation: operations.Search,
    template: "scoop search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-info"), {
    commandOf: managerScoop,
    operation: operations.Info,
    template: "scoop info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-refresh"), {
    commandOf: managerScoop,
    operation: operations.Refresh,
    template: "scoop update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-upgrade-all"), {
    commandOf: managerScoop,
    operation: operations.UpgradeAll,
    template: "scoop update *",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-scoop-list-installed"), {
    commandOf: managerScoop,
    operation: operations.ListInstalled,
    template: "scoop list",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-install"), {
    commandOf: managerSlackpkg,
    operation: operations.Install,
    template: "slackpkg install {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-remove"), {
    commandOf: managerSlackpkg,
    operation: operations.Remove,
    template: "slackpkg remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-upgrade"), {
    commandOf: managerSlackpkg,
    operation: operations.Upgrade,
    template: "slackpkg upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-search"), {
    commandOf: managerSlackpkg,
    operation: operations.Search,
    template: "slackpkg search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-info"), {
    commandOf: managerSlackpkg,
    operation: operations.Info,
    template: "slackpkg info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-refresh"), {
    commandOf: managerSlackpkg,
    operation: operations.Refresh,
    template: "slackpkg update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-upgrade-all"), {
    commandOf: managerSlackpkg,
    operation: operations.UpgradeAll,
    template: "slackpkg upgrade-all",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-slackpkg-list-installed"), {
    commandOf: managerSlackpkg,
    operation: operations.ListInstalled,
    template: "ls -1 /var/log/packages",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-snap-install"), {
    commandOf: managerSnap,
    operation: operations.Install,
    template: "snap install --classic {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-snap-remove"), {
    commandOf: managerSnap,
    operation: operations.Remove,
    template: "snap remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-snap-upgrade"), {
    commandOf: managerSnap,
    operation: operations.Upgrade,
    template: "snap refresh {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-snap-search"), {
    commandOf: managerSnap,
    operation: operations.Search,
    template: "snap find {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-snap-info"), {
    commandOf: managerSnap,
    operation: operations.Info,
    template: "snap info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-snap-upgrade-all"), {
    commandOf: managerSnap,
    operation: operations.UpgradeAll,
    template: "snap refresh",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-snap-list-installed"), {
    commandOf: managerSnap,
    operation: operations.ListInstalled,
    template: "snap list",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-urpm-install"), {
    commandOf: managerUrpm,
    operation: operations.Install,
    template: "urpmi {packages}",
    nonInteractive: "urpmi --auto {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-urpm-remove"), {
    commandOf: managerUrpm,
    operation: operations.Remove,
    template: "urpme {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-urpm-upgrade"), {
    commandOf: managerUrpm,
    operation: operations.Upgrade,
    template: "urpmi {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-urpm-search"), {
    commandOf: managerUrpm,
    operation: operations.Search,
    template: "urpmq --fuzzy {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-urpm-info"), {
    commandOf: managerUrpm,
    operation: operations.Info,
    template: "urpmq -i {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-urpm-refresh"), {
    commandOf: managerUrpm,
    operation: operations.Refresh,
    template: "urpmi.update -a",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-urpm-upgrade-all"), {
    commandOf: managerUrpm,
    operation: operations.UpgradeAll,
    template: "urpmi --auto-update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-urpm-list-installed"), {
    commandOf: managerUrpm,
    operation: operations.ListInstalled,
    template: "rpm --query --all",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-winget-install"), {
    commandOf: managerWinget,
    operation: operations.Install,
    template: "winget install {packages}",
    nonInteractive: "winget install --accept-package-agreements --accept-source-agreements {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-winget-remove"), {
    commandOf: managerWinget,
    operation: operations.Remove,
    template: "winget uninstall {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-winget-upgrade"), {
    commandOf: managerWinget,
    operation: operations.Upgrade,
    template: "winget upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-winget-search"), {
    commandOf: managerWinget,
    operation: operations.Search,
    template: "winget search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-winget-info"), {
    commandOf: managerWinget,
    operation: operations.Info,
    template: "winget show {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-winget-upgrade-all"), {
    commandOf: managerWinget,
    operation: operations.UpgradeAll,
    template: "winget upgrade --all",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-winget-list-installed"), {
    commandOf: managerWinget,
    operation: operations.ListInstalled,
    template: "winget list",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-xbps-install"), {
    commandOf: managerXbps,
    operation: operations.Install,
    template: "xbps-install {packages}",
    nonInteractive: "xbps-install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-xbps-remove"), {
    commandOf: managerXbps,
    operation: operations.Remove,
    template: "xbps-remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-xbps-upgrade"), {
    commandOf: managerXbps,
    operation: operations.Upgrade,
    template: "xbps-install --update {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-xbps-search"), {
    commandOf: managerXbps,
    operation: operations.Search,
    template: "xbps-query -Rs {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-xbps-info"), {
    commandOf: managerXbps,
    operation: operations.Info,
    template: "xbps-query -RS {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-xbps-refresh"), {
    commandOf: managerXbps,
    operation: operations.Refresh,
    template: "xbps-install --sync",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-xbps-upgrade-all"), {
    commandOf: managerXbps,
    operation: operations.UpgradeAll,
    template: "xbps-install --update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-xbps-list-installed"), {
    commandOf: managerXbps,
    operation: operations.ListInstalled,
    template: "xbps-query --list-pkgs",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yay-remove"), {
    commandOf: managerYay,
    operation: operations.Remove,
    template: "yay -Rs {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yay-search"), {
    commandOf: managerYay,
    operation: operations.Search,
    template: "yay -Ss {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yay-info"), {
    commandOf: managerYay,
    operation: operations.Info,
    template: "yay -Si {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yay-upgrade-all"), {
    commandOf: managerYay,
    operation: operations.UpgradeAll,
    template: "yay -Syu",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yay-list-installed"), {
    commandOf: managerYay,
    operation: operations.ListInstalled,
    template: "yay -Q",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yum-install"), {
    commandOf: managerYum,
    operation: operations.Install,
    template: "yum install {packages}",
    nonInteractive: "yum install -y {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-yum-remove"), {
    commandOf: managerYum,
    operation: operations.Remove,
    template: "yum remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yum-upgrade"), {
    commandOf: managerYum,
    operation: operations.Upgrade,
    template: "yum upgrade {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yum-search"), {
    commandOf: managerYum,
    operation: operations.Search,
    template: "yum search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yum-info"), {
    commandOf: managerYum,
    operation: operations.Info,
    template: "yum info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yum-refresh"), {
    commandOf: managerYum,
    operation: operations.Refresh,
    template: "yum check-update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yum-upgrade-all"), {
    commandOf: managerYum,
    operation: operations.UpgradeAll,
    template: "yum update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-yum-list-installed"), {
    commandOf: managerYum,
    operation: operations.ListInstalled,
    template: "yum list --installed",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-zypper-install"), {
    commandOf: managerZypper,
    operation: operations.Install,
    template: "zypper install {packages}",
    nonInteractive: "zypper --non-interactive install {packages}",
    origin: "upt+memory",
  }),
  Command.make(term(PMID, "cmd-zypper-remove"), {
    commandOf: managerZypper,
    operation: operations.Remove,
    template: "zypper remove {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-zypper-upgrade"), {
    commandOf: managerZypper,
    operation: operations.Upgrade,
    template: "zypper update {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-zypper-search"), {
    commandOf: managerZypper,
    operation: operations.Search,
    template: "zypper search {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-zypper-info"), {
    commandOf: managerZypper,
    operation: operations.Info,
    template: "zypper info {packages}",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-zypper-refresh"), {
    commandOf: managerZypper,
    operation: operations.Refresh,
    template: "zypper refresh",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-zypper-upgrade-all"), {
    commandOf: managerZypper,
    operation: operations.UpgradeAll,
    template: "zypper update",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-zypper-list-installed"), {
    commandOf: managerZypper,
    operation: operations.ListInstalled,
    template: "zypper search --installed-only",
    origin: "upt",
  }),
  Command.make(term(PMID, "cmd-dnf-query-installed"), {
    commandOf: managerDnf,
    operation: operations.QueryInstalled,
    template: "rpm -q {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-dnf-query-candidate"), {
    commandOf: managerDnf,
    operation: operations.QueryCandidate,
    template: "dnf -q repoquery --latest-limit=1 --qf %{version} {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-apk-query-installed"), {
    commandOf: managerApk,
    operation: operations.QueryInstalled,
    template: "apk info -e {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-apk-query-candidate"), {
    commandOf: managerApk,
    operation: operations.QueryCandidate,
    template: "apk policy {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-brew-query-installed"), {
    commandOf: managerBrew,
    operation: operations.QueryInstalled,
    template: "brew list --formula {package}",
    missingExitStatus: 1,
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-brew-query-candidate"), {
    commandOf: managerBrew,
    operation: operations.QueryCandidate,
    template: "brew info --json=v2 {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-apt-query-version"), {
    commandOf: managerApt,
    operation: operations.QueryVersion,
    template: "dpkg-query -W -f=${Version} {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-pacman-query-version"), {
    commandOf: managerPacman,
    operation: operations.QueryVersion,
    template: "pacman -Q {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-dnf-query-version"), {
    commandOf: managerDnf,
    operation: operations.QueryVersion,
    template: "rpm -q --qf %{VERSION}-%{RELEASE} {package}",
    origin: "archon",
  }),
  Command.make(term(PMID, "cmd-brew-query-version"), {
    commandOf: managerBrew,
    operation: operations.QueryVersion,
    template: "brew list --versions {package}",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-winget-query-version"), {
    commandOf: managerWinget,
    operation: operations.QueryVersion,
    template: "winget list --exact --id {package}",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-mise-install"), {
    commandOf: managerMise,
    operation: operations.Install,
    template: "mise install {packages}",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-mise-query-version"), {
    commandOf: managerMise,
    operation: operations.QueryVersion,
    template: "mise current {package}",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-mise-list-installed"), {
    commandOf: managerMise,
    operation: operations.ListInstalled,
    template: "mise ls",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-apt-install-exact"), {
    commandOf: managerApt,
    operation: operations.InstallExact,
    template: "apt install {package}={version}",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-brew-install-exact"), {
    commandOf: managerBrew,
    operation: operations.InstallExact,
    template: "brew install {package}@{version}",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-winget-install-exact"), {
    commandOf: managerWinget,
    operation: operations.InstallExact,
    template: "winget install --exact --id {package} --version {version}",
    origin: "memory",
  }),
  Command.make(term(PMID, "cmd-mise-install-exact"), {
    commandOf: managerMise,
    operation: operations.InstallExact,
    template: "mise install {package}@{version}",
    origin: "memory",
  }),
] as const;

/** The commands no harness may run, each with its reason. */
export const prohibitions = [
  Prohibition.make(term(PMID, "prohibition-pacman-1"), {
    prohibitionOf: managerPacman,
    forbiddenTemplate: "pacman -Sy",
    definition: en(
      "Refreshing the package list alone leaves a rolling release partly upgraded; upgrade with -Syu, or install with -S --needed and let a missing package say the list is old.",
    ),
  }),
  Prohibition.make(term(PMID, "prohibition-pacman-2"), {
    prohibitionOf: managerPacman,
    forbiddenTemplate: "pacman -Sy {packages}",
    definition: en("Installing from a freshly refreshed list without upgrading the rest of the system is a partial upgrade."),
  }),
  Prohibition.make(term(PMID, "prohibition-yay-1"), {
    prohibitionOf: managerYay,
    forbiddenTemplate: "yay -S {packages}",
    definition: en(
      "An AUR helper builds and runs scripts of packages nobody reviewed with the person's rights; a harness never drives one.",
    ),
  }),
  Prohibition.make(term(PMID, "prohibition-yay-2"), {
    prohibitionOf: managerYay,
    forbiddenTemplate: "yay -Sy",
    definition: en("A refresh alone is a partial upgrade, and a harness never drives an AUR helper."),
  }),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "managers",
  prefixes: [DCTERMS, PM, PMID, RDFS, SKOS, XSD],
  individuals: [...managers, ...commands, ...prohibitions],
};
