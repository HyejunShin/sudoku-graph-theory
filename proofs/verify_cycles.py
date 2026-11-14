"""Brute-force check of the cycle lemma and its corollaries on abstract cycles.
A cycle has k vertices 0..k-1, edge i joins i and i+1 (mod k), each labeled S (strong) or W (weak).
An assignment x in {0,1}^k is admissible if no edge has two true ends and every strong edge has exactly one true end.
"""
from itertools import product

def admissible(k, lab):
    for x in product((0, 1), repeat=k):
        ok = True
        for i in range(k):
            s = x[i] + x[(i + 1) % k]
            if s == 2 or (lab[i] == 'S' and s != 1):
                ok = False; break
        if ok:
            yield x

def max_strong_matching(k, lab):
    # max matching using only strong edges of the cycle (brute force)
    best = 0
    for mask in range(1 << k):
        chosen = [i for i in range(k) if mask >> i & 1]
        if any(lab[i] != 'S' for i in chosen):
            continue
        used = set(); ok = True
        for i in chosen:
            a, b = i, (i + 1) % k
            if a in used or b in used:
                ok = False; break
            used |= {a, b}
        if ok:
            best = max(best, len(chosen))
    return best

checked = 0
for k in range(3, 12):
    for lab in product('SW', repeat=k):
        nu = max_strong_matching(k, lab) if k <= 9 else None
        weak = [i for i in range(k) if lab[i] == 'W']
        sols = list(admissible(k, lab))
        for x in sols:
            T = sum(x)
            bf = [i for i in range(k) if x[i] + x[(i + 1) % k] == 0]
            # Lemma: f = k - 2T, both-false edges are weak
            assert len(bf) == k - 2 * T
            assert all(lab[i] == 'W' for i in bf)
            assert len(bf) % 2 == k % 2
            if nu is not None:
                assert T >= nu and len(bf) <= k - 2 * nu
            checked += 1
        # no weak edge, odd k -> no admissible assignment
        if not weak and k % 2 == 1:
            assert not sols
        # wrap: odd, exactly one weak edge -> both ends false
        if k % 2 == 1 and len(weak) == 1:
            i = weak[0]
            for x in sols:
                assert x[i] == 0 and x[(i + 1) % k] == 0
        # two weak edges, odd cycle -> even strong path has both ends false (and alternate), odd path ok
        if k % 2 == 1 and len(weak) == 2:
            i, j = weak
            # paths: P1 = vertices i+1 .. j  (j-i-1 edges), P2 = vertices j+1 .. i (k-(j-i)-1 edges)
            len1 = j - i - 1
            len2 = k - (j - i) - 1
            assert (len1 % 2) != (len2 % 2)
            if len1 % 2 == 0:
                ends = ((i + 1) % k, j)
                path = [(i + 1 + t) % k for t in range(len1 + 1)]
            else:
                ends = ((j + 1) % k, i)
                path = [(j + 1 + t) % k for t in range(len2 + 1)]
            for x in sols:
                assert x[ends[0]] == 0 and x[ends[1]] == 0
                for t, v in enumerate(path):
                    assert x[v] == (t % 2)
        # alternating even cycle (strong edges contain a perfect matching) -> every edge has exactly one true end
        if k % 2 == 0 and (all(lab[i] == 'S' for i in range(0, k, 2)) or all(lab[i] == 'S' for i in range(1, k, 2))):
            for x in sols:
                assert all(x[i] + x[(i + 1) % k] == 1 for i in range(k))
        # odd cycle, strong edges at even positions 0,2,...,k-1 (two strong edges meet at vertex 0) -> vertex 0 true
        if k % 2 == 1 and all(lab[i] == 'S' for i in range(0, k, 2)):
            for x in sols:
                assert x[0] == 1
print("all assertions passed; admissible assignments checked:", checked)
