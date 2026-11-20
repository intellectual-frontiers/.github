/**
 * The generator of `kernel/ocsf-types.auto.ts` (commons 0007-grc FR-016): TypeScript types for the OCSF classes the harnesses emit, and
 * every object those classes use, from the OCSF schema server's resolved schema at one pinned version. A required attribute is required in
 * the types; an attribute a profile adds is optional; an enumeration is the union of its values, with their captions in the JSDoc.
 *
 * Every response the generator reads (the data types, each class, each object) is pinned here by its SHA-256, and a response that differs
 * from its pin stops the generator before it writes anything, so the types are a function of the pinned schema alone. The generator needs
 * the network (schema.ocsf.io), so it is run by hand and its output is committed; CI does not run it. Moving to another OCSF version is
 * three steps: set `VERSION`, run with `--pins` and paste the table it prints into `PINS`, then run it again to write the types.
 *
 *   bun tools/ocsf-gen.ts            fetch, check every response against its pin, write kernel/ocsf-types.auto.ts and format it
 *   bun tools/ocsf-gen.ts --check    the same, but fail if the file written would differ from the one in the tree
 *   bun tools/ocsf-gen.ts --pins     fetch, and print the SHA-256 of every response as the `PINS` table
 *
 * @module
 */
import {
  array,
  boolean,
  type Decoder,
  formatDecodeError,
  integer,
  json,
  nullable,
  object,
  record,
  string,
} from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { readTextFile, remove, writeTextFile } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../runtime/path.ts";
import { args, execPath, exit, run, runtimeName, which } from "../runtime/proc.ts";

/** The OCSF version the types are for. */
const VERSION = "1.9.0";

/** The OCSF schema server's API for that version. */
const BASE = `https://schema.ocsf.io/api/${VERSION}`;

/** The classes the harnesses emit (by OCSF name): 2003, 2002, 5001, 5003 and 5023. */
const CLASSES = [
  "compliance_finding",
  "vulnerability_finding",
  "inventory_info",
  "user_inventory",
  "cloud_resources_inventory_info",
] as const;

