# Vendored files

`datastar.js` is Datastar, the library that gives agora's web UIs their interactivity: the server sends HTML and
signal updates over server-sent events and Datastar patches the page (0041-command-line FR-026; 0042-agora FR-019).

| File | Version | License | Source |
| --- | --- | --- | --- |
| `datastar.js` | 1.0.4 | MIT, the Datastar project's own license | the copy `design-systems/frontiers-nature-web/js/datastar.js` carries |

The UIs load it from their own address, never from a remote host. `agora check ui` fails when the file's version is not the
one in this table. To move to another version, replace the file, change the version here, and run `agora check ui`.
