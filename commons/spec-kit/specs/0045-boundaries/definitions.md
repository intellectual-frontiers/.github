# Definitions behind boundaries

**For:** 0045-boundaries. **Read:** the primary sources named in each row, on 2026-11-26, by fetching the document and reading the passage. Every definition below is in our own words; where a row says **read**, the passage was found in the source at the address given, and where it says **not read**, the sentence is from knowledge and the UNVERIFIED list at the end names it. No text of a standard is copied, except the title of a term and the name of a category.

## What a boundary is, in one place

A **boundary** is the line a body of authority draws around the things it answers for. The authority is a person or an organization (an authorizing official, an assessed organization, a covered entity, a controller, a service organization, an engagement's client), and the things are information resources: components, people, facilities, data and the services of other parties. Everything inside is accountable to that authority under one set of requirements, everything outside is either someone else's accountability or no one's, and what crosses the line is governed by an agreement. Every regime below says this in its own words and none of them says it quite the same way, which is why a boundary here has a **kind**: the kind carries the authority, the names of the roles, the categories of asset and the agreements that the regime defines.

The same body of fact is not one boundary. A laptop is in a company, in a CUI environment, in a network zone and perhaps in an authorization boundary, and each of those is a different accountability. A **realm** (0044-asset-connections) is a different thing: where assets are found (an account, a tenant, a cluster, a site), not who answers for them.

## 1. Authorization boundary (FISMA, FedRAMP)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Authorization boundary | All the components of an information system that one authorizing official authorizes to operate. Separately authorized systems that the system is connected to are not inside it. Documents also call it the accreditation boundary. | NIST SP 800-37 Rev. 2, glossary (from OMB Circular A-130 and CNSSI 4009-2022), and the NIST glossary page `csrc.nist.gov/glossary/term/authorization_boundary`. **Read.** |
| System boundary and the assignment of resources | The act of assigning information resources (information and the related people, equipment, funds and technology) to one information system is what draws its security boundary. Resources belong together when they are under the same direct management control, serve the same function or mission with much the same operating characteristics and security needs, and sit in the same general operating environment. A system may hold subsystems that share one security plan. | NIST SP 800-18 Rev. 1, section 2.1 (and footnotes 9 and 10 on information resources and direct management control). **Read.** |
| Determining the boundary is a task of its own | Preparation includes determining the authorization boundary and the information types the system processes, stores and transmits. A system is included in a single authorization boundary so that accountability is plain, and for systems partly run by an external provider, an agreement that describes the boundaries clearly is what keeps accountability plain. | NIST SP 800-37 Rev. 2, Task P-11 and P-12 and the text beside them. **Read.** |
| Categorization | A system's security category is stated for three objectives (confidentiality, integrity, availability), each at an impact of low, moderate or high. The impact of each objective for the system is the highest value among the information types the system holds (the high water mark). | FIPS 199, the text on security categories of information systems and the format `SC = {(confidentiality, impact), (integrity, impact), (availability, impact)}`. **Read.** |
| Boundary protection | Watching and controlling the communications at the external interface of a system, and at key internal interfaces, to prevent and detect unauthorized communications, through devices arranged by the organization's architecture. A public-facing part sits on a separated subnetwork. | NIST SP 800-53 Rev. 5, control SC-7 (the catalog `catalog-nist-sp800` in this repository holds its text) and the NIST glossary entry for boundary protection. **Read.** |
| Information exchange between systems | The exchange of information between the system and other systems is approved and managed through an agreement (an interconnection security agreement, an information exchange security agreement, a memorandum of understanding, a service level agreement, a user agreement, a non-disclosure agreement); each agreement records the interface characteristics, the security and privacy requirements, the controls, each party's responsibilities and the impact level of what is communicated; agreements are reviewed on a schedule. | NIST SP 800-53 Rev. 5, CA-3. **Read.** |
| Internal connections | Connections of components inside the system are authorized and documented with their interface and the nature of the information, ended on conditions, and reviewed. | NIST SP 800-53 Rev. 5, CA-9. **Read.** |
| Flow control | The flow of information inside the system and between connected systems is enforced against approved authorizations. | NIST SP 800-53 Rev. 5, AC-4. **Read.** |
| System plan | A plan names the constituent components, the operational context, the roles, the information types, the categorization and its rationale, the threats, the interconnections and the controls. | NIST SP 800-53 Rev. 5, PL-2 (and PM-5 for an inventory of systems). **Read.** |
| External services | Providers of external system services meet the organization's requirements; the organization writes down the oversight and the roles on both sides and monitors the provider on an ongoing basis. | NIST SP 800-53 Rev. 5, SA-9. **Read.** |
| Common controls and inheritance | A control one party provides that another party's system relies on is an inherited (common) control; the inheriting plan refers to it. | NIST SP 800-18 Rev. 1, section 2 (common security controls "incorporated into the system security plan by reference"). **Read.** The FedRAMP forms of it (leveraged authorization, the customer responsibility matrix) are **not read**. |
| FedRAMP package documents | The system security plan, with its boundary and data flow diagrams, the inventory and the interconnections, and the leveraged authorizations; a significant change is reported and assessed. | FedRAMP documents (templates, the policy on significant change). **Not read.** |

## 2. CUI environment (CMMC and NIST SP 800-171)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Assessment scope | Before an assessment, the organization seeking assessment states the set of all assets in its environment that will be assessed against the security requirements. | 32 CFR 170.19(a), annual edition of 2025-07-01, `govinfo.gov`. **Read.** |
| Level 2 asset categories | **CUI assets** process, store or transmit CUI. **Security protection assets** provide security functions to the scope. **Contractor risk managed assets** can, but are not meant to, handle CUI because of the organization's policy, procedures and practice, and need not be separated from CUI assets. **Specialized assets** can handle CUI but cannot be fully secured (IoT and industrial IoT devices, operational technology, government furnished equipment, restricted information systems, test equipment). These four are in scope and each is documented in the inventory, the system security plan and the network diagram; they differ in how they are assessed. **Out-of-scope assets** cannot handle CUI and do not protect CUI assets; the organization prepares to justify that, and an asset in any in-scope category cannot be out of scope. | 32 CFR 170.19(c)(1), table 3. **Read.** |
| Level 1 | Systems that process, store or transmit federal contract information are in scope; those that do not are out of scope, with no documentation required; specialized assets are not part of the scope. | 32 CFR 170.19(b). **Read.** |
| External service providers | The organization states whether a provider is a cloud service provider and whether it handles CUI or security protection data; where a cloud provider handles CUI, it must meet a FedRAMP level or an equivalence; a provider that is not a cloud provider is brought into the assessment or holds its own certification. | 32 CFR 170.19(c)(2), table 4. **Read** in part (the beginning of the table); the whole table is **not read**. |
| System component | A discrete, identifiable asset (hardware, software, firmware) that is part of a system; inventories give name, owner, version and licence. Components include workstations, servers, mobile devices, network components, virtual machines, database systems and applications. | NIST SP 800-171 Rev. 3, section 1 and the discussion of 03.04.10. **Read.** |
| External system | A system used by the organization but not part of it. | NIST SP 800-171 Rev. 3, 03.01.20 discussion. **Read.** |
| Boundary protection for CUI | Communications at the external managed interfaces of the system and the key internal ones are watched and controlled; public-facing parts sit on separated subnetworks; external systems are reached only through managed interfaces of boundary protection devices. | NIST SP 800-171 Rev. 3, 03.13.01. **Read.** |
| Controlled unclassified information | Information the Government creates or possesses, or an entity holds for or on behalf of it, that a law, regulation or Government-wide policy says is handled with safeguarding or dissemination controls; not classified information. | NIST glossary entry (from 32 CFR 2002). **Read.** |
| The CMMC scoping guides | The guides for levels 1 and 2 give examples of scoping. | `dodcio.defense.gov`: **not read** (the fetch was refused); the rule text of 32 CFR 170.19 is what is relied on. |

## 3. ePHI environment (HIPAA)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Covered entity | A health plan, a health care clearinghouse, or a health care provider that transmits health information electronically in a covered transaction. | 45 CFR 160.103, eCFR as of 2025-06-01. **Read.** |
| Business associate | A person who, for a covered entity (or an organized health care arrangement it takes part in) and not as a member of its workforce, creates, receives, maintains or transmits protected health information for a regulated function or activity, or provides services of the kinds the rule lists. Subcontractors of business associates are included. | 45 CFR 160.103. **Read** in part; the later paragraphs are **not read**. |
| Protected health information and ePHI | Individually identifiable health information, in any form or medium, with a few exclusions (education records, certain employment records, a person dead for more than fifty years). Electronic PHI is the part that is transmitted or maintained in electronic media. | 45 CFR 160.103. **Read.** |
| Information system | An interconnected set of information resources under the same direct management control that shares common functionality; it normally includes hardware, software, information, data, applications, communications and people. | 45 CFR 164.304. **Read.** |
| Hybrid entity and health care component | A single legal entity that is a covered entity, does both covered and non-covered functions and designates its health care components. The security rules then apply only to the health care components; a reference to ePHI means ePHI created, received, maintained or transmitted by or for the component. Components are designated by the entity. | 45 CFR 164.103 and 164.105(a). **Read.** |
| Common control and common ownership | Entities are under common control if one can significantly influence or direct the other's actions or policies, and under common ownership at an interest of five percent or more. These are the tests for affiliated covered entities. | 45 CFR 164.103. **Read.** |
| Business associate agreement and the disclosure to a business associate | A covered entity may let a business associate handle PHI on assurance, by contract, that it will safeguard it. | 45 CFR 164.502(e) and 164.504(e). 164.502 was fetched but **not read through**. |
| Risk analysis | An accurate and thorough assessment of the risks to the confidentiality, integrity and availability of the ePHI the entity holds. | 45 CFR 164.308(a)(1)(ii)(A). **Not read.** |

## 4. Cardholder data environment (PCI DSS)

| Item | Our wording | Source and status |
| --- | --- | --- |
| CDE | The system components, people and processes that store, process or transmit cardholder data or sensitive authentication data, and the system components that may not do those things but have unrestricted connectivity to ones that do. | PCI Security Standards Council glossary (`pcisecuritystandards.org/pci_security/glossary`). **Read.** |
| Segmentation | Segmentation keeps out-of-scope systems from the CDE; it is not required and is not a substitute for the requirements. The CDE is the starting point of the scope. Shared services that are connected to the CDE, and administration workstations outside it, are worked examples. | PCI SSC, Information Supplement: Guidance for PCI DSS Scoping and Network Segmentation, v1.0, May 2017. **Read** in part (the introduction, the CDE paragraph and the contents). |
| The three kinds of system in scope | Systems in the CDE; systems connected to or able to affect the security of the CDE; and systems that are out of scope because they are properly segmented. | PCI DSS v4.0.1, "Scope of PCI DSS Requirements". **Not read** (the standard's PDF was refused); the words are from the supplement and from knowledge. |

## 5. SOC 2 system

| Item | Our wording | Source and status |
| --- | --- | --- |
| The description of the system | A service organization's report describes the system: the services, the commitments and requirements, the components (infrastructure, software, people, procedures, data), the controls and the boundaries of what the description covers. | AICPA, Description Criteria (DC section 200). **Not read** (the AICPA download returned a page, not the criteria). |
| Subservice organizations | A service organization that uses a subservice organization states in the description whether it uses the **carve-out** method (the subservice organization's controls are left out of the description, and the complementary subservice organization controls the service organization expects are named) or the **inclusive** method (the subservice organization's services and controls are described as part of the system). Either way the services of a subservice organization are disclosed. | Secondary sources only (practitioner summaries found by search). **Not read** at the AICPA. |
| Complementary user entity controls | Controls the customers are expected to run for the commitments to hold. | AICPA DC 200. **Not read.** |
| Our own wording of the criteria | The repository already holds the 61 criteria of the Trust Services Criteria in our own words (`catalog-soc2`). | This repository. **Read.** |

## 6. Privacy and data boundary

Every privacy regime draws a line around **personal data** and around **who answers for it**. The words for the answerer differ, and the differences matter for a typed model, so each regime keeps its own role table.

| Regime | Who decides and who processes | Where the line is crossed | Source and status |
| --- | --- | --- | --- |
| **GDPR** (EU 2016/679) | The **controller** decides the purposes and means of processing, alone or with others; the **processor** processes on behalf of a controller; the **recipient** receives data. **Personal data** is any information about an identified or identifiable natural person. **Processing** is any operation on personal data. A **group of undertakings** is a controlling undertaking and the ones it controls. | A controller uses only processors that give sufficient guarantees and binds them by a contract or other legal act (Article 28). Each controller keeps a record of processing activities (Article 30). A transfer to a third country or an international organization is lawful only under the conditions of Chapter V: an adequacy decision (Article 45) or appropriate safeguards (Article 46) and the rest. The Regulation reaches an establishment in the Union and, in the cases Article 3 lists, processing about people in the Union by an entity outside it. | Articles 3, 4(1), 4(2), 4(7), 4(8), 4(19), 28, 30, 44, 45, 46, from EUR-Lex (`eur-lex.europa.eu`, CELEX 32016R0679). **Read.** |
| **UK GDPR** | The same roles and the same definitions of personal data, controller and processor, as retained in UK law; the transfer rules point to the UK's own adequacy regulations and safeguards. | Article 4 as retained. | `legislation.gov.uk/eur/2016/679/article/4`. **Read** (Article 4); the UK transfer provisions and the Data Protection Act 2018 sections are **not read**. |
| **CCPA and CPRA** (California Civil Code 1798.100 and following) | The **business** decides the purposes and means; a **service provider** and a **contractor** process for a business under a written contract with the use limits the law requires; a **third party** is a party that is none of those. A **consumer** is a California resident. The law speaks of **selling** and **sharing** personal information. | The contract with a service provider or contractor, and the notice and opt-out around selling and sharing. | Section 1798.140 (definitions): **not read** (the state's site and a mirror refused the fetch; the Attorney General's summary page was fetched and holds no definitions). The roles are from knowledge. |
| **LGPD** (Brazil, Law 13.709 of 2018) | The **controlador** decides; the **operador** processes for the controller; the **encarregado** is the contact. | International transfer is allowed only on the grounds the law lists (articles 33 to 36). | `planalto.gov.br`: **not read** (the fetch timed out; an unofficial English translation was refused). |
| **PIPEDA** (Canada) | An **organization** (an association, a partnership, a person, a trade union) is accountable for the **personal information** (information about an identifiable individual) it holds, including information it hands to a third party to process. | The accountability principle of Schedule 1. | Section 2(1), `laws-lois.justice.gc.ca`. **Read** (the two definitions); the accountability principle (clause 4.1.3) is **not read** (it was not on the page fetched). |
| **PDPA** (Singapore) | An **organisation** is accountable; a **data intermediary** processes on behalf of another organisation. | Transfers out of Singapore need comparable protection (the transfer limitation obligation). | `sso.agc.gov.sg`: **not read** (refused). |
| **DPDP Act 2023** (India) | The **Data Fiduciary** decides the purpose and means of processing; the **Data Processor** processes on behalf of a Data Fiduciary; a **Significant Data Fiduciary** is one the Government notifies; the **Data Principal** is the person the data is about. **Personal data** is any data about an individual who is identifiable by or in relation to it. | Transfer outside India is permitted except to countries the Government restricts by notification. | Section 2 definitions, `meity.gov.in` (the Act's PDF). **Read** (the definitions); the transfer section (16) was **not found in the text extracted**, so it is **not read**. |

Which regimes the model carries first, and why: **GDPR** and **UK GDPR** (the broadest reach by territory, the most copied vocabulary, and the only pair whose text was read through) and **CCPA and CPRA** (the largest regime of the United States, and the one whose roles differ most from the controller and processor pair). The other four are in the table of regimes with their role words, flagged as unread, and are added to a boundary when a client needs them and their text has been read.

## 7. Organizational boundary

| Item | Our wording | Source and status |
| --- | --- | --- |
| The line of a company, a legal entity, a tenant, a client | The things one party owns or answers for, by ownership, contract or engagement. It is the line that HIPAA's hybrid entity draws inside one legal entity (the health care components) and that a provider of managed services draws between its clients. | 45 CFR 164.103 and 164.105 for the hybrid entity (**read**); `tenancy` and `0007-grc` in this repository for parties, engagements and deny-by-default isolation. |

## 8. Network zone

| Item | Our wording | Source and status |
| --- | --- | --- |
| Enclave | A set of system resources that operate in the same security domain and share the protection of one common, continuous security perimeter. | NIST glossary (CNSSI 4009-2022, from IETF RFC 4949). **Read.** |
| Security domain | A domain that works at one security level and is administered by a single authority, implementing one security policy. | NIST glossary (CNSSI 4009-2022). **Read.** |
| Managed interface | A gateway, router, firewall, malicious-code analysis, virtualization system or encrypted tunnel inside a security architecture, through which a zone is joined to others. | NIST SP 800-171 Rev. 3, 03.13.01 discussion; NIST SP 800-53 Rev. 5, SC-7. **Read.** |

## 9. Trust boundary (threat model)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Trust boundary | A line in a data-flow model across which data or control passes between parts that are trusted differently; each crossing is where a threat model looks for spoofing, tampering and the rest. | Common practice of threat modelling (data-flow diagrams and STRIDE). **Not read** at a primary source; stated as the practice of the field, not as a quotation. |

## 10. Engagement scope

| Item | Our wording | Source and status |
| --- | --- | --- |
| Scope and rules of engagement | A signed engagement says which targets may be tested, which actions may be done to them, in which window, by whom, and which targets are off limits. Testing outside it is unauthorized. | The engagement model of the `tenancy` and `pentest` libraries of this repository (**read**); the rules-of-engagement practice of penetration testing standards (NIST SP 800-115 and others) is **not read** here. |

## UNVERIFIED

- The AICPA description criteria (DC 200) and the exact wording and numbering of the criterion on the boundaries of the system and the one on subservice organizations: not read; the AICPA download returned a page.
- The California definitions (1798.140), the LGPD articles 5 and 33 to 36, the Singapore PDPA definitions and the transfer limitation, the DPDP Act section 16, and PIPEDA Schedule 1 clause 4.1.3: not read. They are named so that a model has a place for them; their text is read before a boundary of that regime is approved for a client.
- The CMMC scoping guides for levels 1 and 2, the whole of table 4 of 32 CFR 170.19, and the PCI DSS v4.0.1 text on the scope of the requirements: not read.
- The FedRAMP documents (the system security plan template, the policy on significant change, the customer responsibility matrix): not read. The classes of a significant change in the rule table of 0045-boundaries FR-063 are the reasoning of this change and are marked as such there.
- The OSCAL recommended value `interconnection` of a component's `type` in a system security plan: the schema of OSCAL 1.1.2 was read (see the specification) and says that `type` is the category of a component's purpose without closing the list; that `interconnection` is a recommended value is from knowledge.
- Whether an adequacy decision of a given country is in force on a given date: it changes; the model carries the table as data with a date and never decides from memory.
- The definitions here are paraphrases for engineering; none is legal advice, and a counsel's reading of a regime governs where it differs.
