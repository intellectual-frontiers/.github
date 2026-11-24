// Spec: 0001-anyfs-githost-layers FR-001
/**
 * The governance layer of the Git host stores of AnyFS: who a commit is by and what its message says, the limits of a store and the names Git treats specially, and where a token comes from. Pure.
 *
 * @module
 */
export { type Changed, defaultSubject, type Identity, messageOf, parseIdentity, parseTrailer, type Subject, type Trailer } from "./identity.ts";
export { caseCollisions, DEFAULT_MAX_OBJECT_BYTES, gitPathProblems } from "./limits.ts";
export { anonymous, cachedToken, environmentToken, providedToken, redactor, resolveToken, staticToken, type TokenSource, usable } from "./token.ts";
