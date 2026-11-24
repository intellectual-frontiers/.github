// Spec: 0001-anyfs-ssh-layers FR-001
/**
 * The SSH backend of AnyFS: a store over a folder on a host reached through an executor of Headless, and the helper it runs there.
 *
 * @module
 */
export { helperOf, type Helper, type HostDialect, POSIX } from "./dialect.ts";
export { callOf, type Command, type Facts, type HostFacts, type Reply, type Transport, type Written } from "./protocol.ts";
export { type Opened, openSshStore, SSH_CAPABILITIES, type SshHost, type SshOptions, type SshStore } from "./store.ts";
