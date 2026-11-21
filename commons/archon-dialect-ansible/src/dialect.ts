// Spec: 0002-ansible-dialect FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The dialect of Archon for Ansible: what it guarantees (as data), how it renders an order and its plan to an inventory, a configuration and a playbook of the modules of ansible-core (never a collection, so that the tool alone is pinned), and the steps that
 * check, with the difference, and apply. The machine converges itself (the connection is local), which is the default preset of Archon; a controller that cannot run Ansible is not asked to. What it renders is generated and never edited. Check mode gives
 * exit 0 even where something would change, so the playbook ends, in check mode, with a task that fails where any task would have changed or could not be checked, and that exit (2) is what the step names as the change.
 *
 * @example
 * ```ts
 * import { ansible, KINDS_CARRIED } from "./dialect.ts";
 * ansible().tool.name; // "ansible-core"
 * KINDS_CARRIED.includes("package"); // true
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { renderedOf, renderHeader, type Dialect, type DialectStep, type Rendered } from "@intellectual-frontiers/archon/dialect";
import { findSecretLike, parseDialectId, parseKindId, type JsonValue, type Requirement, type RequirementId, type ResourceKindId } from "@intellectual-frontiers/archon/governance";
import type { Order, Plan } from "@intellectual-frontiers/archon/logical";

/** The id of the dialect. */
export const DIALECT_ID = "ansible";

/** The version of ansible-core the dialect pins: the one of Ubuntu 24.04's archive. A fleet that pins another passes it. */
export const PINNED_VERSION = "2.16.3";

/** The kinds of resource the dialect carries out, with the shape of `desired` for each (see the specification). */
export const KINDS_CARRIED = ["package", "user", "group", "file", "directory", "service", "ssh-authorized-key", "system-setting"] as const;

/** The names of `system-setting` the dialect carries, each by files only (no module of a collection): the time zone, the locale and the keyboard layout. */
export const SETTINGS_CARRIED = ["timezone", "locale", "keyboard"] as const;

/** What a dialect is made with. */
export type AnsibleOptions = {
  /** The version of ansible-core the machine must have (checked by the program that runs the steps). */
  readonly version?: string;
  /** Whether the tasks raise their rights with sudo; no by default, because the machine converges itself as the user that runs it. */
  readonly become?: boolean;
  /** The folder, below the working folder, the render is written in; `.archon` by default. */
  readonly renderRoot?: string;
};

type Obj = { readonly [key: string]: JsonValue };
const isObj = (v: JsonValue | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const NAME = /^[a-z_][a-z0-9_-]{0,31}\$?$/;
const PKG = /^[a-z0-9][a-z0-9+.-]*$/;
const UNIT = /^[A-Za-z0-9:_.@-]+(\.service|\.timer|\.socket)?$/;
const MODE = /^0?[0-7]{3,4}$/;

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

function str(o: Obj, key: string, problems: string[], id: string, required: boolean, test?: RegExp): string | undefined {
  const v = o[key];
  if (v === undefined) {
    if (required) problems.push(`${id}: desired.${key} is required`);
    return undefined;
  }
  if (typeof v !== "string" || (test !== undefined && !test.test(v))) {
    problems.push(`${id}: desired.${key} is not valid`);
    return undefined;
  }
  return v;
}

const absolute = (o: Obj, key: string, problems: string[], id: string): string | undefined => {
  const v = str(o, key, problems, id, true);
  if (v !== undefined && (!v.startsWith("/") || v.split("/").includes("..") || v.includes("\u0000"))) {
    problems.push(`${id}: desired.${key} is an absolute path with no ..`);
    return undefined;
  }
  return v;
};

function homeOf(user: string): string {
  return user === "root" ? "/root" : `/home/${user}`;
}

/** The task of one requirement, or the reasons it cannot be rendered. */
function taskOf(r: Requirement, index: number, problems: string[]): Obj | readonly Obj[] | undefined {
  const id = r.id;
  const d = r.desired;
  const absent = r.ensure === "absent";
  const base = (module: string, args: Obj): Obj => ({ name: `${id}: ${r.summary}`, [module]: args, register: `r${index}`, ignore_errors: "{{ ansible_check_mode }}" });
  if (!isObj(d) && !absent) {
    problems.push(`${id}: desired is an object`);
    return undefined;
  }
  const o: Obj = isObj(d) ? d : {};
  switch (String(r.kind)) {
    case "package": {
      const name = str(o, "name", problems, id, true, PKG);
      const version = str(o, "version", problems, id, false, /^[A-Za-z0-9.+:~-]+$/);
      return name === undefined ? undefined : base("ansible.builtin.apt", { name: version === undefined ? name : `${name}=${version}`, state: absent ? "absent" : "present", update_cache: true, cache_valid_time: 3600 });
    }
    case "group": {
      const name = str(o, "name", problems, id, true, NAME);
      return name === undefined ? undefined : base("ansible.builtin.group", { name, state: absent ? "absent" : "present" });
    }
    case "user": {
      const name = str(o, "name", problems, id, true, NAME);
      const shell = str(o, "shell", problems, id, false, /^\/[A-Za-z0-9/_.-]+$/);
      const home = str(o, "home", problems, id, false, /^\/[A-Za-z0-9/_.-]+$/);
      const uid = o["uid"];
      if (uid !== undefined && (typeof uid !== "number" || !Number.isInteger(uid) || uid < 0 || uid > 4294967294)) problems.push(`${id}: desired.uid is a whole number`);
      const comment = str(o, "comment", problems, id, false, /^[^:\r\n\u0000]{0,200}$/);
      const groups = o["groups"];
      if (groups !== undefined && (!Array.isArray(groups) || groups.some((g) => typeof g !== "string" || !NAME.test(g)))) problems.push(`${id}: desired.groups is a list of group names`);
      if (name === undefined) return undefined;
      if (absent) return base("ansible.builtin.user", { name, state: "absent" });
      return base("ansible.builtin.user", { name, state: "present", ...(shell === undefined ? {} : { shell }), ...(home === undefined ? {} : { home }), ...(typeof uid === "number" ? { uid } : {}), ...(comment === undefined ? {} : { comment }), ...(Array.isArray(groups) ? { groups: [...groups].sort().join(","), append: true } : {}) });
    }
    case "directory": {
      const path = absolute(o, "path", problems, id);
      const mode = str(o, "mode", problems, id, false, MODE);
      const owner = str(o, "owner", problems, id, false, NAME);
      const group = str(o, "group", problems, id, false, NAME);
      if (path === undefined) return undefined;
      return base("ansible.builtin.file", absent ? { path, state: "absent" } : { path, state: "directory", ...(mode === undefined ? {} : { mode }), ...(owner === undefined ? {} : { owner }), ...(group === undefined ? {} : { group }) });
    }
    case "file": {
      const path = absolute(o, "path", problems, id);
      const content = absent ? undefined : str(o, "content", problems, id, true);
      const mode = str(o, "mode", problems, id, false, MODE);
      const owner = str(o, "owner", problems, id, false, NAME);
      const group = str(o, "group", problems, id, false, NAME);
      if (path === undefined || (!absent && content === undefined)) return undefined;
      return absent ? base("ansible.builtin.file", { path, state: "absent" }) : base("ansible.builtin.copy", { dest: path, content: content ?? "", ...(mode === undefined ? {} : { mode }), ...(owner === undefined ? {} : { owner }), ...(group === undefined ? {} : { group }) });
    }
    case "service": {
      const name = str(o, "name", problems, id, true, UNIT);
      const running = o["running"];
      const enabled = o["enabled"];
      if (typeof running !== "boolean" || typeof enabled !== "boolean") problems.push(`${id}: desired.running and desired.enabled are true or false`);
      if (name === undefined || typeof running !== "boolean" || typeof enabled !== "boolean") return undefined;
      return base("ansible.builtin.systemd_service", { name, state: running ? "started" : "stopped", enabled });
    }
    case "ssh-authorized-key": {
      const user = str(o, "user", problems, id, true, NAME);
      const key = str(o, "key", problems, id, true, /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/=]+( [^\r\n]*)?$/);
      const path = o["path"] === undefined ? (user === undefined ? undefined : `${homeOf(user)}/.ssh/authorized_keys`) : absolute(o, "path", problems, id);
      if (user === undefined || key === undefined || path === undefined) return undefined;
      const dir = path.slice(0, path.lastIndexOf("/"));
      const keyLine = base("ansible.builtin.lineinfile", { path, line: key, state: absent ? "absent" : "present", ...(absent ? {} : { create: true, owner: user, mode: "0600" }) });
      return absent ? keyLine : [{ name: `${id}: the folder of the key file`, "ansible.builtin.file": { path: dir, state: "directory", owner: user, mode: "0700" }, register: `d${index}`, ignore_errors: "{{ ansible_check_mode }}" }, keyLine];
    }
    case "system-setting": {
      const name = str(o, "name", problems, id, true, /^(timezone|locale|keyboard)$/);
      if (name === undefined) return undefined;
      if (absent) {
        problems.push(`${id}: a setting of the system is changed, never removed`);
        return undefined;
      }
      const v = str(o, "value", problems, id, true, name === "timezone" ? /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/ : name === "locale" ? /^(C|[a-z]{2,3}_[A-Z]{2})\.UTF-8$/ : /^[a-z]{2,3}(\([a-z0-9_-]+\))?$/);
      if (v === undefined) return undefined;
      const task = (module: string, args: Obj, suffix: string, extra: Obj = {}): Obj => ({ name: `${id}: ${r.summary} (${suffix})`, [module]: args, register: `s${index}${suffix}`, ignore_errors: "{{ ansible_check_mode }}", ...extra });
      if (name === "timezone") return [task("ansible.builtin.copy", { dest: "/etc/timezone", content: `${v}\n`, mode: "0644" }, "a"), task("ansible.builtin.file", { src: `/usr/share/zoneinfo/${v}`, dest: "/etc/localtime", state: "link", force: true }, "b")];
      if (name === "keyboard") return [task("ansible.builtin.lineinfile", { path: "/etc/default/keyboard", regexp: "^XKBLAYOUT=", line: `XKBLAYOUT="${v}"`, create: true }, "a")];
      return v === "C.UTF-8"
        ? [task("ansible.builtin.lineinfile", { path: "/etc/default/locale", regexp: "^LANG=", line: `LANG=${v}`, create: true }, "a")]
        : [
            { name: `${id}: the locales package`, "ansible.builtin.apt": { name: "locales", state: "present", update_cache: true, cache_valid_time: 3600 }, register: `s${index}p`, ignore_errors: "{{ ansible_check_mode }}" },
            task("ansible.builtin.lineinfile", { path: "/etc/locale.gen", regexp: `^#? ?${v.replace(".", "\\.")} UTF-8`, line: `${v} UTF-8`, create: true }, "g"),
            { name: `${id}: generate the locale`, "ansible.builtin.command": { argv: ["locale-gen"] }, when: `s${index}g is changed` },
            task("ansible.builtin.lineinfile", { path: "/etc/default/locale", regexp: "^LANG=", line: `LANG=${v}`, create: true }, "a"),
          ];
    }
    default:
      problems.push(`${id}: the kind ${String(r.kind)} is not carried by this dialect (${KINDS_CARRIED.join(", ")})`);
      return undefined;
  }
}

