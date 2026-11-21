// Spec: 0002-boot-command FR-002, FR-003, FR-004, FR-005
/**
 * The verbs `prepare`, `arm`, `disarm`, `status` and `serve` over what a fleet gave the plugin. `prepare` renders the install and the playbook; `arm` and `disarm` say which asset a network boot may install (and, only if the person says so, erase a disk that holds data); `status` shows what is
 * armed, what installed and what is missing; `serve` runs the TFTP and HTTP boot server over the pinned files until it is stopped or for a time given.
 *
 * @example
 * ```ts
 * import { bootCommands } from "./commands.ts";
 * // bootCommands(config) is the list of nodes the branch `boot` holds
 * ```
 *
 * @module
 */
import { defineReach, problem } from "@intellectual-frontiers/headless/governance";
import { command, outcomeOf, type Node } from "@intellectual-frontiers/headless/logical";
import { UBUNTU_26_04 } from "@intellectual-frontiers/netboot/governance";
import { ensureAssets, startBoot } from "@intellectual-frontiers/netboot/physical";
import { value } from "@intellectual-frontiers/terminal/args";
import { armAsset, assetsDir, defaultStateFile, disarmAsset, prepare, statusOf, variable } from "./boot.ts";
import type { BootPluginConfig } from "./config.ts";

const asset = value<never>({ help: "The asset to install.", valueName: "ASSET", required: true });
const stateOpt = value<never>({ help: "The boot server's state file.", valueName: "FILE", default: "" });
const assetsOpt = value<never>({ help: "The folder of the pinned boot files and the installer image.", valueName: "DIR", default: "" });

