/**
 * Tests of `kernel/schedule.ts`: the exact files and commands planned for each scheduler, the plist read back with the kernel's XML
 * reader, arguments quoted for systemd and for a `.cmd` file split back to the same words by small reference splitters written here, what
 * cannot be carried refused, and every schedule read back from systemd's, launchd's and schtasks' forms as the same schedule.
 *
 * @module
 */
import fc from "fast-check";
import {
  calendarIntervals,
  describeSchedule,
  formatScheduleError,
  type JobName,
  type JobPlan,
  type JobSpec,
  jobName,
  MINUTE_STEPS,
  onCalendar,
  planJob,
  quoteCmdArgs,
  quoteSystemdArgs,
  type Schedule,
  schedule,
  type ScheduleError,
  schtasksSchedule,
  type Target,
  type Weekday,
  type When,
} from "../../kernel/schedule.ts";
import { child, children, readXml, textOf, type XmlElement } from "@intellectual-frontiers/formats/xml";
import type { Result } from "@intellectual-frontiers/core";
import { assert, assertEquals, fail, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-046";
const PROPERTY = "0005-typescript-runtime FR-014";

const ch = (...codes: number[]): string => String.fromCharCode(...codes);
const NUL = ch(0);
const TAB = ch(9);
const LF = ch(10);
const CR = ch(13);
const SOH = ch(1);

function value<T>(r: Result<T, ScheduleError>): T {
  if (r.kind === "err") return fail(formatScheduleError(r.error));
  return r.value;
}

const when = (w: When): Schedule => value(schedule(w));
const NAME: JobName = value(jobName("backup"));
const OWNER = { domain: "org.example", folder: "Example" } as const;

function job(over: Partial<JobSpec> = {}): JobSpec {
  return {
    name: NAME,
    owner: OWNER,
    argv: ["/usr/bin/backup", "--to", "/srv/backups dir", "100%"],
    workdir: "/srv",
    env: { LANG: "C.UTF-8" },
    when: when({ kind: "daily", hour: 6, minute: 10 }),
    ...over,
  };
}

const LINUX: Target = { os: "linux", home: "/home/ada" };
const DARWIN: Target = { os: "darwin", home: "/Users/ada", uid: 501 };
const WINDOWS: Target = { os: "windows", home: "C:\\Users\\ada" };

const plan = (j: JobSpec, t: Target): JobPlan => value(planJob(j, t));
const content = (p: JobPlan, i: number): string => p.files[i]?.content ?? fail(`no file ${i}`);

function refusal(r: Result<unknown, ScheduleError>): ScheduleError {
  if (r.kind === "ok") return fail("expected a refusal");
  return r.error;
}

// ------------------------------------------------------------------------------------------------------------------------- Linux

proves([FR], "Linux: a systemd user service and timer, exactly", () => {
  const p = plan(job(), LINUX);
  assertEquals(p.label, "org.example.backup.timer");
  assertEquals(p.description, "every day at 06:10");
  assertEquals(
    p.files.map((f) => [f.path, f.mode]),
    [
      [".config/systemd/user/org.example.backup.service", 0o644],
      [".config/systemd/user/org.example.backup.timer", 0o644],
    ],
  );
  assertEquals(
    content(p, 0),
    [
      "# The scheduled job org.example.backup, written by a program: it is replaced when the job is scheduled again.",
      "[Unit]",
      "Description=org.example.backup",
      "",
      "[Service]",
      "Type=oneshot",
      "WorkingDirectory=/srv",
      'Environment="LANG=C.UTF-8"',
      'ExecStart=/usr/bin/backup --to "/srv/backups dir" "100%%"',
      "",
    ].join("\n"),
  );
  assertEquals(
    content(p, 1),
    [
      "# The timer of the scheduled job org.example.backup, written by a program: it is replaced when the job is scheduled again.",
      "[Unit]",
      "Description=org.example.backup, every day at 06:10",
      "",
      "[Timer]",
      "OnCalendar=*-*-* 06:10:00",
      "Persistent=true",
      "",
      "[Install]",
      "WantedBy=timers.target",
      "",
    ].join("\n"),
  );
  assertEquals(p.install, [
    { argv: ["systemctl", "--user", "daemon-reload"], mayFail: false },
    { argv: ["systemctl", "--user", "enable", "--now", "org.example.backup.timer"], mayFail: false },
  ]);
  assertEquals(p.remove, [{ argv: ["systemctl", "--user", "disable", "--now", "org.example.backup.timer"], mayFail: true }]);
  assertEquals(p.afterRemove, [{ argv: ["systemctl", "--user", "daemon-reload"], mayFail: true }]);
});

proves([FR], "Linux: a weekly job with a log, a variable with a space and arguments that need escapes", () => {
  const p = plan(
    job({
      argv: ["/opt/my tool/run", "$HOME", `say "hi"`, "back\\slash", `a${TAB}b`, `x${SOH}`, ""],
      workdir: "/srv/data 100%",
      env: { GREETING: 'hello "world" 50%' },
      log: "/var/log/backup.log",
      when: when({ kind: "weekly", day: "fri", hour: 8, minute: 0 }),
    }),
    LINUX,
  );
  assertEquals(content(p, 0).split("\n").slice(5, 11), [
    "Type=oneshot",
    "WorkingDirectory=/srv/data 100%%",
    'Environment="GREETING=hello \\"world\\" 50%%"',
    'ExecStart="/opt/my tool/run" "$$HOME" "say \\"hi\\"" "back\\\\slash" "a\\tb" "x\\x01" ""',
    "StandardOutput=append:/var/log/backup.log",
    "StandardError=append:/var/log/backup.log",
  ]);
  assert(content(p, 1).includes("Description=org.example.backup, every Friday at 08:00\n"));
  assert(content(p, 1).includes("OnCalendar=Fri *-*-* 08:00:00\n"));
});

// ------------------------------------------------------------------------------------------------------------------------- macOS

const PLIST_HEAD = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
  '<plist version="1.0">',
  "  <dict>",
  "    <key>Label</key>",
  "    <string>org.example.backup</string>",
];

