// Spec: 0006-anyfs-serve-nfs FR-003, FR-004, FR-009
/**
 * The facts of NFS version 3 (RFC 1813) and its mount protocol, as closed lists and one total table: the programs and procedures the server answers, the statuses it gives, the types of an object, and the table from a
 * code of the POSIX view to a status. A failure is said as a local file system would say it: `ENOENT` is `NFS3ERR_NOENT`, and the few codes whose number NFS does not take from Linux (`ENAMETOOLONG`, `ENOTEMPTY`,
 * `ESTALE`, `ENOTSUP`, `EBADF`) have the number RFC 1813 gives them.
 *
 * @example
 * ```ts
 * import { nfsStatusOfErrno } from "./nfs.ts";
 * nfsStatusOfErrno("ENOENT"); // 2
 * nfsStatusOfErrno("ESTALE"); // 70
 * ```
 *
 * @module
 */
import { ERRNO_NUMBER, type Errno } from "@intellectual-frontiers/anyfs-posix/governance";

/** The programs of ONC RPC the server answers: NFS and its mount protocol. */
export const NFS_PROGRAM = 100003;
export const MOUNT_PROGRAM = 100005;
/** The only versions: NFS 3 and MOUNT 3. */
export const NFS_VERSION = 3;
export const MOUNT_VERSION = 3;

/** The procedures of NFS version 3, by number. */
export const NFS_PROCEDURES = ["NULL", "GETATTR", "SETATTR", "LOOKUP", "ACCESS", "READLINK", "READ", "WRITE", "CREATE", "MKDIR", "SYMLINK", "MKNOD", "REMOVE", "RMDIR", "RENAME", "LINK", "READDIR", "READDIRPLUS", "FSSTAT", "FSINFO", "PATHCONF", "COMMIT"] as const;
/** One procedure of NFS. */
export type NfsProcedure = (typeof NFS_PROCEDURES)[number];

/** The procedures of the mount protocol, by number. */
export const MOUNT_PROCEDURES = ["NULL", "MNT", "DUMP", "UMNT", "UMNTALL", "EXPORT"] as const;
/** One procedure of the mount protocol. */
export type MountProcedure = (typeof MOUNT_PROCEDURES)[number];

/** The statuses of RFC 1813 the server gives. */
export const NFS_STATUS = {
  OK: 0,
  PERM: 1,
  NOENT: 2,
  IO: 5,
  ACCES: 13,
  EXIST: 17,
  XDEV: 18,
  NOTDIR: 20,
  ISDIR: 21,
  INVAL: 22,
  FBIG: 27,
  ROFS: 30,
  NAMETOOLONG: 63,
  NOTEMPTY: 66,
  STALE: 70,
  BADHANDLE: 10001,
  BAD_COOKIE: 10003,
  NOTSUPP: 10004,
  TOOSMALL: 10005,
  SERVERFAULT: 10006,
  BADTYPE: 10007,
} as const;
/** The name of a status. */
export type NfsStatusName = keyof typeof NFS_STATUS;
/** The number of a status. */
export type NfsStatus = (typeof NFS_STATUS)[NfsStatusName];

/** The statuses of the mount protocol the server gives. */
export const MOUNT_STATUS = { OK: 0, NOENT: 2, ACCES: 13, INVAL: 22 } as const;

/** The types of an object in NFS (`ftype3`): the store has files and directories only. */
export const FTYPE = { file: 1, dir: 2 } as const;

/** Where the number of a code differs between Linux and NFS version 3. */
const DIFFERS: Readonly<Partial<Record<Errno, NfsStatus>>> = {
  ENAMETOOLONG: NFS_STATUS.NAMETOOLONG,
  ENOTEMPTY: NFS_STATUS.NOTEMPTY,
  ESTALE: NFS_STATUS.STALE,
  ENOTSUP: NFS_STATUS.NOTSUPP,
  EBADF: NFS_STATUS.BADHANDLE,
};

/** The codes whose status is not the number of Linux. */
export const ERRNOS_DIFFER: readonly Errno[] = Object.keys(DIFFERS) as Errno[];

const ALL: ReadonlySet<number> = new Set(Object.values(NFS_STATUS));

/** The status of a code of the POSIX view: the number of Linux where NFS takes it, else the number of RFC 1813. Total: a registry the compiler holds with one entry for each code. */
export function nfsStatusOfErrno(errno: Errno): NfsStatus {
  const own = DIFFERS[errno];
  if (own !== undefined) return own;
  const n = ERRNO_NUMBER[errno];
  return ALL.has(n) ? (n as NfsStatus) : NFS_STATUS.IO;
}

/** Whether a number is a status of RFC 1813 the server gives. */
export function isNfsStatus(n: number): n is NfsStatus {
  return ALL.has(n);
}

/** What the server tells a client it can do (`FSINFO`): the sizes of a transfer. */
export const TRANSFER = { rtmax: 1048576, rtpref: 262144, rtmult: 4096, wtmax: 1048576, wtpref: 262144, wtmult: 4096, dtpref: 32768 } as const;

/** The bits of `ACCESS`. */
export const ACCESS = { READ: 1, LOOKUP: 2, MODIFY: 4, EXTEND: 8, DELETE: 16, EXECUTE: 32 } as const;

/** How stable a write is asked to be (`stable_how`). */
export const STABLE = { UNSTABLE: 0, DATA_SYNC: 1, FILE_SYNC: 2 } as const;
