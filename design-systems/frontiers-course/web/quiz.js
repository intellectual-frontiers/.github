// frontiers-course's in-browser grading (spec FR-015). Each .item fieldset carries its key in data-key; grade() is
// pure so the harness can test it without a browser. When every item on the page has been checked, the page fires
// "course:scored" with the scaled score, which cmi5.js reports when the page was launched by an LMS.
(function (root) {
  "use strict";

  function norm(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function within(value, answer, tolerance) {
    if (!tolerance) return value === answer;
    var t = String(tolerance);
    var d = t.endsWith("%") ? Math.abs(answer) * parseFloat(t) / 100 : parseFloat(t);
    return Math.abs(value - answer) <= d + 1e-9;
  }

  // key: {type, choices: [{correct, feedback}], answer, tolerance, answers, feedback}
  // response: an array of chosen indices for a choice item, a string otherwise.
  function grade(key, response) {
    if (key.type === "multiple-choice" || key.type === "multiple-response") {
      var chosen = (response || []).map(Number).sort(function (a, b) { return a - b; });
      var right = key.choices.map(function (c, i) { return c.correct ? i : -1; }).filter(function (i) { return i >= 0; });
      var correct = chosen.length === right.length && chosen.every(function (v, i) { return v === right[i]; });
      var feedback = chosen.map(function (i) { return key.choices[i].feedback; }).join(" ");
      return { correct: correct, feedback: feedback };
    }
    if (key.type === "numeric") {
      var v = parseFloat(String(response).replace(/,/g, ""));
      var ok = !isNaN(v) && within(v, key.answer, key.tolerance);
      return { correct: ok, feedback: ok ? key.feedback : "Not quite: check your working and try again." };
    }
    var hit = key.answers.some(function (a) { return norm(a) === norm(response); });
    return { correct: hit, feedback: hit ? key.feedback : "Not quite: check your spelling and try again." };
  }

  function wire(doc) {
    var items = Array.prototype.slice.call(doc.querySelectorAll("fieldset.item"));
    if (!items.length) return;
    var results = {};
    var score = doc.querySelector(".score");
    items.forEach(function (el) {
      var key = JSON.parse(el.getAttribute("data-key"));
      var out = el.querySelector(".feedback");
      el.querySelector("button").addEventListener("click", function () {
        var response;
        if (key.choices) {
          response = Array.prototype.slice.call(el.querySelectorAll("input:checked")).map(function (i) { return i.value; });
        } else {
          response = el.querySelector("input").value;
        }
        var r = grade(key, response);
        results[el.id] = r.correct;
        out.textContent = (r.correct ? "Correct. " : "Incorrect. ") + r.feedback;
        out.setAttribute("data-result", r.correct ? "correct" : "incorrect");
        var done = Object.keys(results).length;
        var right = Object.keys(results).filter(function (k) { return results[k]; }).length;
        if (score) score.textContent = right + " of " + items.length + " correct" + (done < items.length ? ", " + (items.length - done) + " to go" : "") + ".";
        if (done === items.length) {
          doc.dispatchEvent(new CustomEvent("course:scored", { detail: { scaled: right / items.length } }));
        }
      });
    });
  }

  root.courseQuiz = { grade: grade, wire: wire };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { wire(document); });
    else wire(document);
  }
})(typeof window !== "undefined" ? window : globalThis);
