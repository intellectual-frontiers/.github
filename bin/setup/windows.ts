// Windows (009-machine-bootstrap FR-093): erga does not run natively on Windows yet, so this prepares WSL 2 with Debian, makes the Linux user, gives it sudo and
// makes it the default user, installs what the Linux bootstrap needs to start (curl and unzip), and runs that bootstrap inside, as the user; it installs the
// Linux Deno and runs this same setup there. It never unregisters or resets a distribution that exists, changes nothing outside WSL, and only reads what it
// finds of a PostgreSQL on Windows, which it hands to the setup inside as ERGA_WINDOWS_POSTGRES.
import { assertNever } from "./result.ts";
import { family } from "./table.ts";

/** The Debian family's own commands, from commons' table: the distribution WSL installs is Debian. */
const APT_REFRESH = family("debian").refreshWords.join(" ");
const APT_INSTALL = family("debian").installWords.join(" ");

export type Ran = { readonly code: number; readonly output: string };
/** quiet: the output kept; shown: on the screen; interactive: on the screen, and the person may type (a password) */
export type How = "quiet" | "shown" | "interactive";

/** What the Windows side does to the computer, so that a test can stand in for wsl.exe, the registry and the person. */
export type WindowsHost = {
  readonly run: (argv: readonly string[], how: How, env?: Readonly<Record<string, string>>) => Promise<Ran>;
  readonly hasWsl: () => boolean;
  readonly ask: (question: string) => Promise<string>;
  readonly programFiles: () => Promise<readonly { readonly name: string; readonly hasPgCtl: boolean }[]>;
  readonly say: (text: string) => void;
  readonly warn: (text: string) => void;
};

export type WindowsOptions = { readonly distro: string; readonly user: string; readonly bootstrapUrl: string; readonly baseUrl: string; readonly dryRun: boolean };

/** How it ended: done, done with notes (the bootstrap's exit status 1: set up, and erga's own checks found something), or stopped with the reason. */
export type WindowsOutcome =
  | { readonly kind: "done" }
  | { readonly kind: "notes" }
  | { readonly kind: "planned" }
  | { readonly kind: "stopped"; readonly reason: string; readonly status: number };

export const USER_NAME = /^[a-z_][a-z0-9_-]{0,30}$/;

/** wsl.exe --list prints UTF-16; read as text, its NULs go, and each name is a line. */
export function distroNames(output: string): string[] {
  return output.replaceAll("\0", "").replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
}

/** `reg query HKLM\SOFTWARE\PostgreSQL\Installations /s`: each installation's major version and the service that runs it. */
export function registryInstallations(output: string): { readonly major: string; readonly service: string }[] {
  const out: { major: string; service: string }[] = [];
  for (const block of output.split(/\r?\n(?=HKEY_)/)) {
    const version = block.match(/^\s*Version\s+REG_SZ\s+(\d+)/m)?.[1];
    if (version === undefined) continue;
    out.push({ major: version, service: block.match(/^\s*Service ID\s+REG_SZ\s+(\S+)/m)?.[1] ?? "" });
  }
  return out;
}

/** `reg query HKLM\SOFTWARE\PostgreSQL\Services\<id> /v Port`: the port, or null. */
export function registryPort(output: string): string | null {
  const m = output.match(/^\s*Port\s+REG_(?:DWORD|SZ)\s+(\S+)/m);
  if (m?.[1] === undefined) return null;
  return m[1].startsWith("0x") ? String(parseInt(m[1], 16)) : m[1];
}

/** `sc.exe query state= all`: the majors of the services named postgresql*<major>. */
export function serviceMajors(output: string): string[] {
  return [...output.matchAll(/^SERVICE_NAME:\s*(postgresql\S*?)(\d+)\s*$/gim)].map((m) => m[2] ?? "").filter((x) => x !== "");
}

