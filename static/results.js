function drawResultsChart(results) {
  const width = 720;
  const height = 360;
  const margin = { left: 54, right: 18, top: 24, bottom: 64 };
  const yMax = results.check_bits || results.n_qubits / 2;
  const x = percent => margin.left + (percent / 100) * (width - margin.left - margin.right);
  const y = value => height - margin.bottom - (value / yMax) * (height - margin.top - margin.bottom);
  const line = key => results.rows
    .map(row => `${x(row.share_in_z * 100)},${y(row[key])}`)
    .join(" ");

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description">`;
  svg += `<title id="chart-title">Cheating-Bob experiment results</title>`;
  svg += `<desc id="chart-description">Average pad bits kept and proof mismatches increase as Bob measures more qubits in the Z basis.</desc>`;

  for (let tick = 0; tick <= yMax; tick += yMax / 4) {
    const tickY = y(tick);
    svg += `<line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${tickY}" y2="${tickY}" />`;
    svg += `<text x="${margin.left - 8}" y="${tickY + 4}" text-anchor="end">${Math.round(tick)}</text>`;
  }

  for (let percent = 0; percent <= 100; percent += 25) {
    const tickX = x(percent);
    svg += `<line class="axis-line" x1="${tickX}" x2="${tickX}" y1="${margin.top}" y2="${height - margin.bottom}" />`;
    svg += `<text x="${tickX}" y="${height - margin.bottom + 20}" text-anchor="middle">${percent}%</text>`;
  }

  svg += `<line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" />`;
  svg += `<line class="axis-line" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${height - margin.bottom}" />`;
  svg += `<polyline class="pad-bits" fill="none" stroke-width="3" points="${line("avg_pad_bits_kept")}" />`;
  svg += `<polyline class="proof-mismatches" fill="none" stroke-width="3" points="${line("avg_mismatches")}" />`;
  svg += `<text x="${(margin.left + width - margin.right) / 2}" y="${height - 12}" text-anchor="middle">Share of qubits measured in Z</text>`;
  svg += `<text x="${margin.left + 8}" y="${margin.top + 14}" class="pad-label">Blue: average pad bits kept</text>`;
  svg += `<text x="${margin.left + 8}" y="${margin.top + 31}" class="proof-label">Red: average proof mismatches</text>`;
  svg += "</svg>";
  return svg;
}

fetch("/static/results.json")
  .then(response => {
    if (!response.ok) throw new Error(`Could not load saved results (${response.status}).`);
    return response.json();
  })
  .then(results => {
    document.getElementById("results-chart").innerHTML = drawResultsChart(results);
    document.getElementById("results-caption").textContent =
      `Saved results from ${results.trials} trials per point, with ${results.n_qubits} qubits per trial.`;
  })
  .catch(error => {
    document.getElementById("results-caption").textContent = error.message;
  });
