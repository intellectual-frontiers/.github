// Spec: 0002-workspace-model FR-005
/**
 * The kernel's `test-record`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { testRecord } from "@intellectual-frontiers/commons/ts/kernel";
/** `testRecord.TEST_SCOPE`. */
export const TEST_SCOPE = testRecord.TEST_SCOPE;
/** `testRecord.installationFromEnv`. */
export const installationFromEnv = testRecord.installationFromEnv;
/** `testRecord.installationResource`. */
export const installationResource = testRecord.installationResource;
/** `testRecord.testCaseLog`. */
export const testCaseLog = testRecord.testCaseLog;
/** `testRecord.testCaseSpan`. */
export const testCaseSpan = testRecord.testCaseSpan;
/** `testRecord.testId`. */
export const testId = testRecord.testId;
/** `testRecord.Installation`. */
export type Installation = testRecord.Installation;
/** `testRecord.Outcome`. */
export type Outcome = testRecord.Outcome;
/** `testRecord.Risk`. */
export type Risk = testRecord.Risk;
/** `testRecord.TestCase`. */
export type TestCase = testRecord.TestCase;
