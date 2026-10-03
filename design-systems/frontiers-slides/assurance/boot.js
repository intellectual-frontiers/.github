/* Starts the run. */
(() => {
  if (window.Assurance.IS_FILE) document.getElementById("as-banner").hidden = false;
  const only = new URLSearchParams(location.search).get("suite") || undefined;
  window.Assurance.runAll({ only });
})();
