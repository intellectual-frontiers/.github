// Spec: 0001-git-layers FR-001
/**
 * The governance layer of the Git stores of AnyFS: who a commit is by, what its message says, and what a store will hold.
 *
 * @module
 */
export { type Changed, defaultSubject, type Identity, messageOf, parseIdentity, parseTrailer, type Subject, type Trailer } from "./identity.ts";
export { caseCollisions, DEFAULT_MAX_OBJECT_BYTES, gitPathProblems } from "./limits.ts";
