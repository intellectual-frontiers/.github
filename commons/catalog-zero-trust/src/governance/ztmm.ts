// Spec: 0002-zero-trust-package FR-003, FR-004, FR-006
/**
 * The CISA Zero Trust Maturity Model, version 2.0 (April 2023), in the words of Intellectual Frontiers (0002-zero-trust-package FR-003, FR-004, FR-006). It was read in full on 2026-11-26: section 5 for the stages (page 9 and figure 2), the introductions of the five
 * pillars (sections 5.1 to 5.5, pages 13 to 29) and their tables 2 to 6 for the functions and what each stage means in each, section 5.6 and table 7 (pages 29 to 30) for the three cross-cutting capabilities, and section 3 and the opening of section 5 (pages 5 to 7) for the
 * definition and the link to OMB M-22-09. The publication's tables are not carried: a pillar at a stage is one sentence of ours that says what the whole pillar looks like there, and a function is described by what it asks, not by its table. The model has four stages
 * (the text of page 9 speaks of three steps of a journey that starts from the traditional stage) and five pillars with three capabilities that cut across them.
 *
 * @example
 * ```ts
 * import { PILLARS, FUNCTIONS } from "./ztmm.ts";
 * PILLARS.map((p) => p.id).join(" "); // "ID DV NW AW DT"
 * FUNCTIONS.length; // 22
 * ```
 *
 * @module
 */
import type { Entry } from "./nist.ts";

type Row = readonly [id: string, title: string, statement: string];
const of = (family: string, rows: readonly Row[]): readonly Entry[] => rows.map(([id, title, statement]) => ({ id, title, statement, family }));

/** The four stages, from where an organization starts to where it aims (page 9 of the model). */
export const STAGE_IDS = ["traditional", "initial", "advanced", "optimal"] as const;
/** A stage of the maturity model. */
export type StageId = (typeof STAGE_IDS)[number];

/** The criteria of each stage in general, which the pillars follow (page 9). */
export const STAGES: readonly Entry[] = of("stage", [
  ["ALL@traditional", "Traditional", "Lifecycles and the attributes of assets (for security and for logging) are set by hand; policies are fixed and deal with one pillar at a time; least privilege is set only when something is provisioned; pillars enforce on their own; response is manual; logs and telemetry are little correlated."],
  ["ALL@initial", "Initial", "Attributes and lifecycles begin to be assigned and configured by automation, as do policy decisions and their enforcement; the first solutions cross pillars and tie in outside systems; privilege is sometimes changed after provisioning; visibility is pooled for internal systems."],
  ["ALL@advanced", "Advanced", "Where it applies, lifecycles, configurations and policies are automated and coordinated across pillars; visibility and identity control are central; enforcement is joined up across pillars; response follows predefined mitigations; privilege changes with risk and posture; awareness grows across the enterprise, outside-hosted resources included."],
  ["ALL@optimal", "Optimal", "Lifecycles and attributes are assigned just in time and fully automatically, assets and resources report on themselves, and policies change on observed triggers; privilege is just enough, within thresholds, for assets and what they depend on; pillars interoperate under continuous monitoring with central visibility and full situational awareness."],
]);

/** The five pillars: what each covers, in our words (the openings of sections 5.1 to 5.5). */
export const PILLARS: readonly Entry[] = of("pillar", [
  ["ID", "Identity", "What uniquely describes a user or an entity that is not a person, and whether each gets the right access to the right resources at the right time for the right purpose and no more, through identity, credential and access management that proves, authorizes and judges the risk of an identity."],
  ["DV", "Devices", "Any asset that can join a network, whether the organization's or a guest's, from servers to printers and network equipment, with its hardware, software and firmware, and the cloud and virtual assets that stand in for devices: kept in a live inventory with their configuration and known weaknesses, secured, and refused when unauthorized."],
  ["NW", "Networks", "The open media that carry messages (internal, wireless, the internet, cellular and application channels), where zero trust moves the controls from the perimeter to the flows: isolating hosts, enforcing encryption, segmenting activity and seeing traffic, with each application treated by its own profile."],
  ["AW", "Applications and workloads", "The systems, programs and services that run on premises, on mobile devices and in clouds, managed and delivered securely with fine access control and threat protection, and treated as if reachable from outside, so that the weight of assurance moves from the accreditation boundary to the application itself."],
  ["DT", "Data", "All structured and unstructured files and fragments that live or lived in systems, devices, networks, applications, databases, infrastructure and backups, with their metadata: inventoried, categorized and labeled, protected at rest and in transit, watched for exfiltration and governed over their life."],
]);

