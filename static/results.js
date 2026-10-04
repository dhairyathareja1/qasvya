fetch("/static/results.json")
  .then(response => {
    if (!response.ok) throw new Error(`Could not load saved results (${response.status}).`);
    return response.json();
  })
  .then(results => {
    document.getElementById("results-caption").textContent =
      `Average values from ${results.trials} trials per strategy, with ${results.n_qubits} qubits per trial.`;
  })
  .catch(error => {
    document.getElementById("results-caption").textContent = error.message;
  });