proves([FR], "macOS: a LaunchAgent every 20 minutes, exactly", () => {
  const p = plan(job({ when: when({ kind: "minutes", every: 20 }), log: "/Users/ada/Library/Logs/backup.log" }), DARWIN);
  assertEquals(p.label, "org.example.backup");
  assertEquals(p.description, "every 20 minutes");
  assertEquals(
    p.files.map((f) => [f.path, f.mode]),
    [["Library/LaunchAgents/org.example.backup.plist", 0o644]],
  );
  const minute = (m: number): string[] => ["      <dict>", "        <key>Minute</key>", `        <integer>${m}</integer>`, "      </dict>"];
  assertEquals(
    content(p, 0),
    [
      ...PLIST_HEAD,
      "    <key>ProgramArguments</key>",
      "    <array>",
      "      <string>/usr/bin/backup</string>",
      "      <string>--to</string>",
      "      <string>/srv/backups dir</string>",
      "      <string>100%</string>",
      "    </array>",
      "    <key>WorkingDirectory</key>",
      "    <string>/srv</string>",
      "    <key>EnvironmentVariables</key>",
      "    <dict>",
      "      <key>LANG</key>",
      "      <string>C.UTF-8</string>",
      "    </dict>",
      "    <key>StartCalendarInterval</key>",
      "    <array>",
      ...minute(0),
      ...minute(20),
      ...minute(40),
      "    </array>",
      "    <key>StandardOutPath</key>",
      "    <string>/Users/ada/Library/Logs/backup.log</string>",
      "    <key>StandardErrorPath</key>",
      "    <string>/Users/ada/Library/Logs/backup.log</string>",
      "    <key>ProcessType</key>",
      "    <string>Background</string>",
      "  </dict>",
      "</plist>",
      "",
    ].join("\n"),
  );
  assertEquals(p.install, [
    { argv: ["launchctl", "bootout", "gui/501/org.example.backup"], mayFail: true },
    { argv: ["launchctl", "bootstrap", "gui/501", "/Users/ada/Library/LaunchAgents/org.example.backup.plist"], mayFail: false },
  ]);
  assertEquals(p.remove, [{ argv: ["launchctl", "bootout", "gui/501/org.example.backup"], mayFail: true }]);
  assertEquals(p.afterRemove, []);
});