/** The SHA-256 of every response of the schema server the types are made from, by its path under `BASE`. */
const PINS: Readonly<Record<string, string>> = {
  data_types: "07a121c450720375e60d5bea2af85af02757582e3c571684265bc4eaa465830f",
  "classes/compliance_finding": "ea6292c65ba6429102e655ff31fab6d577768b4483d6ef07df152fef366be331",
  "classes/vulnerability_finding": "3b3881578b185c912161b61ea67bb3083899e985603851af63a979b587e81b8f",
  "classes/inventory_info": "67b0a0e39c0baba4698204413b8a995fa877e6b6a6151f79d04a04b388a2bb1f",
  "classes/user_inventory": "24bbc693accf0f31df2157e2d78fbaf0806c96bbadb03e56d91c4dc632a8eeb2",
  "classes/cloud_resources_inventory_info": "2df50a515be989906b6751ff36184cf6256953029c45d92d5710d669bc568679",
  "objects/note": "109821403416874ac6e4f960a6aef863e4cef2d6030e184f838c5f6dd8b21451",
  "objects/resource_details": "7511fece71e607d6f5a2f0c4ef168cae579225048885f90b365af6db60ffa2d2",
  "objects/observable": "2f2a8777aa97c1d0668aeee9dec28b27c71ab4cda119be46b4b3a3389df1c29c",
  "objects/api": "5a06f4c7206080dddc74b4ba8a0ba8994775038021825c3fd0aad725c6362a07",
  "objects/ticket": "4713e0f5d6b91a2735087d3e13174d0da0bfe0efa1df2d18d3ec2ce503baf075",
  "objects/malware": "2ba406ddf3e35243384eba5f9e20d3f1c67382495536f3b6a408f6950a00adac",
  "objects/evidences": "57247b7a9aa1b40debc4699b4cc68b197dd9bc9b1e1863a9e818ba20a1bf2704",
  "objects/policy": "c71a4236444935a532f77ab693261da24ceaa72fe449e30e51558755b1da8af3",
  "objects/enrichment": "cee2cefb1978e661d0c53861717e17673734ef67dc9dc53f42948b56af93669e",
  "objects/metadata": "2fe5e268af4a5d3bbe453bed454581a817bc2716b186405fb288cff3b1a3b07f",
  "objects/malware_scan_info": "ca06426a9df1f407b6904a009fd4b5fe8d07d96bee836cb816bc10898b6632c0",
  "objects/object": "2877e626af1f4bf57bb62a4ed74488adfdde40828e464c2ec7a7338a4cb8a721",
  "objects/device": "8f2fe7e1af8606e191e1b18bb5487ecd9e5fa84c3b02c242e0d4079ed45d7f1f",
  "objects/compliance": "c3059acc374b0ece11d9bb386033fdab73c23491c260ba2ceb346769342d1888",
  "objects/vendor_attributes": "a1ebac89c9d6945a731ffe6e15773119c9434dfaf8c4f9e336b26ed5a495cb35",
  "objects/authorization": "78aac32236bddd94efd30f2f0714d6aba92a99bb11758b13753788363ece41ba",
  "objects/attack": "cb54070cd689a73270f90b4c9516672b24c9735c31be83a4a465cc9b3adffa96",
  "objects/remediation": "980c55e6fcefec4b6f9a0a951cd29795a6fea2bc6e38de6b6001176b8590393b",
  "objects/osint": "d490db59ef6111c3619cbc7a3b295995b4ba4e5120a26c0dcaea89d2193aa62f",
  "objects/attestation": "19f9555b91fbc939b8840fd1e38c230f87911c109fcc1715b5ee0390b29d6b70",
  "objects/fingerprint": "09e5c3fbec65f4443b1d7b102bbf620ec7d22b742baab5adf9e57bcd81458e98",
  "objects/cloud": "7c6e284bf2173a980bdaa93bc31bd539571c839c510e4a4affcb2eb88242cb95",
  "objects/group": "963ffdc6e73d236045b707ba810eb4598354586143e8843d7597695639de285e",
  "objects/actor": "b86143352d019768abfebab059613ebd76454c8cb439e56f203b953f3ed84908",
  "objects/finding_info": "279884b4e00678e785e7a4cd9df835ef0a8bc7fdfc228b7a8279a3402bc040dd",
  "objects/user": "5cbe828b2a6498ff79adf688ff5cdc87d21f75f48b67cda5ac046c174a8d1716",
  "objects/firewall_rule": "5bec008c979f35ed69132b4719878cbc5d7b56de063a26b97657576a604707b8",
  "objects/vulnerability": "cd5ee02cbe9e342b5dd7ed23b9de12bf199f96590d7a99313a88a7a48e630a9a",
  "objects/idp": "88310c3c946d14a05274a30628441eb32f7ea5e19a9bdd16f3cbe3b022c9c9ae",
  "objects/table": "6355ec010e9177aec9ca805dfcb6d7f86eb61a264380198138c48bdf17172cb1",
  "objects/databucket": "8065ab86e3b4fd0069ef9750ecf6c3acee9f4c55ccd8bde31a5743ca54d698d7",
  "objects/database": "560efe8166df84e8ee5dc353e70a2c5b3618cbea9ec9c63acf051a40211238bd",
  "objects/container": "841f21e3ec9a7965e7011a657423c18a1c794c28e0c32f6722d8aee1e4b4b0b8",
  "objects/data_classification": "7c7f63261586bfd8459a41d029e0018c9300d29085dff24b44ab113021e67dae",
  "objects/key_value_object": "9215d719ae79b0ebd86424f5d27a852006f27333ab766aa2ac7cc852d4410758",
  "objects/graph": "7e8f25aadf995af0efe503adea90249efc77b002b6fd114251a85b85eae66b30",
  "objects/agent": "d1fe70b53a194d26e0a4577220759f507215d5f94ca72903c8b19b211eb12c10",
  "objects/reputation": "2fb088d444e877a149caa3f1fe3d3ecb736087f02816ce29fdf78ada8409c0ff",
  "objects/request": "c072e2527448943fbc03a8f958487a07fcb97deb1fdf8dbf0174963c08463552",
  "objects/service": "7e169672b8eaad59c66db2468e633eb3cc576adba6060eadb4a758f9ea141793",
  "objects/response": "6a19bfb63cdf46b379f38ce7debc1d3f18891a8003a9fbd527839c4131dc147d",
  "objects/token": "ff8f3900fe123d0cf19e2e523104fcff247b48b7b2ae2e2e9e6fc2b2c5a6f654",
  "objects/file": "b36cdf0dd6182f4af2ee7d89b100c1ec0086f491be4a360ee117acea2a57e10a",
  "objects/cve": "713ca1d6d41e3e5dad1cc53f03ca7daa9e807c199214238ad3df9c4fea3b801a",
  "objects/http_response": "05ced6a899813f0e083e73082186a724685b8b068d3540cbdc2529f13de228f1",
  "objects/http_request": "b9d584e2a048bd2f6144bfd9e8b867d40cf30649744566f5dcf4a1c9fbead15e",
  "objects/process": "bc248082acbb33940855351e7f1c34877025363c2291fd67b34a8a6b39b188cd",
  "objects/script": "afe7add1a8fca35a8510585c08c8ea7a8e424e613e042f9cbccb6b149bc8af81",
  "objects/dns_query": "176b1b0c2a8eea5e63ce59b1b3248ec94772400767e05b114f5a2178fe14c49f",
  "objects/network_connection_info": "839975223b6d013fd35c1d34cbfc83b1041e55a0efb1ca4dceb550adac656cd7",
  "objects/url": "5f5bfad3104a1f861a3e2b009c02286619342568c6a4d4428d87519c136c532d",
  "objects/email": "7e377679ad215d5b3f4f8a565d8906c8e6ec8eda0c1df8ccec4c9854d9fec173",
  "objects/tls": "b6aaaa7d2524fae840c2d9e036729ed32423336a19c0d5864b316027e240e59d",
  "objects/ai_agent": "9dc9425739b4c921104b40a89b2da539b7d68ea1ce1c4488240b075172437c04",
  "objects/network_endpoint": "9cb043f07681209b6921bcdf703dbaa45f5f7fc9a6977b68799f02b5ce995e63",
  "objects/ja4_fingerprint": "af2f2932e96fdcd61a3cd964c12947f17ed9b255395e838d9d9e9d5b3a5b9812",
  "objects/job": "1edc20546401b962758510d2fc2520c6c344d101ec2061a75e956fe794fade36",
  "objects/extension": "eea1e8146c814456f7dc99f46abddb9c65a94bb7e3ca24b6cd8deb330b412556",
  "objects/logger": "ee11c7287f7284b665c00e87688e7ae8af290843dc6d490d66510c88956b0b18",
  "objects/reporter": "582bf49b2dae3121d362e763edb0f3eeb74d1c37d42c70d3a5b3ba7130fc2b5a",
  "objects/product": "6d388b4049fcc45af7fb8c6697d22b4aa2629900e546e97227cf70cae1fbe0ea",
  "objects/timespan": "de6504b183fb702005e6685663aafb855cdebcd325d6134def2fde206cd07e1a",
  "objects/transformation_info": "f9942661ea26f9b586dc45ae19c5bd039a22914beb8be346e2407ffea8e50f09",
  "objects/os": "6888476076ad8f7fe645d516ebafeb99903169f0791e1041c77fff4732bb7fca",
  "objects/image": "a8946516937fe3484ac039384edb80e028084174aef24050ddf2bb6d5732e30a",
  "objects/organization": "082413106d8abd55bd59672eb1fa56e867bb27dc5184cf71e6a8023d2daef3c7",
  "objects/peripheral_device": "f866480bb7d89ef0a1d05ce68518bf7324c70a5317d90cb48a83a14e93d7ea8b",
  "objects/location": "341210d26c3b78cbc60c18a7808fe090c920b6977d10b73bc0a1fe1bf04063df",
  "objects/network_interface": "77ee6a37f4f07180736907cfedf74d5d99aa7657b92ae179591a1fb022c2de8d",
  "objects/device_hw_info": "2fc33ddfcaae10e8e3685294fb25e21e31474e998bbdcb5c2ad7aada56f62f19",
  "objects/assessment": "dac29ed48dff0b9b4f9f2ec3baf93b8097b5be69ba9e382f83b33e1db2a517ea",
  "objects/check": "8e2349401c9e915b599aee89f48683d7c84821f86363e61e05d6d41b1696e046",
  "objects/kb_article": "42756cb45a30c70b04ecdab9c96a4fd869f4bb1cac77e162230f9abb3497f068",
  "objects/tactic": "5b815db6fd4bd4db86f9342bb00177474bbef4ba03e80ca152fc106347b63d28",
  "objects/technique": "191825ca23b0476f2aaa4317acca8a002ebe3f0491ef5fb9c061ba322aaad0a1",
  "objects/mitigation": "adba02027c79afaeb94a35ddccc3e8770d00ce7db30225cdb74c559de46c793c",
  "objects/sub_technique": "0b5a548ad133a62de5570cf30f50c47cb33b4db03b2344f90e038193bb5b01d1",
  "objects/cis_control": "bbc18994ef118f520c5be38856b4e5bc82cf015c537b80eecc8a9625fca62b38",
  "objects/threat_actor": "2a39456ce9b7de5e9a7316ec60cc746c9672f2153acff1d52f93226db132553e",
  "objects/kill_chain_phase": "999b947e7ff20ce67bb5c3226b713107dae4f85412495fb55d041fe6655336fa",
  "objects/autonomous_system": "044dc2f5e04dd866ae30f05276ba28a421560a889d3a3dddcdbe1655fe7d9310",
  "objects/analytic": "bbe17792ecd25859b2e8a0c9b06e5dd5f9bb911cdedd7dd8dc3fcaf7db6dc27c",
  "objects/whois": "1e72b90bab7f8e7ac656c47099a16da8bc18ac1ebda2f44e9f659cc8a302b354",
  "objects/email_auth": "cdb1c5670685cc503d5a163b2fcf0b706e53d2651ce984dcf4444edf495b5539",
  "objects/digital_signature": "2260ae8e3116ddfe1a0f93bee0c27379e15b36ef1ed1c60400dba33dd17eb900",
  "objects/dns_answer": "01cbec188baf9534d43ddf099152c3f5e6310d89884c59df5a78c7ce399a6eed",
  "objects/campaign": "e51b47cf16b6e95a4edf3a02a5d5619bd509c3b80dcceb809f7cf3543c4a58fa",
  "objects/prev_event": "b38d41e179411b68b1131a8443ece9c8af177658089dff57e706871712eb3933",
  "objects/account": "46e88256581bdbaa597d20c67701c0a0136017af7d2422879dfdb7612150d3bb",
  "objects/session": "832471397ec63e7978fbf73d1a26b82515e7f3ba4f02cbf9076132246fa2df1d",
  "objects/application": "e6df72678fa06c8c5289a6ecc42408cec3361b0c5413589c034903dc5aed91c2",
  "objects/iam_role": "c33b295cfabc38e8d9fd446f86ba655b876aa540d6d38f6d3e5d1d53dd69aea4",
  "objects/related_event": "bb1d9b7cb0b65dd4ec4a5ff7240d7d1e4cbc090ddb7f836569381dd9958bb654",
  "objects/trait": "426442a2df1e1afd68976ee2a362babb5c4b97791fb9d527f86298d3bbbfb9c5",
  "objects/ldap_person": "bfe8ada20a69f936ecb31a044dd744f17af8bda7352c7ef6ca665971778ae21b",
  "objects/programmatic_credential": "2471439e99dd52fdc494b59a4597d380294876a8a906c63c8b0c58af29d1b990",
  "objects/advisory": "f0b515af0afc847134da4461c0b46fffaeeb264e95f4e4a1abc10ea5813fd00c",
  "objects/affected_code": "d4ddf983be537348f15925e6ad5396b63c7150780ab4850972fa61d910a1d5f9",
  "objects/affected_package": "0ac31dd9861d59496f09f7142865ffb476b308393a6e1722577956c907d48ac2",
  "objects/cwe": "8af0cb6939fbd14c0b3ee82fed82580dd79ab5d3452782779923793989c38a99",
  "objects/package": "791e9b6c54ed516c8555360160bfbbad5d7c3f7f631edf34b9dd0382ce0847c3",
  "objects/auth_factor": "c14d75ca04ec2669ba608fd9c1bd892277f7cb4cfaafface7b90672bc050e434",
  "objects/scim": "2d48f19582b8005715895d245f19aaaffee946204f7dfaf627207d5bceb3dc7e",
  "objects/sso": "cabcaf5b912077e8283883ddc3ccf01d3a7615be5ed22c2e8f57a7d11a43a9f7",
  "objects/encryption_details": "1b2ba54e421f243f9fc16bd20fa7e17d4ff66786be8976f3bf602f0a7aca5124",
  "objects/classifier_details": "0238f39c2909d83bc0eaa322dd231030c42bb8f773b2e4a2e6941740c29f63be",
  "objects/discovery_details": "38799bf953bdb091c88bb1cbe92bb72d415e8b106a9336e0f51fe0dea7e8c065",
  "objects/node": "1c99df9fc5504394c8747d09f7bc8ce864404870088c55876324bec4e2b4736f",
  "objects/edge": "875248c9d74db37bb4464f0c7824dff7f718d9763dc086207f04405a9d538245",
  "objects/download_info": "56eb181e8e0a9625394c2c9027f2df1e9704f83e3357101a4a7af4010eba2a0c",
  "objects/cvss": "0e8da8440c144ac29c9262738c9bf4ab7cca2277ade2a306eed8c983ee103c97",
  "objects/epss": "082acc3d2998a4605c2b56ccf2937b7e96379832dc51b39e22e915895153d163",
  "objects/http_header": "d5518164ef133b1d10ec97ac37b5c2438bee9ef3db5a20a21d1f85d8d2041b5f",
  "objects/environment_variable": "32fbbc6067c0162437bfb10c02614d355d43dfc4ad4df1d96cd9394738a67658",
  "objects/process_entity": "d427d389a77755f62074fe083fafe8a9d284647006bd8f5572f6d06880648917",
  "objects/long_string": "94532c5cf0330c0048a1f725a77dd1fa6c55ae8f64c8b2d14336c9af6bdc660d",
  "objects/certificate": "f544357d5830fbd1a5108cd7ca38af308e82f61962b49cdde1fad7d385d8ee9d",
  "objects/tls_extension": "4c4e952b4bbb15b70a71c2b15c39164280a5d307e43ff1e37c277db08ea570dd",
  "objects/san": "c81578349beee57054f09d41209acf1bb1e86a646c9e1b3a29818b384726ab56",
  "objects/ai_model": "4e8829f58c21df21d6b77e7ef4f155e5ed12e4d13a4fe02e5d58a18e5612f167",
  "objects/network_proxy": "862b6e4e99ccc90836627e68eb9cc1bff6d2e9305395e5d14a02589ca5782b87",
  "objects/job_action": "369c598e48e86076de1117847baa68d98e8f6a4a73a04c7daeb1750a20ed22b4",
  "objects/job_trigger": "61d9f9692636def47f49f941fc6a7b1f62968448dbc350f34885b49ff9fb9376",
  "objects/feature": "48fec7276b55408b44b243c5627880055709518505c56e1df991bf4409867ac3",
  "objects/port_info": "f261fe64f650bb71af8a38d48625e246624fd1947511f950a920364ec4e9ceca",
  "objects/cpu_info": "5e4a4c3cf716eb19ac28b4cdc19f2aa2658e943e4e1d1f3021f69e941edff3da",
  "objects/display": "0d9e3877fedab9c12d3a8a73c58e265ab37b3da8488d8c94d84c25477d5c9203",
  "objects/gpu_info": "f77adeee0e152d21d10f5b6b5784ac326fb6e112c8639680063a1d9cf355b184",
  "objects/keyboard_info": "8319298dad087c05f9e660684d9549ab9873520a262cc093d6d4771c473485d6",
  "objects/d3fend": "e3d6872c03cf8b1d7125bbee47a8814693f3a949f86fd902b0dd41dee7d44fa0",
  "objects/sensor_info": "7cefa0f80c1a05f3426ea4894a599f56a45dce7774730720c8f662221fdaa984",
  "objects/domain_contact": "c38e6966a7716ef55ebf0bc79ebbec7dc4b990ba3afbd93ff83c0f33b410cf16",
  "objects/sbom": "d898ad6a8dc1429c9e981943885fc31618574abd374d58f41ca31ebfc78c3453",
  "objects/rule": "0303482932474c937fec7ef018efd5bd27d020355f7a1d9c8c50f1f612f88dee",
  "objects/occurrence_details": "7f2e331dc94ccdff4974c16e0999bfe00a154b67c4de13c9675e3801cc831b2d",
  "objects/metric": "b6befc1f6f430be0cdf3935307d5d0a866c0dc05215ef204402748462a0d63d2",
  "objects/d3f_tactic": "5846b20b82c35a0f42462b9768ed9f23970abd74b9ca0de7cb75eaff1564b1b0",
  "objects/d3f_technique": "90ef5ada5c0038046f6f5ba2ad7fd9ffc2fd8b89b2e92a0a2663e02761bf591e",
  "objects/software_component": "5b54c837db28ea1886dcf03044d48abbdb3abf922f1a3647c8a201c83356d4fd",
};

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const OUT = join(ROOT, "kernel", "ocsf-types.auto.ts");

