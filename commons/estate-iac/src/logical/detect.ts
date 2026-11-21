// Spec: 0003-estate-iac-importers FR-007
/**
 * Which importer reads a file: by what is in it, since a name says little (`plan.json`, `stack.json`, `main.yaml`). A JSON with `values` or `planned_values` is OpenTofu or Terraform (`show -json` does not say which wrote it, so the caller says, and Terraform is assumed), one with `Resources` is
 * CloudFormation, one with `deployment.resources` is Pulumi; a YAML with `services` is Compose, one with `Resources` or `AWSTemplateFormatVersion` is CloudFormation, one with `apiVersion` and `kind` is Kubernetes.
 *
 * @example
 * ```ts
 * import { detectTool } from "./detect.ts";
 * detectTool("a.yaml", "services:\n  web:\n    image: x\n"); // "compose"
 * ```
 *
 * @module
 */
import { type Imports, type Tool } from "@intellectual-frontiers/estate-iac/governance";
import { importCloudFormation } from "./cloudformation.ts";
import { importCompose } from "./compose.ts";
import { importKubernetes } from "./kubernetes.ts";
import { importPulumi } from "./pulumi.ts";
import { importTerraform } from "./terraform.ts";

/** The tool a file is of, or nothing where it is none the importers read. */
export function detectTool(_source: string, text: string, prefer: "opentofu" | "terraform" = "terraform"): Tool | undefined {
  const t = text.trimStart();
  if (t.startsWith("{")) {
    try {
      const d = JSON.parse(text) as Record<string, unknown>;
      if ("values" in d || "planned_values" in d) return prefer;
      if (typeof d["Resources"] === "object" && d["Resources"] !== null) return "cloudformation";
      const dep = d["deployment"];
      if (typeof dep === "object" && dep !== null && "resources" in dep) return "pulumi";
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (/^services:\s*$/m.test(text)) return "compose";
  if (/^(AWSTemplateFormatVersion|Resources):/m.test(text)) return "cloudformation";
  if (/^apiVersion:/m.test(text) && /^kind:/m.test(text)) return "kubernetes";
  return undefined;
}

/** The assets and links of a file, by the importer its content says, or a problem where no importer reads it. */
export function importText(source: string, text: string, prefer: "opentofu" | "terraform" = "terraform"): Imports {
  const tool = detectTool(source, text, prefer);
  switch (tool) {
    case "opentofu":
    case "terraform":
      return importTerraform(tool, source, text);
    case "cloudformation":
      return importCloudFormation(source, text);
    case "kubernetes":
      return importKubernetes(source, text);
    case "compose":
      return importCompose(source, text);
    case "pulumi":
      return importPulumi(source, text);
    default:
      return { tool: "terraform", source, assets: [], links: [], problems: [`${source}: no importer reads it (OpenTofu or Terraform \`show -json\`, a CloudFormation template, Kubernetes manifests, a Compose file, a Pulumi stack export)`] };
  }
}
