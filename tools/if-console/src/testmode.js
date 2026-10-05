'use strict';
// The one test hook (0043-if-console FR-033). A test running inside a real VS Code cannot press the button of a modal dialog or read a
// quick pick, so when VS Code runs this extension in its test mode (ExtensionMode.Test, which VS Code sets only for a host started
// with an extension test path, never for an installed extension) the extension publishes one object, under Symbol.for('if-console.test')
// on globalThis, through which a test
//   - queues the answer to the next decision modal (true gives the modal's one button; anything else refuses it; with nothing queued
//     the modal is refused), and reads what each modal would have shown;
//   - reads what the extension showed (the quick picks' items and the webviews' pages), in the order shown;
//   - reads a snapshot of what it holds: the repositories found, the views' entries and the MCP servers it would register.
// Outside test mode the object does not exist and every function here does nothing; the modal is VS Code's own. The hook answers no
// other prompt: quick picks and input boxes are driven by VS Code's own commands in the tests.
const vscode = require('vscode');

const KEY = Symbol.for('if-console.test');
let hook = null;

function active() { return hook !== null; }

function install(extensionContext, describe) {
  if (!extensionContext || extensionContext.extensionMode !== vscode.ExtensionMode.Test) return null;
  hook = { answers: [], shown: [], describe };
  globalThis[KEY] = hook;
  return hook;
}

function uninstall() {
  if (hook && globalThis[KEY] === hook) delete globalThis[KEY];
  hook = null;
}

// Record what was shown. Nothing happens outside test mode.
function note(kind, data) {
  if (hook) hook.shown.push({ kind, ...data });
}

// The answer to a decision modal: the label of the button the test pressed, or undefined.
function answerModal(shown, button) {
  if (!hook) return null;
  note('modal', shown);
  const answer = hook.answers.length ? hook.answers.shift() : false;
  return answer === true ? button : undefined;
}

module.exports = { KEY, active, install, uninstall, note, answerModal };
