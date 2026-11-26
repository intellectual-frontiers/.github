/**
 * The programs a computer needs for a harness's setup (required) and for the everyday comfort tools (comfort), and what each family calls their packages.
 * From desired-os-state-bootstrap.sh's package lists. A name left out for a family means that family needs no package for it.
 *
 * @module
 */
import { DCTERMS, en, type OntologyFile, RDFS, SKOS, term, XSD } from "@intellectual-frontiers/rdf";
import { familyArch, familyDebian } from "./families.ts";
import { PackageName, PM, PMID, Program, tiers } from "./packaging.ts";

/** The program `prog-git`. */
export const progGit = Program.make(term(PMID, "prog-git"), { label: en("git"), programName: "git", tier: tiers.Required, order: 1 });

/** The program `prog-ca-certificates`. */
export const progCaCertificates = Program.make(term(PMID, "prog-ca-certificates"), {
  label: en("ca-certificates"),
  programName: "ca-certificates",
  tier: tiers.Required,
  order: 2,
});

/** The program `prog-curl`. */
export const progCurl = Program.make(term(PMID, "prog-curl"), { label: en("curl"), programName: "curl", tier: tiers.Required, order: 3 });

/** The program `prog-wget`. */
export const progWget = Program.make(term(PMID, "prog-wget"), { label: en("wget"), programName: "wget", tier: tiers.Required, order: 4 });

/** The program `prog-tar`. */
export const progTar = Program.make(term(PMID, "prog-tar"), { label: en("tar"), programName: "tar", tier: tiers.Required, order: 5 });

/** The program `prog-xz`. */
export const progXz = Program.make(term(PMID, "prog-xz"), { label: en("xz"), programName: "xz", tier: tiers.Required, order: 6 });

/** The program `prog-unzip`. */
export const progUnzip = Program.make(term(PMID, "prog-unzip"), {
  label: en("unzip"),
  programName: "unzip",
  tier: tiers.Required,
  order: 7,
});

// The C compiler and linker that Rust links with: erga's launcher compiles erga with Cargo before any erga command can run (erga 009-machine-bootstrap FR-021).
// A Mac has them in the Command Line Tools, which only a person at the screen can install.
/** The program `prog-cc`. */
export const progCc = Program.make(term(PMID, "prog-cc"), {
  label: en("a C compiler and linker"),
  programName: "cc",
  tier: tiers.Required,
  order: 10,
});

/** The program `prog-coreutils`. */
export const progCoreutils = Program.make(term(PMID, "prog-coreutils"), {
  label: en("coreutils"),
  programName: "coreutils",
  tier: tiers.Comfort,
  order: 10,
});

/** The program `prog-sed`. */
export const progSed = Program.make(term(PMID, "prog-sed"), { label: en("sed"), programName: "sed", tier: tiers.Comfort, order: 11 });

/** The program `prog-findutils`. */
export const progFindutils = Program.make(term(PMID, "prog-findutils"), {
  label: en("findutils"),
  programName: "findutils",
  tier: tiers.Comfort,
  order: 12,
});

/** The program `prog-diffutils`. */
export const progDiffutils = Program.make(term(PMID, "prog-diffutils"), {
  label: en("diffutils"),
  programName: "diffutils",
  tier: tiers.Comfort,
  order: 13,
});

/** The program `prog-patch`. */
export const progPatch = Program.make(term(PMID, "prog-patch"), {
  label: en("patch"),
  programName: "patch",
  tier: tiers.Comfort,
  order: 14,
});

/** The program `prog-gzip`. */
export const progGzip = Program.make(term(PMID, "prog-gzip"), { label: en("gzip"), programName: "gzip", tier: tiers.Comfort, order: 15 });

/** The program `prog-zip`. */
export const progZip = Program.make(term(PMID, "prog-zip"), { label: en("zip"), programName: "zip", tier: tiers.Comfort, order: 16 });

/** The program `prog-bzip2`. */
export const progBzip2 = Program.make(term(PMID, "prog-bzip2"), {
  label: en("bzip2"),
  programName: "bzip2",
  tier: tiers.Comfort,
  order: 17,
});

/** The program `prog-file`. */
export const progFile = Program.make(term(PMID, "prog-file"), { label: en("file"), programName: "file", tier: tiers.Comfort, order: 18 });