/** The plist's top dictionary as key and value pairs. */
function plistDict(xml: string): ReadonlyMap<string, XmlElement> {
  const doc = readXml(xml);
  if (doc.kind === "err") return fail(`the plist is not XML: ${doc.error.message}`);
  assertEquals(doc.value.name, "plist");
  const d = child(doc.value, "dict") ?? fail("no dict");
  const els = d.children.filter((c): c is XmlElement => c.kind === "element");
  const out = new Map<string, XmlElement>();
  for (let i = 0; i + 1 < els.length; i += 2) {
    const k = els[i];
    const v = els[i + 1];
    if (k === undefined || v === undefined || k.name !== "key") return fail("a dict is not key and value pairs");
    out.set(textOf(k), v);
  }
  return out;
}

proves([FR], "macOS: a weekly plist reads back with the XML reader, its markup escaped and its arguments whole", () => {
  const argv = ["/Applications/My App.app/Contents/MacOS/run", `a<b&c>"d'`, `two${LF}lines`, "", "é ünïcode"];
  const p = plan(job({ argv, env: {}, when: when({ kind: "weekly", day: "sun", hour: 7, minute: 5 }) }), DARWIN);
  assert(content(p, 0).startsWith(`${PLIST_HEAD.join("\n")}\n    <key>ProgramArguments</key>\n`));
  assert(content(p, 0).includes("<string>a&lt;b&amp;c&gt;&quot;d&apos;</string>"));
  const d = plistDict(content(p, 0));
  assertEquals([...d.keys()], ["Label", "ProgramArguments", "WorkingDirectory", "StartCalendarInterval", "ProcessType"]);
  assertEquals(textOf(d.get("Label")), "org.example.backup");
  const args = d.get("ProgramArguments") ?? fail("no ProgramArguments");
  assertEquals(
    children(args, "string").map((s) => textOf(s)),
    argv,
  );
  const cal = d.get("StartCalendarInterval") ?? fail("no StartCalendarInterval");
  assertEquals(intervalsOf(cal), [{ Minute: 5, Hour: 7, Weekday: 0 }]);
});

// ------------------------------------------------------------------------------------------------------------------------- Windows

proves([FR], "Windows: a .cmd file and a Task Scheduler task, exactly", () => {
  const p = plan(
    job({
      argv: ["C:\\Program Files\\Backup\\backup.exe", "--to", "D:\\backups dir\\", "100%", "a&b", "x^y!", "C:\\plain\\"],
      workdir: "C:\\work",
      log: "C:\\logs\\backup.log",
    }),
    WINDOWS,
  );
  assertEquals(p.label, "Example\\backup");
  assertEquals(
    p.files.map((f) => [f.path, f.mode]),
    [["AppData/Local/Example/backup.cmd", undefined]],
  );
  assertEquals(
    content(p, 0),
    [
      "@echo off",
      "rem The scheduled job Example\\backup, written by a program: it is replaced when the job is scheduled again.",
      "setlocal DisableDelayedExpansion",
      "chcp 65001 >nul",
      'cd /d "C:\\work" || exit /b 1',
      'set "LANG=C.UTF-8"',
      '"C:\\Program Files\\Backup\\backup.exe" --to "D:\\backups dir\\\\" "100%%" "a&b" "x^y!" C:\\plain\\ >> "C:\\logs\\backup.log" 2>&1',
      "exit /b %ERRORLEVEL%",
      "",
    ].join("\r\n"),
  );
  assertEquals(p.install, [
    {
      argv: [
        "schtasks",
        "/Create",
        "/F",
        "/TN",
        "Example\\backup",
        "/TR",
        '"C:\\Users\\ada\\AppData\\Local\\Example\\backup.cmd"',
        "/SC",
        "DAILY",
        "/ST",
        "06:10",
      ],
      mayFail: false,
    },
  ]);
  assert(!p.install.some((s) => s.argv.some((a) => /^\/(RP|RU)$/i.test(a))), "no stored password, no user");
  assertEquals(p.remove, [{ argv: ["schtasks", "/Delete", "/F", "/TN", "Example\\backup"], mayFail: true }]);
  assertEquals(p.afterRemove, []);
});

