// Issue 13: status badge + highlight the current "Try it" step. Polls GET /state/{id}.
function setStep(n) { [...$("guide").children].forEach((li, i) => li.classList.toggle("now", i === n)); }
async function refresh() {
  if (!QR.pkg) { $("badge").textContent = "NO MESSAGE"; $("badge").className = "badge"; return setStep(0); }
  try {
    const s = (await api("/state/" + QR.pkg.id, null, "GET")).state;
    $("badge").textContent = s; $("badge").className = "badge " + s;
    setStep({ LOCKED: 1, DELETED: 2, UNLOCKED: 3 }[s]);
  } catch (e) { /* ignore: server restarted or id unknown */ }
}
setInterval(refresh, 1000); refresh();
