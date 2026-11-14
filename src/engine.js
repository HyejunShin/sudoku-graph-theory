/* Sudoku link-graph engine. Candidates are ids cell*9 + (digit-1); cells are 0..80 (row*9 + col). */
(function (root) {
  'use strict';
  const ROW = c => (c / 9) | 0, COL = c => c % 9, BOX = c => (((c / 27) | 0) * 3 + (((c % 9) / 3) | 0));
  const UNITS = [];
  for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const br = ((b / 3) | 0) * 3, bc = (b % 3) * 3, u = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) u.push((br + i) * 9 + bc + j);
    UNITS.push(u);
  }
  const cellUnits = cell => [ROW(cell), 9 + COL(cell), 18 + BOX(cell)];
  const sees = (a, b) => a !== b && (ROW(a) === ROW(b) || COL(a) === COL(b) || BOX(a) === BOX(b));
  const PEERS = Array.from({ length: 81 }, (_, c) => { const out = []; for (let x = 0; x < 81; x++) if (sees(c, x)) out.push(x); return out; });
  const unitName = u => u < 9 ? 'row ' + (u + 1) : u < 18 ? 'column ' + (u - 8) : 'box ' + (u - 17);
  const cellName = c => 'r' + (ROW(c) + 1) + 'c' + (COL(c) + 1);
  const cid = (cell, d) => cell * 9 + d - 1, cCell = id => (id / 9) | 0, cDig = id => id % 9 + 1;
  const candName = id => cDig(id) + ' in ' + cellName(cCell(id));
  const bits = m => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
  const digits = m => { const out = []; for (let d = 1; d <= 9; d++) if ((m >> d) & 1) out.push(d); return out; };
  const commonUnits = (a, b) => cellUnits(a).filter(u => UNITS[u].includes(b));

  function emptyState() { return { val: new Array(81).fill(0), cand: new Array(81).fill(0), given: new Array(81).fill(false) }; }
  function clone(st) { return { val: st.val.slice(), cand: st.cand.slice(), given: st.given.slice() }; }
  function fromString(s) {
    const t = String(s).replace(/[^0-9.]/g, '');
    if (t.length !== 81) return null;
    const st = emptyState();
    for (let i = 0; i < 81; i++) { const d = t[i] === '.' ? 0 : +t[i]; st.val[i] = d; st.given[i] = d > 0; }
    for (let i = 0; i < 81; i++) for (const p of PEERS[i]) if (st.val[i] && st.val[i] === st.val[p]) return null;
    for (let i = 0; i < 81; i++) if (!st.val[i]) { let m = 0x3FE; for (const p of PEERS[i]) if (st.val[p]) m &= ~(1 << st.val[p]); st.cand[i] = m; }
    return st;
  }
  const toString = st => st.val.map(v => v || '.').join('');
  const has = (st, cell, d) => st.val[cell] === 0 && ((st.cand[cell] >> d) & 1) === 1;
  const alive = (st, id) => has(st, cCell(id), cDig(id));
  function place(st, cell, d) { st.val[cell] = d; st.cand[cell] = 0; for (const p of PEERS[cell]) st.cand[p] &= ~(1 << d); }
  function eliminate(st, id) { st.cand[cCell(id)] &= ~(1 << cDig(id)); }
  const cellsFor = (st, u, d) => UNITS[u].filter(c => has(st, c, d));

  /* Brute-force solver: returns {count: 0|1|2, solution} */
  function solve(vals) {
    const v = vals.slice(); let count = 0, solution = null;
    const mask = cell => { let m = 0x3FE; for (const p of PEERS[cell]) if (v[p]) m &= ~(1 << v[p]); return m; };
    (function rec() {
      let best = -1, bm = 0, bn = 10;
      for (let i = 0; i < 81; i++) if (!v[i]) { const m = mask(i), n = bits(m); if (n < bn) { bn = n; best = i; bm = m; if (n <= 1) break; } }
      if (best < 0) { count++; if (!solution) solution = v.slice(); return; }
      if (bn === 0) return;
      for (let d = 1; d <= 9 && count < 2; d++) if ((bm >> d) & 1) { v[best] = d; rec(); v[best] = 0; }
    })();
    return { count, solution };
  }

  /* Strict check of a pasted puzzle. Returns {ok: true, state, solution} or {ok: false, reason}. */
  function check(str) {
    const t = String(str).replace(/\s+/g, '');
    const bad = t.match(/[^0-9.]/);
    if (bad) return { ok: false, reason: 'Only digits 1 to 9 are allowed, with . or 0 for empty cells. Found "' + bad[0] + '".' };
    if (t.length !== 81) return { ok: false, reason: 'A sudoku has 81 cells. This has ' + t.length + '.' };
    for (let u = 0; u < 27; u++) {
      const seen = {};
      for (const c of UNITS[u]) { const d = t[c] === '.' ? 0 : +t[c]; if (!d) continue; if (seen[d]) return { ok: false, reason: 'Digit ' + d + ' appears twice in ' + unitName(u) + '.' }; seen[d] = true; }
    }
    const state = fromString(t), sol = solve(state.val);
    if (sol.count === 0) return { ok: false, reason: 'This grid has no solution.' };
    if (sol.count > 1) return { ok: false, reason: 'This grid has more than one solution, so it is not a proper sudoku. A proper puzzle has exactly one.' };
    return { ok: true, state: state, solution: sol.solution };
  }

  /* Links */
  function linked(a, b) { if (a === b) return false; const ca = cCell(a), cb = cCell(b); if (ca === cb) return true; return cDig(a) === cDig(b) && sees(ca, cb); }
  function linkInfo(a, b) { const ca = cCell(a), cb = cCell(b); if (ca === cb) return { kind: 'cell', cell: ca }; return { kind: 'unit', unit: commonUnits(ca, cb)[0] }; }
  function strongInfo(st, a, b) {
    if (!linked(a, b)) return null;
    const ca = cCell(a), cb = cCell(b);
    if (ca === cb) return bits(st.cand[ca]) === 2 ? { kind: 'cell', cell: ca } : null;
    for (const u of commonUnits(ca, cb)) if (cellsFor(st, u, cDig(a)).length === 2) return { kind: 'unit', unit: u };
    return null;
  }
  function neighbours(st, id) {
    const cell = cCell(id), d = cDig(id), out = [];
    for (const e of digits(st.cand[cell])) if (e !== d) out.push(cid(cell, e));
    for (const p of PEERS[cell]) if (has(st, p, d)) out.push(cid(p, d));
    return out;
  }
  function strongPartners(st, id) {
    const cell = cCell(id), d = cDig(id), out = [];
    if (bits(st.cand[cell]) === 2) out.push(cid(cell, digits(st.cand[cell]).find(e => e !== d)));
    for (const u of cellUnits(cell)) { const cs = cellsFor(st, u, d); if (cs.length === 2) { const o = cid(cs[0] === cell ? cs[1] : cs[0], d); if (!out.includes(o)) out.push(o); } }
    return out;
  }
  const linkWhy = (a, b) => { const i = linkInfo(a, b); return i.kind === 'cell' ? 'they share cell ' + cellName(i.cell) : 'both are ' + cDig(a) + 's in ' + unitName(i.unit); };
  const strongWhy = (st, a, b) => { const i = strongInfo(st, a, b); return i.kind === 'cell' ? 'cell ' + cellName(i.cell) + ' has only ' + cDig(a) + ' and ' + cDig(b) + ' left' : cDig(a) + ' has only two places left in ' + unitName(i.unit); };
  const list = ids => ids.map(candName).join(', ');

  /* ---------- result builders ---------- */
  function mkResult(tech, theorem) { return { tech, theorem, nodes: new Map(), links: [], elim: [], place: [], steps: [] }; }
  const say = (res, text, marks, clash) => res.steps.push({ text, marks: marks || null, clash: clash || null });
  function addLink(res, st, a, b, forceStrong) { const s = forceStrong === undefined ? !!strongInfo(st, a, b) : forceStrong; res.links.push({ a, b, strong: s }); }

  /* Odd loop (Theorem 5.2): chain = [a1..a2j], strong a1=a2, a3=a4, ...; each target is linked to a1 and a2j. */
  function oddLoop(st, tech, chain, targets, intro) {
    for (let i = 0; i < chain.length; i += 2) if (!strongInfo(st, chain[i], chain[i + 1])) return null;
    for (let i = 1; i + 1 < chain.length; i += 2) if (!linked(chain[i], chain[i + 1])) return null;
    targets = targets.filter(t => alive(st, t) && !chain.includes(t) && linked(t, chain[0]) && linked(t, chain[chain.length - 1]));
    if (!targets.length) return null;
    const res = mkResult(tech, 'Theorem 5.2: an odd loop forces a false');
    chain.forEach(c => res.nodes.set(c, 'loop'));
    targets.forEach(t => res.nodes.set(t, 'elim'));
    for (let i = 0; i + 1 < chain.length; i++) addLink(res, st, chain[i], chain[i + 1], i % 2 === 0);
    for (const t of targets) { res.links.push({ a: t, b: chain[0], strong: false }); res.links.push({ a: chain[chain.length - 1], b: t, strong: false }); }
    res.elim = targets;
    const v = targets[0], marks = {};
    const snap = () => Object.assign({}, marks);
    if (intro) say(res, intro);
    say(res, 'The loop has ' + (chain.length + 1) + ' candidates: the red one plus ' + chain.length + ' that the strong links pair up.');
    marks[v] = 't'; say(res, 'Suppose ' + candName(v) + ' were true.', snap());
    marks[chain[0]] = 'f'; say(res, 'Then ' + candName(chain[0]) + ' is false: ' + linkWhy(v, chain[0]) + '.', snap());
    for (let i = 1; i < chain.length; i++) {
      if (i % 2 === 1) { marks[chain[i]] = 't'; say(res, 'Then ' + candName(chain[i]) + ' is true: ' + strongWhy(st, chain[i - 1], chain[i]) + '.', snap()); }
      else { marks[chain[i]] = 'f'; say(res, 'Then ' + candName(chain[i]) + ' is false: ' + linkWhy(chain[i - 1], chain[i]) + '.', snap()); }
    }
    say(res, 'But ' + candName(chain[chain.length - 1]) + ' and ' + candName(v) + ' cannot both be true: ' + linkWhy(chain[chain.length - 1], v) + '. Contradiction, so ' + candName(v) + ' is false.', snap(), [chain[chain.length - 1], v]);
    if (targets.length > 1) say(res, 'The same argument removes: ' + list(targets.slice(1)) + '.');
    return res;
  }

  /* Even loop (Theorem 5.4): loop = [l0..l(2m-1)], strong l0=l1, l2=l3, ... */
  function evenLoop(st, tech, loop, intro) {
    const n = loop.length;
    for (let i = 0; i < n; i += 2) if (!strongInfo(st, loop[i], loop[i + 1])) return null;
    for (let i = 1; i < n; i += 2) if (!linked(loop[i], loop[(i + 1) % n])) return null;
    const res = mkResult(tech, 'Theorem 5.4: an even loop makes every link either-or');
    loop.forEach(c => res.nodes.set(c, 'loop'));
    const elim = new Set();
    for (let i = 0; i < n; i++) {
      const a = loop[i], b = loop[(i + 1) % n];
      addLink(res, st, a, b, i % 2 === 0);
      for (const x of neighbours(st, a)) if (!loop.includes(x) && linked(x, b)) elim.add(x);
    }
    if (!elim.size) return null;
    res.elim = [...elim]; res.elim.forEach(t => res.nodes.set(t, 'elim'));
    const pat = k => { const m = {}; loop.forEach((c, i) => { m[c] = i % 2 === k ? 't' : 'f'; }); res.elim.forEach(c => { m[c] = 'f'; }); return m; };
    if (intro) say(res, intro);
    say(res, 'The ' + n + ' circled candidates form a loop. Its ' + (n / 2) + ' strong links pair them all up, so exactly ' + (n / 2) + ' of them are true.');
    say(res, 'True candidates are never linked, so true and false alternate round the loop. Only two patterns do that.');
    say(res, 'Pattern A: ' + list(loop.filter((_, i) => i % 2 === 0)) + ' are true.', pat(0));
    say(res, 'Pattern B: ' + list(loop.filter((_, i) => i % 2 === 1)) + ' are true.', pat(1));
    say(res, 'In both patterns every dashed link has exactly one true end. A candidate linked to both ends of a dashed link is therefore false.');
    say(res, 'That removes: ' + list(res.elim) + '.');
    return res;
  }

  /* ---------- finders: each returns an array of results ---------- */
  function findLockedPair(st) {
    const out = [];
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) {
      const cs = cellsFor(st, u, d); if (cs.length !== 2) continue;
      for (const u2 of commonUnits(cs[0], cs[1])) if (u2 !== u) {
        const targets = cellsFor(st, u2, d).filter(c => c !== cs[0] && c !== cs[1]).map(c => cid(c, d));
        const r = oddLoop(st, 'Locked pair', [cid(cs[0], d), cid(cs[1], d)], targets,
          'In ' + unitName(u) + ' the digit ' + d + ' has only two places, and both lie in ' + unitName(u2) + '. This is the smallest loop: a triangle.');
        if (r) out.push(r);
      }
    }
    return out;
  }
  function findNakedPair(st) {
    const out = [];
    for (let u = 0; u < 27; u++) {
      const bi = UNITS[u].filter(c => !st.val[c] && bits(st.cand[c]) === 2);
      for (let i = 0; i < bi.length; i++) for (let j = i + 1; j < bi.length; j++) if (st.cand[bi[i]] === st.cand[bi[j]]) {
        const [a, b] = digits(st.cand[bi[i]]), X = bi[i], Y = bi[j];
        const r = evenLoop(st, 'Naked pair', [cid(X, a), cid(X, b), cid(Y, b), cid(Y, a)],
          'Cells ' + cellName(X) + ' and ' + cellName(Y) + ' both hold only ' + a + ' and ' + b + ', and they see each other.');
        if (r && !out.some(o => o.elim.join() === r.elim.join())) out.push(r);
      }
    }
    return out;
  }
  function findHiddenPair(st) {
    const out = [];
    for (let u = 0; u < 27; u++) for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 9; b++) {
      const ca = cellsFor(st, u, a), cb = cellsFor(st, u, b);
      if (ca.length === 2 && cb.length === 2 && ca[0] === cb[0] && ca[1] === cb[1]) {
        const [X, Y] = ca;
        const r = evenLoop(st, 'Hidden pair', [cid(X, a), cid(Y, a), cid(Y, b), cid(X, b)],
          'In ' + unitName(u) + ' the digits ' + a + ' and ' + b + ' each fit only cells ' + cellName(X) + ' and ' + cellName(Y) + '.');
        if (r) out.push(r);
      }
    }
    return out;
  }
  function findXWing(st) {
    const out = [];
    for (let d = 1; d <= 9; d++) for (const base of [0, 9]) {
      const lines = [];
      for (let u = base; u < base + 9; u++) { const cs = cellsFor(st, u, d); if (cs.length === 2) lines.push(cs); }
      const cross = c => base === 0 ? COL(c) : ROW(c);
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
        const A = lines[i], B = lines[j];
        if (cross(A[0]) === cross(B[0]) && cross(A[1]) === cross(B[1])) {
          const word = base === 0 ? ['rows', 'columns'] : ['columns', 'rows'];
          const r = evenLoop(st, 'X-Wing', [cid(A[0], d), cid(A[1], d), cid(B[1], d), cid(B[0], d)],
            'Digit ' + d + ' has only two places in each of two ' + word[0] + ', and they line up in the same two ' + word[1] + '.');
          if (r) out.push(r);
        }
      }
    }
    return out;
  }
  function findSkyscraper(st) {
    const out = [];
    for (let d = 1; d <= 9; d++) for (const base of [0, 9]) {
      const lines = [];
      for (let u = base; u < base + 9; u++) { const cs = cellsFor(st, u, d); if (cs.length === 2) lines.push(cs); }
      const cross = c => base === 0 ? COL(c) : ROW(c);
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) for (const [p1, q1] of [lines[i], lines[i].slice().reverse()]) for (const [p2, q2] of [lines[j], lines[j].slice().reverse()]) {
        if (cross(p1) !== cross(p2) || cross(q1) === cross(q2)) continue;
        const targets = PEERS[q1].filter(c => sees(c, q2) && has(st, c, d)).map(c => cid(c, d));
        const r = oddLoop(st, 'Skyscraper', [cid(q1, d), cid(p1, d), cid(p2, d), cid(q2, d)], targets,
          'Digit ' + d + ' has only two places in each of two parallel lines, and one end of each shares a line.');
        if (r) out.push(r);
      }
    }
    return out;
  }
  function findKite(st) {
    const out = [];
    for (let d = 1; d <= 9; d++) for (let ru = 0; ru < 9; ru++) {
      const rc = cellsFor(st, ru, d); if (rc.length !== 2) continue;
      for (let cu = 9; cu < 18; cu++) {
        const cc = cellsFor(st, cu, d); if (cc.length !== 2) continue;
        for (const [A, B] of [rc, rc.slice().reverse()]) for (const [C, D] of [cc, cc.slice().reverse()]) {
          if (B === C || A === C || A === D || B === D) continue;
          if (BOX(B) !== BOX(C) || BOX(A) === BOX(B) || BOX(D) === BOX(C)) continue;
          const targets = PEERS[A].filter(c => sees(c, D) && has(st, c, d)).map(c => cid(c, d));
          const r = oddLoop(st, 'Two-String Kite', [cid(A, d), cid(B, d), cid(C, d), cid(D, d)], targets,
            'Digit ' + d + ' has only two places in ' + unitName(ru) + ' and only two in ' + unitName(cu) + '. One end of each lies in the same box.');
          if (r) out.push(r);
        }
      }
    }
    return out;
  }
  function findXYWing(st) {
    const out = [];
    const bi = []; for (let c = 0; c < 81; c++) if (!st.val[c] && bits(st.cand[c]) === 2) bi.push(c);
    for (const P of bi) {
      const [a, b] = digits(st.cand[P]);
      const wings = PEERS[P].filter(c => bi.includes(c));
      for (const W1 of wings) for (const W2 of wings) {
        if (W1 === W2) continue;
        const d1 = digits(st.cand[W1]), d2 = digits(st.cand[W2]);
        if (!d1.includes(a) || d1.includes(b) || !d2.includes(b) || d2.includes(a)) continue;
        const c = d1.find(x => x !== a); if (!d2.includes(c)) continue;
        const targets = PEERS[W1].filter(z => sees(z, W2) && z !== P && has(st, z, c)).map(z => cid(z, c));
        const r = oddLoop(st, 'XY-Wing', [cid(W1, c), cid(W1, a), cid(P, a), cid(P, b), cid(W2, b), cid(W2, c)], targets,
          'Pivot ' + cellName(P) + ' holds ' + a + ' and ' + b + '. Wing ' + cellName(W1) + ' holds ' + a + ' and ' + c + ', wing ' + cellName(W2) + ' holds ' + b + ' and ' + c + '.');
        if (r) out.push(r);
      }
    }
    return out;
  }

  /* Generic odd loop: breadth-first search for a closed alternating walk (Proposition 7.2), kept only when it is a simple cycle. */
  function chainFor(st, v, sameDigit, maxPairs) {
    const ok = x => !sameDigit || cDig(x) === cDig(v);
    const parent = new Map(); parent.set(v, null);
    let frontier = [v];
    for (let depth = 1; depth <= maxPairs && frontier.length; depth++) {
      const next = [];
      for (const x of frontier) for (const y of neighbours(st, x)) {
        if (y === v || !ok(y)) continue;
        for (const z of strongPartners(st, y)) {
          if (!ok(z) || parent.has(z)) continue;
          parent.set(z, { x, y }); next.push(z);
          if (depth >= 2 && linked(z, v)) {
            const chain = []; let cur = z;
            while (cur !== v) { const p = parent.get(cur); chain.unshift(p.y, cur); cur = p.x; }
            if (new Set(chain).size === chain.length && !chain.includes(v)) return chain;
          }
        }
      }
      frontier = next;
    }
    return null;
  }
  function nameChain(st, v, chain) {
    const all = [v].concat(chain), one = all.every(x => cDig(x) === cDig(v)), k = all.length;
    const kinds = []; for (let i = 0; i < chain.length; i += 2) kinds.push(strongInfo(st, chain[i], chain[i + 1]).kind);
    if (one) return k === 5 ? 'Turbot Fish' : 'X-Cycle (odd loop of ' + k + ')';
    if (kinds.every(x => x === 'cell')) return k === 7 ? 'XY-Wing' : 'XY-Chain (loop of ' + k + ')';
    if (k === 7 && kinds.join() === 'cell,unit,cell' && st.cand[cCell(chain[0])] === st.cand[cCell(chain[5])]) return 'W-Wing';
    return 'Alternating chain (loop of ' + k + ')';
  }
  function findChains(st, sameDigit, maxPairs, limit) {
    const out = [];
    for (let id = 0; id < 729 && out.length < (limit || 1); id++) if (alive(st, id)) {
      const chain = chainFor(st, id, sameDigit, maxPairs || 5);
      if (!chain) continue;
      const r = oddLoop(st, nameChain(st, id, chain), chain, [id], 'A chain of alternating links starts and ends next to the red candidate.');
      if (r) out.push(r);
    }
    return out;
  }

  /* Colouring (Theorem 5.1 and Corollary 5.5). digit = 1..9 for Simple Colouring, 0 for 3D Medusa (all strong links). */
  function findColouring(st, digit) {
    const out = [], seen = new Set();
    const okNode = id => digit === 0 || cDig(id) === digit;
    const partners = id => strongPartners(st, id).filter(okNode);
    for (let start = 0; start < 729; start++) {
      if (!alive(st, start) || !okNode(start) || seen.has(start) || !partners(start).length) continue;
      const colour = new Map([[start, 0]]), stack = [start], edges = [];
      while (stack.length) { const x = stack.pop(); for (const y of partners(x)) { if (!colour.has(y)) { colour.set(y, 1 - colour.get(x)); stack.push(y); } if (x < y) edges.push([x, y]); } }
      colour.forEach((_, k) => seen.add(k));
      const nodes = [...colour.keys()];
      if (nodes.length < 4) continue;
      if (digit === 0 && !edges.some(([x, y]) => cCell(x) === cCell(y))) continue;
      const cls = [nodes.filter(n => colour.get(n) === 0), nodes.filter(n => colour.get(n) === 1)];
      const base = (tech) => { const r = mkResult(tech, 'Theorem 5.1 and Corollary 5.5: colouring'); nodes.forEach(n => r.nodes.set(n, colour.get(n) === 0 ? 'k0' : 'k1')); edges.forEach(([x, y]) => r.links.push({ a: x, b: y, strong: true }));
        say(r, (digit ? 'For digit ' + digit + ', ' : 'Across all digits, ') + nodes.length + ' candidates are chained together by strong links.');
        say(r, 'Along a strong link exactly one end is true. So colouring the chain alternately gives two colours, and one whole colour is true while the other is false.'); return r; };
      const name = digit ? 'Simple Colouring' : '3D Medusa';
      let wrap = null;
      for (let k = 0; k < 2 && !wrap; k++) for (let i = 0; i < cls[k].length && !wrap; i++) for (let j = i + 1; j < cls[k].length; j++) if (linked(cls[k][i], cls[k][j])) { wrap = [k, cls[k][i], cls[k][j]]; break; }
      if (wrap) {
        const [k, a, b] = wrap, r = base(name + ' (wrap)'), word = k === 0 ? 'blue' : 'orange', otherWord = k === 0 ? 'orange' : 'blue';
        r.links.push({ a, b, strong: false, clash: true });
        r.elim = cls[k].slice(); r.place = cls[1 - k].slice();
        say(r, 'Two ' + word + ' candidates, ' + candName(a) + ' and ' + candName(b) + ', are linked: ' + linkWhy(a, b) + '. They cannot both be true.', null, [a, b]);
        say(r, 'So ' + word + ' is not the true colour. Every ' + word + ' candidate goes, and every ' + otherWord + ' candidate is placed.');
        r.wrapClass = k; out.push(r); continue;
      }
      const trap = [];
      for (let id = 0; id < 729; id++) if (alive(st, id) && !colour.has(id)) {
        const s0 = cls[0].find(n => linked(id, n)), s1 = cls[1].find(n => linked(id, n));
        if (s0 !== undefined && s1 !== undefined) trap.push([id, s0, s1]);
      }
      if (trap.length) {
        const r = base(name + ' (trap)');
        for (const [id, s0, s1] of trap) { r.elim.push(id); r.nodes.set(id, 'elim'); r.links.push({ a: id, b: s0, strong: false }); r.links.push({ a: id, b: s1, strong: false }); }
        const [id, s0, s1] = trap[0];
        say(r, candName(id) + ' is linked to a blue candidate (' + candName(s0) + ') and to an orange one (' + candName(s1) + ').');
        say(r, 'One of the two colours is true, so ' + candName(id) + ' is linked to a true candidate. It is false.');
        if (trap.length > 1) say(r, 'The same argument removes: ' + list(trap.slice(1).map(t => t[0])) + '.');
        out.push(r);
      }
    }
    return out;
  }
  function findSimpleColouring(st) { let out = []; for (let d = 1; d <= 9; d++) out = out.concat(findColouring(st, d)); return out; }

  /* Singles (not loop techniques; used to advance a puzzle) */
  function findSingle(st) {
    for (let c = 0; c < 81; c++) if (!st.val[c] && bits(st.cand[c]) === 1) return { cell: c, d: digits(st.cand[c])[0], why: 'Only digit left in ' + cellName(c) };
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) { const cs = cellsFor(st, u, d); if (cs.length === 1) return { cell: cs[0], d, why: 'Only place for ' + d + ' in ' + unitName(u) }; }
    return null;
  }
  function fillSingles(st) { let n = 0, s; while ((s = findSingle(st))) { place(st, s.cell, s.d); n++; } return n; }
  function apply(st, res) { for (const id of res.elim) eliminate(st, id); for (const id of res.place) if (alive(st, id)) place(st, cCell(id), cDig(id)); }
  const solved = st => st.val.every(v => v > 0);
  const broken = st => st.val.some((v, c) => !v && st.cand[c] === 0);

  const TECHNIQUES = [
    { key: 'locked', name: 'Locked pair', loop: 'triangle', find: findLockedPair, blurb: 'A candidate that sees both ends of a strong link.' },
    { key: 'naked', name: 'Naked pair', loop: 'loop of 4', find: findNakedPair, blurb: 'Two cells that share the same two digits.' },
    { key: 'hidden', name: 'Hidden pair', loop: 'loop of 4', find: findHiddenPair, blurb: 'Two digits that share the same two cells.' },
    { key: 'xwing', name: 'X-Wing', loop: 'loop of 4', find: findXWing, blurb: 'One digit, two lines, the same two crossing lines.' },
    { key: 'sky', name: 'Skyscraper', loop: 'loop of 5', find: findSkyscraper, blurb: 'Two parallel strong links that share a line at one end.' },
    { key: 'kite', name: 'Two-String Kite', loop: 'loop of 5', find: findKite, blurb: 'A row link and a column link joined inside a box.' },
    { key: 'xywing', name: 'XY-Wing', loop: 'loop of 7', find: findXYWing, blurb: 'Three two-digit cells: a pivot and two wings.' },
    { key: 'colour', name: 'Simple Colouring', loop: '2-colouring', find: findSimpleColouring, blurb: 'Colour one digit’s strong links with two colours.' },
    { key: 'xchain', name: 'One-digit loop', loop: 'Turbot Fish, X-Cycle', find: st => findChains(st, true, 5, 1), blurb: 'A longer odd loop of one digit.' },
    { key: 'medusa', name: '3D Medusa', loop: '2-colouring', find: st => findColouring(st, 0), blurb: 'Colouring that hops between digits.' },
    { key: 'chain', name: 'Alternating chain', loop: 'odd loop', find: st => findChains(st, false, 6, 1), blurb: 'Any odd loop with alternating strong links.' }
  ];

  root.SudokuEngine = { ROW, COL, BOX, UNITS, PEERS, sees, unitName, cellName, cid, cCell, cDig, candName, bits, digits, fromString, check, toString, clone, has, alive, place, eliminate, cellsFor,
    solve, linked, linkInfo, strongInfo, neighbours, strongPartners, linkWhy, strongWhy, findSingle, fillSingles, apply, solved, broken, TECHNIQUES, findChains, findColouring };
})(typeof window !== 'undefined' ? window : globalThis);
