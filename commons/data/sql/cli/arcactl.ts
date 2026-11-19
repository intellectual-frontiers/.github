#!/usr/bin/env bun
// Spec: 0046-arcactl FR-001
/**
 * The program `arcactl`: it gives `main` the real arguments, environment and terminal, prints what it returns and exits with its code.
 *
 * @module
 */
import { main } from "./main.ts";
import { terminalPrompter } from "./prompt.ts";

const tty = process.stdin.isTTY === true && process.stdout.isTTY === true;
const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
};
const result = await main(process.argv.slice(2), { env: process.env, cwd: process.cwd(), tty, ...(tty ? { prompt: terminalPrompter() } : {}), stdin: readStdin });
if (result.out !== "") process.stdout.write(result.out);
if (result.err !== "") process.stderr.write(result.err);
process.exit(result.code);
