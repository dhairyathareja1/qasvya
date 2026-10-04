import secrets
import numpy as np
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _pad(bits, theta):
    bits, theta = np.asarray(bits, dtype=int), np.asarray(theta, dtype=int)
    return np.packbits(bits[theta == 0]).tobytes()


def _xor(a, b):
    return bytes(i ^ j for i, j in zip(a, b))


def new_key():
    return secrets.token_bytes(16)


def hide_key(k, x, theta):
    return _xor(k, _pad(x, theta))


def recover_key(bits, theta, c):
    return _xor(c, _pad(bits, theta))


def encrypt(k, message):
    nonce = secrets.token_bytes(12)
    return nonce, AESGCM(k).encrypt(nonce, message.encode(), None)


def decrypt(k, nonce, blob):
    return AESGCM(k).decrypt(nonce, blob, None).decode()
