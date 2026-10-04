// Issue 11: cheating Bob, Eve, and the key-leak button
$("f").oninput = e => { $("fv").textContent = e.target.value; };

async function leak() {
  if (!QR.y) return log("Recall first, then leak the key.");
  try {
    const r = await api("/release", { id: QR.pkg.id });
    log("[Leak] The key (basis list) is now public.");
    const d = await decryptWith(QR.y, r.theta);          // best Bob can do: his recall data + the key
    log(`[Bob] Tried to decrypt with his recall data and the leaked key: ${d.ok ? "SUCCESS (bug!)" : "FAILED"}. ` +
        `Guessed key matches the real key on ${(d.key_agreement * 100).toFixed(0)}% of bits (50% = pure guessing).`);
  } catch (e) { fail(e); }
}
async function cheat() {
  if (!needMsg()) return;
  try {
    const f = $("f").value / 100;
    const m = await api("/measure", { id: QR.pkg.id, bases: makeBases(QR.pkg.n, f) });
    const v = await api("/verify", { id: QR.pkg.id, y: m.bits });
    log(`[Cheating Bob] Kept about ${Math.round(f * 100)}% of the qubits for reading. ` +
        `Proof mismatches: ${v.mismatches}/${v.checked} -> ${v.ok ? "passed (lucky!)" : "REJECTED"}`);
  } catch (e) { fail(e); }
}
async function eve() {
  if (!needMsg()) return;
  try {
    const m = await api("/measure", { id: QR.pkg.id, bases: makeBases(QR.pkg.n, 0.5) });
    const d = await decryptWith(m.bits, makeBases(QR.pkg.n, 0.5));   // Eve guesses the key bases
    log(`[Eve] Guessed the bases without the key: ${d.ok ? "read it (bug!)" : "FAILED to decrypt"} ` +
        `(key match ${(d.key_agreement * 100).toFixed(0)}%)`);
  } catch (e) { fail(e); }
}
$("btn-leak").onclick = leak; $("btn-cheat").onclick = cheat; $("btn-eve").onclick = eve;
