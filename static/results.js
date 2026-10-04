// Issue 12: draw the cheater-experiment chart from static/results.json (plain SVG, no library)
function drawChart(d) {
  const W = 640, H = 300, m = { l: 46, r: 12, t: 14, b: 44 }, yMax = d.n_qubits / 2;   // 128
  const x = s => m.l + s * (W - m.l - m.r), y = v => H - m.b - (v / yMax) * (H - m.t - m.b);
  const line = (key, cls) =>
    `<polyline class="${cls}" fill="none" stroke-width="2.5" points="${d.rows.map(r => x(r.share_in_z) + "," + y(r[key])).join(" ")}"/>`;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cheater experiment results">`;
  for (const v of [0, 32, 64, 96, 128])
    s += `<line class="ax" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  for (const p of [0, 25, 50, 75, 100])
    s += `<text x="${x(p / 100)}" y="${H - m.b + 16}" text-anchor="middle">${p}%</text>`;
  s += line("avg_pad_bits_kept", "l2") + line("avg_mismatches", "l1");
  s += `<text x="${(W + m.l) / 2}" y="${H - 6}" text-anchor="middle">Share of qubits Bob measures to read the message</text>`;
  s += `<text x="${m.l + 8}" y="${m.t + 4}" class="l2" fill="var(--c2)">blue: pad bits Bob keeps (of 128)</text>`;
  s += `<text x="${m.l + 8}" y="${m.t + 20}" fill="var(--c1)">red: proof mismatches (of 128 check bits; 0 needed to pass)</text></svg>`;
  const p0 = d.rows.find(r => r.share_in_z === 0.1);
  s += `<p><small>${d.trials} trials per point. More reading means more mismatches. ` +
       (p0 ? `At 10% he keeps about ${p0.avg_pad_bits_kept.toFixed(0)} pad bits but fails the proof every time (pass rate ${(p0.pass_rate * 100).toFixed(0)}%).` : "") + `</small></p>`;
  return s;
}
fetch("/static/results.json").then(r => r.json()).then(d => { $("chart").innerHTML = drawChart(d); })
  .catch(() => { $("chart").textContent = "results.json not found. Run: python make_results.py"; });
