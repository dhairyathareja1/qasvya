const state = { message: null, recallBits: null, status: null, statusPolling: false };
const $ = id => document.getElementById(id);

function log(message) {
  const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
  const activity = $("log");
  activity.textContent += `\n${entry}`;
  activity.scrollTop = activity.scrollHeight;
}

function setStatusBadge(status, announceChange = false) {
  if (!["LOCKED", "DELETED", "UNLOCKED"].includes(status)) return;

  const changed = state.status !== status;
  state.status = status;
  const badge = $("status-badge");
  badge.textContent = status;
  badge.className = `status-badge ${status.toLowerCase()}`;
  badge.hidden = false;
  if (changed && announceChange) log(`Message state changed to ${status}.`);
}

async function refreshMessageState() {
  const id = state.message && state.message.id;
  if (!id || state.statusPolling) return;

  state.statusPolling = true;
  try {
    const response = await fetch(`/state/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) return;

    const result = await response.json();
    if (state.message && state.message.id === id) setStatusBadge(result.state, true);
  } catch {
    // Keep showing the latest known state while the status endpoint is unavailable.
  } finally {
    state.statusPolling = false;
  }
}

async function request(path, body) {
  log(`Request ${path}: ${JSON.stringify(body)}`);

  let response;
  let responseText;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    responseText = await response.text();
  } catch (error) {
    log(`Network error for ${path}: ${error.message}`);
    throw error;
  }

  let result;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    result = responseText;
  }

  log(`Response ${path} (${response.status}): ${JSON.stringify(result)}`);
  if (!response.ok) {
    const detail = result && typeof result === "object" ? result.detail : result;
    throw new Error(detail || `Request failed with status ${response.status}`);
  }
  return result;
}

function requireMessage() {
  if (state.message) return true;
  log("Action could not run: send a message first.");
  return false;
}

async function send() {
  log("Action: Send");
  try {
    const message = await request("/send", { message: $("msg").value });
    state.message = message;
    state.recallBits = null;
    setStatusBadge("LOCKED");
    $("message-state").textContent = `Message ${message.id} sent and locked (${message.n} qubits).`;
    log(`Send completed for message ${message.id}.`);
    refreshMessageState();
  } catch (error) {
    log(`Send failed: ${error.message}`);
  }
}

async function recall() {
  log("Action: Recall");
  if (!requireMessage()) return;

  try {
    const bases = Array(state.message.n).fill(1);
    const measurement = await request("/measure", {
      id: state.message.id,
      bases
    });
    state.recallBits = measurement.bits;
    const proof = await request("/verify", {
      id: state.message.id,
      y: measurement.bits
    });
    const outcome = proof.ok ? "Recall proof accepted; message deleted." : "Recall proof rejected.";
    $("message-state").textContent = outcome;
    log(`Recall completed: ${outcome} Mismatches: ${proof.mismatches}; checked: ${proof.checked}.`);
  } catch (error) {
    log(`Recall failed: ${error.message}`);
  }
}

async function unlock() {
  log("Action: Unlock");
  if (!requireMessage()) return;

  try {
    const released = await request("/release", { id: state.message.id });
    const measurement = await request("/measure", {
      id: state.message.id,
      bases: released.theta
    });
    const decrypted = await request("/decrypt", {
      id: state.message.id,
      bits: measurement.bits,
      theta: released.theta,
      nonce: state.message.nonce,
      blob: state.message.blob
    });
    const outcome = decrypted.ok ? `Message unlocked: ${decrypted.text}` : "Message could not be decrypted.";
    $("message-state").textContent = outcome;
    log(`Unlock completed: ${outcome}`);
  } catch (error) {
    log(`Unlock failed: ${error.message}`);
  }
}

function randomBases(n, shareZ) {
  return Array.from({ length: n }, () => Math.random() < shareZ ? 0 : 1);
}

async function cheat() {
  log("Action: Cheating Bob");
  if (!requireMessage()) return;

  try {
    const share = Number($("cheat-share").value) / 100;
    const measurement = await request("/measure", {
      id: state.message.id,
      bases: randomBases(state.message.n, share)
    });
    const proof = await request("/verify", {
      id: state.message.id,
      y: measurement.bits
    });
    const outcome = proof.ok ? "proof accepted" : "proof rejected";
    log(`Cheating Bob kept about ${Math.round(share * 100)}% of qubits for reading; ${outcome}. ` +
      `Mismatches: ${proof.mismatches}; checked: ${proof.checked}.`);
  } catch (error) {
    log(`Cheating Bob demo failed: ${error.message}`);
  }
}

async function eve() {
  log("Action: Eve's measurement");
  if (!requireMessage()) return;

  try {
    const measurement = await request("/measure", {
      id: state.message.id,
      bases: randomBases(state.message.n, 0.5)
    });
    const guessedTheta = randomBases(state.message.n, 0.5);
    const result = await request("/decrypt", {
      id: state.message.id,
      bits: measurement.bits,
      theta: guessedTheta,
      nonce: state.message.nonce,
      blob: state.message.blob
    });
    log(result.ok
      ? `Eve guessed enough to decrypt the message: ${result.text}`
      : `Eve could not decrypt the message. Key agreement: ${(result.key_agreement * 100).toFixed(0)}%.`);
  } catch (error) {
    log(`Eve demo failed: ${error.message}`);
  }
}

async function leakKey() {
  log("Action: Leak key after recall");
  if (!requireMessage()) return;
  if (!state.recallBits) {
    log("Key leak could not run: recall the message first.");
    return;
  }

  try {
    const released = await request("/release", { id: state.message.id });
    const result = await request("/decrypt", {
      id: state.message.id,
      bits: state.recallBits,
      theta: released.theta,
      nonce: state.message.nonce,
      blob: state.message.blob
    });
    log(result.ok
      ? `After the key leak, the message decrypted: ${result.text}`
      : `After the key leak, the recall data still could not decrypt the message. ` +
        `Key agreement: ${(result.key_agreement * 100).toFixed(0)}%.`);
  } catch (error) {
    log(`Key leak demo failed: ${error.message}`);
  }
}

$("btn-send").addEventListener("click", send);
$("btn-recall").addEventListener("click", recall);
$("btn-unlock").addEventListener("click", unlock);
$("cheat-share").addEventListener("input", event => {
  $("cheat-share-value").textContent = `${event.target.value}%`;
});
$("cheat-share").addEventListener("change", cheat);
$("btn-eve").addEventListener("click", eve);
$("btn-leak").addEventListener("click", leakKey);
setInterval(refreshMessageState, 1000);