/** Stop with a message and status 1. */
function stop(message: string): never {
  console.error(`ocsf-gen: ${message}`);
  return exit(1);
}

// ---------------------------------------------------------------------------------------------------------------------------- the schema

type Attr = {
  readonly type: string;
  readonly caption?: string;
  readonly description?: string;
  readonly requirement?: string;
  readonly is_array?: boolean;
  readonly object_type?: string;
  readonly enum?: Readonly<Record<string, { readonly caption?: string }>>;
  readonly profiles?: readonly string[] | null;
  readonly "@deprecated"?: { readonly message?: string; readonly since?: string };
};

type Def = {
  readonly name: string;
  readonly caption: string;
  readonly description?: string;
  readonly uid?: number;
  readonly category_uid?: number;
  readonly category_name?: string;
  readonly attributes: Readonly<Record<string, Attr>>;
};

const attrDecoder: Decoder<Attr> = object(
  { type: string },
  {
    caption: string,
    description: string,
    requirement: string,
    is_array: boolean,
    object_type: string,
    enum: record(object({}, { caption: string })),
    profiles: nullable(array(string)),
    "@deprecated": object({}, { message: string, since: string }),
  },
);

const defDecoder: Decoder<Def> = object(
  { name: string, caption: string, attributes: record(attrDecoder) },
  { description: string, uid: integer, category_uid: integer, category_name: string },
);

