"""Web API for QRecall: send a locked message, then unlock it or recall it with proof."""
import secrets
import threading
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import crypto
import quantum

STATIC = Path(__file__).parent / "static"
app = FastAPI(title="QRecall")
vault = {}                      # message id -> Alice's secrets and state (server memory only)
_lock = threading.Lock()        # stops two simultaneous requests from both measuring


class Send(BaseModel):
    message: str


class Measure(BaseModel):
    id: str
    bases: list[int]            # one 0 (Z) or 1 (H) per qubit


def get_msg(id):
    if id not in vault:
        raise HTTPException(404, "Unknown message id")
    return vault[id]


def need_len(arr, name):
    if len(arr) != quantum.N or any(v not in (0, 1) for v in arr):
        raise HTTPException(400, f"{name} must be a list of {quantum.N} values, each 0 or 1")


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------- Issue 6: /send and /measure ----------------
@app.post("/send")
def send(r: Send):
    k = crypto.new_key()                          # AES key for the message
    x, theta = quantum.prepare()                  # secret bits + bases (Alice only)
    c = crypto.hide_key(k, x, theta)              # key hidden under the quantum pad
    nonce, blob = crypto.encrypt(k, r.message)
    id = secrets.token_hex(4)
    vault[id] = dict(x=x, theta=theta, k=k, c=c, state="LOCKED", measured=False)
    # Bob receives the qubits (via /measure), c, nonce and blob. Never x, theta or k.
    return dict(id=id, n=quantum.N, c=c.hex(), nonce=nonce.hex(), blob=blob.hex())


@app.post("/measure")
def measure(r: Measure):
    m = get_msg(r.id)
    need_len(r.bases, "bases")
    with _lock:
        if m["measured"]:
            raise HTTPException(409, "Qubits already measured - they cannot be copied")
        m["measured"] = True                      # the register is consumed (no cloning)
    bits = quantum.measure(m["x"], m["theta"], r.bases)
    return dict(bits=bits.tolist())


# ---------------- Issue 7: /state, /verify, /release, /decrypt ----------------
class Verify(BaseModel):
    id: str
    y: list[int]                # Bob's recall proof: results of measuring in the H basis


class Ident(BaseModel):
    id: str


class Decrypt(BaseModel):
    id: str
    bits: list[int]
    theta: list[int]
    nonce: str                  # hex
    blob: str                   # hex


@app.get("/state/{id}")
def state(id: str):
    m = get_msg(id)
    return dict(state=m["state"], measured=m["measured"])


@app.post("/verify")            # Alice checks Bob's recall proof
def verify(r: Verify, delta: float = 0.0):
    m = get_msg(r.id)
    need_len(r.y, "y")
    if not 0.0 <= delta <= 0.1:                   # demo convenience: client may relax the check, capped
        raise HTTPException(400, "delta must be between 0 and 0.1")
    with _lock:
        if m["state"] == "UNLOCKED":
            raise HTTPException(409, "Key already released: a recall proof is no longer meaningful")
        ok, mism, checked = quantum.check_proof(r.y, m["x"], m["theta"], delta)
        if ok and m["state"] == "LOCKED":
            m["state"] = "DELETED"
    return dict(ok=ok, mismatches=mism, checked=checked, state=m["state"])


@app.post("/release")           # Alice sends the key (theta)
def release(r: Ident):
    m = get_msg(r.id)
    with _lock:
        leaked = m["state"] == "DELETED"          # releasing after a valid recall = "key leak" demo
        if m["state"] == "LOCKED":
            m["state"] = "UNLOCKED"
    return dict(theta=m["theta"].tolist(), leaked=leaked, state=m["state"])


@app.post("/decrypt")           # Bob tries to open the message with his bits + theta
def decrypt(r: Decrypt):
    m = get_msg(r.id)
    need_len(r.bits, "bits")
    need_len(r.theta, "theta")
    k_try = crypto.recover_key(r.bits, r.theta, m["c"])
    # DEMO ONLY: compares with the real key so the UI can show "50% = pure guessing"
    agree = float(np.mean(np.unpackbits(np.frombuffer(k_try, np.uint8)) ==
                          np.unpackbits(np.frombuffer(m["k"], np.uint8))))
    try:
        text = crypto.decrypt(k_try, bytes.fromhex(r.nonce), bytes.fromhex(r.blob))
        return dict(ok=True, text=text, key_agreement=agree)
    except Exception:
        return dict(ok=False, text=None, key_agreement=agree)


app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def home():
    return FileResponse(STATIC / "index.html")