proves([FR], "Windows: an hourly job with no environment and no log", () => {
  const p = plan(job({ argv: ["C:\\bin\\tick.exe"], workdir: "C:\\", env: {}, when: when({ kind: "hourly", minute: 42 }) }), WINDOWS);
  assertEquals(content(p, 0).split("\r\n").slice(4, 7), ['cd /d "C:\\" || exit /b 1', "C:\\bin\\tick.exe", "exit /b %ERRORLEVEL%"]);
  assertEquals(p.install[0]?.argv.slice(7), ["/SC", "HOURLY", "/ST", "00:42"]);
});

// ------------------------------------------------------------------------------------------------------------------------- schedules

proves([FR], "every kind of schedule in words and in each scheduler's form", () => {
  const cases: readonly [When, string, string, readonly string[]][] = [
    [{ kind: "minutes", every: 1 }, "every minute", "*-*-* *:00/1:00", ["/SC", "MINUTE", "/MO", "1", "/ST", "00:00"]],
    [{ kind: "minutes", every: 15 }, "every 15 minutes", "*-*-* *:00/15:00", ["/SC", "MINUTE", "/MO", "15", "/ST", "00:00"]],
    [{ kind: "hourly", minute: 5 }, "every hour at minute 05", "*-*-* *:05:00", ["/SC", "HOURLY", "/ST", "00:05"]],
    [{ kind: "daily", hour: 23, minute: 59 }, "every day at 23:59", "*-*-* 23:59:00", ["/SC", "DAILY", "/ST", "23:59"]],
    [
      { kind: "weekly", day: "wed", hour: 0, minute: 0 },
      "every Wednesday at 00:00",
      "Wed *-*-* 00:00:00",
      ["/SC", "WEEKLY", "/D", "WED", "/ST", "00:00"],
    ],
    [
      { kind: "monthly", day: 3, hour: 5, minute: 0 },
      "on day 3 of every month at 05:00",
      "*-*-03 05:00:00",
      ["/SC", "MONTHLY", "/D", "3", "/ST", "05:00"],
    ],
  ];
  for (const [w, words, cal, sch] of cases) {
    const s = when(w);
    assertEquals(describeSchedule(s), words);
    assertEquals(onCalendar(s), cal);
    assertEquals(schtasksSchedule(s), sch);
  }
  assertEquals(calendarIntervals(when({ kind: "minutes", every: 30 })), [{ Minute: 0 }, { Minute: 30 }]);
  assertEquals(calendarIntervals(when({ kind: "monthly", day: 28, hour: 1, minute: 2 })), [{ Minute: 2, Hour: 1, Day: 28 }]);
});

proves([FR], "schedules out of range are refused", () => {
  const bad: readonly [When, string][] = [
    [{ kind: "minutes", every: 7 }, "when.every"],
    [{ kind: "minutes", every: 60 }, "when.every"],
    [{ kind: "hourly", minute: 60 }, "when.minute"],
    [{ kind: "hourly", minute: 1.5 }, "when.minute"],
    [{ kind: "daily", hour: 24, minute: 0 }, "when.hour"],
    [{ kind: "daily", hour: 1, minute: -1 }, "when.minute"],
    [{ kind: "weekly", day: "xyz" as Weekday, hour: 1, minute: 0 }, "when.day"],
    [{ kind: "monthly", day: 29, hour: 1, minute: 0 }, "when.day"],
    [{ kind: "monthly", day: 0, hour: 1, minute: 0 }, "when.day"],
  ];
  for (const [w, field] of bad) assertEquals(refusal(schedule(w)).field, field, JSON.stringify(w));
});

const DAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const hm = { hour: fc.integer({ min: 0, max: 23 }), minute: fc.integer({ min: 0, max: 59 }) };
const whenArb: fc.Arbitrary<When> = fc.oneof(
  fc.constantFrom(...MINUTE_STEPS).map((every): When => ({ kind: "minutes", every })),
  fc.integer({ min: 0, max: 59 }).map((minute): When => ({ kind: "hourly", minute })),
  fc.record(hm).map((r): When => ({ kind: "daily", ...r })),
  fc.record({ day: fc.constantFrom(...DAYS), ...hm }).map((r): When => ({ kind: "weekly", ...r })),
  fc.record({ day: fc.integer({ min: 1, max: 28 }), ...hm }).map((r): When => ({ kind: "monthly", ...r })),
);

const SYSTEMD_DAYS: Readonly<Record<string, Weekday>> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

/** A schedule read back from an `OnCalendar=` expression of the forms systemd.time(7) gives, checking every field is in range. */
function fromOnCalendar(expr: string): When | undefined {
  const m = /^(?:([A-Z][a-z]{2}) )?\*-\*-(\*|\d\d) (\*|\d\d):(?:(\d\d)|00\/(\d+)):00$/.exec(expr);
  if (m === null) return undefined;
  const [, wd, dd, hh, mm, step] = m;
  const n = (s: string | undefined, lo: number, hi: number): number | undefined => {
    const v = Number(s);
    return s !== undefined && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined;
  };
  if (step !== undefined) return wd === undefined && dd === "*" && hh === "*" ? { kind: "minutes", every: Number(step) } : undefined;
  const minute = n(mm, 0, 59);
  if (minute === undefined) return undefined;
  if (hh === "*") return wd === undefined && dd === "*" ? { kind: "hourly", minute } : undefined;
  const hour = n(hh, 0, 23);
  if (hour === undefined) return undefined;
  if (wd !== undefined) {
    const day = SYSTEMD_DAYS[wd];
    return day !== undefined && dd === "*" ? { kind: "weekly", day, hour, minute } : undefined;
  }
  if (dd !== "*") {
    const day = n(dd, 1, 31);
    return day === undefined ? undefined : { kind: "monthly", day, hour, minute };
  }
  return { kind: "daily", hour, minute };
}

type Interval = { Minute?: number; Hour?: number; Day?: number; Weekday?: number };

/** launchd's intervals as read from the plist: a dict, or an array of dicts, of integer values. */
function intervalsOf(e: XmlElement): Interval[] {
  const dicts = e.name === "array" ? children(e, "dict") : [e];
  return dicts.map((d) => {
    const els = d.children.filter((c): c is XmlElement => c.kind === "element");
    const out: Interval = {};
    for (let i = 0; i + 1 < els.length; i += 2) {
      const k = textOf(els[i]);
      const v = els[i + 1];
      if (v?.name !== "integer" || !/^\d+$/.test(textOf(v))) return fail(`${k} is not an integer`);
      if (k !== "Minute" && k !== "Hour" && k !== "Day" && k !== "Weekday") return fail(`${k} is not a calendar key`);
      out[k] = Number(textOf(v));
    }
    return out;
  });
}

const LAUNCHD_DAYS: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** A schedule read back from launchd's calendar intervals (each value in launchd's range). */
function fromIntervals(list: readonly Interval[]): When | undefined {
  const ok = (v: number | undefined, lo: number, hi: number): boolean => v === undefined || (v >= lo && v <= hi);
  if (!list.every((c) => ok(c.Minute, 0, 59) && ok(c.Hour, 0, 23) && ok(c.Day, 1, 31) && ok(c.Weekday, 0, 7))) return undefined;
  const [first, second] = list;
  if (first === undefined || first.Minute === undefined) return undefined;
  if (second !== undefined) {
    const every = second.Minute ?? 0;
    const same = list.every((c, i) => Object.keys(c).length === 1 && c.Minute === i * every);
    return same && every * list.length === 60 ? { kind: "minutes", every } : undefined;
  }
  const { Minute: minute, Hour: hour, Day: day, Weekday: wd } = first;
  if (hour === undefined) return day === undefined && wd === undefined ? { kind: "hourly", minute } : undefined;
  if (wd !== undefined) {
    const d = LAUNCHD_DAYS[wd % 7];
    return d === undefined || day !== undefined ? undefined : { kind: "weekly", day: d, hour, minute };
  }
  return day !== undefined ? { kind: "monthly", day, hour, minute } : { kind: "daily", hour, minute };
}

