/* Starts the run, fills in the live documentation, and wires the controls. */
(() => {
  const { suites, IS_FILE, FIXTURES } = window.Assurance;
  const params = new URLSearchParams(location.search);
  const filter = document.getElementById("as-filter");
  filter.value = params.get("suite") || "";
  if (IS_FILE) document.getElementById("as-banner").hidden = false;

  const guards = document.getElementById("as-guards");
  for (const group of ["Unit", "Integration"]) {
    const h = document.createElement("h3"); h.textContent = group; guards.append(h);
    const dl = document.createElement("dl");
    for (const suite of suites.filter((x) => x.group === group)) {
      const dt = document.createElement("dt"); dt.textContent = `${suite.name} (${suite.tests.length} tests${suite.needs === "http" ? ", needs http" : ""})`;
      const dd = document.createElement("dd"); dd.textContent = suite.description;
      dl.append(dt, dd);
    }
    guards.append(dl);
  }
  const links = document.getElementById("as-fixture-links");
  for (const path of FIXTURES) {
    const a = document.createElement("a");
    a.className = "as-link"; a.href = path.replace("assurance/", ""); a.textContent = path.split("/").pop();
    links.append(a);
  }

  const run = () => window.Assurance.runAll({ only: filter.value.trim() || undefined });
  document.getElementById("as-run").addEventListener("click", run);
  filter.addEventListener("change", run);
  if (!params.has("manual")) run();
})();