/** The three capabilities that cut across the pillars, which each pillar reads for itself too (section 5.6, page 11). */
export const THEMES: readonly Entry[] = of("theme", [
  ["VA", "Visibility and analytics", "The observable artifacts that the characteristics and the events of an environment leave, analyzed to inform policy decisions and response and to build a risk profile that lets security act before an incident."],
  ["AO", "Automation and orchestration", "The use of automated tools and workflows that support security response across products and services, with oversight, security and interaction kept over how those functions, products and services are developed."],
  ["GV", "Governance", "The definition and enforcement of the policies, procedures and processes of cybersecurity within and across pillars, to manage the enterprise and reduce risk in support of zero trust and of the requirements the organization answers to."],
]);

/** The 22 functions of the five pillars, `ID.AU` to `DT.EN`: what each asks of an organization (tables 2 to 6). */
export const FUNCTIONS: readonly Entry[] = [
  ...of("ID", [
    ["ID.AU", "Authentication", "How strongly an identity proves itself and whether that is checked once at the start or throughout the session: from a password or multi-factor authentication with standing access, through phishing-resistant multi-factor authentication such as FIDO2 or PIV, to continuous validation."],
    ["ID.IS", "Identity stores", "How many places hold identities and how well they are joined: from self-run, on-premises stores only, to stores that are consolidated and securely integrated across partners and environments."],
    ["ID.RA", "Risk assessments", "How the risk that an identity is compromised is judged and used: from rare determinations, through manual methods and static rules, to analysis in real time with dynamic rules that feed access decisions."],
    ["ID.AM", "Access management", "How access is given and ended: from permanent access reviewed from time to time, through expiring grants with automatic review and then need-based, per-session access, to just-in-time and just-enough access tailored to each action and resource."],
  ]),
  ...of("DV", [
    ["DV.PC", "Policy enforcement and compliance monitoring", "How much the organization can see of a device's compliance and make it comply: from little visibility, through self-reported characteristics, to verified insight at first access and compliance enforced for the whole life of devices and virtual assets, with automated management of software, configuration and patches."],
    ["DV.AS", "Asset and supply chain risk management", "How assets are tracked and their supply chain risk managed: from ad hoc acquisition with no enterprise view, to a near-real-time view across vendors and providers and supply chain risk handled with automation and tolerance for failures."],
    ["DV.RA", "Resource access", "Whether access to a resource takes the requesting device into account: from no requirement to see the device, through devices that report characteristics, to decisions that use verified insight and real-time risk analytics from the device."],
    ["DV.TP", "Device threat protection", "How threat protection is deployed to devices and virtual assets: from manual deployment to some devices, to one central solution with advanced capability and a single approach to protection, policy enforcement and compliance monitoring."],
  ]),
  ...of("NW", [
    ["NW.SG", "Network segmentation", "How finely the network is divided: from large perimeter segments with few limits on reach and bulk tunnels, through isolation of critical workloads and service-specific interconnections, to distributed micro-perimeters around application profiles with just-in-time, just-enough connectivity."],
    ["NW.TM", "Network traffic management", "How traffic is steered and prioritized by application: from static rules set by hand at provisioning, through application profiles with distinct traffic features, to rules that evolve continuously and reprioritize by mission criticality and risk."],
    ["NW.TE", "Traffic encryption", "How much traffic is encrypted and how its keys are kept: from minimal encryption and ad hoc keys, through encryption of all internal traffic and formal key policy, to all applicable traffic encrypted with least-privilege key management and cryptographic agility."],
    ["NW.RS", "Network resilience", "How the network meets the availability that applications need: from case-by-case configuration with little resilience for non-critical work, to holistic delivery that adapts to changing demand for all workloads in proportion."],
  ]),
  ...of("AW", [
    ["AW.AA", "Application access", "How access to an application is authorized: from local authorization on static attributes, through per-request decisions with context such as identity and device compliance, with expiry, to continuous authorization from real-time risk, behavior and usage."],
    ["AW.TP", "Application threat protections", "How applications are protected from threats: from general-purpose protections for known threats, to protections woven into every workflow that are content aware and tailored to sophisticated attacks, with real-time visibility."],
    ["AW.AV", "Accessible applications", "How far applications can be reached by authorized users over open networks: from private networks and VPNs only, through brokered connections for some, to all applicable applications available to authorized users and devices."],
    ["AW.DW", "Secure application development and deployment workflow", "How code reaches production: from ad hoc environments and non-robust deployment, through pipelines with least-privilege access, to coordinated teams, no developer access to production, immutable workloads and change only by redeployment."],
    ["AW.ST", "Application security testing", "How applications are tested for security: from manual tests before deployment, through static and dynamic testing with expert analysis, to testing built into the whole lifecycle with routine automated tests of deployed applications."],
  ]),
  ...of("DT", [
    ["DT.IN", "Data inventory management", "How well the organization knows what data it has: from a manual inventory of the data that matters most, to continuous inventory of all applicable data with loss prevention that blocks suspected exfiltration dynamically."],
    ["DT.CT", "Data categorization", "How data is categorized and labeled: from limited ad hoc capability, through a strategy with defined labels and manual enforcement, to automated categorization and labeling across the enterprise in granular, structured formats for all data types."],
    ["DT.AV", "Data availability", "Where data is kept to be available: from on-premises stores with some off-site backups, to redundant, highly available stores with access to history, optimized dynamically for what users and entities need."],
    ["DT.AC", "Data access", "How access to data is governed: from static access controls, through automated controls with elements of least privilege, to dynamic just-in-time and just-enough controls using identity, device risk, application and data category, with continuous review of permissions."],
    ["DT.EN", "Data encryption", "How data is encrypted and its keys protected: from minimal encryption at rest and in transit and ad hoc keys, through all data in transit and key policies, to all data at rest and in transit, rotated keys with no secrets hard coded, and encryption in use where appropriate."],
  ]),
];

