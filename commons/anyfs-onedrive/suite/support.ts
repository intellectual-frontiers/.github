/**
 * What the tests of the store share: a store opened on the fake Graph, and the helpers that make paths and bytes.
 *
 * @module
 */
import { parsePath, parsePlace, type Path } from "@intellectual-frontiers/anyfs/governance";
import { assert } from "@intellectual-frontiers/test";
import { openOneDriveStore, staticToken, type OneDriveOptions, type OneDrivePlace, type OneDriveStore } from "../src/mod.ts";
import { ENDPOINT, type FakeGraph } from "./fake-graph.ts";

export const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
export const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);
export const text = (b: Uint8Array): string => new TextDecoder().decode(b);

export const placeOf = (url: string): OneDrivePlace => {
  const r = parsePlace(url);
  if (r.kind !== "ok" || r.value.kind !== "onedrive") throw new Error(`not a place of OneDrive: ${url}`);
  return r.value;
};

let counter = 0;
/** A store in a folder of its own on the fake. */
export async function open(fake: FakeGraph, options: Partial<OneDriveOptions> = {}, folder = `run${counter++}`, token = "good-token"): Promise<OneDriveStore> {
  const opened = await openOneDriveStore({ place: placeOf(`onedrive://me/${folder}`), token: staticToken(token), endpoint: ENDPOINT, transport: fake.transport, ...options });
  assert(opened.kind === "ok", opened.kind === "err" ? opened.error : "");
  return opened.value;
}
