import numpy as np
from quantum import N, prepare, measure, check_proof

for p in [0.0, 0.01, 0.02, 0.05]:
    res = []
    for _ in range(50):
        x, theta = prepare()
        y = measure(x, theta, np.ones(N, int), noise=p)
        res.append((
            check_proof(y, x, theta, 0.0)[0],
            check_proof(y, x, theta, 0.08)[0],
            check_proof(y, x, theta, 0.0)[1]
        ))
    print(f"noise {p:.2f}: avg mismatches {np.mean([r[2] for r in res]):4.1f}/128 | "
          f"strict accept {np.mean([r[0] for r in res]):.2f} | delta=0.08 accept {np.mean([r[1] for r in res]):.2f}")
