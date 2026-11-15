// What a person sees, and the log that keeps it: colour and emoji only at a terminal (never with NO_COLOR), so a log or a pipe stays plain
// (009-machine-bootstrap FR-061 to FR-066).

const enc = new TextEncoder();
export type Stream = "out" | "err";
/** Where the screen's text goes: standard output and error, or, in a test, wherever the test puts it. */
export const screen: { write: (stream: Stream, text: string) => void } = {
  write(stream, text) {
    const f = stream === "out" ? Deno.stdout : Deno.stderr;
    const bytes = enc.encode(text);
    let n = 0;
    while (n < bytes.length) n += f.writeSync(bytes.subarray(n));
  },
};
export function write(stream: Stream, text: string): void {
  screen.write(stream, text);
}

const ESC = "\u001b";
// deno-lint-ignore no-control-regex
export const ansi = /\u001b\[[0-9;]*[A-Za-z]/g;
export const plain = (s: string): string => s.replace(ansi, "");

export type Look = { readonly colour: boolean; readonly utf: boolean; readonly tty: boolean; readonly cols: number };

export function lookOf(env: Readonly<Record<string, string>>): Look {
  const term = env.TERM ?? "dumb";
  const tty = Deno.stderr.isTerminal() && term !== "dumb";
  const colour = tty && (env.NO_COLOR ?? "") === "";
  const utf = /utf/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || "");
  let cols = 80;
  if (tty) {
    try {
      const w = Deno.consoleSize().columns;
      if (w >= 40) cols = w;
    } catch { /* not a console */ }
  }
  return { colour, utf, tty, cols };
}

export type Palette = {
  readonly b: string;
  readonly c: string;
  readonly g: string;
  readonly r: string;
  readonly y: string;
  readonly d: string;
  readonly z: string;
  readonly yb: string;
};
const paint = (on: boolean, code: string) => on ? `${ESC}[${code}m` : "";
export const paletteOf = (on: boolean): Palette => ({
  b: paint(on, "1"),
  c: paint(on, "1;36"),
  g: paint(on, "32"),
  r: paint(on, "31"),
  y: paint(on, "33"),
  d: paint(on, "2"),
  z: paint(on, "0"),
  yb: paint(on, "1;93"),
});

/** The emoji of each role, or plain words where the terminal has no UTF-8. */
export type Marks = Readonly<
  Record<
    | "tick"
    | "cross"
    | "warn"
    | "rocket"
    | "pkg"
    | "dl"
    | "list"
    | "rust"
    | "ok"
    | "stop"
    | "what"
    | "why"
    | "log"
    | "pack"
    | "help"
    | "key"
    | "dir"
    | "sync"
    | "next"
    | "retry"
    | "one"
    | "two"
    | "three"
    | "wait"
    | "radio",
    string
  >
>;
export const marksOf = (utf: boolean): Marks =>
  utf
    ? {
      tick: "✅",
      cross: "❌",
      warn: "⚠️ ",
      rocket: "🚀 ",
      pkg: "📦 ",
      dl: "📥 ",
      list: "📋 ",
      rust: "🦀 ",
      ok: "✅ ",
      stop: "🛑 ",
      what: "❓ ",
      why: "💬 ",
      log: "📄 ",
      pack: "🎁 ",
      help: "🤝 ",
      key: "🔐 ",
      dir: "📂 ",
      sync: "🔄 ",
      next: "👉 ",
      retry: "🔁 ",
      one: "1️⃣ ",
      two: "2️⃣ ",
      three: "3️⃣ ",
      wait: "⏳ ",
      radio: "📡 ",
    }
    : {
      tick: "ok",
      cross: "x",
      warn: "!",
      rocket: "",
      pkg: "",
      dl: "",
      list: "",
      rust: "",
      ok: "",
      stop: "",
      what: "",
      why: "",
      log: "",
      pack: "",
      help: "",
      key: "",
      dir: "",
      sync: "",
      next: "-> ",
      retry: "~ ",
      one: "",
      two: "",
      three: "",
      wait: "",
      radio: "",
    };
