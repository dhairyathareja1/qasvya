"""End-to-end tests of the QRecall API. Run: pytest"""
import numpy as np
import pytest
from fastapi.testclient import TestClient

import api
from quantum import N

client = TestClient(api.app)
ALL_H = [1] * N
ALL_Z = [0] * N


def send(msg="secret exam paper"):
    return client.post("/send", json={"message": msg}).json()


def measure(id, bases):
    return client.post("/measure", json={"id": id, "bases": bases})


def decrypt(pkg, bits, theta):
    return client.post("/decrypt", json={"id": pkg["id"], "bits": bits, "theta": theta,
                                         "nonce": pkg["nonce"], "blob": pkg["blob"]}).json()


def test_unlock_works():
    p = send()
    theta = client.post("/release", json={"id": p["id"]}).json()["theta"]
    bits = measure(p["id"], theta).json()["bits"]
    d = decrypt(p, bits, theta)
    assert d["ok"] and d["text"] == "secret exam paper"
    assert client.get(f"/state/{p['id']}").json()["state"] == "UNLOCKED"


def test_recall_verifies_and_deletes():
    p = send()
    y = measure(p["id"], ALL_H).json()["bits"]
    v = client.post("/verify", json={"id": p["id"], "y": y}).json()
    assert v["ok"] and v["mismatches"] == 0 and v["checked"] == N // 2
    assert v["state"] == "DELETED"


def test_second_measure_is_409():
    p = send()
    assert measure(p["id"], ALL_H).status_code == 200
    assert measure(p["id"], ALL_H).status_code == 409


def test_cheater_is_rejected():
    p = send()
    y = measure(p["id"], ALL_Z).json()["bits"]    # reads everything, so the proof is wrong
    v = client.post("/verify", json={"id": p["id"], "y": y}).json()
    assert not v["ok"] and v["mismatches"] > 30
    assert v["state"] == "LOCKED"


def test_eve_cannot_decrypt():
    p = send()
    rng = np.random.default_rng()
    bases = rng.integers(0, 2, N).tolist()
    guess_theta = rng.integers(0, 2, N).tolist()
    bits = measure(p["id"], bases).json()["bits"]
    assert not decrypt(p, bits, guess_theta)["ok"]


def test_key_leak_after_recall_fails():
    p = send()
    y = measure(p["id"], ALL_H).json()["bits"]
    assert client.post("/verify", json={"id": p["id"], "y": y}).json()["ok"]
    rel = client.post("/release", json={"id": p["id"]}).json()
    assert rel["leaked"] is True and rel["state"] == "DELETED"
    d = decrypt(p, y, rel["theta"])               # best Bob can do: his recall data + leaked key
    assert not d["ok"] and d["key_agreement"] < 0.8   # about 0.5 = pure guessing


def test_recall_after_unlock_is_blocked():
    p = send()
    client.post("/release", json={"id": p["id"]})
    r = client.post("/verify", json={"id": p["id"], "y": ALL_H})
    assert r.status_code == 409


def test_delta_tolerates_small_noise():
    p = send()
    y = measure(p["id"], ALL_H).json()["bits"]
    theta = api.vault[p["id"]]["theta"]           # white-box: flip 3 check bits to mimic noise
    for i in np.flatnonzero(theta == 1)[:3]:
        y[i] ^= 1
    strict = client.post("/verify", json={"id": p["id"], "y": y}).json()
    assert not strict["ok"] and strict["mismatches"] == 3
    relaxed = client.post("/verify?delta=0.05", json={"id": p["id"], "y": y}).json()
    assert relaxed["ok"]                           # 3/128 = 2.3% <= 5%


def test_bad_requests():
    assert client.post("/measure", json={"id": "nope", "bases": ALL_H}).status_code == 404
    p = send()
    assert measure(p["id"], [1, 0, 1]).status_code == 400
    assert client.post("/verify?delta=0.9", json={"id": p["id"], "y": ALL_H}).status_code == 400


def test_secrets_are_never_sent():
    p = send()
    assert set(p) == {"id", "n", "c", "nonce", "blob"}