/** A schedule read back from schtasks' `/SC` arguments, checking each is one schtasks takes. */
function fromSchtasks(args: readonly string[]): When | undefined {
  const opt = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i < 0 ? undefined : args[i + 1];
  };
  const st = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(opt("/ST") ?? "");
  if (st === null) return undefined;
  const hour = Number(st[1]);
  const minute = Number(st[2]);
  const sc = opt("/SC") ?? "";
  switch (sc) {
    case "MINUTE": {
      const mo = Number(opt("/MO"));
      return Number.isInteger(mo) && mo >= 1 && mo <= 1439 && hour === 0 && minute === 0 ? { kind: "minutes", every: mo } : undefined;
    }
    case "HOURLY":
      return hour === 0 ? { kind: "hourly", minute } : undefined;
    case "DAILY":
      return { kind: "daily", hour, minute };
    case "WEEKLY": {
      const d = (opt("/D") ?? "").toLowerCase();
      const day = DAYS.find((x) => x === d);
      return day === undefined ? undefined : { kind: "weekly", day, hour, minute };
    }
    case "MONTHLY": {
      const day = Number(opt("/D"));
      return Number.isInteger(day) && day >= 1 && day <= 31 ? { kind: "monthly", day, hour, minute } : undefined;
    }
    default:
      return undefined;
  }
}

proves([FR, PROPERTY], "every schedule reads back the same from OnCalendar, the plist's StartCalendarInterval and schtasks", () => {
  fc.assert(
    fc.property(whenArb, (w) => {
      const s = when(w);
      assertEquals(fromOnCalendar(onCalendar(s)), w);
      assertEquals(fromSchtasks(schtasksSchedule(s)), w);
      const linux = plan(job({ when: s }), LINUX);
      assert(content(linux, 1).includes(`\nOnCalendar=${onCalendar(s)}\n`));
      const darwin = plan(job({ when: s }), DARWIN);
      const cal = plistDict(content(darwin, 0)).get("StartCalendarInterval") ?? fail("no StartCalendarInterval");
      assertEquals(fromIntervals(intervalsOf(cal)), w);
      const windows = plan(job({ when: s, argv: ["C:\\x.exe"], workdir: "C:\\" }), WINDOWS);
      assertEquals(windows.install[0]?.argv.slice(7), [...schtasksSchedule(s)]);
    }),
  );
});

// ------------------------------------------------------------------------------------------------------------------------- quoting

/** A reference reading of an `ExecStart=` value: `%%` specifiers, words split on blanks, double quotes with C escapes, then `$$`. */
function splitSystemd(line: string): string[] | undefined {
  let s = "";
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c !== "%") s += c;
    else if (line.charAt(i + 1) === "%") {
      s += "%";
      i++;
    } else return undefined;
  }
  const dollars = (w: string): string | undefined => {
    let out = "";
    for (let i = 0; i < w.length; i++) {
      if (w.charAt(i) !== "$") out += w.charAt(i);
      else if (w.charAt(i + 1) === "$") {
        out += "$";
        i++;
      } else return undefined;
    }
    return out;
  };
  const words: string[] = [];
  let i = 0;
  for (;;) {
    while (s.charAt(i) === " ") i++;
    if (i >= s.length) return words;
    let w = "";
    if (s.charAt(i) === '"') {
      i++;
      for (;;) {
        if (i >= s.length) return undefined;
        const c = s.charAt(i);
        if (c === '"') break;
        if (c !== "\\") {
          w += c;
          i++;
          continue;
        }
        const n = s.charAt(i + 1);
        if (n === "\\" || n === '"') {
          w += n;
          i += 2;
        } else if (n === "t") {
          w += TAB;
          i += 2;
        } else if (n === "x" && /^[0-9a-f]{2}$/.test(s.slice(i + 2, i + 4))) {
          w += String.fromCharCode(Number.parseInt(s.slice(i + 2, i + 4), 16));
          i += 4;
        } else return undefined;
      }
      i++;
      if (i < s.length && s.charAt(i) !== " ") return undefined;
    } else {
      while (i < s.length && s.charAt(i) !== " ") {
        const c = s.charAt(i);
        if (c === '"' || c === "'" || c === "\\" || c === TAB) return undefined;
        w += c;
        i++;
      }
    }
    const d = dollars(w);
    if (d === undefined) return undefined;
    words.push(d);
  }
}

