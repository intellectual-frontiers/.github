// Spec: 0005-repoctl-library-commit-doctor FR-001
/**
 * `repoctl new library` and `repoctl commit` on Headless (commons repoctl 0005-repoctl-library-commit-doctor FR-001 to FR-007): the verbs that make something in the checkout. `new library <name>` scaffolds a library of commons (its manifest,
 * `about.ts`, specification kit, tools, configuration and `LICENSE`), refuses a name that is invalid, held for a family or in use, classifies the library for the README and makes the generated files that need it; `commit` makes the commit as
 * the repository's identity with its trailers, refusing what must not be committed and checking the generated files first.
 *
 * @example
 * ```ts
 * import { newLibraryVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof newLibraryVerb; // "function"
 * ```
 *
 * @module
 */
import { RESERVED, type Match } from "@intellectual-frontiers/libraries/family";
import { CO_AUTHOR_VARIABLE, parseIssueNumber, parseSessionUrl, parseSubject, SESSION_VARIABLE } from "@intellectual-frontiers/repoctl/governance";
import { acceptName, filesOf, findingsOfSync, finding, type Held, messageText, orderGenerators, ROLES, type Role, runCommit, runSync, withRole } from "@intellectual-frontiers/repoctl/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import { defineVerb, generatorsOf, outcomeOfDone, outcomeOfEnvironment, outcomeOfUsage } from "../define.ts";

const roleOf = (text: string): Role | undefined => ROLES.find((r) => r === text);

const heldOf = (): readonly Held[] =>
  RESERVED.map((r: { readonly match: Match; readonly host: string }): Held => ({ match: r.match.kind === "exact" ? { kind: "exact", name: r.match.name } : { kind: "prefix", prefix: r.match.prefix }, host: r.host }));

/** `repoctl new library <name>`. */
export const newLibraryVerb = defineVerb({
  name: "library",
  id: "new library",
  options: {
    summary: value<never>({ help: "What the library is, in a sentence or two: its first sentence is its row in the README.", valueName: "TEXT", required: true }),
    role: value<never>({ help: "Where the README puts it: foundation, pattern, program or standard.", valueName: "ROLE", default: "program" }),
  },
  operands: [{ name: "NAME", help: "The name of the library: lower-case letters, digits and hyphens, starting with a letter.", arity: "one" }],
  examples: [
    { args: ["widget", "--summary", "Widgets, made by the book."], says: "Scaffold the library widget in the libraries' folder with its manifest, spec kit, tools and LICENSE." },
    { args: ["widget", "--summary", "Widgets.", "--dry-run"], says: "List the files that would be made, and write nothing." },
  ],
  run: async (args, ctx, w, host) => {
    const settings = host.config.libraries;
    if (settings === undefined) return outcomeOfEnvironment("this repository's configuration has no libraries");
    const role = roleOf(args.options.role);
    if (role === undefined) return outcomeOfUsage(`${args.options.role} is not a role: ${ROLES.join(", ")}`, "E-USAGE", "repoctl new library --help");
    const existing = (await w.files.list(`${w.repo}/${settings.folder}`)).filter((n) => !n.includes("."));
    const name = acceptName(args.positionals[0] ?? "", heldOf(), existing, settings.folder);
    if (name.kind === "err") return outcomeOfDone({ data: null, text: name.error.message, findings: [finding("fail", name.error.code, name.error.message, "repoctl new library --help")] });
    const files = filesOf({ name: name.value, summary: args.options.summary, folder: settings.folder });
    if (ctx.mode !== "apply") return outcomeOfDone({ data: { library: name.value, files: files.map((f) => f.path) }, text: files.map((f) => `would write  ${f.path}`).join("\n"), findings: [], title: "Previewed" });
    for (const f of files) await w.files.write(`${w.repo}/${f.path}`, f.text);
    if (settings.roleFile !== undefined) {
      const readme = `${w.repo}/${settings.roleFile}`;
      const source = await w.files.read(readme);
      if (source === undefined) return outcomeOfEnvironment(`${settings.roleFile} is missing, so the library cannot be classified`);
      const classified = withRole(source, name.value, role);
      if (classified.kind === "err") return outcomeOfEnvironment(classified.error);
      await w.files.write(readme, classified.value);
    }
    if (settings.linker !== undefined) await w.process.run(settings.linker, { cwd: w.repo });
    const order = orderGenerators(generatorsOf(host));
    if (order.kind === "err") return outcomeOfEnvironment(`the table of generators waits for itself: ${order.error.join(", ")}`);
    const synced = await runSync(w, "write", order.value);
    return outcomeOfDone({
      data: { library: name.value, role, files: files.map((f) => f.path), sync: synced.outcomes.map((o) => ({ id: o.id, state: o.kind })) },
      text: [`made ${settings.folder}/${name.value} (${files.length} files, classified as ${role})`, ...synced.outcomes.filter((o) => o.kind === "regenerated").map((o) => `made ${o.id}`)].join("\n"),
      findings: findingsOfSync(synced),
      next: [`cd ${settings.folder}/${name.value} && bun run verify`, `repoctl check`],
      title: `Library ${name.value} made`,
    });
  },
});