const dataTypesDecoder: Decoder<Readonly<Record<string, { readonly type?: string }>>> = record(object({}, { type: string }));

const fetched = new Map<string, string>();

/** A response of the schema server, tried up to three times, its SHA-256 recorded. */
async function get<T>(path: string, decoder: Decoder<T>): Promise<T> {
  const url = `${BASE}/${path}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      fetched.set(path, await sha256(bytes));
      const d = json(new TextDecoder().decode(bytes), decoder);
      if (d.kind === "err") return stop(`${url}: ${formatDecodeError(d.error)}`);
      return d.value;
    } catch (e) {
      if (attempt >= 3) return stop(`${url}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`ocsf-gen: ${url}: ${e instanceof Error ? e.message : String(e)}; trying again`);
    }
  }
}

const types = await get("data_types", dataTypesDecoder);
const classes: Def[] = [];
for (const c of CLASSES) classes.push(await get(`classes/${c}`, defDecoder));
const objects = new Map<string, Def>();
const pending: string[] = [];
const want = (d: Def): void => {
  for (const a of Object.values(d.attributes)) {
    const t = a.object_type;
    if (t !== undefined && !t.includes("/") && !objects.has(t) && !pending.includes(t)) pending.push(t);
  }
};
classes.forEach(want);
for (let name = pending.shift(); name !== undefined; name = pending.shift()) {
  const o = await get(`objects/${name}`, defDecoder);
  objects.set(name, o);
  want(o);
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

if (args.includes("--pins")) {
  console.log("const PINS: Readonly<Record<string, string>> = {");
  for (const [path, sum] of fetched) console.log(`  ${JSON.stringify(path)}: ${JSON.stringify(sum)},`);
  console.log("};");
  exit(0);
}
const wrong = [...fetched].filter(([path, sum]) => PINS[path] !== sum).map(([path]) => path);
const unread = Object.keys(PINS).filter((path) => !fetched.has(path));
if (wrong.length > 0 || unread.length > 0) {
  stop(
    `the OCSF ${VERSION} schema is not the one pinned (differs or unpinned: ${wrong.join(", ") || "none"}; pinned but not read: ${unread.join(", ") || "none"}); run with --pins after a deliberate change`,
  );
}

// ---------------------------------------------------------------------------------------------------------------------------- the types

const SCALAR: Readonly<Record<string, string>> = {
  boolean_t: "boolean",
  float_t: "number",
  integer_t: "number",
  long_t: "number",
  port_t: "number",
  timestamp_t: "number",
  json_t: "unknown",
};

/** The scalar type a data type rests on (`email_t` is a `string_t`). */
function baseOf(t: string): string {
  let x = t;
  for (let i = 0; i < 5; i++) {
    const up = types[x]?.type;
    if (up === undefined) break;
    x = up;
  }
  return x;
}

const pascal = (s: string): string =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== "")
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
    .join("");

