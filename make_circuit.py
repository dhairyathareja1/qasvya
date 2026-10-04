from qiskit import QuantumCircuit

x = [1, 0, 1, 1, 0, 0, 1, 0]
theta = [0, 1, 0, 1, 1, 0, 1, 0]
n = len(x)
qc = QuantumCircuit(n, n)
for i in range(n):
    if x[i]:
        qc.x(i)
qc.barrier(label="write bits")
for i in range(n):
    if theta[i]:
        qc.h(i)
qc.barrier(label="Alice encodes")
for i in range(n):
    qc.h(i)
qc.barrier(label="Bob recalls")
qc.measure(range(n), range(n))
fig = qc.draw("mpl", fold=-1)
fig.savefig("static/circuit.svg", format="svg", bbox_inches="tight")
print("saved static/circuit.svg")
