// Spec: 0003-estate-endpoints-readers FR-003, FR-004
/**
 * Mobile apps from what they declare. An Android manifest gives the app (the package, the oldest system it runs on, whether it allows traffic in the clear) and an endpoint for each web address its deep links claim; an iOS property list (`Info.plist`) gives the app (the bundle identifier, the
 * oldest system) and what App Transport Security allows: arbitrary loads set the app to allow the clear, and each exception domain that allows insecure loads is an endpoint in the clear. The app is linked to its endpoints (`client-of`). Permissions and components are not read.
 *
 * @example
 * ```ts
 * import { importAndroid } from "./mobile.ts";
 * importAndroid("AndroidManifest.xml", '<manifest package="test.example.app"/>').assets.length; // 1
 * ```
 *
 * @module
 */
import { formatXmlError, readXml, type XmlElement } from "@intellectual-frontiers/formats/xml";
import { distinctLinks, IdPool, present, slug, type Imported, type ImportedLink } from "@intellectual-frontiers/estate-iac/governance";
import { provenance, type Found } from "@intellectual-frontiers/estate-endpoints/governance";

const attr = (e: XmlElement, name: string): string | undefined => e.attributes.find(([n]) => n === name)?.[1];
const kids = (e: XmlElement, name: string): readonly XmlElement[] => e.children.filter((c): c is XmlElement => c.kind === "element" && c.name === name);

/** An Android manifest: the app and the endpoints its deep links claim. */
export function importAndroid(source: string, text: string): Found {
  const none = (message: string): Found => ({ format: "android", source, assets: [], links: [], problems: [message] });
  const xml = readXml(text);
  if (xml.kind === "err") return none(`${source}: ${formatXmlError(xml.error)}`);
  const root = xml.value;
  const pkg = attr(root, "package");
  if (root.name !== "manifest" || pkg === undefined) return none(`${source}: no manifest with a package: it is not an AndroidManifest.xml`);
  const ids = new IdPool();
  const app = kids(root, "application")[0];
  const cleartext = app === undefined ? undefined : attr(app, "android:usesCleartextTraffic");
  const sdk = kids(root, "uses-sdk")[0];
  const appAsset: Imported = { id: ids.take(slug("android", pkg)), kind: "mobile-app", attributes: present({ platform: "android", "bundle-id": pkg, "min-os": sdk === undefined ? undefined : attr(sdk, "android:minSdkVersion"), ...(cleartext === undefined ? {} : { "allows-cleartext": cleartext === "true" }), provenance: provenance("android", source, "manifest") }) };
  const assets: Imported[] = [appAsset];
  const links: ImportedLink[] = [];
  const seen = new Set<string>();
  const walk = (e: XmlElement): void => {
    if (e.name === "data") {
      const scheme = attr(e, "android:scheme");
      const host = attr(e, "android:host");
      if ((scheme === "http" || scheme === "https") && host !== undefined && host !== "*" && !seen.has(`${scheme}://${host}`)) {
        seen.add(`${scheme}://${host}`);
        const ep: Imported = { id: ids.take(slug("android", pkg, host)), kind: "endpoint", attributes: present({ scheme, host: host.replace(/^\*\./, ""), exposure: "internet", provenance: provenance("android", source, `deep-link ${host}`) }) };
        assets.push(ep);
        links.push({ from: appAsset.id, to: ep.id, kind: "client-of" });
      }
    }
    for (const c of e.children) if (c.kind === "element") walk(c);
  };
  walk(root);
  return { format: "android", source, assets, links: distinctLinks(links), problems: [] };
}

type Plist = string | number | boolean | Plist[] | { [k: string]: Plist };

/** The value of a property list element. */
function plistValue(e: XmlElement): Plist {
  const text = e.children.map((c) => (c.kind === "text" ? c.text : "")).join("");
  switch (e.name) {
    case "dict": {
      const out: { [k: string]: Plist } = {};
      const items = e.children.filter((c): c is XmlElement => c.kind === "element");
      for (let i = 0; i + 1 < items.length; i += 2) {
        const k = items[i] as XmlElement;
        out[k.children.map((c) => (c.kind === "text" ? c.text : "")).join("")] = plistValue(items[i + 1] as XmlElement);
      }
      return out;
    }
    case "array":
      return e.children.filter((c): c is XmlElement => c.kind === "element").map(plistValue);
    case "true":
      return true;
    case "false":
      return false;
    case "integer":
    case "real":
      return Number(text);
    default:
      return text;
  }
}

const isDict = (v: Plist | undefined): v is { [k: string]: Plist } => typeof v === "object" && v !== null && !Array.isArray(v);

/** An iOS `Info.plist` (as XML): the app and what App Transport Security allows. */
export function importIos(source: string, text: string): Found {
  const none = (message: string): Found => ({ format: "ios", source, assets: [], links: [], problems: [message] });
  const xml = readXml(text);
  if (xml.kind === "err") return none(`${source}: ${formatXmlError(xml.error)} (a binary property list is read as XML: \`plutil -convert xml1\`)`);
  const dict = xml.value.name === "plist" ? xml.value.children.find((c): c is XmlElement => c.kind === "element" && c.name === "dict") : undefined;
  const d = dict === undefined ? undefined : plistValue(dict);
  if (!isDict(d) || typeof d["CFBundleIdentifier"] !== "string") return none(`${source}: no CFBundleIdentifier: it is not an Info.plist`);
  const id = d["CFBundleIdentifier"];
  const ats = isDict(d["NSAppTransportSecurity"]) ? d["NSAppTransportSecurity"] : {};
  const arbitrary = ats["NSAllowsArbitraryLoads"] === true;
  const ids = new IdPool();
  const app: Imported = { id: ids.take(slug("ios", id)), kind: "mobile-app", attributes: present({ platform: "ios", "bundle-id": id, "min-os": typeof d["MinimumOSVersion"] === "string" ? d["MinimumOSVersion"] : undefined, "allows-cleartext": arbitrary || (isDict(ats["NSExceptionDomains"]) && Object.values(ats["NSExceptionDomains"] as object).some((x) => isDict(x as Plist) && (x as { [k: string]: Plist })["NSExceptionAllowsInsecureHTTPLoads"] === true)), provenance: provenance("ios", source, "Info.plist") }) };
  const assets: Imported[] = [app];
  const links: ImportedLink[] = [];
  const domains = isDict(ats["NSExceptionDomains"]) ? ats["NSExceptionDomains"] : {};
  for (const [domain, v] of Object.entries(domains)) {
    if (!isDict(v) || v["NSExceptionAllowsInsecureHTTPLoads"] !== true) continue;
    const ep: Imported = { id: ids.take(slug("ios", id, domain)), kind: "endpoint", attributes: present({ scheme: "http", host: domain, exposure: "internet", provenance: provenance("ios", source, `NSExceptionDomains ${domain}`) }) };
    assets.push(ep);
    links.push({ from: app.id, to: ep.id, kind: "client-of" });
  }
  return { format: "ios", source, assets, links: distinctLinks(links), problems: [] };
}
