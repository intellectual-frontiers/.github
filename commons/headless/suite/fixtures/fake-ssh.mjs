#!/usr/bin/env node
// A stand-in for the OpenSSH client of the tests: it prints what it was given (the options, the destination and the one remote command) as the first line of its output, and then
// answers each line of its standard input upper-cased, until the input ends. It never connects anywhere.
import process from "node:process";

const args = process.argv.slice(2);
const dash = args.indexOf("--");
const report = { options: args.slice(0, dash < 0 ? args.length : dash), after: dash < 0 ? [] : args.slice(dash + 1) };
process.stdout.write(`${JSON.stringify(report)}\n`);
let pending = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  pending += chunk;
  let i;
  while ((i = pending.indexOf("\n")) >= 0) {
    process.stdout.write(`${pending.slice(0, i).toUpperCase()}\n`);
    pending = pending.slice(i + 1);
  }
});
process.stdin.on("end", () => process.exit(process.env.FAKE_SSH_EXIT === undefined ? 0 : Number(process.env.FAKE_SSH_EXIT)));
