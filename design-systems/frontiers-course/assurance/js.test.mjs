#!/usr/bin/env node
/*
 * frontiers-course's script tests (spec FR-015, FR-016), run by assurance/run.py: quiz.js grades every item of the
 * model given on stdin right and wrong as its key says, and cmi5.js, launched against a mock LMS, sends the
 * statements cmi5 requires in the order it requires them. Prints one JSON line: {passed, failed: [..]}.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const model = JSON.parse(fs.readFileSync(0, "utf8"));
let passed = 0;
const failed = [];
const check = (ok, what) => { if (ok) passed++; else failed.push(what); };

function load(file, extra = {}) {
  const ctx = vm.createContext({ console, URL, URLSearchParams, JSON, Math, Date, Promise, ...extra });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(web, file), "utf8"), ctx);
  return ctx;
}

// quiz.js
const quiz = load("quiz.js").courseQuiz;
for (const unit of model.units) {
  for (const step of unit.steps.filter((s) => s.kind === "assessment")) {
    for (const item of step.items) {
      const key = { type: item.type };
      for (const k of ["answer", "tolerance", "answers", "feedback"]) if (k in item) key[k] = item[k];
      if (item.choices) key.choices = item.choices.map((c) => ({ correct: c.correct, feedback: c.feedback }));
      let right, wrong;
      if (item.choices) {
        right = item.choices.map((c, i) => (c.correct ? i : -1)).filter((i) => i >= 0).reverse().map(String);
        wrong = [String(item.choices.findIndex((c) => !c.correct))];
      } else if (item.type === "numeric") {
        right = String(item.answer);
        wrong = String(item.answer * 10 + 1);
      } else {
        right = `  ${item.answers[item.answers.length - 1].toUpperCase()} `;
        wrong = "not an answer";
      }
      const r = quiz.grade(key, right), w = quiz.grade(key, wrong);
      check(r.correct === true, `quiz.js marks the right answer to ${item.id} wrong`);
      check(w.correct === false, `quiz.js marks a wrong answer to ${item.id} right`);
      check(typeof r.feedback === "string" && r.feedback.length > 0, `quiz.js gives no feedback for ${item.id}`);
      if (item.type === "multiple-response") {
        check(quiz.grade(key, right.slice(0, 1)).correct === false, `quiz.js accepts part of the answer to ${item.id}`);
      }
      if (item.type === "numeric" && item.tolerance) {
        const t = item.tolerance.endsWith("%") ? Math.abs(item.answer) * parseFloat(item.tolerance) / 100 : parseFloat(item.tolerance);
        check(quiz.grade(key, String(item.answer + t * 0.99)).correct, `quiz.js refuses ${item.id} within its tolerance`);
        check(!quiz.grade(key, String(item.answer + t * 1.01)).correct, `quiz.js accepts ${item.id} outside its tolerance`);
      }
    }
  }
}

// cmi5.js, against a mock LMS
const CMI5 = "https://w3id.org/xapi/cmi5/context/categories/cmi5";
const MOVEON = "https://w3id.org/xapi/cmi5/context/categories/moveon";
async function launch({ step, graded = false, mode = "Normal", score, params = true, mastery = 0.8 }) {
  const sent = [];
  const listeners = {};
  let leave;
  const doc = {
    body: { getAttribute: (n) => ({ "data-step": step, "data-graded": String(graded), "data-mastery": "0.8" })[n] },
    addEventListener: (type, fn) => { listeners[type] = fn; }
  };
  const fetch = async (url, init = {}) => {
    if (url.startsWith("https://lms.test/fetch")) return { json: async () => ({ "auth-token": "dG9rZW4=" }) };
    if (url.includes("activities/state")) {
      const u = new URL(url);
      check(u.searchParams.get("stateId") === "LMS.LaunchData" && u.searchParams.get("registration") === "reg-1", "cmi5.js asks for the wrong state");
      return { json: async () => ({ launchMode: mode, masteryScore: mastery, moveOn: graded ? "Passed" : "Completed",
        contextTemplate: { extensions: { "https://w3id.org/xapi/cmi5/context/extensions/sessionid": "s-1" }, contextActivities: { grouping: [{ id: "https://x.test/au" }] } } }) };
    }
    if (url === "https://lms.test/xapi/statements") {
      check(init.headers.Authorization === "Basic dG9rZW4=" && init.headers["X-Experience-API-Version"] === "1.0.3", "cmi5.js sends a statement without its auth or version");
      sent.push(JSON.parse(init.body));
      return { ok: true };
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const ctx = load("cmi5.js");
  const actor = JSON.stringify({ objectType: "Agent", account: { homePage: "https://lms.test", name: "learner" } });
  const q = params ? `?endpoint=${encodeURIComponent("https://lms.test/xapi")}&fetch=${encodeURIComponent("https://lms.test/fetch?k=1")}&actor=${encodeURIComponent(actor)}&registration=reg-1&activityId=${encodeURIComponent("https://x.test/au")}` : "";
  let n = 0, t = 1000;
  const result = await ctx.courseCmi5.start({ href: `https://cdn.test/au.html${q}`, fetch, doc, now: () => (t += 500), uuid: () => `id-${++n}`, onLeave: (fn) => { leave = fn; } });
  if (score !== undefined && listeners["course:scored"]) listeners["course:scored"]({ detail: { scaled: score } });
  await new Promise((r) => setTimeout(r, 0));
  if (leave) { leave(); leave(); }
  await new Promise((r) => setTimeout(r, 0));
  return { result, sent, verbs: sent.map((s) => s.verb.display["en-US"]) };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let r = await launch({ step: "lesson", params: false });
check(r.result === null && r.sent.length === 0, "cmi5.js acts on a page opened without cmi5's launch parameters");
r = await launch({ step: "lesson" });
check(same(r.verbs, ["initialized", "completed", "terminated"]), `a lesson sends ${r.verbs}, not initialized, completed, terminated`);
const s0 = r.sent[0];
check(s0.context.registration === "reg-1" && s0.context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"] === "s-1",
  "cmi5.js drops the registration or the session id from LMS.LaunchData's context template");
check(s0.context.contextActivities.category.some((c) => c.id === CMI5) && s0.context.contextActivities.grouping[0].id === "https://x.test/au",
  "cmi5.js leaves out the cmi5 category or the template's grouping");
check(!s0.context.contextActivities.category.some((c) => c.id === MOVEON), "initialized carries the moveOn category");
check(r.sent[1].context.contextActivities.category.some((c) => c.id === MOVEON) && r.sent[1].result.completion === true && /^PT[\d.]+S$/.test(r.sent[1].result.duration),
  "completed lacks the moveOn category, completion or duration");
check(r.sent.every((s) => s.object.id === "https://x.test/au" && s.actor.account.name === "learner"), "a statement names the wrong activity or actor");
check(/^PT[\d.]+S$/.test(r.sent[2].result.duration), "terminated has no duration");
r = await launch({ step: "assessment", graded: true, score: 1 });
check(same(r.verbs, ["initialized", "passed", "terminated"]), `a passed graded assessment sends ${r.verbs}`);
check(r.sent[1].result.score.scaled === 1 && r.sent[1].result.success === true &&
  r.sent[1].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/masteryscore"] === 0.8, "passed lacks its score, success or mastery score");
r = await launch({ step: "assessment", graded: true, score: 0.5 });
check(same(r.verbs, ["initialized", "failed", "terminated"]), `a failed graded assessment sends ${r.verbs}`);
r = await launch({ step: "assessment", graded: true, score: 0.7, mastery: 0.6 });
check(same(r.verbs, ["initialized", "passed", "terminated"]), "cmi5.js ignores the LMS's mastery score");
r = await launch({ step: "assessment", graded: false, score: 0.5 });
check(same(r.verbs, ["initialized", "completed", "terminated"]), `a practice assessment sends ${r.verbs}`);
r = await launch({ step: "lesson", mode: "Browse" });
check(same(r.verbs, ["initialized", "terminated"]), `a lesson in Browse mode sends ${r.verbs}`);

console.log(JSON.stringify({ passed, failed }));
