const state = { message: null, recallBits: null };
const $ = id => document.getElementById(id);

function log(message) {
  const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
  const activity = $("log");
  activity.textContent += `\n${entry}`;
  activity.scrollTop = activity.scrollHeight;
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
    $("message-state").textContent = `Message ${message.id} sent and locked (${message.n} qubits).`;
    log(`Send completed for message ${message.id}.`);
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

$("btn-send").addEventListener("click", send);
$("btn-recall").addEventListener("click", recall);
$("btn-unlock").addEventListener("click", unlock);
