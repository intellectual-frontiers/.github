# Definitions behind zero trust

**For:** 0047-zero-trust. **Read:** the primary sources named in each row, on 2026-11-26, by fetching the document and reading the passage. Every definition below is in our own words. Where a row says **read**, the passage was read at the source; where it says **not read**, the source could not be fetched (its host refused the download) and the row is not relied on until it is read. Nothing in a **not read** row may be written into a catalog, an ontology or a requirement as if it had been read.

## What zero trust is, in one place

**Zero trust** is a set of ideas for making every request for access to a resource a decision of its own, taken with the least privilege that the request needs, in a network that is treated as already compromised. A **zero trust architecture** is the plan that an organization makes from those ideas: the components, how they relate, the workflows and the access policies. What an organization runs as a result is a zero trust enterprise. The aim is to keep an unauthorized subject from the data and the services, and to make the enforcement as fine as can be, so that the zones that are trusted only by habit (a network location, an owned device, a credential that was given once) shrink.

Zero trust is therefore not a product, not a boundary and not a framework of controls: it is a way of deciding access, and a scale of how far an organization has gone in deciding it that way. In this repository it is carried by three things that already exist: **properties and readings** (0043-asset-properties) say what is true and how fresh the proof is, **boundaries** (0045-boundaries) say where an authority answers for assets, and **evidence** says what was decided. Zero trust adds a vocabulary, a catalog and a few typed records; it adds no layer.

## 1. The tenets and the model (NIST SP 800-207)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Definition | See above: concepts to cut the uncertainty in deciding access per request, least privilege, a network seen as compromised; the architecture is the plan, the enterprise is the result. | NIST SP 800-207, section 1. **Read.** |
| Tenet 1, resources | Every data source and computing service is a resource, including small devices that send data, software as a service, systems that send commands to actuators and, where the organization chooses, personally owned devices that reach its resources. | NIST SP 800-207, section 2.1. **Read.** |
| Tenet 2, communication | Every communication is secured wherever it comes from. Being on the organization's own network grants nothing; a request from inside meets the same requirements as one from outside; the most secure way available is used, with confidentiality, integrity and authentication of the source. | Section 2.1. **Read.** |
| Tenet 3, per session | Access to one resource is granted for one session, after the requester is evaluated, with the least privilege the task needs. A grant for one resource does not carry to another. | Section 2.1. **Read.** |
| Tenet 4, dynamic policy | Access is decided by a policy that uses the observable state of the identity (a user or a service), of the application and of the requesting asset, and may use behavior and environment (time, location, reported attacks). The policy is the set of rules over attributes; the more sensitive the resource, the stricter the rule. | Section 2.1. **Read.** |
| Tenet 5, posture | The organization monitors and measures the integrity and security posture of every asset it owns or is associated with, and no asset is trusted for what it is. A subverted, vulnerable or unmanaged asset may be treated differently, including by refusing all connections. | Section 2.1. **Read.** |
| Tenet 6, dynamic and enforced | Authentication and authorization are dynamic and strictly enforced before access: a constant cycle of obtaining access, assessing threats, adapting and reevaluating, with identity, credential and access management and asset management in place, and re-authentication on events the policy names. | Section 2.1. **Read.** |
| Tenet 7, collection | The organization collects as much as it can about the state of assets, the network and the communications, and uses it to improve the policy and its enforcement. | Section 2.1. **Read.** |
| Scope of the tenets | They are technology agnostic, ideals that a given strategy may not fully reach, and they apply to the work of an organization and its partners, not to anonymous public use. | Section 2.1. **Read.** |
| Policy decision point | The part that decides whether a subject may reach a resource. It is two logical parts: a **policy engine**, which decides (it grants, denies or revokes, using the policy and outside inputs, and logs the decision as approved or denied) and a **policy administrator**, which carries the decision out (it opens or shuts the path between the subject and the resource, and makes any session credential). | Section 3.1 and figure 2. **Read.** |
| Policy enforcement point | The part that enables, watches and ends the connections between a subject and a resource, and takes its instructions from the policy administrator; it may be one part, a client side and a resource side, or a portal. Beyond it is the zone that holds the resource. | Section 3.1. **Read.** |
| Control plane and data plane | The components talk to each other on a control plane; the application data goes on a separate data plane. | Section 3.1. **Read.** |
| Inputs to the policy engine | Eight sources: a continuous diagnostics and mitigation system (the state of assets), an industry compliance system (the rules of the regime), threat intelligence feeds, network and system activity logs, data access policies, a public key infrastructure, an identity management system and a security information and event management system. | Section 3.1. **Read.** |
| The trust algorithm | The process by which the policy engine grants or denies; its inputs are the access request (the resource and what is known about the requester and its asset), the subject database (who may do what), the asset database with the observable status of the requesting asset, and the requirements of the resource (for example the assurance of the authentication, the sensitivity of the data). | Section 3.3. **Read** for these four inputs; the rest of the section (the further inputs and the variants of the algorithm) was not read. |
| Approaches and deployment models | Three approaches (enhanced identity governance, logical micro-segmentation, network-based segmentation) and four ways to deploy (a device agent or gateway, an enclave gateway, a resource portal, a sandbox for device applications); a full solution uses elements of all three approaches. | Sections 3.1 and 3.2, from the headings and the opening text. **Read** in part. |

## 2. Zero trust for cloud-native applications (NIST SP 800-207A)

| Item | Our wording | Source and status |
| --- | --- | --- |
| The shift | The weight of the controls moves from segmentation and isolation by network parameters (addresses, subnets, perimeter) to identities: policies on the identities of applications and services as well as users, enforced wherever the service runs, on premises or in several clouds. | NIST SP 800-207A, abstract. **Read.** |
| What enforces it | A platform of API gateways, sidecar proxies and an application identity infrastructure (for example SPIFFE), with policies on identities at one tier and on the network at another, and a service mesh that deploys and enforces them. | Abstract and table of contents. **Read** in part (the body was not read). |