/** Each PostgreSQL installed on Windows as <major>@<port>, read only: the registry first, then the services, then C:\Program Files\PostgreSQL\<major>\bin\pg_ctl.exe. */
export async function findWindowsPostgres(host: WindowsHost): Promise<string[]> {
  const found = new Map<string, string>();
  const inst = await host.run(["reg.exe", "query", "HKLM\\SOFTWARE\\PostgreSQL\\Installations", "/s"], "quiet");
  if (inst.code === 0) {
    for (const i of registryInstallations(inst.output)) {
      let port = "5432";
      if (i.service !== "") {
        const p = await host.run(["reg.exe", "query", `HKLM\\SOFTWARE\\PostgreSQL\\Services\\${i.service}`, "/v", "Port"], "quiet");
        port = (p.code === 0 ? registryPort(p.output) : null) ?? "5432";
      }
      found.set(i.major, `${i.major}@${port}`);
    }
  }
  const svc = await host.run(["sc.exe", "query", "state=", "all"], "quiet");
  if (svc.code === 0) { for (const m of serviceMajors(svc.output)) if (!found.has(m)) found.set(m, `${m}@5432`); }
  for (const d of await host.programFiles()) {
    const m = d.name.match(/^(\d+)/)?.[1];
    if (m !== undefined && d.hasPgCtl && !found.has(m)) found.set(m, `${m}@5432`);
  }
  return [...found.values()].sort();
}

/** Inside the distribution, as root or as the user: the command is given to sh as one argument, so no quoting by Windows reaches the shell. */
const inLinux = (o: WindowsOptions, as: string, cmd: string) => ["wsl.exe", "-d", o.distro, "-u", as, "--", "sh", "-c", cmd];

export async function prepareWindows(host: WindowsHost, o: WindowsOptions): Promise<WindowsOutcome> {
  const stopped = (reason: string, status = 3): WindowsOutcome => ({ kind: "stopped", reason, status });
  host.say(`Setting up Windows for erga: WSL 2 with ${o.distro}, then erga's own setup inside it (erga runs in WSL; it does not run natively on Windows yet).`);
  const wsl = host.hasWsl();
  const distros = async () => distroNames((await host.run(["wsl.exe", "--list", "--quiet"], "quiet", { WSL_UTF8: "1" })).output);
  const have = wsl && (await distros()).includes(o.distro);
  if (o.dryRun) {
    if (!wsl) host.say("  WSL is not part of this Windows: a real run stops here and says to run Windows Update (Windows 11, or Windows 10 version 2004 or later)");
    host.say(
      have
        ? `  would continue in ${o.distro}, which is installed (nothing in it is deleted)`
        : `  would install WSL 2 and ${o.distro}: wsl.exe --install -d ${o.distro} --no-launch`,
    );
    host.say(`  would make the Linux user (or use the one there), give it sudo and make it ${o.distro}'s default user`);
    host.say("  would install curl, wget and unzip in it, which a new Debian lacks");
    host.say("  would look, reading only, for a PostgreSQL on Windows and hand what it finds to the setup inside as ERGA_WINDOWS_POSTGRES");
    host.say(`  would run, as that user: curl -fsSL ${o.bootstrapUrl} | sh`);
    return { kind: "planned" };
  }
  if (!wsl) return stopped("WSL is not part of this Windows. It needs Windows 11 (or Windows 10 version 2004 or later), fully updated. Run Windows Update and try again.");
  // 1. WSL and the distribution
  if (!have) {
    host.say(`Installing WSL 2 and ${o.distro} (a download of a few hundred megabytes)...`);
    const r = await host.run(["wsl.exe", "--install", "-d", o.distro, "--no-launch"], "shown");
    if (r.code !== 0) return stopped(`WSL could not be installed (exit ${r.code}). If Windows asked you to restart, restart and run this line again.`);
    if (!(await distros()).includes(o.distro)) return stopped("Windows has to restart to finish installing WSL. Restart it, then run the same line again: it continues from here.");
  } else {
    host.say(`${o.distro} is already installed: continuing in it. Nothing in it is deleted.`);
  }
  // 2. the Linux user
  const existing = (await host.run(inLinux(o, "root", "getent passwd 1000 | cut -d: -f1"), "quiet")).output.trim();
  let user: string;
  if (existing !== "") {
    user = existing;
    host.say(`Using the Linux user that is already there: ${user}.`);
  } else {
    user = o.user;
    while (!USER_NAME.test(user)) user = (await host.ask("Choose a Linux username (lowercase letters, digits, - and _; it need not match your Windows name)")).trim();
    host.say(`Making the Linux user ${user}. Type its password twice when asked; nothing shows while you type: that is normal.`);
    const r = await host.run(inLinux(o, "root", `${APT_REFRESH} && ${APT_INSTALL} sudo && adduser --gecos '' ${user} && usermod -aG sudo ${user}`), "interactive");
    if (r.code !== 0) return stopped(`A step inside ${o.distro} failed (exit ${r.code}): making the user ${user}`);
  }
  // make it the user a new window opens as
  const conf = await host.run(inLinux(o, "root", `grep -qs '^default=${user}' /etc/wsl.conf || printf '[user]\\ndefault=${user}\\n' >> /etc/wsl.conf`), "quiet");
  if (conf.code !== 0) return stopped(`A step inside ${o.distro} failed (exit ${conf.code}): making ${user} the default user`);
  await host.run(["wsl.exe", "--terminate", o.distro], "quiet");
  // 3. what the Linux bootstrap needs to start: curl (or wget) to fetch it and Deno, unzip to unpack Deno
  const pk = await host.run(inLinux(o, "root", `${APT_REFRESH} && ${APT_INSTALL} curl wget unzip`), "shown");
  if (pk.code !== 0) return stopped(`A step inside ${o.distro} failed (exit ${pk.code}): ${APT_INSTALL} curl wget unzip`);
  // 4. PostgreSQL already on Windows, read only
  const pg = await findWindowsPostgres(host);
  const env: Record<string, string> = { BOOTSTRAP_URL: o.baseUrl };
  if (pg.length > 0) {
    host.say(`PostgreSQL on Windows: ${pg.join(", ")} (version@port). Nothing about it is changed.`);
    host.say(`  erga's setup can use a PostgreSQL 18 here as the home of your local Erga database; it asks you once, inside ${o.distro}.`);
    env.ERGA_WINDOWS_POSTGRES = pg.join(",");
  } else {
    host.say("No PostgreSQL on Windows: your local Erga database will be erga's own, inside Debian (off until you start it).");
  }
  // WSLENV hands these variables to the commands run inside WSL
  env.WSLENV = Object.keys(env).join(":");
  // 5. erga's own bootstrap, as the user, in front of the person (it asks for the Linux password once, and for the GitHub sign-in)
  host.say(
    `\nRunning erga's setup inside ${o.distro}. It asks for your Linux password once and for a GitHub sign-in. Getting erga ready (Deno and its packages) takes a few minutes, once.`,
  );
  const r = await host.run(inLinux(o, user, `cd && curl -fsSL '${o.bootstrapUrl}' | sh`), "interactive", env);
  return outcomeOf(r.code);
}

