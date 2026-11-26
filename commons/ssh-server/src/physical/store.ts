// Spec: 0003-server-policy FR-010
/**
 * The store port of the server and its two implementations: in memory, and in one JSON file (written atomically, mode 600, because it holds the secrets of tokens). The port is small on purpose: the controller may implement it on its own database.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditEvent, EnrollmentSession, KnownAsset, PairingRecord, TokenRecord } from "@intellectual-frontiers/ssh-server/governance";
import { checkPairing, checkToken, tokenId } from "@intellectual-frontiers/ssh-server/logical";

/** The store the server keeps its state in. Every method may be asynchronous; `takeToken` and `takePairing` are atomic: a code or token is given once. */
export interface EnrollStore {
  getSession(id: string): Promise<EnrollmentSession | undefined>;
  putSession(session: EnrollmentSession): Promise<void>;
  listSessions(): Promise<readonly EnrollmentSession[]>;
  assets(): Promise<readonly KnownAsset[]>;
  putAsset(asset: KnownAsset): Promise<void>;
  /** Record that a device asked to be removed: a person confirms. */
  requestRemoval(assetId: string): Promise<void>;
  removalRequests(): Promise<readonly string[]>;
  putToken(token: TokenRecord): Promise<void>;
  /** The record of a presented token, marked used, where it is valid at `now`. */
  takeToken(presented: string, now: number): Promise<TokenRecord | undefined>;
  putPairing(pairing: PairingRecord): Promise<void>;
  takePairing(code: string, now: number): Promise<PairingRecord | undefined>;
  /** Record a nonce of a device and say whether it was new: a nonce is never used twice. */
  takeNonce(nonce: string): Promise<boolean>;
  appendAudit(event: AuditEvent): Promise<void>;
  audit(): Promise<readonly AuditEvent[]>;
}

/** What a store holds, as data (and as the JSON file). */
export type StoreState = {
  sessions: Record<string, EnrollmentSession>;
  assets: Record<string, KnownAsset>;
  removals: string[];
  tokens: Record<string, TokenRecord>;
  pairings: Record<string, PairingRecord>;
  audit: AuditEvent[];
  nonces: string[];
};

/** The most audit events a store keeps in memory (the file keeps the same). */
const AUDIT_KEEP = 10_000;

/** An empty state. */
export function emptyState(): StoreState {
  return { sessions: {}, assets: {}, removals: [], tokens: {}, pairings: {}, audit: [], nonces: [] };
}

/** A store over a state, calling `changed` after each change (so that a file store can write). */
export function stateStore(state: StoreState, changed: () => Promise<void> = async () => {}): EnrollStore {
  return {
    getSession: async (id) => state.sessions[id],
    putSession: async (s) => {
      state.sessions[s.id] = s;
      await changed();
    },
    listSessions: async () => Object.values(state.sessions),
    assets: async () => Object.values(state.assets),
    putAsset: async (a) => {
      state.assets[a.id] = a;
      await changed();
    },
    requestRemoval: async (id) => {
      if (!state.removals.includes(id)) state.removals.push(id);
      await changed();
    },
    removalRequests: async () => [...state.removals],
    putToken: async (t) => {
      state.tokens[t.id] = t;
      await changed();
    },
    takeToken: async (presented, now) => {
      const id = tokenId(presented);
      const rec = id === undefined ? undefined : state.tokens[id];
      const r = checkToken(rec, presented, now, (t) => createHash("sha256").update(t).digest("hex"));
      if (r.kind === "err") return undefined;
      const used = { ...r.value, used: true };
      state.tokens[used.id] = used;
      await changed();
      return used;
    },
    putPairing: async (p) => {
      state.pairings[p.code] = p;
      await changed();
    },
    takePairing: async (code, now) => {
      const r = checkPairing(state.pairings[code], code, now);
      if (r.kind === "err") return undefined;
      const used = { ...r.value, used: true };
      state.pairings[code] = used;
      await changed();
      return used;
    },
    takeNonce: async (nonce) => {
      if (state.nonces.includes(nonce)) return false;
      state.nonces.push(nonce);
      if (state.nonces.length > 100_000) state.nonces.splice(0, state.nonces.length - 100_000);
      await changed();
      return true;
    },
    appendAudit: async (e) => {
      state.audit.push(e);
      if (state.audit.length > AUDIT_KEEP) state.audit.splice(0, state.audit.length - AUDIT_KEEP);
      await changed();
    },
    audit: async () => [...state.audit],
  };
}

/** The store in memory. */
export function memoryStore(): EnrollStore {
  return stateStore(emptyState());
}

/** The store in one JSON file: read at the start if it exists, rewritten after each change through a temporary file and a rename, with mode 600. Writes are queued, so concurrent changes never interleave. */
export async function fileStore(path: string): Promise<EnrollStore> {
  let state = emptyState();
  try {
    const text = await readFile(path, "utf8");
    state = { ...emptyState(), ...(JSON.parse(text) as Partial<StoreState>) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await mkdir(dirname(path), { recursive: true });
  let queue: Promise<void> = Promise.resolve();
  const changed = (): Promise<void> => {
    queue = queue.then(async () => {
      const temp = `${path}.tmp`;
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, path);
      await chmod(path, 0o600).catch(() => {});
    });
    return queue;
  };
  return stateStore(state, changed);
}