/** OCSF's text as one line of JSDoc: no HTML, no comment terminator, no `@` (a JSDoc tag), single spaces. */
const doc = (s = ""): string =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\*\//g, "* /")
    .replace(/@/g, "(at)")
    .replace(/\s+/g, " ")
    .trim();

/** Names the kernel's boundary test reads as host globals: an attribute of one of these names is written as a mapped type of its string. */
const HOST_NAMES: ReadonlySet<string> = new Set(["process", "Buffer", "require", "__dirname"]);

const typeName = (name: string): string => `Ocsf${pascal(name)}`;

function tsType(a: Attr): string {
  let t: string;
  if (a.type === "object_t")
    t =
      a.object_type !== undefined && a.object_type !== "object" && objects.has(a.object_type) ? typeName(a.object_type) : "OcsfOpenObject";
  else if (a.enum !== undefined && Object.keys(a.enum).length > 0) {
    const numeric = (SCALAR[baseOf(a.type)] ?? "string") === "number";
    t = Object.keys(a.enum)
      .sort((x, y) => (numeric ? Number(x) - Number(y) : byText(x, y)))
      .map((k) => (numeric ? k : JSON.stringify(k)))
      .join(" | ");
  } else t = SCALAR[baseOf(a.type)] ?? "string";
  return a.is_array === true ? (t.includes("|") ? `readonly (${t})[]` : `readonly ${t}[]`) : t;
}

