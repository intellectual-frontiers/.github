// frontiers-course's cmi5 runtime (spec FR-016): when an LMS launches a page with cmi5's launch parameters, it fetches
// the auth token and LMS.LaunchData, sends "initialized", then "completed" for a lesson or "passed"/"failed" (and
// "completed" for practice) for an assessment once quiz.js scores it, and "terminated" when the page is left. A page
// opened without cmi5's parameters does nothing. start() takes its environment so the harness can run it in Node.
(function (root) {
  "use strict";

  var CMI5 = "https://w3id.org/xapi/cmi5/context/categories/cmi5";
  var MOVEON = "https://w3id.org/xapi/cmi5/context/categories/moveon";
  var MASTERY = "https://w3id.org/xapi/cmi5/context/extensions/masteryscore";
  var VERBS = {
    initialized: "http://adlnet.gov/expapi/verbs/initialized",
    completed: "http://adlnet.gov/expapi/verbs/completed",
    passed: "http://adlnet.gov/expapi/verbs/passed",
    failed: "http://adlnet.gov/expapi/verbs/failed",
    terminated: "http://adlnet.gov/expapi/verbs/terminated"
  };

  function duration(ms) {
    return "PT" + (Math.round(ms / 10) / 100).toFixed(2) + "S";
  }

  function start(env) {
    var url = new URL(env.href);
    var q = url.searchParams;
    var endpoint = q.get("endpoint"), fetchUrl = q.get("fetch"), actor = q.get("actor");
    var registration = q.get("registration"), activityId = q.get("activityId");
    if (!endpoint || !fetchUrl || !actor || !registration || !activityId) return Promise.resolve(null);
    if (!endpoint.endsWith("/")) endpoint += "/";
    var fetch = env.fetch, began = env.now(), token, launch, ended = false, finished = false;
    actor = JSON.parse(actor);

    function headers() {
      return { "Authorization": "Basic " + token, "X-Experience-API-Version": "1.0.3", "Content-Type": "application/json" };
    }

    function send(verb, result, moveOn) {
      var context = JSON.parse(JSON.stringify(launch.contextTemplate || {}));
      context.registration = registration;
      context.contextActivities = context.contextActivities || {};
      var category = [{ id: CMI5 }];
      if (moveOn) category.push({ id: MOVEON });
      context.contextActivities.category = (context.contextActivities.category || []).concat(category);
      if ((verb === "passed" || verb === "failed") && launch.masteryScore !== undefined) {
        context.extensions = context.extensions || {};
        context.extensions[MASTERY] = launch.masteryScore;
      }
      var statement = {
        id: env.uuid(), timestamp: new Date(env.now()).toISOString(), actor: actor,
        verb: { id: VERBS[verb], display: { "en-US": verb } },
        object: { id: activityId, objectType: "Activity" }, context: context
      };
      if (result) statement.result = result;
      return fetch(endpoint + "statements", { method: "POST", headers: headers(), body: JSON.stringify(statement), keepalive: verb === "terminated" });
    }

    var stateUrl = endpoint + "activities/state?stateId=LMS.LaunchData&activityId=" + encodeURIComponent(activityId) +
      "&agent=" + encodeURIComponent(JSON.stringify(actor)) + "&registration=" + encodeURIComponent(registration);

    return fetch(fetchUrl, { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        token = body["auth-token"];
        return fetch(stateUrl, { headers: headers() });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        launch = data;
        return send("initialized");
      })
      .then(function () {
        var normal = (launch.launchMode || "Normal") === "Normal";
        var step = env.doc.body.getAttribute("data-step");
        var graded = env.doc.body.getAttribute("data-graded") === "true";
        var mastery = launch.masteryScore !== undefined ? launch.masteryScore : parseFloat(env.doc.body.getAttribute("data-mastery"));
        var done = Promise.resolve();
        if (normal && step === "lesson") {
          finished = true;
          done = send("completed", { completion: true, duration: duration(env.now() - began) }, true);
        }
        if (normal && step === "assessment") {
          env.doc.addEventListener("course:scored", function (e) {
            if (finished) return;
            finished = true;
            var scaled = e.detail.scaled;
            var d = duration(env.now() - began);
            if (graded) {
              var ok = scaled >= mastery;
              send(ok ? "passed" : "failed", { score: { scaled: scaled }, success: ok, duration: d }, true);
            } else {
              send("completed", { completion: true, duration: d }, true);
            }
          });
        }
        env.onLeave(function () {
          if (ended) return;
          ended = true;
          send("terminated", { duration: duration(env.now() - began) });
        });
        return done;
      })
      .then(function () {
        return { launch: launch, terminate: function () { return send("terminated", { duration: duration(env.now() - began) }); } };
      });
  }

  root.courseCmi5 = { start: start };
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    start({
      href: window.location.href, fetch: window.fetch.bind(window), doc: document, now: Date.now,
      uuid: function () { return crypto.randomUUID(); },
      onLeave: function (fn) { window.addEventListener("pagehide", fn); }
    }).catch(function (e) { console.error("cmi5:", e); });
  }
})(typeof window !== "undefined" ? window : globalThis);