/** The program `prog-less`. */
export const progLess = Program.make(term(PMID, "prog-less"), { label: en("less"), programName: "less", tier: tiers.Comfort, order: 19 });

/** The program `prog-debianutils`. */
export const progDebianutils = Program.make(term(PMID, "prog-debianutils"), {
  label: en("debianutils"),
  programName: "debianutils",
  tier: tiers.Comfort,
  order: 20,
});

/** The program `prog-procps`. */
export const progProcps = Program.make(term(PMID, "prog-procps"), {
  label: en("procps"),
  programName: "procps",
  tier: tiers.Comfort,
  order: 21,
});

/** The program `prog-hostname`. */
export const progHostname = Program.make(term(PMID, "prog-hostname"), {
  label: en("hostname"),
  programName: "hostname",
  tier: tiers.Comfort,
  order: 22,
});

/** The program `prog-ncurses`. */
export const progNcurses = Program.make(term(PMID, "prog-ncurses"), {
  label: en("ncurses"),
  programName: "ncurses",
  tier: tiers.Comfort,
  order: 23,
});

/** The program `prog-rsync`. */
export const progRsync = Program.make(term(PMID, "prog-rsync"), {
  label: en("rsync"),
  programName: "rsync",
  tier: tiers.Comfort,
  order: 24,
});

/** The program `prog-bc`. */
export const progBc = Program.make(term(PMID, "prog-bc"), { label: en("bc"), programName: "bc", tier: tiers.Comfort, order: 25 });

/** The program `prog-grep`. */
export const progGrep = Program.make(term(PMID, "prog-grep"), { label: en("grep"), programName: "grep", tier: tiers.Comfort, order: 26 });

/** The program `prog-gawk`. */
export const progGawk = Program.make(term(PMID, "prog-gawk"), { label: en("gawk"), programName: "gawk", tier: tiers.Comfort, order: 27 });

/** The program `prog-bash-completion`. */
export const progBashCompletion = Program.make(term(PMID, "prog-bash-completion"), {
  label: en("bash-completion"),
  programName: "bash-completion",
  tier: tiers.Comfort,
  order: 30,
});

/** The program `prog-imagemagick`. */
export const progImagemagick = Program.make(term(PMID, "prog-imagemagick"), {
  label: en("imagemagick"),
  programName: "imagemagick",
  tier: tiers.Comfort,
  order: 32,
});

/** The program `prog-webp`. */
export const progWebp = Program.make(term(PMID, "prog-webp"), { label: en("webp"), programName: "webp", tier: tiers.Comfort, order: 33 });

/** The program `prog-imagemagick-codecs`. */
export const progImagemagickCodecs = Program.make(term(PMID, "prog-imagemagick-codecs"), {
  label: en("imagemagick-codecs"),
  programName: "imagemagick-codecs",
  tier: tiers.Comfort,
  order: 36,
});

/** The programs a computer needs, each named once. */
export const programs = [
  progGit,
  progCaCertificates,
  progCurl,
  progWget,
  progTar,
  progXz,
  progUnzip,
  progCc,
  progCoreutils,
  progSed,
  progFindutils,
  progDiffutils,
  progPatch,
  progGzip,
  progZip,
  progBzip2,
  progFile,
  progLess,
  progDebianutils,
  progProcps,
  progHostname,
  progNcurses,
  progRsync,
  progBc,
  progGrep,
  progGawk,
  progBashCompletion,
  progImagemagick,
  progWebp,
  progImagemagickCodecs,
] as const;

