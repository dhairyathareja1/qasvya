import secrets
import numpy as np
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator

N = 256  # 128 key pad bits, 128 check bits
_sim = AerSimulator(method="stabilizer")


def prepare():
    ones = secrets.SystemRandom().sample(range(N), N // 2)
    theta = np.zeros(N, dtype=int)
    theta[ones] = 1
    x = np.array([secrets.randbits(1) for _ in range(N)], dtype=int)
    return x, theta


def build_circuit(x, theta, bases):
    n = len(x)
    qc = QuantumCircuit(n, n)
    for i in range(n):
        if x[i]:
            qc.x(i)
        if theta[i]:
            qc.h(i)
        if bases[i]:
            qc.h(i)
    qc.measure(range(n), range(n))
    return qc


def measure(x, theta, bases):
    x, theta, bases = (np.asarray(a, dtype=int) for a in (x, theta, bases))
    out = _sim.run(build_circuit(x, theta, bases), shots=1, memory=True).result().get_memory()[0]
    return np.array([int(b) for b in out[::-1]], dtype=int)  # Reverse Qiskit bit order


def check_proof(y, x, theta, delta=0.0):
    y, x, theta = (np.asarray(a, dtype=int) for a in (y, x, theta))
    chk = theta == 1
    mism = int((y[chk] != x[chk]).sum())
    return bool(mism <= delta * chk.sum()), mism, int(chk.sum())
