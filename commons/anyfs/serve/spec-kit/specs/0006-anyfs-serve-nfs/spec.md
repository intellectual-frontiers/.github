# Feature Specification: NFS loopback

**Spec ID:** 0006-anyfs-serve-nfs
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Any AnyFS store served as NFS version 3 over TCP on the loopback (RFC 1813, with the mount protocol on the same port and ONC RPC of RFC 5531, record marking over TCP), built on the POSIX view of `anyfs-posix`: its table of codes gives the status of a failure, its path policy gives the names, and every operation says how it was carried out.

## Requirements

- **FR-001**: The XDR codec (RFC 4506) MUST be strict: it reads and writes the unsigned 32 and 64-bit integers, booleans, opaque data and strings padded to four bytes, MUST refuse a read past the end, a length that does not fit what is left, a padding that is not zero, a boolean that is not 0 or 1 and a string that is not well-formed UTF-8, and what it writes MUST read back as the same values.
- **FR-002**: The ONC RPC layer MUST read a call (version 2) from records of TCP (fragments joined, a record longer than the limit refused), MUST answer a program it does not serve with `PROG_UNAVAIL`, a version it does not serve with `PROG_MISMATCH` and the versions it serves, a procedure it does not have with `PROC_UNAVAIL`, arguments that do not decode with `GARBAGE_ARGS`, and an RPC version other than 2 with `RPC_MISMATCH`; the reply MUST carry the xid of the call.
- **FR-003**: The status of a failure MUST be given by a total table from the codes of the POSIX view (`Errno`) to the statuses of NFS version 3, which takes the number of `ERRNO_NUMBER` where NFS uses the number of Linux and the number of NFS where it differs (`ENAMETOOLONG`, `ENOTEMPTY`, `ESTALE`, `ENOTSUP`, `EBADF`), and MUST NOT give a status that is not one of RFC 1813.
- **FR-004**: The mount protocol (version 3) MUST answer `MNT` of the export path with a file handle of the root and the flavors `AUTH_SYS` and `AUTH_NONE`, `MNT` of any other path with `MNT3ERR_NOENT`, `EXPORT` with the one export and `DUMP`, `UMNT` and `UMNTALL` with what they say, on the same port as the NFS procedures.
- **FR-005**: A file handle MUST be opaque, at most 64 bytes, and made of the boot identity of the server and a number the server gives a path: the same path MUST give the same handle while the server runs, a handle of another boot, one never given, one of a path that was removed and one that was dropped from the bounded table MUST be `NFS3ERR_STALE`, and a rename MUST keep the handle of what was renamed, and of what is below it.
- **FR-006**: `GETATTR`, `LOOKUP`, `ACCESS`, `READ`, `READDIR`, `READDIRPLUS`, `FSSTAT`, `FSINFO` and `PATHCONF` MUST answer from the view: the type, the size, the mode and the owner of a stat, the time of the store where it keeps one (and where it keeps none, a time that changes whenever its revision does, so that a client's cache is not kept past a change), directories in a stable order with a cookie that resumes a listing, and `..` as the parent of a directory and never above the root. A name that is not NFC, holds `/`, a control character or a NUL, or is empty MUST be `NFS3ERR_INVAL`.
- **FR-007**: `WRITE` MUST be held in a buffer of the object that the server flushes as one whole object write at `COMMIT`, at a write that asks for stable storage, after the buffer has been idle, before a rename of the object and when the server closes; a client's reads and attributes of an object with a buffer MUST see the buffer; the write verifier MUST be the boot identity, so that a client that sees it change sends its writes again; an object larger than the limit MUST be `NFS3ERR_FBIG`; and a flush that fails MUST keep the buffer and answer `COMMIT` with the failure.
- **FR-008**: `CREATE` (unchecked, guarded and exclusive with its verifier, which a repeated request with the same verifier meets with the same result), `MKDIR`, `REMOVE`, `RMDIR`, `RENAME` and a `SETATTR` of the size MUST be done through the view; a name that is there for a guarded create MUST be `NFS3ERR_EXIST` (a client that overwrites with a guarded create, as the `nfs_creat` of libnfs 5.0.2 does, is refused, as RFC 1813 section 3.3.8 says), an unchecked create of a name that is there MUST be accepted and MUST truncate the file where its attributes set the size to 0 and leave it alone where they do not (the open with truncation of a kernel client), a directory that is not empty `NFS3ERR_NOTEMPTY`, a file where a directory was asked `NFS3ERR_NOTDIR` and the reverse `NFS3ERR_ISDIR`.
- **FR-009**: What the store cannot keep MUST be refused and never pretended: `SYMLINK`, `LINK` and `MKNOD` MUST be `NFS3ERR_NOTSUPP` (`NFS3ERR_BADTYPE` for a node that is not a file or directory), `READLINK` `NFS3ERR_INVAL`, and a `SETATTR` of a mode, owner or time that is not the one the object has MUST be refused (`NFS3ERR_NOTSUPP`) where the option `attributes` is `refuse` (the default) and accepted without effect, and counted, where it is `ignore`; the mode of a `CREATE` or `MKDIR` is not kept and MUST be said in the trace.
- **FR-010**: The server MUST listen on the loopback only, MUST serve only the callers whose `AUTH_SYS` uid is in the option `uids` where it is given (`NFS3ERR_ACCES`, `MNT3ERR_ACCES`, and no file handle, for the others), MUST bound the connections, the record size and the handles, MUST refuse every change where it is read-only (`NFS3ERR_ROFS`) and where the store cannot write, and MUST NOT log the bytes of an object.
- **FR-011**: Every operation MUST tell the option `onEvent` the procedure, the path, the status and how it was carried out (`native`, `emulated` with its reason, or `refused`), taken from the view where the view did it and `write-back-buffer` where the buffer did, and the server MUST be told to say how a client mounts it (`mount -t nfs -o vers=3,proto=tcp,port=P,mountport=P,nolock 127.0.0.1:/ DIR`).
- **FR-012**: Over the same store, a client of NFS that makes, writes, reads, lists, renames and removes files and directories MUST end with the same files as the same steps made through the view, and a model test over random sequences of such steps MUST hold it.

## Acceptance scenarios

1. **Given** a running server over a store in memory, **When** a client mounts the export, makes a directory, writes a file in two parts, commits, reads it back and lists the directory, **Then** the bytes and names are what was written and the store holds the file as one object, per FR-004, FR-007 and FR-008.
2. **Given** a caller whose uid is not allowed, **When** it asks to mount, **Then** it is refused and gets no handle, per FR-010.

## Out of scope

- A mount by the kernel of an operating system: the tests speak the protocol with a client of their own (see the header of the test); what a kernel client does that the protocol does not oblige, and its locking (the mount says `nolock`), are not covered. The portmapper (a mount names the port), NFS version 4, Kerberos, byte ranges of an object beyond the whole-object write of the store, symbolic links, hard links, and a server on an address other than the loopback.

## Edge cases

- A client that sends a record in many fragments, or many records at once, is answered once for each record in order, per FR-002.
- A write at an offset past the end of the object fills the gap with zeros, as a file system does, per FR-007.

## Assumptions

- The caller of the loopback is a program of the same computer; its uid is what it says it is, which is why the default is the uid of the person who starts the server.

## Open questions

- None.

## Key entities

- **Handle table** - the bounded map between a path and the number in its file handle.
- **Write buffer** - the content of an object being written, held until it is flushed as one object.

## Success criteria

- **SC-001**: A computer that can mount NFS mounts any store of AnyFS as a folder with one command, and what it cannot do the folder says so by the status it gives.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
