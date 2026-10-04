'use strict';
// An environment file in the syntax of os-release(5) and systemd's EnvironmentFile (0041-command-line FR-047):
// one KEY=value per line, the value optionally in single or double quotes, `#` starting a comment, no expansion and no
// line continuation.

function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    const q = value[0];
    if ((q === '"' || q === "'") && value.length >= 2 && value.endsWith(q)) {
      value = value.slice(1, -1);
      if (q === '"') value = value.replace(/\\(["\\])/g, '$1');
    }
    out[key] = value;
  }
  return out;
}

module.exports = { parseEnv };
