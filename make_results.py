import json
import sys
import numpy as np
from quantum import N, prepare, measure, check_proof

rng = np.random.default_rng()
TRIALS = int(sys.argv[1]) if len(sys.argv) > 1 else 100
SHARES = [round(i * 0.05, 2) for i in range(21)]  # 0, 0.05, ... 1.0


def one_trial(f):
    x, theta = prepare()
    bases = (rng.random(N) >= f).astype(int)  # 0 = Z (keeps info), 1 = H
    y = measure(x, theta, bases)
    ok, mism, _ = check_proof(y, x, theta, delta=0.0)
    kept = int(((theta == 0) & (bases == 0)).sum())  # pad bits Bob would hold if key leaked
    return mism, kept, ok


def main():
    rows = []
    for f in SHARES:
        r = [one_trial(f) for _ in range(TRIALS)]
        rows.append({
            "share_in_z": f,
            "avg_mismatches": float(np.mean([a for a, _, _ in r])),
            "avg_pad_bits_kept": float(np.mean([b for _, b, _ in r])),
            "pass_rate": float(np.mean([c for _, _, c in r]))
        })
        print(rows[-1])

    with open("static/results.json", "w") as f:
        json.dump({"n_qubits": N, "check_bits": N // 2, "trials": TRIALS, "rows": rows}, f, indent=2)
    print("saved static/results.json")


if __name__ == "__main__":
    main()
