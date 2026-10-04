"""Web API for QRecall: send a locked message, then unlock it or recall it with proof."""
import secrets
import threading
from pathlib import Path

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


@app.get("/")
def home():
    return FileResponse(STATIC / "index.html")
