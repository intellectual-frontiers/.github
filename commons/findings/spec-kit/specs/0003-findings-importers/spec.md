# Feature Specification: Findings: the importers

**Spec ID:** 0003-findings-importers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Reading the reports of SARIF tools, OWASP ZAP, Burp Suite and Nessus into findings. The importers read text and run no tool.

## Requirements

- **FR-001**: The SARIF importer MUST read SARIF 2.1.0 and give a finding for each result of each run, with the severity from the `security-severity` score where there is one (9 and over critical, 7 high, 4 medium, above 0 low) and otherwise from the level (`error` high, `warning` medium, `note` low, `none` info), the weakness from the rule's tags, the place as the file and line of the first location, and the asset as given, since a SARIF report does not say it.
- **FR-002**: The ZAP importer MUST read the JSON report and give a finding for each alert of each site, with the risk code as the severity (3 high, 2 medium, 1 low, 0 info), the CWE from `cweid`, the asset the origin of the site, the place the first instance's address (and how many places there were), and the solution without markup; evidence MUST be redacted.
- **FR-003**: The Burp importer MUST read the XML report and give a finding for each issue with the severity Burp gives it (High, Medium, Low, Information), the host as the asset, the path as the place, the CWE from the vulnerability classifications, and the background and remediation without markup; it MUST NOT read the requests and responses an issue carries.
- **FR-004**: The Nessus importer MUST read the `.nessus` export and give a finding for each report item of each host, with the severity Nessus gives it (4 critical to 0 info), the host as the asset, the port and protocol as the place, the plugin as the rule, the CVEs and the CWE it names and the synopsis, description and solution; the output of a plugin MUST be cut short and redacted, and the properties of the host MUST NOT be read.
- **FR-005**: The importer of a report MUST be chosen by what is in it (a JSON with `runs` and a version, one with `site`, JSON lines with `template-id`, an XML with `<issues`, one with `<NessusClientData`, one with `<nmaprun`), a SARIF report MUST be refused where no asset is given, and a text no importer reads MUST be a problem and no finding.
- **FR-006**: Reading paths MUST read a file given by name (a problem where no importer reads it), walk a folder skipping without a word what no importer reads, give each finding its identity, and say how many repeats of an identity there were.
- **FR-007**: The nuclei importer MUST read the JSON lines of `-jsonl` and give a finding for each line with the template as the rule, the severity the template gives, the origin of the host as the asset, the address it matched as the place and the CVE and CWE of its classification; it MUST NOT read the request, the response or the command line, and what the template extracted MUST be cut short and redacted.
- **FR-008**: The nmap importer MUST read the XML of `-oX` and give an informational finding for each open port of each host (the rule `open-port`, the port and service in the title, the host name or address as the asset, the port and protocol as the place, the product and version in the description), and none for a closed or filtered port.

## Acceptance scenarios

1. **Given** a ZAP report with an alert of risk code 3, **When** it is read, **Then** the finding is high, per FR-002.
2. **Given** a Nessus export whose item prints a bearer token, **When** it is read, **Then** the token is not in the finding, per FR-004.

## Out of scope

- Running any scanner, and fetching a report from a service.

## Edge cases

- Neither ZAP nor Burp has a critical severity: their highest is high, per FR-002 and FR-003.

## Assumptions

- The reports are the formats the tools write today; a format that changes is a new test.

## Open questions

- None.

## Key entities

- **Importer**, **Report**.

## Success criteria

- **SC-001**: The tests of the library pass, with a secret planted in every report and found in no finding.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
