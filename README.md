# QRecall

**Unsend a message, with quantum proof.** Send a locked message, then either unlock it or
*recall* it. A valid recall proves the message can never be read, even if the key leaks later.

Built for Qiskit Fall Fest, IIT Roorkee. Python, FastAPI, Qiskit (Aer), AES-GCM, plain HTML/JS.

## The story
An exam paper is sent to centres days early, encrypted. The exam is postponed. How does the
board *prove* every centre destroyed its copy? A normal file can be copied, so deletion can
never be proved. With certified deletion, it can.

## How it works (simplified Broadbent-Islam certified deletion)
1. **Alice** picks random bits `x` and random bases `theta` (0 = Z basis, 1 = H basis, exactly half each),
   and prepares 256 qubits: qubit `i` holds `x[i]` in basis `theta[i]`.
2. The pad is `x` at the `theta = 0` positions (128 bits). Her AES key is hidden as `c = key XOR pad`.
   The message is encrypted with AES-GCM under that key.
3. **Bob** receives the qubits, `c` and the ciphertext. He cannot read it without `theta`.
4. **Recall:** Bob measures every qubit in the H basis and returns the results `y`. Alice checks
   `y = x` at the `theta = 1` positions. If it passes, the message is deleted for good: the H
   measurement destroys the pad information.
5. **Unlock:** Alice sends `theta`. Bob measures in those bases, gets `x`, rebuilds the pad, recovers
   the key and decrypts.

Bob has one measurement. To read the message he must measure in the right bases, but then he cannot
produce the recall proof. To produce the proof he must measure in H, which destroys what he needed.

## Run
    pip install -r requirements.txt
    uvicorn api:app --reload        # open http://localhost:8000
    pytest                          # 10 tests, about 1 second

## Public demo deployment
**Public demo: not deployed yet.** The Dockerfile is ready, but the image must be built from
the published repository before a public service URL can be added here.

To deploy a free Docker web service on [Render](https://render.com/docs/docker):

1. Publish this Dockerfile and README to the GitHub repository.
2. In Render, create a **Web Service** and connect `dhairyathareja1/qasvya`.
3. Set the runtime to **Docker**, the root directory to `.`, and the instance plan to **Free**.
4. Set the health check path to `/health`, then create the service.
5. Once the service is live, replace this status with its assigned `onrender.com` URL.

Render free web services spin down after 15 minutes without traffic and may take about a minute
to start again. Their filesystem is temporary, and this app stores messages in memory, so messages
are lost when the service restarts or spins down. See [Render's free service limitations](https://render.com/docs/free).

## API (the contract between backend and frontend)
All bodies are JSON. `bases`, `y`, `bits`, `theta` are lists of 256 values, each 0 or 1.

| Endpoint | Body | Returns |
|---|---|---|
| `GET /health` | | `{status: "ok"}` |
| `POST /send` | `{message}` | `{id, n, c, nonce, blob}` (hex strings) |
| `POST /measure` | `{id, bases}` | `{bits}`. Works **once**; a second call returns 409 |
| `POST /verify?delta=0` | `{id, y}` | `{ok, mismatches, checked, state}`. `delta` is capped at 0.1 |
| `POST /release` | `{id}` | `{theta, leaked, state}` |
| `POST /decrypt` | `{id, bits, theta, nonce, blob}` | `{ok, text, key_agreement}` |
| `GET /state/{id}` | | `{state, measured}` |
| `GET /` | | Web UI (`static/index.html`) |

States: `LOCKED` -> `DELETED` (valid recall) or `UNLOCKED` (key released).
After `UNLOCKED`, `/verify` returns 409, because a proof made after the key is out proves nothing.

## Results (100 trials each; regenerate with `python make_results.py`)
"Cheating Bob" measures a share of qubits in Z to keep information and the rest in H to fake the proof.

| Share measured to keep info | Proof mismatches (of 128) | Pad bits kept | Strict check passes |
|---|---|---|---|
| 0% (honest recall) | 0.0 | 0.0 | 100% |
| 5% | 2.82 | 6.12 | 7% |
| 10% | 6.79 | 12.69 | 0% |
| 15% | 9.37 | 19.61 | 0% |
| 20% | 12.44 | 24.92 | 0% |
| 25% | 15.88 | 31.66 | 0% |
| 30% | 19.32 | 38.74 | 0% |
| 35% | 21.62 | 45.62 | 0% |
| 40% | 25.7 | 50.41 | 0% |
| 45% | 29.14 | 58.37 | 0% |
| 50% | 31.96 | 64.35 | 0% |
| 55% | 35.47 | 69.65 | 0% |
| 60% | 38.26 | 76.61 | 0% |
| 65% | 41.52 | 83.14 | 0% |
| 70% | 44.46 | 89.91 | 0% |
| 75% | 48.96 | 96.25 | 0% |
| 80% | 51.06 | 102.4 | 0% |
| 85% | 55.01 | 108.32 | 0% |
| 90% | 57.05 | 114.97 | 0% |
| 95% | 60.92 | 121.45 | 0% |
| 100% | 64.2 | 128.0 | 0% |

Under readout noise, honest Bob also fails a strict check (1% noise: strict check accepts him
only 20% of the time; a tolerance of 8% accepts him 100%). So a tolerance threshold is needed, at the
cost of letting a cheater keep a few more bits.

## Limitations (please read)
- **The quantum channel is simulated.** One server holds the qubits and Alice's secrets; the code
  enforces one measurement per message. A real deployment needs a real quantum channel.
- **Simplified protocol.** The paper adds a check-bit string, privacy amplification and error
  correction. We use the pad directly, so a cheater can keep a few key bits with small probability.
  That does not break a 128-bit key, but it is not the formal guarantee.
- **Recall only counts before the key is released.** After unlock, Bob could fake a proof.
- `/decrypt` returns `key_agreement` using the real key. This is a demo view, not something an attacker sees.
- `delta` can be set by the client for demo purposes; a real system fixes it on Alice's side.
- Messages live in server memory and vanish on restart.

## Reference
Broadbent and Islam, *Quantum encryption with certified deletion*, TCC 2020.

## Acknowledgements
Team: Dhairya Thareja, Manasvi Khare, Shreya Gupta