/** `repoctl commit -m <subject>`. */
export const commitVerb = defineVerb({
  name: "commit",
  id: "commit",
  options: {
    message: value({ short: "m", help: "The subject of the commit: one line of at most 100 characters, with no full stop at its end.", valueName: "SUBJECT", required: true }),
    refs: value<never>({ help: "The issue the commit refers to: its number, written as the line `Refs #N`.", valueName: "N" }),
    session: value<never>({ help: `The address of the session, written as the line \`Claude-Session\` (else the variable ${SESSION_VARIABLE}).`, valueName: "URL" }),
    coAuthor: value<never>({ help: `The line that credits the agent (else the variable ${CO_AUTHOR_VARIABLE}, else the configuration's).`, valueName: "LINE" }),
  },
  operands: [{ name: "PATH", help: "Files to stage before the commit; the files already staged are committed in any case.", arity: "many" }],
  examples: [
    { args: ["-m", "Add the doctor", "--refs", "10"], says: "Commit what is staged, as the repository's identity, with the trailers its configuration lists (`Refs #10`, the co-author, the session)." },
    { args: ["-m", "Fix the merge", "--dry-run", "commons/repoctl/src"], says: "Show the message and the files, and commit nothing." },
  ],
  run: async (args, ctx, w, host) => {
    const subject = parseSubject(args.options.message);
    if (subject.kind === "err") return outcomeOfUsage(subject.error, "E-COMMIT-SUBJECT", "repoctl commit --help");
    const refs = args.options.refs === undefined ? undefined : parseIssueNumber(args.options.refs);
    if (refs?.kind === "err") return outcomeOfUsage(refs.error, "E-COMMIT-REFS", "repoctl commit --help");
    const policy = host.config.commit;
    if (policy.issue.required && refs === undefined) return outcomeOfUsage("this repository's commits refer to an issue: give --refs N", "E-COMMIT-REFS", "repoctl commit --help");
    const text = args.options.session ?? host.env(SESSION_VARIABLE) ?? "";
    const session = policy.trailers.includes("session") ? parseSessionUrl(text) : undefined;
    if (session?.kind === "err") return outcomeOfUsage(`the session address is missing or not valid: ${session.error}`, "E-COMMIT-SESSION", "repoctl commit --help");
    const coAuthor = policy.trailers.includes("co-author") ? (args.options.coAuthor ?? host.env(CO_AUTHOR_VARIABLE) ?? policy.coAuthor) : undefined;
    const order = orderGenerators(generatorsOf(host));
    if (order.kind === "err") return outcomeOfEnvironment(`the table of generators waits for itself: ${order.error.join(", ")}`);
    const report = await runCommit(w, { subject: subject.value, refs: refs?.value, session: session?.value, coAuthor, paths: args.positionals, dryRun: ctx.mode !== "apply" }, order.value, policy);
    switch (report.kind) {
      case "refused":
        return outcomeOfDone({ data: null, text: "the commit was refused", findings: report.findings });
      case "preview":
        return outcomeOfDone({ data: { message: report.message, files: report.files }, text: `${report.message}\n${report.files.map((f) => `  ${f}`).join("\n")}`, findings: [], title: "Previewed" });
      case "committed":
        return outcomeOfDone({ data: { sha: report.sha, files: report.files, message: report.message }, text: `${report.sha}  ${messageText({ subject: subject.value, trailers: [] }).trim()}\n${report.files.length} files`, findings: [], next: ["git push origin HEAD:main"], title: "Committed" });
      default:
        return outcomeOfDone({ data: null, text: "", findings: [] });
    }
  },
});