function changing(plan: Plan): ReadonlySet<RequirementId> {
  return new Set(plan.entries.filter((e) => e.action === "create" || e.action === "update" || e.action === "remove").map((e) => e.id));
}

/** The dialect, as the port of Archon takes it. */
export function ansible(options: AnsibleOptions = {}): Dialect {
  const root = options.renderRoot ?? ".archon";
  const version = options.version ?? PINNED_VERSION;
  const carried = KINDS_CARRIED.map((k) => must(parseKindId(k)) as ResourceKindId);
  return {
    id: must(parseDialectId(DIALECT_ID)),
    tool: { name: "ansible-core", version },
    guarantees: { kinds: carried, subjects: ["machine"], plan: "faithful", idempotence: "proven", destroy: true },
    render: async (order: Order, plan: Plan): Promise<Result<Rendered, readonly string[]>> => {
      const problems: string[] = [];
      const todo = changing(plan);
      const tasks: Obj[] = [];
      const registered: string[] = [];
      order.requirements.forEach((r, i) => {
        if (!todo.has(r.id)) return;
        const found = findSecretLike(r.desired);
        if (found.length > 0) problems.push(`${r.id}: desired holds what looks like a secret (${found.map((f) => f.path).join(", ")}); a secret is a reference, never a value`);
        const t = taskOf(r, i, problems);
        if (t === undefined) return;
        for (const one of Array.isArray(t) ? t : [t]) {
          tasks.push(one as Obj);
          if (typeof one["register"] === "string") registered.push(one["register"]);
        }
      });
      if (problems.length > 0) return err(problems);
      const subject = String(order.subject.name);
      const drift = registered.map((n) => `${n} is changed or ${n} is failed`).join(" or ");
      const play = {
        name: `archon: converge ${subject}`,
        hosts: subject,
        gather_facts: false,
        become: options.become === true,
        tasks: [...tasks, ...(registered.length === 0 ? [] : [{ name: "check mode: end with exit 2 where anything would change", "ansible.builtin.fail": { msg: "something would change" }, when: `ansible_check_mode and (${drift})` }])],
      };
      const header = renderHeader("yaml");
      return renderedOf(new Map([
        ["ansible/inventory.yml", `${header}\n${JSON.stringify({ all: { hosts: { [subject]: { ansible_connection: "local", ansible_python_interpreter: "auto_silent" } } } }, null, 2)}\n`],
        ["ansible/ansible.cfg", `${header}\n[defaults]\nnocows = True\nretry_files_enabled = False\nforce_color = False\ninterpreter_python = auto_silent\nstdout_callback = default\nresult_format = yaml\n`],
        ["ansible/playbook.yml", `${header}\n${JSON.stringify([play], null, 2)}\n`],
      ]));
    },
    steps: (plan: Plan, rendered: Rendered): readonly DialectStep[] => {
      const playbook = rendered.files.get("ansible/playbook.yml");
      if (playbook === undefined) return [];
      const todo = changing(plan);
      const covers = plan.entries.filter((e) => todo.has(e.id) && (KINDS_CARRIED as readonly string[]).includes(String(e.kind))).map((e) => e.id);
      if (covers.length === 0) return [];
      const dir = `${root}/${rendered.digest}/ansible`;
      const run = (extra: readonly string[]): readonly string[] => ["env", `ANSIBLE_CONFIG=${dir}/ansible.cfg`, "ansible-playbook", "-i", `${dir}/inventory.yml`, `${dir}/playbook.yml`, ...extra];
      return [{ covers, summary: `converge ${covers.length} resource${covers.length === 1 ? "" : "s"} with ansible-core ${version}`, apply: run([]), check: run(["--check", "--diff"]), changedExit: 2 }];
    },
  };
}
