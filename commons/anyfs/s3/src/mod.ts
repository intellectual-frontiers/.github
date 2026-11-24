// Spec: 0002-anyfs-s3-store FR-001
/**
 * The S3 backend of AnyFS: `openS3Store` makes a store over a bucket and a prefix of any S3-compatible service, whose capabilities are what the service was found to keep, signed by Signature Version 4 and sent by a
 * transport that a test can stand in for. The bucket name, the keys, the XML of S3, the table of its errors and the sources of its keys are here too, each by its own export.
 *
 * @module
 */
export { type BucketName, parseBucketName } from "./bucket.ts";
export { type Addressing, awsEndpoint, type CallError, type Endpoint, failureOf, makeClient, parseEndpoint, type PayloadSigning, type S3Client } from "./client.ts";
export { cachedCredentials, type CredentialSource, environmentCredentials, promptedCredentials, providedCredentials, resolveCredentials, staticCredentials } from "./credentials.ts";
export { describeFailure, type Failure, FAILURE_KINDS, type FailureKind, kindOf, problemOf, type Subject } from "./errors.ts";
export { basePrefix, decodeListedKey, describeFinding, encodeKey, isOwn, keyOf, type KeyFinding, OWN, pathOfKey } from "./keys.ts";
export { casOf, createBucket, describeCallError, type Facts, probeEndpoint } from "./probe.ts";
export {
  CAS_CAPABILITIES,
  openS3Store,
  type Opened,
  PLAIN_CAPABILITIES,
  READ_CAPABILITIES,
  type RevisionMode,
  type S3CasStore,
  type S3Facts,
  type S3Options,
  type S3Place,
  type S3PlainStore,
  type S3ReadStore,
} from "./store.ts";
export { fetchTransport, type HttpMethod, type HttpRequest, type HttpResponse, type SendOptions, type Transport } from "./transport.ts";
export { DEFAULT_LIMITS, type ErrorBody, type ListPage, type Listed, parseErrorBody, parseListing, parseXml, type XmlLimits, type XmlNode } from "./xml.ts";