/** A reference reading of a `.cmd` file's command line: `%%` (a batch file's escape), cmd.exe's specials only inside quotes, then the C runtime's argument rules (the program's name taken as written). */
function splitCmd(line: string): string[] | undefined {
  let s = "";
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c !== "%") s += c;
    else if (line.charAt(i + 1) === "%") {
      s += "%";
      i++;
    } else return undefined;
  }
  let quoted = false;
  for (const c of s) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && "&|<>^()".includes(c)) return undefined;
  }
  if (s.startsWith("@") || s.startsWith(":")) return undefined;
  const blank = (c: string): boolean => c === " " || c === TAB;
  const words: string[] = [];
  let i = 0;
  let program = "";
  if (s.charAt(0) === '"') {
    const end = s.indexOf('"', 1);
    if (end < 0) return undefined;
    program = s.slice(1, end);
    i = end + 1;
    if (i < s.length && !blank(s.charAt(i))) return undefined;
  } else {
    while (i < s.length && !blank(s.charAt(i))) program += s.charAt(i++);
  }
  words.push(program);
  for (;;) {
    while (blank(s.charAt(i))) i++;
    if (i >= s.length) return words;
    let w = "";
    let inQ = false;
    while (i < s.length && (inQ || !blank(s.charAt(i)))) {
      const c = s.charAt(i);
      if (c === "\\") {
        let n = 0;
        while (s.charAt(i + n) === "\\") n++;
        if (s.charAt(i + n) === '"') {
          w += "\\".repeat(Math.floor(n / 2));
          if (n % 2 === 1) w += '"';
          else inQ = !inQ;
          i += n + 1;
        } else {
          w += "\\".repeat(n);
          i += n;
        }
      } else if (c === '"') {
        inQ = !inQ;
        i++;
      } else {
        w += c;
        i++;
      }
    }
    if (inQ) return undefined;
    words.push(w);
  }
}

const UNITS = [
  "a",
  "Z",
  "0",
  " ",
  TAB,
  '"',
  "'",
  "\\",
  "%",
  "$",
  ";",
  "&",
  "|",
  "<",
  ">",
  "^",
  "(",
  ")",
  "!",
  "=",
  ",",
  "@",
  "-",
  ":",
  "/",
  ".",
  "é",
  "€",
  SOH,
  LF,
  CR,
];
const arg = fc.string({ unit: fc.constantFrom(...UNITS), maxLength: 8 });
const argvArb = fc.array(arg, { minLength: 1, maxLength: 5 });

const systemdCarries = (argv: readonly string[]): boolean =>
  argv.every((a) => !a.includes(NUL) && !a.includes(LF) && !a.includes(CR) && a !== ";") &&
  argv[0] !== undefined &&
  argv[0] !== "" &&
  !"@-:+!|".includes(argv[0].charAt(0));

const cmdCarries = (argv: readonly string[]): boolean =>
  argv.every((a) => !a.includes('"') && ![...a].some((c) => c.charCodeAt(0) < 32 && c !== TAB)) && argv[0] !== undefined && argv[0] !== "";

proves([FR, PROPERTY], "arguments quoted for systemd's ExecStart= split back to the same argument vector, or are refused", () => {
  fc.assert(
    fc.property(argvArb, (argv) => {
      const q = quoteSystemdArgs(argv);
      assertEquals(q.kind, systemdCarries(argv) ? "ok" : "err", JSON.stringify(argv));
      if (q.kind === "ok") assertEquals(splitSystemd(q.value), argv, q.value);
    }),
    { numRuns: 500 },
  );
});

proves([FR, PROPERTY], "arguments quoted for a .cmd file split back to the same argument vector, or are refused", () => {
  fc.assert(
    fc.property(argvArb, (argv) => {
      const q = quoteCmdArgs(argv);
      assertEquals(q.kind, cmdCarries(argv) ? "ok" : "err", JSON.stringify(argv));
      if (q.kind === "ok") assertEquals(splitCmd(q.value), argv, q.value);
    }),
    { numRuns: 500 },
  );
});