/** The commands of the branch `boot`. */
export function bootCommands(config: BootPluginConfig): readonly Node[] {
  const program = config.program ?? "archon";
  const fleet = config.options ?? {};
  const optionsOf = (o: Readonly<Record<string, unknown>>): Record<string, string> => Object.fromEntries(Object.keys(fleet).map((k) => [k, String(o[k] ?? "")]));
  const stateOf = (o: Readonly<Record<string, unknown>>, env: (n: string) => string | undefined): string => (String(o["state"] ?? "") !== "" ? String(o["state"]) : defaultStateFile(program, env));

  const prepareVerb = command({
    name: "prepare",
    summary: "Render the install of a managed machine (its autoinstall, with no secret in it) and the playbook it converges itself with, as generated files for you to commit and sign. The machine runs nothing from a repository tip that a signer of the fleet did not sign.",
    options: { asset, ...fleet },
    examples: [{ args: ["--asset", "athens"], says: "Render athens's install and playbook." }],
    action: { kind: "action", effect: "mutate", dryRun: false, idempotent: true, reach: defineReach({ channels: ["local"], idempotent: true }) },
    run: async (args) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const name = String(o["asset"]);
      const subject = await config.subject(name, optionsOf(o));
      if (subject.kind === "err") return outcomeOf(null, { problems: [problem("fail", subject.error.message, { code: subject.error.code })], exit: subject.error.exit });
      const done = await prepare(name, subject.value);
      if (done.kind === "err") return outcomeOf(null, { problems: [problem("fail", done.error, { code: "E-PREPARE" })], exit: "findings" });
      return outcomeOf({ files: done.value.files }, { text: `rendered for ${name}:\n${done.value.files.map((f) => `wrote ${f}`).join("\n")}\ncommit and sign them: the machine pulls this tip and converges itself from it`, next: [`${program} boot arm --asset ${name}`] });
    },
  });

  const arm = command({
    name: "arm",
    summary: "Say that the next network boot of the asset may install it: only an armed asset is installed, once. A machine whose disks hold data is stopped unless you arm it with --confirm-destroy yes. It changes nothing on the machine.",
    options: { asset, ...fleet, state: stateOpt, confirmDestroy: value<never>({ help: "Allow the install to erase a disk that holds data: `yes`.", valueName: "yes", default: "" }), mac: value<never>({ help: "The MAC of the machine that will boot, where the fleet does not know it.", valueName: "MAC", default: "" }) },
    examples: [{ args: ["--asset", "athens"], says: "Arm athens for one install." }, { args: ["--asset", "athens", "--confirm-destroy", "yes"], says: "Arm athens and allow it to erase a disk that holds data." }],
    action: { kind: "action", effect: "mutate", dryRun: false, idempotent: false, reach: defineReach({ channels: ["local"] }) },
    run: async (args, ctx) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const name = String(o["asset"]);
      const subject = await config.subject(name, optionsOf(o));
      if (subject.kind === "err") return outcomeOf(null, { problems: [problem("fail", subject.error.message, { code: subject.error.code })], exit: subject.error.exit });
      const destroy = String(o["confirmDestroy"]) === "yes";
      const mac = String(o["mac"] ?? "");
      const token = await armAsset(stateOf(o, ctx.env), name, { confirmDestroy: destroy, ...(mac === "" ? {} : { mac }) });
      return outcomeOf({ armed: name, tokenLength: token.length }, { text: `armed ${name}${destroy ? " (it may erase a disk that holds data)" : " (it is stopped if a disk holds data)"}: network boot the machine now`, next: [`${program} boot serve`] });
    },
  });

  const disarm = command({
    name: "disarm",
    summary: "Take an asset out of the armed ones: its next network boot boots its own disk.",
    options: { asset, state: stateOpt },
    examples: [{ args: ["--asset", "athens"], says: "Disarm athens." }],
    action: { kind: "action", effect: "mutate", dryRun: false, idempotent: true, reach: defineReach({ channels: ["local"], idempotent: true }) },
    run: async (args, ctx) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      await disarmAsset(stateOf(o, ctx.env), String(o["asset"]));
      return outcomeOf({ disarmed: String(o["asset"]) }, { text: `${String(o["asset"])} is not armed` });
    },
  });

  const status = command({
    name: "status",
    summary: "Show what is armed, what has installed, the installs' latest progress and which boot files are not held yet. It changes nothing.",
    options: { state: stateOpt, assets: assetsOpt },
    examples: [{ args: [], says: "Show the state of the boot server." }],
    action: { kind: "report", reach: defineReach({ channels: ["local"], readOnly: true, idempotent: true }) },
    run: async (args, ctx) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const stateFile = stateOf(o, ctx.env);
      const s = await statusOf(stateFile, assetsDir(program, String(o["assets"] ?? ""), stateFile, ctx.env));
      const text = [`armed: ${s.armed.join("; ") || "nothing"}`, `installed: ${s.installed.join("; ") || "nothing"}`, `boot files not held (or not matching their pins): ${s.missing.join(", ") || "none"}`, ...s.last.map((l) => `  ${l}`)].join("\n");
      return outcomeOf(s, { text, ...(s.missing.length > 0 ? { next: [`${program} boot serve --fetch yes`] } : {}) });
    },
  });

  const serve = command({
    name: "serve",
    summary: `Run the boot server: TFTP (UDP 69) and HTTP (TCP 8080) answer a machine that network boots, from the pinned Ubuntu ${UBUNTU_26_04.point} files, the menus and the install data of the armed assets, until you stop it (or for --for seconds). The password hash comes from <secrets>/<asset>/password-hash on this machine only.`,
    options: {
      ...fleet, state: stateOpt, assets: assetsOpt,
      secrets: value<never>({ help: `The folder of the secrets of the fleet's machines, outside any repository (${variable(program, "SECRETS")}).`, valueName: "DIR", default: "" }),
      fetch: value<never>({ help: "Fetch the boot files and the installer image (about 2 GB) that are not held, checking each against its pin: `yes`.", valueName: "yes", default: "" }),
      httpPort: value<never>({ help: "The TCP port of the HTTP server.", valueName: "PORT", default: "8080" }),
      tftpPort: value<never>({ help: "The UDP port of the TFTP server (69 is the standard; it needs the right to bind it).", valueName: "PORT", default: "69" }),
      baseUrl: value<never>({ help: "The server's address as the machine sees it, for example http://192.168.1.10:8080/ (the address a request arrived at by default).", valueName: "URL", default: "" }),
      for: value<never>({ help: "Stop after this many seconds (0: until interrupted).", valueName: "SECONDS", default: "0" }),
    },
    examples: [{ args: ["--fetch", "yes"], says: "Fetch what is missing and serve until interrupted." }, { args: ["--for", "3600"], says: "Serve for an hour." }],
    action: { kind: "action", effect: "mutate", dryRun: false, idempotent: false, reach: defineReach({ channels: ["local"] }) },
    run: async (args, ctx) => {
      const o = args.options as Readonly<Record<string, unknown>>;
      const stateFile = stateOf(o, ctx.env);
      const dir = assetsDir(program, String(o["assets"] ?? ""), stateFile, ctx.env);
      const fetched = await ensureAssets(dir, UBUNTU_26_04, String(o["fetch"]) === "yes" ? undefined : async (u) => new Response(`not fetched: ${u}`, { status: 404 }), () => {});
      if (fetched.kind === "err") return outcomeOf(null, { problems: [problem("fail", `${fetched.error}${String(o["fetch"]) === "yes" ? "" : " (add --fetch yes to get the files)"}`, { code: "E-ASSETS" })], exit: "environment" });
      const secrets = String(o["secrets"]) !== "" ? String(o["secrets"]) : ctx.env(variable(program, "SECRETS"));
      const lines: string[] = [];
      const base = String(o["baseUrl"] ?? "");
      const server = await startBoot({
        stateFile, assets: fetched.value, pins: UBUNTU_26_04, provider: config.provider(optionsOf(o), secrets),
        http: { port: Number(o["httpPort"]) }, tftp: { port: Number(o["tftpPort"]) },
        ...(base === "" ? {} : { baseUrl: base.endsWith("/") ? base : `${base}/` }),
        emit: (e) => void lines.push(`${e.at} ${e.kind}: ${e.detail}`),
      });
      const seconds = Number(o["for"]);
      await new Promise<void>((resolve) => {
        if (seconds > 0) setTimeout(resolve, seconds * 1000);
        process.once("SIGINT", () => resolve());
        process.once("SIGTERM", () => resolve());
      });
      await server.stop();
      return outcomeOf({ httpPort: server.httpPort, tftpPort: server.tftpPort }, { text: lines.slice(-40).join("\n") || "the boot server ran and nothing asked it for anything" });
    },
  });
  return [prepareVerb, arm, disarm, status, serve];
}
