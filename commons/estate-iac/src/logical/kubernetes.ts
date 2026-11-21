// Spec: 0003-estate-iac-importers FR-004
/**
 * Kubernetes manifests: one YAML text with documents separated by `---`. A Deployment, StatefulSet, DaemonSet, Job or CronJob is an application (with the image of its first container); a Service is an endpoint for each of its ports (open to the internet where it is a LoadBalancer, to the
 * partners where it is a NodePort, internal where it is a ClusterIP), exposed by the applications its selector picks; an Ingress is an endpoint for each host (https where it has a TLS section), that depends on the services it routes to. Secrets are never read: a Secret is not an asset, and its data is not copied.
 *
 * @example
 * ```ts
 * import { importKubernetes } from "./kubernetes.ts";
 * importKubernetes("k.yaml", "apiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  ports:\n    - port: 80\n").assets.length; // 1
 * ```
 *
 * @module
 */
import { parseYaml, formatYamlError } from "@intellectual-frontiers/formats/yaml";
import { distinctLinks, IdPool, present, provenanceOf, slug, type Imported, type ImportedLink, type Imports } from "@intellectual-frontiers/estate-iac/governance";

type Obj = { readonly [k: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const arr = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

const WORKLOADS: Readonly<Record<string, string>> = { Deployment: "api", StatefulSet: "api", DaemonSet: "worker", Job: "batch", CronJob: "batch", ReplicaSet: "api" };

/** The documents of a text of several, split at the lines that are only `---`. */
export function documentsOf(text: string): readonly string[] {
  return text.split(/^---[ \t]*$/m).filter((d) => d.replace(/^\s*#.*$/gm, "").trim() !== "");
}

/** The pod template of a workload: its labels and the image of its first container. */
function podOf(kind: string, spec: Obj): { labels: Obj; image: string | undefined } {
  const template = kind === "CronJob" ? (isObj(spec["jobTemplate"]) && isObj((spec["jobTemplate"] as Obj)["spec"]) ? ((spec["jobTemplate"] as Obj)["spec"] as Obj)["template"] : undefined) : spec["template"];
  const t = isObj(template) ? template : {};
  const meta = isObj(t["metadata"]) ? t["metadata"] : {};
  const pod = isObj(t["spec"]) ? t["spec"] : {};
  const first = arr(pod["containers"])[0];
  return { labels: isObj(meta["labels"]) ? meta["labels"] : {}, image: isObj(first) ? str(first["image"]) : undefined };
}

/** The assets and links of the manifests in a text. */
export function importKubernetes(source: string, text: string): Imports {
  const ids = new IdPool();
  const assets: Imported[] = [];
  const links: ImportedLink[] = [];
  const problems: string[] = [];
  const workloads: { asset: Imported; labels: Obj; namespace: string }[] = [];
  const services: { name: string; namespace: string; selector: Obj; endpoints: Imported[] }[] = [];
  const ingresses: { endpoint: Imported; namespace: string; serviceNames: string[] }[] = [];
  let n = 0;
  for (const part of documentsOf(text)) {
    n += 1;
    const y = parseYaml(part);
    if (y.kind === "err") {
      problems.push(`${source}: document ${n}: ${formatYamlError(y.error)}`);
      continue;
    }
    const d = y.value;
    if (!isObj(d) || typeof d["kind"] !== "string") continue;
    const kind = d["kind"];
    const meta = isObj(d["metadata"]) ? d["metadata"] : {};
    const name = str(meta["name"]);
    const namespace = str(meta["namespace"]) ?? "default";
    const spec = isObj(d["spec"]) ? d["spec"] : {};
    if (name === undefined) continue;
    const address = `${str(d["apiVersion"]) ?? "v1"}/${kind}/${namespace}/${name}`;
    const provenance = provenanceOf("kubernetes", source, address);
    if (kind in WORKLOADS) {
      const pod = podOf(kind, spec);
      const asset: Imported = { id: ids.take(slug("k8s", namespace, name)), kind: "application", attributes: present({ tier: WORKLOADS[kind], image: pod.image, provenance }) };
      assets.push(asset);
      workloads.push({ asset, labels: pod.labels, namespace });
    } else if (kind === "Service") {
      const type = str(spec["type"]) ?? "ClusterIP";
      const exposure = type === "LoadBalancer" ? "internet" : type === "NodePort" ? "partner" : "internal";
      const endpoints: Imported[] = [];
      for (const p of arr(spec["ports"])) {
        if (!isObj(p) || typeof p["port"] !== "number") continue;
        const udp = str(p["protocol"]) === "UDP";
        const e: Imported = { id: ids.take(slug("k8s", namespace, name, String(p["port"]))), kind: "endpoint", attributes: present({ scheme: udp ? "udp" : "tcp", host: `${name}.${namespace}.svc`, port: p["port"], exposure, provenance }) };
        assets.push(e);
        endpoints.push(e);
      }
      services.push({ name, namespace, selector: isObj(spec["selector"]) ? spec["selector"] : {}, endpoints });
    } else if (kind === "Ingress") {
      const tlsHosts = new Set(arr(spec["tls"]).flatMap((t) => (isObj(t) ? arr(t["hosts"]).filter((h): h is string => typeof h === "string") : [])));
      for (const rule of arr(spec["rules"])) {
        if (!isObj(rule) || typeof rule["host"] !== "string") continue;
        const names = arr(isObj(rule["http"]) ? (rule["http"] as Obj)["paths"] : []).flatMap((p) => {
          const backend = isObj(p) && isObj(p["backend"]) ? p["backend"] : {};
          const svc = isObj(backend["service"]) ? str((backend["service"] as Obj)["name"]) : undefined;
          return svc === undefined ? [] : [svc];
        });
        const e: Imported = { id: ids.take(slug("k8s", namespace, name, rule["host"])), kind: "endpoint", attributes: present({ scheme: tlsHosts.has(rule["host"]) ? "https" : "http", host: rule["host"], exposure: "internet", provenance }) };
        assets.push(e);
        ingresses.push({ endpoint: e, namespace, serviceNames: names });
      }
    }
  }
  // a service is exposed by the workloads its selector picks (every label of the selector is on the pod); an ingress needs the services it routes to
  for (const s of services) {
    if (Object.keys(s.selector).length === 0) continue;
    for (const w of workloads) {
      if (w.namespace !== s.namespace || !Object.entries(s.selector).every(([k, v]) => w.labels[k] === v)) continue;
      for (const e of s.endpoints) links.push({ from: w.asset.id, to: e.id, kind: "exposes" });
    }
  }
  for (const i of ingresses) {
    for (const svc of i.serviceNames) for (const t of services.filter((s) => s.name === svc && s.namespace === i.namespace)) for (const e of t.endpoints) links.push({ from: i.endpoint.id, to: e.id, kind: "depends-on" });
  }
  return { tool: "kubernetes", source, assets, links: distinctLinks(links), problems };
}