function attrDoc(a: Attr): string {
  const values =
    a.enum !== undefined && Object.keys(a.enum).length > 0
      ? ` Values: ${Object.entries(a.enum)
          .sort(([x], [y]) => (Number.isNaN(Number(x)) ? byText(x, y) : Number(x) - Number(y)))
          .map(([v, e]) => `${v} ${doc(e.caption)}`)
          .join(", ")}.`
      : "";
  const profiles = a.profiles !== undefined && a.profiles !== null && a.profiles.length > 0 ? `; profiles ${a.profiles.join(", ")}` : "";
  const gone = a["@deprecated"];
  const deprecated = gone === undefined ? "" : ` @deprecated Since OCSF ${gone.since ?? "?"}: ${doc(gone.message)}`;
  return `/** ${doc(a.caption)}: ${doc(a.description)}${values} (${a.requirement ?? "optional"}${profiles})${deprecated} */`;
}

/** A definition as an exported type: its attributes sorted by name, `fixed` overriding the generated type of a few. */
function declare(name: string, d: Def, fixed: Readonly<Record<string, string>> = {}): string {
  const head = `/** ${doc(d.caption)}: ${doc(d.description)} */`;
  const entries = Object.entries(d.attributes).sort(([x], [y]) => byText(x, y));
  if (entries.length === 0) return `${head}\nexport type ${name} = OcsfOpenObject;`;
  const plain: string[] = [];
  const hosts: string[] = [];
  for (const [k, a] of entries) {
    const required = a.requirement === "required" && (a.profiles === undefined || a.profiles === null || a.profiles.length === 0);
    const t = fixed[k] ?? tsType(a);
    if (HOST_NAMES.has(k)) hosts.push(`  ${attrDoc(a)}`, `  readonly [K in ${JSON.stringify(k)}]${required ? "" : "?"}: ${t};`);
    else plain.push(`  ${attrDoc(a)}`, `  readonly ${k}${required ? "" : "?"}: ${t};`);
  }
  const body = `{\n${plain.join("\n")}\n}`;
  return hosts.length === 0
    ? `${head}\nexport type ${name} = ${body};`
    : `${head}\nexport type ${name} = ${body} & {\n${hosts.join("\n")}\n};`;
}

