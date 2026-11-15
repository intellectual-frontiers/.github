// The packaging table of commons (commons 0002-packaging), read as typed code: the families, the package each calls a program, the commands as lists of
// words, the platforms and the pins. Nothing here is a second copy of a fact the table holds (commons 0001-software-supply-chain FR-003).
import { families, pins, platforms, programs, recordFields } from "../../commons/generated/packaging.auto.ts";

export type FamilyId = keyof typeof families;
export type Family = (typeof families)[FamilyId];
export type ProgramName = keyof typeof programs;
export type PlatformName = keyof typeof platforms;
export type PinName = keyof typeof pins;
export type Tier = "required" | "comfort";
/** The families a script acts on: supported, and the table says how to install packages on them (or that none is installed, a Mac). */
export type ActingFamily = "debian" | "arch" | "macos";

const isFamily = (s: string): s is FamilyId => Object.hasOwn(families, s);
const isProgram = (s: string): s is ProgramName => Object.hasOwn(programs, s);

export function family(id: FamilyId): Family {
  return families[id];
}

/** The family the words of os-release's ID and ID_LIKE name: the first word that detects one. */
export function familyOf(words: readonly string[]): FamilyId | null {
  for (const w of words) {
    for (const id of Object.keys(families)) {
      if (isFamily(id) && (families[id].detect as readonly string[]).includes(w)) return id;
    }
  }
  return null;
}

/** The family `uname -s` names on a platform without os-release (Darwin is macos). */
export function familyOfUname(name: string): FamilyId | null {
  for (const id of Object.keys(families)) {
    if (isFamily(id) && families[id].uname !== "" && families[id].uname === name) return id;
  }
  return null;
}

/** A family this setup acts on, or null: the others are named, with their manager, and refused. */
export function acting(id: FamilyId | null): ActingFamily | null {
  if (id === null || families[id].status !== "supported") return null;
  return id === "debian" || id === "arch" || id === "macos" ? id : null;
}

/** What the family calls the package of a program, or the program's own name where the table has none. */
export function packageOf(fam: FamilyId, program: string): string {
  if (!isProgram(program)) return program;
  const names: Readonly<Partial<Record<FamilyId, string>>> = programs[program].names;
  return names[fam] ?? program;
}

/** The programs of a tier, in the table's order. */
export function programsOf(tier: Tier): ProgramName[] {
  return (Object.keys(programs) as string[]).filter(isProgram).filter((p) => programs[p].tier === tier);
}

/** The one command a person with administrator rights runs to install these packages on this family (erga 009-machine-bootstrap FR-016). */
export function adminInstall(fam: FamilyId, packages: readonly string[]): string {
  const t: string = families[fam].adminInstall;
  return `sudo ${t.replace(/\{packages?\}.*$/, "")}${packages.join(" ")}`;
}

/** The same, for programs, by the family's names. */
export function adminInstallPrograms(fam: FamilyId, progs: readonly string[]): string {
  return adminInstall(fam, progs.map((p) => packageOf(fam, p)));
}

/** A pin's version and its SHA-256 on a platform (commons 0002-packaging FR-014). */
export function pin(name: PinName): { readonly version: string; readonly sha256: Readonly<Partial<Record<PlatformName, string>>> } {
  return pins[name];
}

export const recordFieldNames: readonly string[] = recordFields.map((f) => f.name);
export const recordValues = (name: string): readonly string[] => {
  const f = recordFields.find((x) => x.name === name);
  return f !== undefined && "values" in f ? f.values : [];
};

export { families, pins, platforms, programs };
