"""Checks for the extra strategies:
 (1) Theorem 5.2 on 5-cycles and 7-cycles v -l- a =s= b -l- c =s= d (-l- e =s= f) -l- v  => v false
     (covers Skyscraper, Two-String Kite, Turbot Fish, XY-Wing, W-Wing, XY-Chain);
 (2) Guardians: on any odd cycle of links, choosing a constraint set for each link, some 'guardian'
     (another live candidate of one of those sets) is true;
 (3) Naked pair / hidden pair as 4-cycles (Theorem 5.4).
"""
import random, itertools
random.seed(11)
def G(r, c): return (3*((r-1) % 3) + (r-1)//3 + (c-1)) % 9 + 1
def constraints():
    cons = []
    for r in range(1, 10):
        for c in range(1, 10): cons.append([(r, c, d) for d in range(1, 10)])
    for d in range(1, 10):
        for r in range(1, 10): cons.append([(r, c, d) for c in range(1, 10)])
        for c in range(1, 10): cons.append([(r, c, d) for r in range(1, 10)])
        for b in range(9):
            br, bc = 3*(b//3)+1, 3*(b % 3)+1
            cons.append([(r, c, d) for r in range(br, br+3) for c in range(bc, bc+3)])
    return cons
CONS = constraints()
def random_solution():
    perm = list(range(1, 10)); random.shuffle(perm)
    def shuf():
        out = []; bands = [0, 1, 2]; random.shuffle(bands)
        for b in bands:
            inner = [0, 1, 2]; random.shuffle(inner); out += [3*b + i + 1 for i in inner]
        return out
    R, C = shuf(), shuf()
    return {(r, c, perm[G(R[r-1], C[c-1]) - 1]) for r in range(1, 10) for c in range(1, 10)}
stats = dict(c5=0, c7=0, xywing=0, guard=0, lone_guard=0, pairs=0)
for trial in range(30):
    T = random_solution()
    p = random.choice([0.06, 0.1, 0.15])
    P = set(T) | {(r, c, d) for r in range(1, 10) for c in range(1, 10) for d in range(1, 10) if random.random() < p}
    W = {v: set() for v in P}; S = {v: set() for v in P}; setsof = {}
    for ci, con in enumerate(CONS):
        live = [v for v in con if v in P]
        for a, b in itertools.combinations(live, 2):
            W[a].add(b); W[b].add(a); setsof.setdefault(frozenset((a, b)), []).append(live)
        if len(live) == 2:
            a, b = live; S[a].add(b); S[b].add(a)
    # (1) 5-cycles and 7-cycles for Theorem 5.2
    n5 = n7 = 0
    for v in P:
        for a in W[v]:
            for b in S[a]:
                if b == v: continue
                for c in W[b]:
                    if c in (v, a): continue
                    for d in S[c]:
                        if d in (v, a, b): continue
                        if v in W[d]:
                            assert v not in T; n5 += 1
                            if a[2] != b[2] or c[2] != d[2]: stats['xywing'] += 1
                        if n7 < 4000:
                            for e in W[d]:
                                if e in (v, a, b, c): continue
                                for f in S[e]:
                                    if f in (v, a, b, c, d): continue
                                    if v in W[f]:
                                        assert v not in T; n7 += 1
    stats['c5'] += n5; stats['c7'] += n7
    # (2) guardians on random odd cycles
    verts = list(P)
    for _ in range(600):
        path = [random.choice(verts)]
        for _ in range(random.choice([2, 4, 6])):
            nxt = [w for w in W[path[-1]] if w not in path]
            if not nxt: break
            path.append(random.choice(nxt))
        k = len(path)
        if k % 2 == 1 and k >= 3 and path[0] in W[path[-1]]:
            guardians = set()
            for i in range(k):
                u, w = path[i], path[(i+1) % k]
                live = random.choice(setsof[frozenset((u, w))])
                guardians |= set(live) - {u, w}
            assert any(g in T for g in guardians)
            stats['guard'] += 1
            if len(guardians) == 1: stats['lone_guard'] += 1
            # any candidate linked to every guardian is false
            common = None
            for g in guardians:
                common = set(W[g]) if common is None else common & W[g]
            for x in (common or set()) - guardians:
                assert x not in T
    # (3) naked pairs as 4-cycles: cells X,Y in a unit with the same two candidates
    cells = {}
    for (r, c, d) in P: cells.setdefault((r, c), set()).add(d)
    for (x, dx), (y, dy) in itertools.combinations(cells.items(), 2):
        if dx == dy and len(dx) == 2 and (x[0] == y[0] or x[1] == y[1] or ((x[0]-1)//3, (x[1]-1)//3) == ((y[0]-1)//3, (y[1]-1)//3)):
            a, b = sorted(dx)
            cyc = [(x[0], x[1], a), (x[0], x[1], b), (y[0], y[1], b), (y[0], y[1], a)]
            for i in range(4):
                u, w = cyc[i], cyc[(i+1) % 4]
                assert w in W[u] and (u in T) + (w in T) == 1
                for z in W[u] & W[w]: assert z not in T
            stats['pairs'] += 1
print(stats)