## 3. Example implementations (NIST SP 1800-35)

| Item | Our wording | Source and status |
| --- | --- | --- |
| What it is | A practice guide of example implementations: 19 builds, made with 24 collaborators, of a zero trust architecture across on-premises and several clouds, for a hybrid workforce and partners; not a regulation. | NIST SP 1800-35, abstract. **Read.** |
| Enhanced identity governance phases | The reference architecture is described in a crawl phase and a run phase. | Table of contents. **Read** in part. |
| Mappings | Mappings of the security capabilities of the example architecture to the NIST Cybersecurity Framework 1.1 and 2.0, to SP 800-53 Rev. 5 and to the critical software measures are published in supplemental documentation. | Section 7.2. The mappings are **not read**: they are not in the guide itself. |

## 4. The federal strategy (OMB M-22-09)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Pillars and themes | Five areas of effort (identity, devices, networks, applications and workloads, data) with three themes across them (visibility and analytics, automation and orchestration, governance), taken from the maturity model of the Cybersecurity and Infrastructure Security Agency. | OMB M-22-09. **Read.** |
| Identity goal | Staff use identities managed by the enterprise to reach the applications of their work, and phishing-resistant multifactor authentication protects them; agencies use centralized identity management, strong multifactor authentication throughout, and consider at least one device-level signal in authorizing a user. | Same, section on identity. **Read.** |
| Devices goal | A complete inventory of every device operated and authorized, and the ability to prevent, detect and respond to incidents on them; assets are inventoried through the continuous diagnostics program and endpoint detection and response tools meet the agency's requirements. | Same. **Read.** |
| Networks goal | All DNS requests and HTTP traffic in the environment are encrypted, and a plan begins to break the perimeter into isolated environments. | Same. **Read.** |
| Applications and workloads goal | Every application is treated as internet connected, is tested rigorously and welcomes external vulnerability reports. | Same. **Read.** |
| Data goal | A shared path to protections built on thorough categorization of data, cloud security services that monitor access to sensitive data, and enterprise-wide logging and information sharing. | Same. **Read.** |
| Date | The goals are to be met by the end of fiscal year 2024. | Same. **Read.** |

## 5. Not read

These are the sources this note names but could not read; the rows of the catalog that rest on them are not written until they are read at their source, and a requirement of 0047-zero-trust says so.

| Source | What rests on it | Status |
| --- | --- | --- |
| CISA Zero Trust Maturity Model, version 2.0 | The names and meanings of the maturity stages (the memorandum above cites the model and names its pillars and themes; the stage names and the per-function tables are in the model itself) | **Not read**: the host refused the download. The stage names are not written into the ontology. |
| DoD Zero Trust Strategy and the activities list (target level and advanced) | Its pillars, the activity names and the counts of activities at each level | **Not read**: the host refused the download. The counts of 91 and 152 that the owner named are **unverified**; no activity is written into any file until the list is read. |
| DoD zero trust reference architecture and overlays | The mapping of activities to controls | **Not read.** |
| NCCoE supplemental mappings to SP 800-53 Rev. 5 and CSF 2.0 | The crosswalk from controls to the pillars | **Not read**: they are not in the guide. The crosswalk is made from that source when it is read; until then a control maps to a pillar only by a person's decision recorded with a reason. |
| SP 800-207, sections 3.3 onward and section 4 onward | The variants of the trust algorithm, threats, migration | **Not read.** |

## 6. How the terms map onto what we have

| Term | In this repository |
| --- | --- |
| Resource, protect surface | The part of an estate that a decision protects: one asset, a population or a data store. A **protect surface** is the smallest boundary that a policy names (a boundary of the kind trust, 0045-boundaries FR-002), and a path into it is an interconnection that needs a decision. The word is our own; it is not read in a source of this note. |
| Policy decision point, policy enforcement point | In a product's own operations its controller decides and enforces for the acts it offers; in a customer's environment they are the products the connectors read. Commons names the roles and holds no product. |
| Access decision | A signed record of one decision: the subject, the posture signals of its device, the context, the resource, the policy by hash, the outcome, the reasons and the evidence. It is the unit of the log that tenet 6 and tenet 7 ask for. |
| Posture signal | A reading (0043-asset-properties) about a subject or a device that a decision used. |
| Implicit trust | A place where access is allowed because of where, whose or how long (a network location, an owned device, a shared or long-lived credential, a standing privilege) and not because of a decision. The negative-space lens of 0046-dossiers lists them. |

## 7. Collisions of words

| Word | Other meaning here | Choice |
| --- | --- | --- |
| trust | The enrollment trust of a machine (a product's ladder of how far a new machine was verified), the boundary kind `trust` (0045-boundaries) and the trust algorithm of SP 800-207 | The record is called an **access decision**, never a trust score; the trust algorithm is called the decision procedure of the policy engine; the enrollment trust and the boundary kind keep their names. No score is made (0047-zero-trust FR-020). |
| decision | A Decision of the owner (0018-standards-first), the decision of a person who approves a plan | An **access decision** always carries the word access; a Decision of the owner keeps its capital. |
| policy | A policy of the gate library (a rule written as code over the subjects of a change) and the access policy of SP 800-207 | The access policy is an **access policy**; the gate keeps its name. Both are code addressed by hash. |
| signal | A telemetry signal (trace, metric, log) and a posture signal | **Posture signal** always carries the word posture. |
| pillar | None in the ontology | Used as the sources use it: an area of effort. |
| activity | A PROV-O activity | **Zero trust activity** in the catalog; the class does not subclass `prov:Activity`. |
