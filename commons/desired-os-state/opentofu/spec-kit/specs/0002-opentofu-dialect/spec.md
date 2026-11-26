# Feature Specification: OpenTofu dialect

**Spec ID:** 0002-opentofu-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect of Desired OS State (commons desired-os-state 0004-desired-os-state-dialects) for cloud resources with OpenTofu: it renders an order of `cloud-resource` requirements to a JSON configuration and says which steps init, plan and apply the saved plan; it runs nothing. What makes it fit for a pipeline: pinned providers, no credential and no secret in anything it renders, the state kept outside the repository, no argument that runs code, and a plan that is checked against the order before it is applied.

## Requirements

- **FR-001**: The dialect MUST declare as data that it carries the kind `cloud-resource`, reaches subjects of the class `cloud-account`, has a faithful plan (a saved plan is what apply does), has an idempotence that is unproven and destroys; and it MUST name the tool (`opentofu`) and the version it pins.
- **FR-002**: The dialect MUST refuse its options, with every reason, where a provider's version is not exact (a range is not a pin), a provider's source is not `namespace/name`, a provider setting is named like a credential or holds what looks like a secret, the state folder is not absolute, holds `..` or is inside the folder the render is committed in, or a backend is the local one (which the state folder is) or has a setting named like a credential or holding a secret.
- **FR-003**: The render MUST refuse an order, with every reason, where a requirement is of a kind that is not carried, its `desired` is not `{ provider, type, name, settings }`, its provider is not one the options pin, its type does not begin with the provider's name and an underscore, its name is not lower case words, its settings are not an object, or two requirements state one resource.
- **FR-004**: The render MUST refuse a requirement whose `desired` holds what looks like a secret or a reference to a secret, a setting named like a credential, and a setting that runs code or is the dialect's own (`provisioner`, `connection`, `depends_on`, `provider`, `count`, `for_each`, `lifecycle`).
- **FR-005**: The render MUST be one file, `opentofu/main.tf.json`, in OpenTofu's JSON syntax, saying that it is generated, the same text and digest for the same order and options, with the required version and every used provider at an exact version, the provider's settings, the backend (the local state in the state folder, or the remote one named), each resource with its settings and `depends_on` taken from the requirements' dependencies, and nothing for a requirement that says its resource is absent.
- **FR-006**: The steps MUST be none where nothing changes, and otherwise two: initialize (which also is its own check, because it changes no cloud resource), and plan to a saved plan with the detailed exit code 2 for a change as the check and apply of that saved plan, and nothing else, as the apply; every argument vector MUST be a list that names the digest of the render, keep the provider data and the saved plan in the state folder, and never go through a shell.
- **FR-007**: A saved plan, read as the JSON of `tofu show -json`, MUST give the resources it changes (the no-ops and the reads are not changes) with their actions, a digest of those addresses and actions and none of the values (a plan holds the secrets of what it makes), which is the hash an approval names; and `checkPlan` MUST name, for an order, each resource the plan would destroy or replace that no requirement asks to destroy, each change to a resource in the state that no requirement states, and each resource a requirement says is absent that the plan would not remove.

## Acceptance scenarios

1. **Given** an order of a bucket and a policy that depends on it, **When** it is rendered, **Then** the configuration names the pinned provider and the policy depends on the bucket, per FR-005.
2. **Given** a setting that holds a secret, **When** it is rendered, **Then** it is refused, per FR-004.
3. **Given** a plan that would replace a bucket the order did not ask to destroy, **When** it is checked, **Then** the replacement is named, per FR-007.

## Out of scope

- Running OpenTofu, installing it and fetching providers: the program that runs the steps, with the owner's approval.
- The lock file with the providers' hashes (`tofu providers lock`): the owner commits it.
- Sensitive settings of a resource: a secret is never in a render, and these are not carried yet.

## Edge cases

- A resource removed from the order and still in the state is a change to a resource no requirement states, and is named, per FR-007.

## Assumptions

- The provider reads its credentials from the environment of the run, as each cloud's own tooling does.
- The render has not been run against the real tool here: OpenTofu is not installed, and installing it needs the owner's approval.

## Open questions

- None.

## Key entities

- **Provider pin**, **Resource**, **Saved plan**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
