// Spec: 0001-layers FR-009; 0002-engine FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * The engine's public surface (`@intellectual-frontiers/data/engine`): the extension host every layer and every extension stands on. A layer declares its contribution
 * points (`point`) and its handles (`handle`); an extension is a manifest (`defineExtension`, `lazyExtension`) made of contributions (`contribute`); a project lists its
 * extensions and gives them to `compose`, which orders them, finds every mistake as a value, and gives back a composition to read contributions from, start and fire.
 *
 * @module
 */
export { type ActivationError, type ComposeError, type ComposeOptions, type Composition, compose } from "./compose.ts";
export { type Context, type Handle, handle, type HandleError, type Provided, provide } from "./handle.ts";
export { type ExtensionId, extensionId, type IdError } from "./id.ts";
export {
  type Activate,
  CONTRACT,
  type Contribution,
  contribute,
  defineExtension,
  type Entry,
  type EventName,
  type Extension,
  type ExtensionInput,
  type LazyExtension,
  type LazyInput,
  lazyExtension,
} from "./manifest.ts";
export { type ContributionPoint, point, type PointName } from "./point.ts";