const out: string[] = [
  "/**",
  ` * TypeScript types for the OCSF ${VERSION} classes the harnesses emit (commons 0007-grc FR-016), and every object they use. A required`,
  " * attribute is required here; an attribute a profile adds is optional; a deprecated one says so. The classes:",
  ...classes.map((c) => ` * - ${doc(c.caption)} (${String(c.uid)}, \`${c.name}\`)`),
  " *",
  ` * GENERATED by \`bun tools/ocsf-gen.ts\` from the OCSF ${VERSION} schema (schema.ocsf.io, every response pinned by its SHA-256 in the`,
  " * generator); never edit by hand. OCSF is Apache-2.0, a Linux Foundation project.",
  " *",
  " * @module",
  " */",
  "",
  "/** The OCSF version these types are for. */",
  `export const OCSF_VERSION = ${JSON.stringify(VERSION)};`,
  "",
  "/** The classes these types are for: their uid, caption, and category. */",
  "export const OCSF_CLASSES = {",
  ...classes.map(
    (c) =>
      `  ${c.name}: { uid: ${String(c.uid)}, caption: ${JSON.stringify(c.caption)}, category_uid: ${String(c.category_uid)}, category_name: ${JSON.stringify(c.category_name)} },`,
  ),
  "} as const;",
  "",
  "/** An object OCSF leaves open (`object`, `unmapped`, `data`): any JSON members. */",
  "export type OcsfOpenObject = { readonly [key: string]: unknown };",
  "",
];
for (const [n, o] of [...objects].sort(([a], [b]) => byText(a, b))) {
  if (n === "object") continue;
  out.push(declare(typeName(n), o), "");
}
for (const c of classes) {
  out.push(declare(typeName(c.caption), c, { class_uid: String(c.uid), category_uid: String(c.category_uid) }), "");
}
const text = out.join("\n");