/** The bootstrap's exit status, read the way FR-093 says: 1 is "set up, with notes", any other failure stops. */
export function outcomeOf(code: number): WindowsOutcome {
  if (code === 0) return { kind: "done" };
  if (code === 1) return { kind: "notes" };
  return {
    kind: "stopped",
    reason: `erga's setup stopped (exit ${code}). Its last lines say why; run this line again to continue, it repeats nothing that is done.`,
    status: code,
  };
}

export function closingWords(o: WindowsOutcome, distro: string): string[] {
  switch (o.kind) {
    case "planned":
      return ["That was a dry run: nothing was changed."];
    case "stopped":
      return [o.reason];
    case "done":
    case "notes":
      return [
        o.kind === "notes"
          ? "\nDone, with notes: erga is installed, and its own checks found things to look at (listed above; ./ergactl doctor and ./ergactl check say what to do)."
          : "\nDone.",
        `Open ${distro} from the Start menu or Windows Terminal (a new tab, ${distro}) to use erga.`,
        "Your local Erga database is off until you need it: in Debian, ./erga local start starts it, ./erga arca ensure --env local fills it the first time, ./erga local status shows how DBeaver or psql connects, ./erga local stop stops it. ./erga local run thyra runs Thyra, and ./erga man serve shows the Erga Manuals at http://127.0.0.1:8080/man/.",
      ];
    default:
      return assertNever(o);
  }
}