/** What a pillar looks like at a stage, one sentence of ours for each of the 20 pairs (tables 2 to 6); the id is `<pillar>@<stage>`. */
export const PILLAR_STAGES: readonly Entry[] = [
  ...of("ID", [
    ["ID@traditional", "Identity, traditional", "Identities prove themselves with passwords or multi-factor authentication and hold standing access that is reviewed from time to time; the identity stores are self-run and on premises, identity risk is judged rarely and by hand, logs are read by hand, and people and entities are onboarded and removed manually."],
    ["ID@initial", "Identity, initial", "Multi-factor authentication is required and looks at more than one attribute of the entity; self-run and hosted identity stores exist with little joining between them; risk is judged by hand with static rules; access that is granted, privileged access too, expires and is reviewed automatically; non-privileged onboarding is automated."],
    ["ID@advanced", "Identity, advanced", "Phishing-resistant multi-factor authentication begins to cover every identity and password-free methods begin; stores are being consolidated; identity risk is analyzed in part automatically with dynamic rules that inform access decisions; access is need-based and per session; the orchestration of every identity is automated across environments."],
    ["ID@optimal", "Identity, optimal", "Identity is validated continuously, not only when access is first granted; identity stores are joined across partners and environments; risk is determined in real time; access is just in time and just enough for each action and resource; orchestration is fully automated."],
  ]),
  ...of("DV", [
    ["DV@traditional", "Devices, traditional", "There is little or no insight into what a device does or whether it complies, and few ways to enforce policy; physical and virtual assets are tracked ad hoc and not across vendors; no view of the devices that reach resources is required; protections are deployed to some devices by hand."],
    ["DV@initial", "Devices, initial", "Devices report some of their own characteristics, with weak enforcement; a basic process approves software and pushes updates; physical assets and some virtual ones are tracked and supply chain policy follows a framework; some devices must report before they reach a resource; some deployment of protection is automated."],
    ["DV@advanced", "Devices, advanced", "An administrator can verify a device's data at first access and compliance is enforced on most devices; management, software approval, vulnerability finding and patching are mostly automated; a cross-vendor view of assets builds up; access uses verified insight; non-compliant devices are found and isolated."],
    ["DV@optimal", "Devices, optimal", "Compliance is verified and enforced for the whole life of devices and virtual assets; the view of all assets across vendors and providers is at or near real time; access uses real-time risk analysis from the device; one unified solution protects, enforces and monitors; provisioning to removal is automated."],
  ]),
  ...of("NW", [
    ["NW@traditional", "Networks, traditional", "The network is a few large perimeter segments with few limits on reach inside them, possibly with bulk tunnels between sites; rules are static and set by hand; little traffic is encrypted and keys are managed ad hoc; resilience is case by case; monitoring looks at the boundary."],
    ["NW@initial", "Networks, initial", "Critical workloads are isolated and their connectivity limited to what they need; applications get profiles with distinct traffic handling; all traffic to internal applications begins to be encrypted under a formal key policy; monitoring uses known indicators of compromise in each environment; some automation appears."],
    ["NW@advanced", "Networks, advanced", "Isolation reaches more of the network with micro-perimeters at ingress and egress and service-specific interconnections; rules adapt to risk assessments; all applicable traffic is encrypted with keys and certificates rotated; anomaly-based detection correlates telemetry; changes are made through automated change management."],
    ["NW@optimal", "Networks, optimal", "Micro-perimeters and micro-segmentation are distributed around application profiles with just-in-time, just-enough connectivity; rules evolve continuously and reprioritize by criticality and risk; keys are managed with least privilege and cryptographic agility; all detection sources are correlated automatically; networks are defined as code."],
  ]),
  ...of("AW", [
    ["AW@traditional", "Applications and workloads, traditional", "Access to applications rests on local authorization and static attributes; threat protections are general-purpose; some applications are reachable only over private networks or VPNs; environments are ad hoc with weak deployment; security testing is manual and comes before deployment."],
    ["AW@initial", "Applications and workloads, initial", "Authorization starts to use context per request, with expiry; protections are woven into critical workflows; some applications are reachable by brokered connection over open networks; pipelines and least-privilege controls give environments for development, testing and production; static and dynamic testing begin."],
    ["AW@advanced", "Applications and workloads, advanced", "Access decisions are automated with richer context and enforced expiry; protections cover all workflows and some application-specific threats; most applicable applications are reachable by authorized users; development, security and operations are coordinated and developers do not reach production; testing is part of the pipeline."],
    ["AW@optimal", "Applications and workloads, optimal", "Access is authorized continuously from real-time risk and behavior; protections are content aware; all applicable applications are available to authorized users and devices; workloads are immutable where feasible and change only by redeployment with automated deployment and no administrator access; deployed applications are tested routinely."],
  ]),
  ...of("DT", [
    ["DT@traditional", "Data, traditional", "Only some data, mainly the data critical to the mission, is inventoried by hand; categorization is ad hoc; data is mostly on premises with off-site backups; access is governed by static controls; little is encrypted and keys are handled ad hoc; visibility into location, access and use is limited and manual."],
    ["DT@initial", "Data, initial", "Inventory is automating for on-premises and cloud and covers most data, with the first protection against loss; a categorization strategy has defined labels and manual enforcement; some data is on redundant, highly available stores; automated access controls with elements of least privilege begin; data in transit is encrypted."],
    ["DT@advanced", "Data, advanced", "Inventory and tracking are automated enterprise-wide with loss prevention on static attributes and labels; some categorization and labeling are automated in a consistent, tiered manner; access controls are automated, consider identity, device risk, application and category, and expire where applicable; data at rest and in transit is encrypted and keys are rotated."],
    ["DT@optimal", "Data, optimal", "All applicable data is inventoried continuously and loss prevention dynamically blocks suspected exfiltration; categorization and labeling are automated for every data type; availability is optimized dynamically; access is just in time and just enough with continuous review; data in use is encrypted where appropriate and visibility spans the whole data lifecycle."],
  ]),
];