// ---------------------------------------------------------------------------------------------------------------------------- write

/** Format a file with Bun's formatter (bunfig.toml [fmt]), as the tree is. */
async function format(path: string): Promise<void> {
  const bun = runtimeName() === "bun" ? execPath() : which("bun");
  if (bun === undefined) stop("bun is needed to format the types");
  const r = await run([bun, "fmt", path], { cwd: ROOT });
  if (!r.success) stop(`bun fmt ${path} failed:\n${r.stdout}${r.stderr}`);
}

if (args.includes("--check")) {
  const probe = join(ROOT, "kernel", `ocsf-types.check-${String(Date.now())}.ts`);
  try {
    await writeTextFile(probe, text);
    await format(probe);
    const now = await readTextFile(probe);
    const tree = await readTextFile(OUT).catch(() => "");
    if (now !== tree) stop(`${OUT} is not what the pinned OCSF ${VERSION} schema gives; run bun tools/ocsf-gen.ts`);
    console.log(`OCSF ${VERSION}: ${OUT} is up to date`);
  } finally {
    await remove(probe);
  }
} else {
  await writeTextFile(OUT, text);
  await format(OUT);
  console.log(`OCSF ${VERSION}: ${String(classes.length)} classes, ${String(objects.size)} objects, written to ${OUT}`);
}
