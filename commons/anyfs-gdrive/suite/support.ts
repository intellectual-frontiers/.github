/**
 * What the tests of the store share: a store opened on the fake Drive, and the helpers that make paths and bytes.
 *
 * @module
 */
import { parsePath, parsePlace, type Path } from "@intellectual-frontiers/anyfs/governance";
import { assert } from "@intellectual-frontiers/test";
import { openDriveStore, staticToken, type DriveOptions, type DrivePlace, type DriveStore } from "../src/mod.ts";
import { ENDPOINT, type FakeDrive, ROOT } from "./fake-drive.ts";

export const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
export const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
export const text = (b: Uint8Array): string => new TextDecoder().decode(b);

export const placeOf = (folder: string): DrivePlace => {
  const r = parsePlace(`gdrive://${folder}`);
  if (r.kind !== "ok" || r.value.kind !== "gdrive") throw new Error(`not a place of Drive: ${folder}`);
  return r.value;
};

/** A store on a folder of its own in the root of the fake (the folder is made), or on the folder named. */
export async function open(fake: FakeDrive, options: Partial<DriveOptions> = {}, folder?: string, token = "good-token"): Promise<{ readonly store: DriveStore; readonly folder: string }> {
  const id = folder ?? fake.folder(ROOT, `run-${Math.random().toString(36).slice(2)}`);
  const opened = await openDriveStore({ place: placeOf(id), token: staticToken(token), endpoint: ENDPOINT, transport: fake.transport, ...options });
  assert(opened.kind === "ok", opened.kind === "err" ? opened.error : "");
  return { store: opened.value, folder: id };
}
