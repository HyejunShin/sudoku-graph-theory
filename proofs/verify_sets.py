"""Brute-force checks for the two extensions in section 7 of the write-up.

A. Lemma 7.4: group dots obey the two link rules (so the Cycle Lemma and Theorem 5.2 carry over).
B. Theorem 7.5, the sets rule: if k pairwise disjoint constraint sets are covered by k other
   constraint sets, every candidate of the covering sets outside the covered ones is false.

Both are checked on random states that contain a known solution. Run: python3 verify_sets.py
"""
import itertools, random, time

random.seed(7)

def random_grid():
    perm = random.sample(range(1, 10), 9)
    def order():
        return [3 * b + i for b in random.sample(range(3), 3) for i in random.sample(range(3), 3)]
    R, C = order(), order()
    return [[perm[(3 * (R[r] % 3) + R[r] // 3 + C[c]) % 9] for c in range(9)] for r in range(9)]

def constraint_sets():
    sets = []
    for r in range(9):
        for c in range(9):
            sets.append(('cell', frozenset((r, c, d) for d in range(1, 10))))
    for d in range(1, 10):
        for i in range(9):
            sets.append(('row', frozenset((i, c, d) for c in range(9))))
            sets.append(('col', frozenset((r, i, d) for r in range(9))))
            sets.append(('box', frozenset((3 * (i // 3) + a, 3 * (i % 3) + b, d) for a in range(3) for b in range(3))))
    return sets

SETS = constraint_sets()

def random_state():
    """A solved grid G, and a set P of candidates that contains the solution: the usual pencil marks for
    a random choice of given cells, with a few more false candidates rubbed out at random."""
    G = random_grid()
    truth = {(r, c, G[r][c]) for r in range(9) for c in range(9)}
    given = set(random.sample([(r, c) for r in range(9) for c in range(9)], random.randint(22, 40)))
    P = set()
    for r in range(9):
        for c in range(9):
            for d in range(1, 10):
                if (r, c) in given:
                    if G[r][c] == d: P.add((r, c, d))
                    continue
                clash = any(G[r2][c2] == d and (r2 == r or c2 == c or (r2 // 3 == r // 3 and c2 // 3 == c // 3)) for (r2, c2) in given)
                if not clash: P.add((r, c, d))
    for x in random.sample(sorted(P - truth), min(len(P - truth), random.randint(0, 60))):
        P.discard(x)
    live = [s & P for _, s in SETS]
    assert all(len(s & truth) == 1 for s in live)
    return truth, P, live

def check_groups(truth, P, live):
    """Dots: single candidates and groups (2 or 3 cells of one box in one row or column, same digit)."""
    n = 0
    for d in range(1, 10):
        dots = [frozenset([x]) for x in P if x[2] == d]
        for b in range(9):
            cells = [x for x in P if x[2] == d and 3 * (x[0] // 3) + x[1] // 3 == b]
            for key in (0, 1):
                by = {}
                for x in cells: by.setdefault(x[key], []).append(x)
                dots += [frozenset(v) for v in by.values() if len(v) >= 2]
        true = lambda A: len(A & truth) >= 1
        for S in live:
            inside = [A for A in dots if A <= S]
            for A, B in itertools.combinations(inside, 2):
                if A & B: continue
                assert not (true(A) and true(B)), 'two linked dots are both true'
                if A | B == S: assert true(A) != true(B), 'a strong link without exactly one true end'
                n += 1
    return n

def check_sets_rule(truth, P, live, tries=60):
    n = 0
    small = [s for s in live if 2 <= len(s) <= 4]
    for _ in range(tries):
        k = random.choice((2, 2, 3, 3, 4))
        if len(small) < k: return n
        base = []
        for s in random.sample(small, len(small)):
            if all(not (s & b) for b in base): base.append(s)
            if len(base) == k: break
        if len(base) < k: continue
        U = frozenset().union(*base)
        touching = [s for s in live if s & U and s not in base]
        # greedy pre-filter keeps the search small: a cover must come from sets that meet U
        if len(touching) > 26: continue
        for cover in itertools.combinations(touching, k):
            if U <= frozenset().union(*cover):
                extra = frozenset().union(*cover) - U
                assert not (extra & truth), 'the sets rule removed a true candidate'
                if extra: n += 1
    return n

def check_families(truth, P, live):
    """The two families that give the named strategies: cells against digits inside one unit (naked and hidden
    subsets), and rows against columns for one digit (X-Wing, Swordfish, Jellyfish). Either side may be the base."""
    n = 0
    kind = [k for k, _ in SETS]
    cells = [s for s, k in zip(live, kind) if k == 'cell']
    def family(A, B):
        nonlocal n
        A = [s for s in A if len(s) >= 2]
        for k in (2, 3, 4):
            for base in itertools.combinations([s for s in A if len(s) <= k], k):
                U = frozenset().union(*base)
                cover = [s for s in B if s & U]
                if len(cover) != k or not U <= frozenset().union(*cover): continue
                extra = frozenset().union(*cover) - U
                assert not (extra & truth), 'the sets rule removed a true candidate'
                if extra: n += 1
    for unit_kind in ('row', 'col', 'box'):
        for i in range(9):
            def inside(x):
                return x[0] == i if unit_kind == 'row' else x[1] == i if unit_kind == 'col' else 3 * (x[0] // 3) + x[1] // 3 == i
            unit_cells = [s for s in cells if s and all(inside(x) for x in s)]
            unit_digits = [s for s, k in zip(live, kind) if k == unit_kind and s and all(inside(x) for x in s)]
            family(unit_cells, unit_digits); family(unit_digits, unit_cells)
    for d in range(1, 10):
        rows = [s for s, k in zip(live, kind) if k == 'row' and s and next(iter(s))[2] == d]
        cols = [s for s, k in zip(live, kind) if k == 'col' and s and next(iter(s))[2] == d]
        family(rows, cols); family(cols, rows)
    return n

t0, groups, rule, fam, states = time.time(), 0, 0, 0, 0
while time.time() - t0 < 40:
    truth, P, live = random_state()
    groups += check_groups(truth, P, live)
    rule += check_sets_rule(truth, P, live)
    fam += check_families(truth, P, live)
    states += 1
print('states:', states)
print('group dots (Lemma 7.4): %d linked pairs of dots checked against the two link rules, 0 failures' % groups)
print('sets rule (Theorem 7.5): %d random base/cover instances and %d subset and fish instances, k = 2, 3, 4, each removing at least one candidate, 0 failures' % (rule, fam))
