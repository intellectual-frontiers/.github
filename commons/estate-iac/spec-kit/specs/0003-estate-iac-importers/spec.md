# Feature Specification: Estate Iac: the importers

**Spec ID:** 0003-estate-iac-importers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Reading OpenTofu and Terraform (`show -json`), CloudFormation, Kubernetes, Compose and Pulumi files into assets and links of the estate. The importers read text and run no tool.

## Requirements

- **FR-001**: The OpenTofu and Terraform importer MUST read the JSON of `show -json` of a state or of a plan, give an asset for each managed resource (a data source is not one), and say a text that is not that JSON as a problem with no asset. A resource MUST be a cloud resource with its provider (`aws`, `azure`, `cloudflare`, `gcp` or `other`), its partition (a region that begins `us-gov-` is `aws-us-gov`, an Azure location that begins `usgov` or `usdod` is `azure-government`), its type, its region or location and its identifier where the state has one; a record of the name system MUST be a domain, a load balancer listener an endpoint and a certificate of the cloud a certificate.
- **FR-002**: The OpenTofu and Terraform importer MUST NOT copy the `values` of a resource beyond the attributes of FR-001, because a state holds secrets; and MUST make a link for each reference to another resource in a plan's expressions and for each `depends_on`, and none for a variable, a local, a module output or a data source.
- **FR-003**: The CloudFormation importer MUST read a template as JSON or as YAML without short-form tags, give a cloud resource of the provider `aws` for each resource with its type, make links of `DependsOn`, `Ref` and `Fn::GetAtt`, and, for a YAML it cannot read because of tags, say so with the way to JSON; it MUST NOT copy properties.
- **FR-004**: The Kubernetes importer MUST read documents separated by `---`; give an application for each Deployment, StatefulSet, DaemonSet, Job and CronJob with the image of its first container, an endpoint for each port of a Service (open to the internet for a LoadBalancer, to partners for a NodePort, internal otherwise) and one for each host of an Ingress (https where it has a TLS section); link the applications a Service's selector picks to its endpoints (`exposes`) and an Ingress's endpoints to the services it routes to (`depends-on`); and MUST NOT read a Secret.
- **FR-005**: The Compose importer MUST give an application for each service with its image, an endpoint for each published port (internal where published on the loopback, open to the internet otherwise) exposed by the service, and a dependency for each `depends_on`; it MUST NOT read environment values.
- **FR-006**: The Pulumi importer MUST read a stack export, give a cloud resource for each resource except the stack and the providers, with the provider and type from its type token and its identifier, make links of the `dependencies` and the `parent`, and MUST NOT copy inputs or outputs.
- **FR-007**: The importer of a file MUST be chosen by what is in it: a JSON with `values` or `planned_values` is OpenTofu or Terraform (the caller says which, Terraform by default), one with `Resources` is CloudFormation, one with `deployment.resources` is Pulumi, a YAML with `services` is Compose, one with `Resources` or `AWSTemplateFormatVersion` is CloudFormation and one with `apiVersion` and `kind` is Kubernetes; a file none of them reads MUST be a problem and no asset.
- **FR-008**: Reading paths MUST read a file given as a file (a problem where no importer reads it) and walk a folder, skipping without a word a JSON or YAML file in it that no importer reads and the folders of tools (`node_modules`, `.git`, `.terraform`); and where two files give one identity, keep the first and say so.

## Acceptance scenarios

1. **Given** a state with an instance in `us-gov-west-1`, **When** it is read, **Then** the asset is a cloud resource of the partition `aws-us-gov`, per FR-001.
2. **Given** a Service whose selector picks a Deployment, **When** the manifests are read, **Then** the Deployment exposes the Service's endpoint, per FR-004.
3. **Given** a state whose resource holds a password in its values, **When** it is read, **Then** the password is nowhere in the result, per FR-002.

## Out of scope

- Running OpenTofu, Terraform, Pulumi or `kubectl` to make the files: the owner makes them.
- HCL: the JSON of `show -json` is read, never the source.
- Helm charts and Kustomize overlays: the rendered manifests are read.

## Edge cases

- A state with child modules is read for every module, per FR-001.

## Assumptions

- `show -json` of a plan from OpenTofu and one from Terraform have the same shape.

## Open questions

- None.

## Key entities

- **Importer**, **Provenance**.

## Success criteria

- **SC-001**: The tests of the library pass, with every imported asset accepted by the estate.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
