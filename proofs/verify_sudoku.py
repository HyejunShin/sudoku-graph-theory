"""Randomized check of the elimination theorems on real sudoku candidate states.
A state = the solution's 81 true candidates plus random extra (false) candidates.
Every elimination produced by the theorems must be a false candidate, and every forced-true must be true.
"""
import random, itertools, sys
random.seed(20261114)

def random_solution():
    grid = [[0]*9 for _ in range(9)]
    def ok(r, c, d):
        if any(grid[r][j] == d for j in range(9)): return False
        if any(grid[i][c] == d for i in range(9)): return False
        br, bc = 3*(r//3), 3*(c//3)
        return all(grid[i][j] != d for i in range(br, br+3) for j in range(bc, bc+3))
    def fill(pos):
        if pos == 81: return True
        r, c = divmod(pos, 9)
        ds = list(range(1, 10)); random.shuffle(ds)
        for d in ds:
            if ok(r, c, d):
                grid[r][c] = d
                if fill(pos+1): return True
                grid[r][c] = 0
        return False
    fill(0)
    return grid

def constraints():
    cons = []
    for r in range(9):
        for c in range(9):
            cons.append([(r, c, d) for d in range(1, 10)])           # cell
    for d in range(1, 10):
        for r in range(9):
            cons.append([(r, c, d) for c in range(9)])               # row-digit
        for c in range(9):
            cons.append([(r, c, d) for r in range(9)])               # col-digit
        for b in range(9):
            br, bc = 3*(b//3), 3*(b%3)
            cons.append([(r, c, d) for r in range(br, br+3) for c in range(bc, bc+3)])
    return cons
CONS = constraints()
assert len(CONS) == 324

stats = dict(states=0, wrap=0, trap=0, two=0, alt=0, strongmeet=0, cycles=0, odd_allstrong=0)

def run_state(p_extra):
    sol = random_solution()
    truth = {(r, c, sol[r][c]) for r in range(9) for c in range(9)}
    cand = set(truth)
    for r in range(9):
        for c in range(9):
            for d in range(1, 10):
                if random.random() < p_extra: cand.add((r, c, d))
    W = {v: set() for v in cand}
    S = {v: set() for v in cand}
    for con in CONS:
        live = [v for v in con if v in cand]
        assert sum(v in truth for v in live) == 1
        for a, b in itertools.combinations(live, 2):
            W[a].add(b); W[b].add(a)
        if len(live) == 2:
            a, b = live
            S[a].add(b); S[b].add(a)
    # 2-color the strong graph
    comp = {}; col = {}
    ncomp = 0
    for v in cand:
        if v in comp or not S[v]: continue
        comp[v] = ncomp; col[v] = 0; stack = [v]
        while stack:
            u = stack.pop()
            for w in S[u]:
                if w not in comp:
                    comp[w] = ncomp; col[w] = 1 - col[u]; stack.append(w)
                else:
                    assert col[w] != col[u], "strong graph not bipartite"
        ncomp += 1
    classes = {}
    for v in comp: classes.setdefault((comp[v], col[v]), set()).add(v)
    # solution is constant on classes, opposite on the two classes of a component
    for (k, c), cls in classes.items():
        vals = {v in truth for v in cls}
        assert len(vals) == 1
    false_classes = set()
    # wrap: weak edge inside one color class
    for (k, c), cls in classes.items():
        if any(W[a] & cls for a in cls):
            false_classes.add((k, c)); stats['wrap'] += 1
    # trap: vertex adjacent to both classes of a component
    for v in cand:
        seen = {}
        for w in W[v]:
            if w in comp and comp[w] != comp.get(v, -1):
                seen.setdefault(comp[w], set()).add(col[w])
        for k, cs in seen.items():
            if len(cs) == 2:
                assert v not in truth; stats['trap'] += 1
    # also trap inside own component is impossible for a true vertex: handled by wrap
    # two-cluster: a, b in same class X of K1; c, d in opposite classes of K2; a~c, b~d weak  => X false
    for (k1, c1), X in classes.items():
        hit = {}
        for a in X:
            for w in W[a]:
                if w in comp and comp[w] != k1:
                    hit.setdefault(comp[w], set()).add(col[w])
        if any(len(cs) == 2 for cs in hit.values()):
            false_classes.add((k1, c1)); stats['two'] += 1
    for (k, c) in false_classes:
        assert all(v not in truth for v in classes[(k, c)])
        assert all(v in truth for v in classes[(k, 1 - c)])
    # alternating cycles of length 4 and 6: s w s w (s w): every weak edge has exactly one true end; common W-neighbors false
    def alt_cycles(maxlen):
        for a in cand:
            for b in S[a]:
                # path a =s= b -w- c =s= d -w- ...
                def ext(path):
                    last = path[-1]
                    if len(path) % 2 == 0:      # next edge weak
                        if len(path) >= 4 and path[0] in W[last]:
                            yield list(path)
                        if len(path) < maxlen:
                            for x in W[last]:
                                if x not in path:
                                    yield from ext(path + [x])
                    else:                        # next edge strong
                        for x in S[last]:
                            if x not in path:
                                yield from ext(path + [x])
                yield from ext([a, b])
    cnt = 0
    for cyc in alt_cycles(6):
        cnt += 1
        k = len(cyc)
        for i in range(k):
            u, v = cyc[i], cyc[(i+1) % k]
            assert (u in truth) + (v in truth) == 1
            for w in W[u] & W[v]:
                assert w not in truth
        stats['alt'] += 1
        if cnt > 300: break
    # odd cycle, strong edges at positions 0,2,..,k-1 so two strong edges meet at v0 => v0 true (length 5)
    cnt = 0
    for v0 in cand:
        for v1 in S[v0]:
            for v2 in W[v1]:
                if v2 in (v0, v1): continue
                for v3 in S[v2]:
                    if v3 in (v0, v1, v2): continue
                    for v4 in W[v3]:
                        if v4 in (v0, v1, v2, v3): continue
                        if v0 in S[v4]:
                            assert v0 in truth; stats['strongmeet'] += 1; cnt += 1
        if cnt > 200: break
    # random cycles in W: f = k - 2T, both-false edges not strong
    verts = list(cand)
    for _ in range(300):
        start = random.choice(verts)
        path = [start]
        for _ in range(random.randint(2, 10)):
            nxt = [w for w in W[path[-1]] if w not in path]
            if not nxt: break
            path.append(random.choice(nxt))
        if len(path) >= 3 and path[0] in W[path[-1]]:
            k = len(path)
            T = sum(v in truth for v in path)
            bf = 0
            for i in range(k):
                u, v = path[i], path[(i+1) % k]
                assert not (u in truth and v in truth)
                if u not in truth and v not in truth:
                    bf += 1
                    assert v not in S[u]
            assert bf == k - 2*T and bf % 2 == k % 2
            stats['cycles'] += 1
    stats['states'] += 1

for i in range(40):
    run_state(random.choice([0.08, 0.12, 0.18, 0.25]))
print(stats)