/** What a cross-cutting capability looks like at a stage in general (table 7, pages 29 to 30); the id is `<theme>@<stage>`. */
export const THEME_STAGES: readonly Entry[] = [
  ...of("VA", [
    ["VA@traditional", "Visibility and analytics, traditional", "Logs are collected by hand across the enterprise with low fidelity and minimal analysis."],
    ["VA@initial", "Visibility and analytics, initial", "The collection and analysis of logs and events for mission-critical functions begins to be automated, and the gaps in visibility are assessed regularly."],
    ["VA@advanced", "Visibility and analytics, advanced", "Automated collection of logs and events grows enterprise-wide, virtual environments included, into central analysis that correlates across several sources."],
    ["VA@optimal", "Visibility and analytics, optimal", "Visibility is comprehensive across the enterprise through central, dynamic monitoring and advanced analysis of logs and events."],
  ]),
  ...of("AO", [
    ["AO@traditional", "Automation and orchestration, traditional", "Operations and response rest on static, manual processes with little automation."],
    ["AO@initial", "Automation and orchestration, initial", "Orchestration and response begin to be automated for the functions critical to the mission."],
    ["AO@advanced", "Automation and orchestration, advanced", "Orchestration and response are automated enterprise-wide and use context from several sources to inform decisions."],
    ["AO@optimal", "Automation and orchestration, optimal", "Orchestration and response change dynamically with the requirements and the environment of the whole enterprise."],
  ]),
  ...of("GV", [
    ["GV@traditional", "Governance, traditional", "Policies are made ad hoc across the enterprise and enforced by manual processes or static technical means."],
    ["GV@initial", "Governance, initial", "Policies for enterprise-wide enforcement are defined and begin to be implemented, with little automation and manual updates."],
    ["GV@advanced", "Governance, advanced", "Tiered, tailored policies apply enterprise-wide with automation where possible, and access policy decisions use context from several sources."],
    ["GV@optimal", "Governance, optimal", "Enterprise-wide policies that allow tailored local controls are implemented and automated, with continuous enforcement and dynamic updates."],
  ]),
];