export const framesOf = (utf: boolean): readonly string[] => utf ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] : ["|", "/", "-", "\\"];

/** Every environment variable name (capitals with an underscore) in bright yellow where there is colour (FR-063). */
export function envColour(text: string, p: Palette): string {
  if (p.yb === "") return text;
  return text.replace(/(?<![A-Za-z0-9_-])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)/g, `${p.yb}$1${p.z}`);
}

/** At most n characters, the end shown as ... where it is cut, so a progress line never wraps. */
export const clip = (n: number, s: string): string => s.length > n ? `${s.slice(0, n - 1)}...` : s;

/** The log: every message and every step's output, one timestamped line each, without colour (FR-066). */
export class Log {
  #lines = 0;
  constructor(readonly path: string | null, readonly supportPath: string | null) {}
  get lines(): number {
    return this.#lines;
  }
  /** One timestamped line. */
  line(text: string): void {
    this.raw(`${new Date().toTimeString().slice(0, 8)} ${plain(text)}\n`);
  }
  /** Text as it is (a step's output). */
  raw(text: string): void {
    if (this.path === null || text === "") return;
    try {
      Deno.writeTextFileSync(this.path, plain(text), { append: true });
      this.#lines += (text.match(/\n/g) ?? []).length;
    } catch { /* a log that cannot be written changes nothing else */ }
  }
}

/** The screen: messages, phases (one line each when done), headings, and what a dry run would do. */
export class Ui {
  readonly p: Palette;
  readonly e: Marks;
  readonly frames: readonly string[];
  #phase = "";
  #phaseBad = false;
  constructor(readonly look: Look, readonly log: Log, readonly dry: boolean) {
    this.p = paletteOf(look.colour);
    this.e = marksOf(look.utf);
    this.frames = framesOf(look.utf);
  }
  say(text = ""): void {
    write("out", `${envColour(text, this.p)}\n`);
    this.log.line(text);
  }
  /** To standard error, as the stops and the warnings are. */
  sayErr(text = ""): void {
    write("err", `${envColour(text, this.p)}\n`);
    this.log.line(text);
  }
  warn(text: string): void {
    write("err", `${this.p.y}${this.e.warn}${this.p.z} ${envColour(text, this.p)}\n`);
    this.log.line(`WARNING: ${text}`);
  }
  would(text: string): void {
    write("out", `  ${this.p.d}would${this.p.z} ${text}\n`);
  }
  /** A group of steps, shown as one line when it is done (a tick, or a warning where something needs attention, FR-062). */
  phase(title: string): void {
    this.phaseClose();
    this.#phase = title;
    if (this.dry) write("out", `\n${this.p.b}${title}${this.p.z}\n`);
  }
  get currentPhase(): string {
    return this.#phase;
  }
  markBad(): void {
    this.#phaseBad = true;
  }
  phaseClose(): void {
    if (this.#phase === "") return;
    if (!this.dry) {
      const { y, g, z, d } = this.p;
      write("out", this.#phaseBad ? `${y}${this.e.warn}${z} ${this.#phase} ${d}(something needs attention, see below)${z}\n` : `${g}${this.e.tick}${z} ${this.#phase}\n`);
    }
    this.#phase = "";
    this.#phaseBad = false;
  }
  phaseDrop(): void {
    this.#phase = "";
    this.#phaseBad = false;
  }
  heading(text: string): void {
    this.phaseClose();
    write("out", `\n${this.p.b}${text}${this.p.z}\n`);
    this.log.line(text);
  }
}

/** A path in the home folder as a person reads it: ~/... */
export function shortPath(home: string, p: string): string {
  return p.startsWith(`${home}/`) ? `~/${p.slice(home.length + 1)}` : p;
}

/** What may never be written to a support file or sent: tokens and the values of settings that look secret. */
export function redact(text: string): string {
  return text
    .replace(/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "$1[removed]")
    .replace(/(ph[cx]_)[A-Za-z0-9_]+/g, "$1[removed]")
    .replace(/(token|password|secret|key)=[^ \n]+/gi, "$1=[removed]");
}