/** What each family calls the package of a program. */
export const packageNames = [
  PackageName.make(term(PMID, "pkg-debian-git"), { forProgram: progGit, forFamily: familyDebian, name: "git" }),
  PackageName.make(term(PMID, "pkg-arch-git"), { forProgram: progGit, forFamily: familyArch, name: "git" }),
  PackageName.make(term(PMID, "pkg-debian-ca-certificates"), {
    forProgram: progCaCertificates,
    forFamily: familyDebian,
    name: "ca-certificates",
  }),
  PackageName.make(term(PMID, "pkg-arch-ca-certificates"), {
    forProgram: progCaCertificates,
    forFamily: familyArch,
    name: "ca-certificates",
  }),
  PackageName.make(term(PMID, "pkg-debian-curl"), { forProgram: progCurl, forFamily: familyDebian, name: "curl" }),
  PackageName.make(term(PMID, "pkg-arch-curl"), { forProgram: progCurl, forFamily: familyArch, name: "curl" }),
  PackageName.make(term(PMID, "pkg-debian-wget"), { forProgram: progWget, forFamily: familyDebian, name: "wget" }),
  PackageName.make(term(PMID, "pkg-arch-wget"), { forProgram: progWget, forFamily: familyArch, name: "wget" }),
  PackageName.make(term(PMID, "pkg-debian-tar"), { forProgram: progTar, forFamily: familyDebian, name: "tar" }),
  PackageName.make(term(PMID, "pkg-arch-tar"), { forProgram: progTar, forFamily: familyArch, name: "tar" }),
  PackageName.make(term(PMID, "pkg-debian-xz"), { forProgram: progXz, forFamily: familyDebian, name: "xz-utils" }),
  PackageName.make(term(PMID, "pkg-arch-xz"), { forProgram: progXz, forFamily: familyArch, name: "xz" }),
  PackageName.make(term(PMID, "pkg-debian-unzip"), { forProgram: progUnzip, forFamily: familyDebian, name: "unzip" }),
  PackageName.make(term(PMID, "pkg-arch-unzip"), { forProgram: progUnzip, forFamily: familyArch, name: "unzip" }),
  PackageName.make(term(PMID, "pkg-debian-cc"), { forProgram: progCc, forFamily: familyDebian, name: "build-essential" }),
  PackageName.make(term(PMID, "pkg-arch-cc"), { forProgram: progCc, forFamily: familyArch, name: "gcc" }),
  PackageName.make(term(PMID, "pkg-debian-coreutils"), { forProgram: progCoreutils, forFamily: familyDebian, name: "coreutils" }),
  PackageName.make(term(PMID, "pkg-arch-coreutils"), { forProgram: progCoreutils, forFamily: familyArch, name: "coreutils" }),
  PackageName.make(term(PMID, "pkg-debian-sed"), { forProgram: progSed, forFamily: familyDebian, name: "sed" }),
  PackageName.make(term(PMID, "pkg-arch-sed"), { forProgram: progSed, forFamily: familyArch, name: "sed" }),
  PackageName.make(term(PMID, "pkg-debian-findutils"), { forProgram: progFindutils, forFamily: familyDebian, name: "findutils" }),
  PackageName.make(term(PMID, "pkg-arch-findutils"), { forProgram: progFindutils, forFamily: familyArch, name: "findutils" }),
  PackageName.make(term(PMID, "pkg-debian-diffutils"), { forProgram: progDiffutils, forFamily: familyDebian, name: "diffutils" }),
  PackageName.make(term(PMID, "pkg-arch-diffutils"), { forProgram: progDiffutils, forFamily: familyArch, name: "diffutils" }),
  PackageName.make(term(PMID, "pkg-debian-patch"), { forProgram: progPatch, forFamily: familyDebian, name: "patch" }),
  PackageName.make(term(PMID, "pkg-arch-patch"), { forProgram: progPatch, forFamily: familyArch, name: "patch" }),
  PackageName.make(term(PMID, "pkg-debian-gzip"), { forProgram: progGzip, forFamily: familyDebian, name: "gzip" }),
  PackageName.make(term(PMID, "pkg-arch-gzip"), { forProgram: progGzip, forFamily: familyArch, name: "gzip" }),
  PackageName.make(term(PMID, "pkg-debian-zip"), { forProgram: progZip, forFamily: familyDebian, name: "zip" }),
  PackageName.make(term(PMID, "pkg-arch-zip"), { forProgram: progZip, forFamily: familyArch, name: "zip" }),
  PackageName.make(term(PMID, "pkg-debian-bzip2"), { forProgram: progBzip2, forFamily: familyDebian, name: "bzip2" }),
  PackageName.make(term(PMID, "pkg-arch-bzip2"), { forProgram: progBzip2, forFamily: familyArch, name: "bzip2" }),
  PackageName.make(term(PMID, "pkg-debian-file"), { forProgram: progFile, forFamily: familyDebian, name: "file" }),
  PackageName.make(term(PMID, "pkg-arch-file"), { forProgram: progFile, forFamily: familyArch, name: "file" }),
  PackageName.make(term(PMID, "pkg-debian-less"), { forProgram: progLess, forFamily: familyDebian, name: "less" }),
  PackageName.make(term(PMID, "pkg-arch-less"), { forProgram: progLess, forFamily: familyArch, name: "less" }),
  PackageName.make(term(PMID, "pkg-debian-debianutils"), { forProgram: progDebianutils, forFamily: familyDebian, name: "debianutils" }),
  PackageName.make(term(PMID, "pkg-debian-procps"), { forProgram: progProcps, forFamily: familyDebian, name: "procps" }),
  PackageName.make(term(PMID, "pkg-arch-procps"), { forProgram: progProcps, forFamily: familyArch, name: "procps-ng" }),
  PackageName.make(term(PMID, "pkg-debian-hostname"), { forProgram: progHostname, forFamily: familyDebian, name: "hostname" }),
  PackageName.make(term(PMID, "pkg-arch-hostname"), { forProgram: progHostname, forFamily: familyArch, name: "inetutils" }),
  PackageName.make(term(PMID, "pkg-debian-ncurses"), { forProgram: progNcurses, forFamily: familyDebian, name: "ncurses-bin" }),
  PackageName.make(term(PMID, "pkg-arch-ncurses"), { forProgram: progNcurses, forFamily: familyArch, name: "ncurses" }),
  PackageName.make(term(PMID, "pkg-debian-rsync"), { forProgram: progRsync, forFamily: familyDebian, name: "rsync" }),
  PackageName.make(term(PMID, "pkg-arch-rsync"), { forProgram: progRsync, forFamily: familyArch, name: "rsync" }),
  PackageName.make(term(PMID, "pkg-debian-bc"), { forProgram: progBc, forFamily: familyDebian, name: "bc" }),
  PackageName.make(term(PMID, "pkg-arch-bc"), { forProgram: progBc, forFamily: familyArch, name: "bc" }),
  PackageName.make(term(PMID, "pkg-debian-grep"), { forProgram: progGrep, forFamily: familyDebian, name: "grep" }),
  PackageName.make(term(PMID, "pkg-arch-grep"), { forProgram: progGrep, forFamily: familyArch, name: "grep" }),
  PackageName.make(term(PMID, "pkg-debian-gawk"), { forProgram: progGawk, forFamily: familyDebian, name: "gawk" }),
  PackageName.make(term(PMID, "pkg-arch-gawk"), { forProgram: progGawk, forFamily: familyArch, name: "gawk" }),
  PackageName.make(term(PMID, "pkg-debian-bash-completion"), {
    forProgram: progBashCompletion,
    forFamily: familyDebian,
    name: "bash-completion",
  }),
  PackageName.make(term(PMID, "pkg-arch-bash-completion"), {
    forProgram: progBashCompletion,
    forFamily: familyArch,
    name: "bash-completion",
  }),
  PackageName.make(term(PMID, "pkg-debian-imagemagick"), { forProgram: progImagemagick, forFamily: familyDebian, name: "imagemagick" }),
  PackageName.make(term(PMID, "pkg-arch-imagemagick"), { forProgram: progImagemagick, forFamily: familyArch, name: "imagemagick" }),
  PackageName.make(term(PMID, "pkg-debian-webp"), { forProgram: progWebp, forFamily: familyDebian, name: "webp" }),
  PackageName.make(term(PMID, "pkg-arch-webp"), { forProgram: progWebp, forFamily: familyArch, name: "libwebp" }),
  PackageName.make(term(PMID, "pkg-debian-imagemagick-codecs"), {
    forProgram: progImagemagickCodecs,
    forFamily: familyDebian,
    name: "libmagickcore-7.q16-10-extra|libmagickcore-6.q16-7-extra|libmagickcore-6.q16-6-extra",
  }),
] as const;

/** The file this module states: its name, its prefixes and its individuals. */
export const file: OntologyFile = {
  name: "programs",
  prefixes: [DCTERMS, PM, PMID, RDFS, SKOS, XSD],
  individuals: [...programs, ...packageNames],
};