proves([FR], "what cannot be carried safely is refused, naming the field", () => {
  const cases: readonly [JobSpec, Target, string, ScheduleError["reason"]][] = [
    [job({ argv: ["/bin/x", `a${LF}b`] }), LINUX, "argv[1]", "unsafe"],
    [job({ argv: ["/bin/x", `a${CR}`] }), LINUX, "argv[1]", "unsafe"],
    [job({ argv: ["/bin/x", `a${NUL}`] }), LINUX, "argv[1]", "unsafe"],
    [job({ argv: ["/bin/x", ";"] }), LINUX, "argv[1]", "unsafe"],
    [job({ argv: ["-/bin/x"] }), LINUX, "argv[0]", "unsafe"],
    [job({ argv: [] }), LINUX, "argv", "invalid"],
    [job({ workdir: "srv" }), LINUX, "workdir", "invalid"],
    [job({ workdir: "/srv " }), LINUX, "workdir", "unsafe"],
    [job({ workdir: `/srv${LF}x` }), LINUX, "workdir", "unsafe"],
    [job({ env: { X: `a${LF}b` } }), LINUX, "env.X", "unsafe"],
    [job({ env: { "BAD-NAME": "x" } }), LINUX, "env.BAD-NAME", "invalid"],
    [job({ log: "relative.log" }), LINUX, "log", "invalid"],
    [job({ owner: { domain: "example", folder: "Example" } }), LINUX, "owner.domain", "invalid"],
    [job({ owner: { domain: "Org.Example", folder: "Example" } }), DARWIN, "owner.domain", "invalid"],
    [job({ owner: { domain: "org.example", folder: "a\\b" } }), WINDOWS, "owner.folder", "invalid"],
    [job(), { os: "darwin", home: "/Users/ada" }, "uid", "invalid"],
    [job({ argv: ["/bin/x", `a${CR}b`] }), DARWIN, "argv[1]", "unsafe"],
    [job({ argv: ["/bin/x", `a${SOH}b`] }), DARWIN, "argv[1]", "unsafe"],
    [job({ argv: ["/bin/x", ch(0xd800)] }), DARWIN, "argv[1]", "unsafe"],
    [job({ env: { X: `a${SOH}` } }), DARWIN, "env.X", "unsafe"],
    [job({ argv: ["C:\\x.exe", 'say "hi"'], workdir: "C:\\" }), WINDOWS, "argv[1]", "unsafe"],
    [job({ argv: ["C:\\x.exe", `a${LF}b`], workdir: "C:\\" }), WINDOWS, "argv[1]", "unsafe"],
    [job({ argv: ["C:\\x.exe"], workdir: "C:\\" }), { os: "windows", home: "C:\\Users\\100%" }, "home", "unsafe"],
    [job({ argv: ["C:\\x.exe"], workdir: "relative" }), WINDOWS, "workdir", "invalid"],
    [job({ argv: ["C:\\x.exe"], workdir: 'C:\\a"b' }), WINDOWS, "workdir", "unsafe"],
    [job({ argv: ["C:\\x.exe"], workdir: "C:\\", env: { X: 'a"b' } }), WINDOWS, "env.X", "unsafe"],
    [job({ argv: ["C:\\x.exe"], workdir: "C:\\", log: `C:\\a${CR}b` }), WINDOWS, "log", "unsafe"],
  ];
  for (const [j, t, field, reason] of cases) {
    const e = refusal(planJob(j, t));
    assertEquals([e.field, e.reason], [field, reason], `${t.os} ${JSON.stringify(j.argv)}: ${e.message}`);
    assertEquals(formatScheduleError(e), `${field}: ${e.message}`);
  }
  for (const bad of ["", "Backup", "-x", "x-", "a_b", "a.b", "a".repeat(65)]) assertEquals(refusal(jobName(bad)).field, "name", bad);
  assertEquals(value(jobName("a".repeat(64))), "a".repeat(64));
  assertEquals(value(jobName("db-backup-2")), "db-backup-2");
});
