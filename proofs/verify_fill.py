"""Checks for the proofs being added:
 (1) the explicit grid G is a completed sudoku;
 (2) Proposition 7.2: u is in O (alternating closed walk exists) => u false; otherwise the constructed map is link-consistent with x(u)=1;
 (3) Proposition 7.3: the naked-triple state has no strong links, yet (1,4,1) is eliminable.
"""
import random, itertools
random.seed(7)

def G(r, c):  # 1-indexed
    return (3*((r-1) % 3) + (r-1)//3 + (c-1)) % 9 + 1
rows = [[G(r, c) for c in range(1, 10)] for r in range(1, 10)]
full = set(range(1, 10))
assert all(set(row) == full for row in rows)
assert all({rows[r][c] for r in range(9)} == full for c in range(9))
assert all({rows[r][c] for r in range(br, br+3) for c in range(bc, bc+3)} == full for br in (0,3,6) for bc in (0,3,6))
assert rows[0] == list(range(1, 10))
print("G is a completed grid; row 1 =", rows[0])

def constraints():
    cons = []
    for r in range(1, 10):
        for c in range(1, 10):
            cons.append([(r, c, d) for d in range(1, 10)])
    for d in range(1, 10):
        for r in range(1, 10): cons.append([(r, c, d) for c in range(1, 10)])
        for c in range(1, 10): cons.append([(r, c, d) for r in range(1, 10)])
        for b in range(9):
            br, bc = 3*(b//3)+1, 3*(b % 3)+1
            cons.append([(r, c, d) for r in range(br, br+3) for c in range(bc, bc+3)])
    return cons
CONS = constraints()

def links(P):
    W = {v: set() for v in P}; S = {v: set() for v in P}
    for con in CONS:
        live = [v for v in con if v in P]
        for a, b in itertools.combinations(live, 2):
            W[a].add(b); W[b].add(a)
        if len(live) == 2:
            a, b = live; S[a].add(b); S[b].add(a)
    return W, S

def random_solution():
    # relabel digits and permute rows/cols within bands of G
    perm = list(range(1, 10)); random.shuffle(perm)
    def shuf():
        out = []
        bands = [0, 1, 2]; random.shuffle(bands)
        for b in bands:
            inner = [0, 1, 2]; random.shuffle(inner)
            out += [3*b + i + 1 for i in inner]
        return out
    R, C = shuf(), shuf()
    return {(r, c, perm[G(R[r-1], C[c-1]) - 1]) for r in range(1, 10) for c in range(1, 10)}

def consistent(x, W, S):
    for u in W:
        for v in W[u]:
            if x[u] + x[v] > 1: return False
        for v in S[u]:
            if x[u] + x[v] != 1: return False
    return True

n_in_O = n_built = 0
for trial in range(25):
    T = random_solution()
    for con in CONS: assert sum(v in T for v in con) == 1
    p = random.choice([0.08, 0.12, 0.18])
    P = set(T) | {(r, c, d) for r in range(1, 10) for c in range(1, 10) for d in range(1, 10) if random.random() < p}
    W, S = links(P)
    for u in P:
        E = {u}; stack = [u]
        while stack:
            a = stack.pop()
            for b in W[a]:
                for c in S[b]:
                    if c not in E:
                        E.add(c); stack.append(c)
        O = set()
        for e in E: O |= W[e]
        if u in O:                      # alternating closed walk at u exists
            assert u not in T; n_in_O += 1
        else:
            assert not (E & O)          # Claim A
            x = {v: (1 if v in E else 0 if v in O else int(v in T)) for v in P}
            assert x[u] == 1 and consistent(x, W, S); n_built += 1
print("Prop 7.2: walk found and u false:", n_in_O, "| consistent map built with x(u)=1:", n_built)

# Proposition 7.3
P = {(r, c, d) for r in range(1, 10) for c in range(1, 10) for d in range(1, 10)} - {(1, c, d) for c in (1, 2, 3) for d in range(4, 10)}
sizes = sorted({sum(v in P for v in con) for con in CONS})
print("constraint-set sizes in the naked-triple state:", sizes)
W, S = links(P)
assert all(not S[v] for v in P)
T0 = {(r, c, G(r, c)) for r in range(1, 10) for c in range(1, 10)}
assert T0 <= P
x = {v: int(v == (1, 4, 1)) for v in P}
assert consistent(x, W, S)
print("no strong links; G is a solution in P; single-true map at (1,4,1) is link-consistent")
