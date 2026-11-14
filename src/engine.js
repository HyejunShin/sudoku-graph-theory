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
  function neighbors(st, id) {
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
      for (const x of neighbors(st, a)) if (!loop.includes(x) && linked(x, b)) elim.add(x);
    }
    if (!elim.size) return null;
    res.elim = [...elim]; res.elim.forEach(t => res.nodes.set(t, 'elim'));
    // every removed candidate gets one dashed link, to the nearer end of the loop link it is linked to (it is linked to both ends)
    for (const x of res.elim) for (let i = 0; i < n; i++) { const a = loop[i], b = loop[(i + 1) % n]; if (linked(x, a) && linked(x, b)) { const far = c => Math.abs(ROW(cCell(x)) - ROW(cCell(c))) + Math.abs(COL(cCell(x)) - COL(cCell(c))); res.links.push({ a: x, b: far(a) <= far(b) ? a : b, strong: false }); break; } }
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
      for (const x of frontier) for (const y of neighbors(st, x)) {
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

  /* Coloring (Theorem 5.1 and Corollary 5.5). digit = 1..9 for Simple Coloring, 0 for 3D Medusa (all strong links). */
  function findColoring(st, digit) {
    const out = [], seen = new Set();
    const okNode = id => digit === 0 || cDig(id) === digit;
    const partners = id => strongPartners(st, id).filter(okNode);
    for (let start = 0; start < 729; start++) {
      if (!alive(st, start) || !okNode(start) || seen.has(start) || !partners(start).length) continue;
      const color = new Map([[start, 0]]), stack = [start], edges = [];
      while (stack.length) { const x = stack.pop(); for (const y of partners(x)) { if (!color.has(y)) { color.set(y, 1 - color.get(x)); stack.push(y); } if (x < y) edges.push([x, y]); } }
      color.forEach((_, k) => seen.add(k));
      const nodes = [...color.keys()];
      if (nodes.length < 4) continue;
      if (digit === 0 && !edges.some(([x, y]) => cCell(x) === cCell(y))) continue;
      const cls = [nodes.filter(n => color.get(n) === 0), nodes.filter(n => color.get(n) === 1)];
      const base = (tech) => { const r = mkResult(tech, 'Theorem 5.1 and Corollary 5.5: coloring'); nodes.forEach(n => r.nodes.set(n, color.get(n) === 0 ? 'k0' : 'k1')); edges.forEach(([x, y]) => r.links.push({ a: x, b: y, strong: true }));
        say(r, (digit ? 'For digit ' + digit + ', ' : 'Across all digits, ') + nodes.length + ' candidates are chained together by strong links.');
        say(r, 'Along a strong link exactly one end is true. So coloring the chain alternately gives two colors, and one whole color is true while the other is false.'); return r; };
      const name = digit ? 'Simple Coloring' : '3D Medusa';
      let wrap = null;
      for (let k = 0; k < 2 && !wrap; k++) for (let i = 0; i < cls[k].length && !wrap; i++) for (let j = i + 1; j < cls[k].length; j++) if (linked(cls[k][i], cls[k][j])) { wrap = [k, cls[k][i], cls[k][j]]; break; }
      if (wrap) {
        const [k, a, b] = wrap, r = base(name + ' (wrap)'), word = k === 0 ? 'blue' : 'orange', otherWord = k === 0 ? 'orange' : 'blue';
        r.links.push({ a, b, strong: false, clash: true });
        r.elim = cls[k].slice(); r.place = cls[1 - k].slice();
        say(r, 'Two ' + word + ' candidates, ' + candName(a) + ' and ' + candName(b) + ', are linked: ' + linkWhy(a, b) + '. They cannot both be true.', null, [a, b]);
        say(r, 'So ' + word + ' is not the true color. Every ' + word + ' candidate goes, and every ' + otherWord + ' candidate is placed.');
        r.wrapClass = k; out.push(r); continue;
      }
      const trap = [];
      for (let id = 0; id < 729; id++) if (alive(st, id) && !color.has(id)) {
        const s0 = cls[0].find(n => linked(id, n)), s1 = cls[1].find(n => linked(id, n));
        if (s0 !== undefined && s1 !== undefined) trap.push([id, s0, s1]);
      }
      if (trap.length) {
        const r = base(name + ' (trap)');
        for (const [id, s0, s1] of trap) { r.elim.push(id); r.nodes.set(id, 'elim'); r.links.push({ a: id, b: s0, strong: false }); r.links.push({ a: id, b: s1, strong: false }); }
        const [id, s0, s1] = trap[0];
        say(r, candName(id) + ' is linked to a blue candidate (' + candName(s0) + ') and to an orange one (' + candName(s1) + ').');
        say(r, 'One of the two colors is true, so ' + candName(id) + ' is linked to a true candidate. It is false.');
        if (trap.length > 1) say(r, 'The same argument removes: ' + list(trap.slice(1).map(t => t[0])) + '.');
        out.push(r);
      }
    }
    return out;
  }
  function findSimpleColoring(st) { let out = []; for (let d = 1; d <= 9; d++) out = out.concat(findColoring(st, d)); return out; }

  /* Singles (not loop techniques; used to advance a puzzle) */
  function findSingle(st) {
    for (let c = 0; c < 81; c++) if (!st.val[c] && bits(st.cand[c]) === 1) return { cell: c, d: digits(st.cand[c])[0], why: 'Only digit left in ' + cellName(c) };
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) { const cs = cellsFor(st, u, d); if (cs.length === 1) return { cell: cs[0], d, why: 'Only place for ' + d + ' in ' + unitName(u) }; }
    return null;
  }
  /* Every single candidate cell as its own one-step move. The page uses these only when automatic filling is switched off. */
  function findSingles(st) {
    const out = [], seen = new Set();
    const add = (cell, d, text) => {
      const id = cid(cell, d); if (seen.has(id)) return; seen.add(id);
      const res = mkResult('Single candidate', 'Only one choice'); res.easy = true;
      res.nodes.set(id, 'loop'); res.place = [id];
      say(res, text + ' So ' + d + ' goes in ' + cellName(cell) + '.', { [id]: 't' });
      out.push(res);
    };
    for (let c = 0; c < 81; c++) if (!st.val[c] && bits(st.cand[c]) === 1) add(c, digits(st.cand[c])[0], cellName(c) + ' has only one candidate left.');
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) { const cs = cellsFor(st, u, d); if (cs.length === 1) add(cs[0], d, 'In ' + unitName(u) + ' the digit ' + d + ' has only one place left.'); }
    return out;
  }
  function fillSingles(st) { let n = 0, s; while ((s = findSingle(st))) { place(st, s.cell, s.d); n++; } return n; }
  function apply(st, res) { for (const id of res.elim) eliminate(st, id); for (const id of res.place) if (alive(st, id)) place(st, cCell(id), cDig(id)); }
  const solved = st => st.val.every(v => v > 0);
  const broken = st => st.val.some((v, c) => !v && st.cand[c] === 0);

  /* ---------- beyond links ----------
     A link joins two candidates. The three finders below need a fact about three or more at once, so no loop explains them.
     They are tried only when every link technique has failed. */
  const combos = (arr, k) => { const out = []; (function rec(i, cur) { if (cur.length === k) { out.push(cur.slice()); return; } for (let j = i; j < arr.length; j++) { cur.push(arr[j]); rec(j + 1, cur); cur.pop(); } })(0, []); return out; };
  const cellList = cs => cs.map(cellName).join(', ');
  const digitList = ds => ds.length > 1 ? ds.slice(0, -1).join(', ') + ' and ' + ds[ds.length - 1] : String(ds[0]);

  /* Locked triple: in one unit a digit has exactly three places, and all three lie in a second unit.
     One of the three is true whichever it is, so the digit leaves the rest of the second unit.
     With two places this is the Locked pair triangle; with three, the group has to act as one candidate. */
  function findLockedGroup(st) {
    const out = [];
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) {
      const cs = cellsFor(st, u, d); if (cs.length !== 3) continue;
      for (const u2 of cellUnits(cs[0])) if (u2 !== u && cs.every(c => UNITS[u2].includes(c))) {
        const targets = cellsFor(st, u2, d).filter(c => !cs.includes(c)).map(c => cid(c, d));
        if (!targets.length) continue;
        const group = cs.map(c => cid(c, d)), v = targets[0], marks = {};
        const res = mkResult('Locked triple', 'Lemma 7.4: three candidates act as one dot');
        group.forEach(g => res.nodes.set(g, 'k0')); targets.forEach(t => res.nodes.set(t, 'elim')); res.groups = [group];
        res.elim = targets; linkToGroups(res);
        const snap = () => Object.assign({}, marks);
        say(res, 'In ' + unitName(u) + ' the digit ' + d + ' has only three places, and all three lie in ' + unitName(u2) + '.');
        say(res, 'One of the three blue ' + d + 's is true, because ' + unitName(u) + ' needs a ' + d + '. A link joins only two candidates, so treat the three as one group: a single dot that is true when one of them is.');
        marks[v] = 't'; say(res, 'Suppose ' + candName(v) + ' were true.', snap());
        group.forEach(g => { marks[g] = 'f'; }); say(res, 'Then all three ' + d + 's of the group are false: each shares ' + unitName(u2) + ' with it.', snap());
        say(res, 'Now ' + unitName(u) + ' has no place for ' + d + '. Contradiction, so ' + candName(v) + ' is false.', snap());
        if (targets.length > 1) say(res, 'The same argument removes: ' + list(targets.slice(1)) + '.');
        out.push(res);
      }
    }
    return out;
  }

  /* For a counting pattern: a dashed link from every removed candidate to the nearest member of the group dot it is linked to. */
  function linkToGroups(res) {
    for (const e of res.elim) {
      let best = null;
      for (const g of res.groups) for (const m of g) if (linked(e, m)) {
        const dist = Math.abs(ROW(cCell(e)) - ROW(cCell(m))) * 3 + Math.abs(COL(cCell(e)) - COL(cCell(m))) * 3 + Math.abs(cDig(e) - cDig(m)) * 0.1;
        if (!best || dist < best[1]) best = [m, dist];
      }
      if (best) res.links.push({ a: e, b: best[0], strong: false });
    }
  }

  /* Triples and quads. Naked: k cells of a unit hold only k digits between them, so those digits are used up there.
     Hidden: k digits fit only in k cells of a unit, so those cells hold nothing else.
     Both are counting arguments (Hall's theorem on the cells and digits of the unit), not link arguments. */
  function findSubsets(st) {
    const out = [], seen = new Set();
    const push = (res, elim) => { const key = elim.slice().sort((a, b) => a - b).join(','); if (seen.has(key)) return; seen.add(key); res.elim = elim; elim.forEach(e => res.nodes.set(e, 'elim')); linkToGroups(res); out.push(res); };
    for (const k of [3, 4]) for (let u = 0; u < 27; u++) {
      const cells = UNITS[u].filter(c => !st.val[c]);
      if (cells.length <= k) continue;
      const word = k === 3 ? 'triple' : 'quad', num = k === 3 ? 'Three' : 'Four';
      for (const cs of combos(cells, k)) {
        let m = 0; for (const c of cs) m |= st.cand[c];
        if (bits(m) !== k) continue;
        const elim = []; for (const c of cells) if (!cs.includes(c)) for (const d of digits(st.cand[c] & m)) elim.push(cid(c, d));
        if (!elim.length) continue;
        const res = mkResult('Naked ' + word, 'Theorem 7.5, the sets rule: ' + k + ' cells need ' + k + ' digits');
        res.groups = digits(m).map(d => cs.filter(c => has(st, c, d)).map(c => cid(c, d))); res.groupStyle = 'arc';
        res.groups.forEach(g => g.forEach(id => res.nodes.set(id, 'k0')));
        say(res, 'In ' + unitName(u) + ', the cells ' + cellList(cs) + ' hold only the digits ' + digitList(digits(m)) + ' between them.');
        say(res, num + ' cells need ' + num.toLowerCase() + ' different digits, so each of ' + digitList(digits(m)) + ' is used inside these cells. For each digit, join its candidates there into one blue dot. The count proves every blue dot true.');
        say(res, 'Any other candidate of ' + unitName(u) + ' with one of those digits is linked to a true dot, so it is false. That removes: ' + list(elim) + '.');
        push(res, elim);
      }
      const ds = []; for (let d = 1; d <= 9; d++) if (cells.some(c => has(st, c, d))) ds.push(d);
      for (const dd of combos(ds, k)) {
        const where = cells.filter(c => dd.some(d => has(st, c, d)));
        if (where.length !== k) continue;
        const elim = []; for (const c of where) for (const d of digits(st.cand[c])) if (!dd.includes(d)) elim.push(cid(c, d));
        if (!elim.length) continue;
        const res = mkResult('Hidden ' + word, 'Theorem 7.5, the sets rule: ' + k + ' digits need ' + k + ' cells');
        res.groups = where.map(c => dd.filter(d => has(st, c, d)).map(d => cid(c, d))); res.groupStyle = 'arc';
        res.groups.forEach(g => g.forEach(id => res.nodes.set(id, 'k0')));
        say(res, 'In ' + unitName(u) + ', the digits ' + digitList(dd) + ' fit only in the cells ' + cellList(where) + '.');
        say(res, num + ' digits need ' + num.toLowerCase() + ' different cells, so each of these cells holds one of ' + digitList(dd) + '. In each cell, join those candidates into one blue dot. The count proves every blue dot true.');
        say(res, 'Any other candidate in these cells shares its cell with a true dot, so it is false. That removes: ' + list(elim) + '.');
        push(res, elim);
      }
    }
    return out;
  }

  /* Swordfish and Jellyfish: one digit, k rows whose places for it lie in only k columns (or the other way round).
     k rows need k different columns, so the digit leaves the rest of those columns. The same counting as a triple or quad. */
  function findFish(st) {
    const out = [], seen = new Set();
    for (const k of [3, 4]) for (let d = 1; d <= 9; d++) for (const [base, cover, baseOf, coverOf, bn, cn] of [[0, 9, ROW, COL, 'rows', 'columns'], [9, 0, COL, ROW, 'columns', 'rows']]) {
      const lines = []; for (let i = 0; i < 9; i++) { const cs = cellsFor(st, base + i, d); if (cs.length >= 2 && cs.length <= k) lines.push({ i, cs }); }
      for (const ls of combos(lines, k)) {
        const cov = new Set(); for (const l of ls) for (const c of l.cs) cov.add(coverOf(c));
        if (cov.size !== k) continue;
        const bi = ls.map(l => l.i), cv = [...cov].sort((a, b) => a - b), elim = [];
        for (const x of cv) for (const c of UNITS[cover + x]) if (!bi.includes(baseOf(c)) && has(st, c, d)) elim.push(cid(c, d));
        const key = elim.join(','); if (!elim.length || seen.has(key)) continue; seen.add(key);
        const num = k === 3 ? 'three' : 'four';
        const res = mkResult(k === 3 ? 'Swordfish' : 'Jellyfish', 'Theorem 7.5, the sets rule: ' + k + ' ' + bn + ' need ' + k + ' ' + cn);
        res.groups = cv.map(x => { const g = []; for (const l of ls) for (const c of l.cs) if (coverOf(c) === x) g.push(cid(c, d)); return g; }); res.groupStyle = 'arc';
        res.groups.forEach(g => g.forEach(id => res.nodes.set(id, 'k0')));
        elim.forEach(e => res.nodes.set(e, 'elim')); res.elim = elim;
        say(res, 'In ' + bn + ' ' + bi.map(i => i + 1).join(', ') + ' the digit ' + d + ' fits only in ' + cn + ' ' + cv.map(i => i + 1).join(', ') + '.');
        say(res, 'Each of the ' + num + ' ' + bn + ' needs its ' + d + ' in a different one of those ' + cn + ', so every one of the ' + cn + ' gets its ' + d + ' from these ' + bn + '. In each of the ' + cn + ', join those ' + d + 's into one blue dot. The count proves every blue dot true.');
        say(res, 'Any other ' + d + ' in those ' + cn + ' is linked to a true dot, so it is false. That removes: ' + list(elim) + '.');
        linkToGroups(res);
        out.push(res);
      }
    }
    return out;
  }

  /* XYZ-Wing: a pivot cell holding x, y, z and two wings it sees, holding x z and y z.
     Whichever digit the pivot takes, one of the three cells is z, so a cell that sees all three cannot be z. */
  function findXYZWing(st) {
    const out = [];
    for (let p = 0; p < 81; p++) if (!st.val[p] && bits(st.cand[p]) === 3) {
      const wings = PEERS[p].filter(c => !st.val[c] && bits(st.cand[c]) === 2 && (st.cand[c] & ~st.cand[p]) === 0);
      for (const [w1, w2] of combos(wings, 2)) {
        if (st.cand[w1] === st.cand[w2]) continue;
        const z = digits(st.cand[w1] & st.cand[w2])[0], x = digits(st.cand[w1] & ~(1 << z))[0], y = digits(st.cand[w2] & ~(1 << z))[0];
        const elim = []; for (let c = 0; c < 81; c++) if (c !== p && c !== w1 && c !== w2 && has(st, c, z) && sees(c, p) && sees(c, w1) && sees(c, w2)) elim.push(cid(c, z));
        if (!elim.length) continue;
        const res = mkResult('XYZ-Wing', 'Lemma 7.6 and Theorem 5.2: a triangle whose link is counted');
        // the group dot is the z of the pivot together with the z of one wing; the wing in line with the pivot draws best
        const inLine = w => ROW(w) === ROW(p) || COL(w) === COL(p);
        // ...but not if a removed candidate would sit inside the outline drawn round the two
        const between = w => elim.some(e => { const c = cCell(e); return ROW(c) >= Math.min(ROW(p), ROW(w)) && ROW(c) <= Math.max(ROW(p), ROW(w)) && COL(c) >= Math.min(COL(p), COL(w)) && COL(c) <= Math.max(COL(p), COL(w)); });
        const first = [w1, w2].filter(w => !between(w)).sort((a, b) => inLine(b) - inLine(a))[0];
        const [ga, gb, xa, xb] = first === w2 ? [w2, w1, y, x] : [w1, w2, x, y];
        const zp = cid(p, z), zg = cid(ga, z), zo = cid(gb, z), v = elim[0], marks = {}, snap = () => Object.assign({}, marks);
        for (const c of [p, w1, w2]) for (const d of digits(st.cand[c])) res.nodes.set(cid(c, d), 'loop');
        res.nodes.set(zp, 'k0'); res.nodes.set(zg, 'k0'); res.groups = first === undefined ? [] : [[zp, zg]];
        elim.forEach(e => res.nodes.set(e, 'elim')); res.elim = elim;
        res.links.push({ a: v, b: zp, strong: false }); res.links.push({ a: zg, b: zo, strong: true, group: true }); res.links.push({ a: zo, b: v, strong: false });
        for (const e of elim.slice(1)) { res.links.push({ a: e, b: zp, strong: false }); res.links.push({ a: e, b: zo, strong: false }); }
        say(res, 'The pivot ' + cellName(p) + ' holds ' + digitList([x, y, z].sort()) + '. It sees ' + cellName(ga) + ', which holds ' + digitList([xa, z].sort()) + ', and ' + cellName(gb) + ', which holds ' + digitList([xb, z].sort()) + '.');
        say(res, 'Take the two blue ' + z + 's, in ' + cellName(p) + ' and ' + cellName(ga) + ', as one dot: true when one of them is ' + z + '.');
        say(res, 'If the blue dot is false, the pivot is not ' + z + ' and ' + cellName(ga) + ' is ' + xa + ', so the pivot is ' + xb + ' and ' + cellName(gb) + ' must be ' + z + '. So the blue dot and ' + candName(zo) + ' cannot both be false: a link found by counting (solid line).');
        marks[v] = 't'; say(res, 'Suppose ' + candName(v) + ' were true.', snap());
        marks[zp] = 'f'; marks[zg] = 'f'; say(res, 'Then the blue dot is false: ' + cellName(cCell(v)) + ' sees both of its cells.', snap());
        marks[zo] = 't'; say(res, 'Then ' + candName(zo) + ' is true, by the counted link.', snap());
        say(res, 'But ' + candName(zo) + ' and ' + candName(v) + ' cannot both be true: ' + linkWhy(zo, v) + '. Contradiction, so ' + candName(v) + ' is false.', snap(), [zo, v]);
        if (elim.length > 1) say(res, 'The same argument removes: ' + list(elim.slice(1)) + '.');
        out.push(res);
      }
    }
    return out;
  }

  /* Grouped chain: the odd loop of Theorem 5.2 for one digit, where a dot may be a group: two or three cells of a box
     that share a row or column. A group is "true" when one of its cells holds the digit. Two dots are linked when they
     share no cell and all their cells lie in one unit; the link is strong when together they are every place left for the
     digit in that unit. Empty Rectangle and grouped X-Cycles are loops of this kind. */
  function findGroupedChains(st) {
    const out = [];
    for (let d = 1; d <= 9 && !out.length; d++) {
      const nodes = [];
      for (let c = 0; c < 81; c++) if (has(st, c, d)) nodes.push([c]);
      for (let b = 0; b < 9; b++) { const cs = cellsFor(st, 18 + b, d); for (const key of [ROW, COL]) { const by = {}; for (const c of cs) (by[key(c)] = by[key(c)] || []).push(c); for (const k in by) if (by[k].length >= 2) nodes.push(by[k]); } }
      const n = nodes.length, unitOf = (A, B) => { if (A.some(c => B.includes(c))) return -1; for (const u of cellUnits(A[0])) if (A.every(c => UNITS[u].includes(c)) && B.every(c => UNITS[u].includes(c))) return u; return -1; };
      const weak = Array.from({ length: n }, () => []), strong = Array.from({ length: n }, () => []);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) {
        const u = unitOf(nodes[i], nodes[j]); if (u < 0) continue;
        weak[i].push({ j, u });
        for (const u2 of cellUnits(nodes[i][0])) if (nodes[i].every(c => UNITS[u2].includes(c)) && nodes[j].every(c => UNITS[u2].includes(c)) && cellsFor(st, u2, d).length === nodes[i].length + nodes[j].length) { strong[i].push({ j, u: u2 }); break; }
      }
      const nm = A => A.length === 1 ? candName(cid(A[0], d)) : 'the group of ' + d + 's in ' + A.map(cellName).join(', ');
      for (let v = 0; v < n && !out.length; v++) if (nodes[v].length === 1) {
        // breadth-first over "false" dots; each is reached from v or from a true dot, and leads to its strong partners
        let frontier = [{ f: null, t: v, uw: -1, us: -1, prev: null }], hit = null; const seenT = new Set([v]);
        for (let depth = 1; depth <= 5 && !hit && frontier.length; depth++) {
          const next = [];
          for (const cur of frontier) { if (hit) break;
            for (const w of weak[cur.t]) { if (hit) break;
              for (const sgl of strong[w.j]) {
                if (seenT.has(sgl.j)) continue; seenT.add(sgl.j);
                const step = { f: w.j, t: sgl.j, uw: w.u, us: sgl.u, prev: cur };
                const close = weak[sgl.j].find(e => e.j === v);
                if (close) { step.uc = close.u; hit = step; break; }
                next.push(step);
              } } }
          frontier = next;
        }
        if (!hit) continue;
        const path = []; for (let x = hit; x && x.f !== null; x = x.prev) path.unshift(x);
        if (!path.some(x => nodes[x.f].length > 1 || nodes[x.t].length > 1)) continue;      // no group in it: an ordinary loop, left to the link techniques
        const vid = cid(nodes[v][0], d), res = mkResult('Grouped chain', 'Lemma 7.4 and Theorem 5.2: an odd loop with a group as one dot'), marks = {}, snap = () => Object.assign({}, marks);
        const ids = A => A.map(c => cid(c, d)), near = (A, B) => { let best = null; for (const a of A) for (const b of B) { const dist = Math.abs(ROW(a) - ROW(b)) + Math.abs(COL(a) - COL(b)); if (!best || dist < best[2]) best = [a, b, dist]; } return best; };
        const link = (A, B, strongLink) => { const pr = near(A, B); res.links.push({ a: cid(pr[0], d), b: cid(pr[1], d), strong: strongLink, group: true }); };
        res.groups = [];
        for (const x of path) for (const A of [nodes[x.f], nodes[x.t]]) { ids(A).forEach(id => res.nodes.set(id, A.length > 1 ? 'k0' : 'loop')); if (A.length > 1) res.groups.push(ids(A)); }
        res.nodes.set(vid, 'elim'); res.elim = [vid];
        let prev = nodes[v];
        for (const x of path) { link(prev, nodes[x.f], false); link(nodes[x.f], nodes[x.t], true); prev = nodes[x.t]; }
        link(prev, nodes[v], false);
        say(res, 'This is an odd loop for the digit ' + d + ', but some of its dots are groups (blue): cells of one box that share a row or column. A group counts as true when one of its cells holds the ' + d + '.');
        marks[vid] = 't'; say(res, 'Suppose ' + candName(vid) + ' were true.', snap());
        for (const x of path) {
          ids(nodes[x.f]).forEach(id => { marks[id] = 'f'; }); say(res, 'Then ' + nm(nodes[x.f]) + ' is false: it shares ' + unitName(x.uw) + ' with the one before.', snap());
          ids(nodes[x.t]).forEach(id => { marks[id] = 't'; }); say(res, 'Then ' + nm(nodes[x.t]) + ' is true: ' + d + ' has no other place left in ' + unitName(x.us) + '.', snap());
        }
        say(res, 'But that shares ' + unitName(hit.uc) + ' with ' + candName(vid) + ', so both cannot hold. Contradiction, so ' + candName(vid) + ' is false.', snap());
        out.push(res);
      }
    }
    return out;
  }

  /* Almost-locked sets (ALS-XZ). An almost-locked set is n cells of one unit holding n + 1 digits: one digit too many.
     Take two of them, A and B, a digit x whose places in A all see its places in B, and another shared digit z.
     If z were missing from both, each set would be locked on its other digits and both would need x, which the x's forbid.
     So the z's of A and the z's of B are two dots that cannot both be false: a counted link. A z that sees all of them
     closes a triangle. XYZ-Wing and WXYZ-Wing are the small cases. */
  function findALS(st) {
    const sets = [], seenKey = new Set();
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u].filter(c => !st.val[c]);
      for (let k = 1; k <= 4; k++) for (const cs of combos(cells, k)) {
        let m = 0; for (const c of cs) m |= st.cand[c];
        if (bits(m) !== k + 1) continue;
        const key = cs.join(','); if (seenKey.has(key)) continue; seenKey.add(key);
        sets.push({ cs, m });
      }
    }
    const out = [], done = new Set(), LIMIT = 4;
    const of = (S, d) => S.cs.filter(c => has(st, c, d)), dot = (S, d) => of(S, d).map(c => cid(c, d));
    const disjoint = (A, B) => !A.cs.some(c => B.cs.includes(c));
    const restricted = (A, B, x) => of(A, x).every(a => of(B, x).every(b => sees(a, b)));
    const outsideSeeing = (cellsIn, d, sets3) => { const e = []; for (let c = 0; c < 81; c++) if (has(st, c, d) && !sets3.some(S => S.cs.includes(c)) && cellsIn.every(q => sees(c, q))) e.push(cid(c, d)); return e; };
    const nearest = (X, Y) => { let best = null; for (const a of X) for (const b of Y) { const dist = Math.abs(ROW(cCell(a)) - ROW(cCell(b))) + Math.abs(COL(cCell(a)) - COL(cCell(b))) + Math.abs(cDig(a) - cDig(b)) * 0.1; if (!best || dist < best[2]) best = [a, b, dist]; } return best; };
    const describe = (S, name) => 'Set ' + name + ': ' + cellList(S.cs) + ' hold' + (S.cs.length === 1 ? 's' : '') + ' ' + (S.cs.length + 1) + ' digits in ' + S.cs.length + (S.cs.length === 1 ? ' cell' : ' cells');
    const start = (name, theorem, used) => { const res = mkResult(name, theorem); for (const S of used) for (const c of S.cs) for (const d of digits(st.cand[c])) res.nodes.set(cid(c, d), 'loop'); return res; };
    const finish = (res, elim) => {
      elim.forEach(e => res.nodes.set(e, 'elim')); res.elim = elim;
      // the first removed candidate closes the loop: a dashed link to every blue dot it sees whole; the others get one each
      for (const g of res.groups) if (g.length && g.every(m => linked(elim[0], m))) dashedLater.push([res, [elim[0]], g]);
      linkToGroups(res); out.push(res);
    };
    const solid = (res, X, Y) => { const n = nearest(X, Y); res.links.push({ a: n[0], b: n[1], strong: true, group: true }); };
    const dashed = (res, X, Y) => { const n = nearest(X, Y); res.links.push({ a: n[0], b: n[1], strong: false, group: true }); };
    const dashedLater = [];

    // weak links between sets: a digit whose places in one all see its places in the other
    const pairs = [];
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
      const A = sets[i], B = sets[j]; if (!(A.m & B.m) || !disjoint(A, B)) continue;
      const xs = digits(A.m & B.m).filter(x => restricted(A, B, x));
      if (xs.length) pairs.push({ i, j, xs });
    }

    // two sets, one linking digit x: the z dots of A and B cannot both be false (ALS-XZ, WXYZ-Wing)
    for (const pr of pairs) { if (out.length >= LIMIT) break;
      const A = sets[pr.i], B = sets[pr.j];
      for (const x of pr.xs) for (const z of digits(A.m & B.m)) if (z !== x) {
        const elim = outsideSeeing(of(A, z).concat(of(B, z)), z, [A, B]);
        const key = elim.join(','); if (!elim.length || done.has(key)) continue; done.add(key);
        const ZA = dot(A, z), ZB = dot(B, z), XA = dot(A, x), XB = dot(B, x), v = elim[0], marks = {}, snap = () => Object.assign({}, marks);
        const res = start('Almost-locked sets', 'Lemma 7.7 and Theorem 5.2: an odd loop of dots through two almost-locked sets', [A, B]);
        XA.concat(XB).forEach(id => res.nodes.set(id, 'k1')); ZA.concat(ZB).forEach(id => res.nodes.set(id, 'k0')); res.groups = [ZA, ZB]; res.dots = [XA, XB];
        solid(res, ZA, XA); dashed(res, XA, XB); solid(res, XB, ZB);
        say(res, describe(A, 'A') + ', one too many. ' + describe(B, 'B') + '.');
        say(res, 'In such a set, two digits cannot both be missing: the cells would be short of digits. So inside A the blue ' + z + 's and the orange ' + x + 's cannot both be false (solid line), and the same inside B.');
        say(res, 'The orange ' + x + 's of A and of B all see each other, so they cannot both be true (dashed line). With the red ' + z + ' this is an odd loop.');
        marks[v] = 't'; say(res, 'Suppose ' + candName(v) + ' were true. It sees every blue ' + z + ', so both blue dots are false.', snap());
        ZA.concat(ZB).forEach(id => { marks[id] = 'f'; }); XA.concat(XB).forEach(id => { marks[id] = 't'; });
        say(res, 'Then the orange ' + x + 's are true in A and in B. But they see each other. Contradiction, so ' + candName(v) + ' is false.', snap());
        if (elim.length > 1) say(res, 'The same argument removes: ' + list(elim.slice(1)) + '.');
        finish(res, elim);
      }
    }

    // two sets, two linking digits: every digit is pinned to its own set (this includes the basic Sue de Coq)
    for (const pr of pairs) { if (out.length >= LIMIT) break; if (pr.xs.length < 2) continue;
      const A = sets[pr.i], B = sets[pr.j], x1 = pr.xs[0], x2 = pr.xs[1], elim = [], groups = [];
      for (const [S, T] of [[A, B], [B, A]]) for (const d of digits(S.m)) if (d !== x1 && d !== x2) { const e = outsideSeeing(of(S, d), d, [A, B]); if (e.length) { elim.push(...e); groups.push(dot(S, d)); } }
      for (const x of [x1, x2]) { const e = outsideSeeing(of(A, x).concat(of(B, x)), x, [A, B]); if (e.length) { elim.push(...e); groups.push(dot(A, x).concat(dot(B, x))); } }
      const uniq = [...new Set(elim)], key = uniq.join(','); if (!uniq.length || done.has(key)) continue; done.add(key);
      const res = start('Almost-locked sets (two links)', 'Lemma 7.7 twice: every digit is pinned to its own set', [A, B]);
      groups.forEach(g => g.forEach(id => res.nodes.set(id, 'k0'))); res.groups = groups;
      const nA = A.cs.length, nB = B.cs.length;
      say(res, describe(A, 'A') + '. ' + describe(B, 'B') + '. The digits ' + x1 + ' and ' + x2 + ' each have all their places in A in sight of all their places in B.');
      say(res, 'So ' + x1 + ' is used by at most one of the two sets, and so is ' + x2 + '. That leaves at most ' + (nA + nB) + ' digit uses for ' + (nA + nB) + ' cells, so none can be spared: every blue dot is true.');
      say(res, 'Any candidate outside the sets that sees a whole blue dot of its own digit is linked to a true dot. That removes: ' + list(uniq) + '.');
      finish(res, uniq);
    }

    // three sets in a row, A - x - B - y - C: the z dots of A and C cannot both be false (ALS-XY-Wing, a chain of almost-locked sets)
    const nbr = sets.map(() => []);
    for (const pr of pairs) for (const x of pr.xs) { nbr[pr.i].push({ k: pr.j, x }); nbr[pr.j].push({ k: pr.i, x }); }
    for (let b = 0; b < sets.length && out.length < LIMIT; b++) for (const ea of nbr[b]) { if (out.length >= LIMIT) break;
      for (const ec of nbr[b]) {
        if (ec.k <= ea.k || ec.x === ea.x) continue;
        const A = sets[ea.k], B = sets[b], C = sets[ec.k], x = ea.x, y = ec.x; if (!disjoint(A, C)) continue;
        for (const z of digits(A.m & C.m)) if (z !== x && z !== y) {
          const elim = outsideSeeing(of(A, z).concat(of(C, z)), z, [A, B, C]);
          const key = elim.join(','); if (!elim.length || done.has(key)) continue; done.add(key);
          const ZA = dot(A, z), XA = dot(A, x), XB = dot(B, x), YB = dot(B, y), YC = dot(C, y), ZC = dot(C, z), v = elim[0], marks = {}, snap = () => Object.assign({}, marks);
          const res = start('Chain of almost-locked sets', 'Lemma 7.7 and Theorem 5.2: an odd loop of dots through three almost-locked sets', [A, B, C]);
          [XA, XB, YB, YC].forEach(g => g.forEach(id => res.nodes.set(id, 'k1'))); ZA.concat(ZC).forEach(id => res.nodes.set(id, 'k0')); res.groups = [ZA, ZC]; res.dots = [XA, XB, YB, YC];
          solid(res, ZA, XA); dashed(res, XA, XB); solid(res, XB, YB); dashed(res, YB, YC); solid(res, YC, ZC);
          say(res, describe(A, 'A') + '. ' + describe(B, 'B') + '. ' + describe(C, 'C') + '. Each has one digit too many.');
          say(res, 'Inside each set two digits cannot both be missing (solid lines). The ' + x + 's of A and B all see each other, and so do the ' + y + 's of B and C (dashed lines). With the red ' + z + ' this is an odd loop.');
          marks[v] = 't'; ZA.forEach(id => { marks[id] = 'f'; }); say(res, 'Suppose ' + candName(v) + ' were true. Then the blue ' + z + 's of A are false, so A uses ' + x + '.', snap());
          XA.forEach(id => { marks[id] = 't'; }); XB.forEach(id => { marks[id] = 'f'; }); YB.forEach(id => { marks[id] = 't'; });
          say(res, 'Then B cannot use ' + x + ', so B uses ' + y + '.', snap());
          YC.forEach(id => { marks[id] = 'f'; }); ZC.forEach(id => { marks[id] = 't'; });
          say(res, 'Then C cannot use ' + y + ', so one of the blue ' + z + 's of C is true. But ' + candName(v) + ' sees them all. Contradiction, so ' + candName(v) + ' is false.', snap());
          if (elim.length > 1) say(res, 'The same argument removes: ' + list(elim.slice(1)) + '.');
          finish(res, elim);
          if (out.length >= LIMIT) break;
        }
        if (out.length >= LIMIT) break;
      }
    }
    for (const [res, X, Y] of dashedLater) dashed(res, X, Y);
    return out;
  }

  /* Finned fish. A fish that fails only because of a few extra places, the fins, all in one box.
     If the fins are false it is a plain fish, so the fin dot and each covering dot cannot both be false: a counted link.
     A candidate that the plain fish would remove, and that shares the fins' box, closes a triangle. */
  function findFinnedFish(st) {
    const out = [], seen = new Set();
    for (const k of [2, 3]) for (let d = 1; d <= 9; d++) for (const [base, cover, baseOf, coverOf, bn, cn] of [[0, 9, ROW, COL, 'rows', 'columns'], [9, 0, COL, ROW, 'columns', 'rows']]) {
      const lines = []; for (let i = 0; i < 9; i++) { const cs = cellsFor(st, base + i, d); if (cs.length >= 2 && cs.length <= k + 2) lines.push({ i, cs }); }
      for (const ls of combos(lines, k)) {
        const all = [].concat(...ls.map(l => l.cs)), cols = [...new Set(all.map(coverOf))];
        if (cols.length <= k || cols.length > k + 2) continue;
        for (const cv of combos(cols, k)) {
          const fins = all.filter(c => !cv.includes(coverOf(c)));
          if (!fins.length || new Set(fins.map(BOX)).size !== 1) continue;
          if (ls.some(l => !l.cs.some(c => cv.includes(coverOf(c))))) continue;
          const bi = ls.map(l => l.i), box = BOX(fins[0]), elim = [];
          for (const x of cv) for (const c of UNITS[cover + x]) if (!bi.includes(baseOf(c)) && BOX(c) === box && has(st, c, d)) elim.push(cid(c, d));
          if (!elim.length) continue;
          const key = elim.join(','); if (seen.has(key)) continue; seen.add(key);
          const v = elim[0], line = coverOf(cCell(v)), dot = all.filter(c => coverOf(c) === line).map(c => cid(c, d)), F = fins.map(c => cid(c, d));
          if (!dot.length) continue;
          const res = mkResult(k === 2 ? 'Finned X-Wing' : 'Finned Swordfish', 'Theorem 7.5, Lemma 7.7 and Theorem 5.2: a fish with a counted link'), marks = {}, snap = () => Object.assign({}, marks);
          all.forEach(c => res.nodes.set(cid(c, d), 'loop')); F.concat(dot).forEach(id => res.nodes.set(id, 'k0')); res.groups = [F, dot];
          elim.forEach(e => res.nodes.set(e, 'elim')); res.elim = elim;
          res.links.push({ a: F[0], b: dot[0], strong: true, group: true });
          res.links.push({ a: v, b: F[0], strong: false, group: true }); res.links.push({ a: v, b: dot[0], strong: false, group: true });
          for (const e of elim.slice(1)) res.links.push({ a: e, b: F[0], strong: false, group: true });
          const one = cn.slice(0, -1);
          say(res, 'In ' + bn + ' ' + bi.map(i => i + 1).join(', ') + ' the digit ' + d + ' fits only in ' + cn + ' ' + cv.map(i => i + 1).sort().join(', ') + ', except for the fin: ' + list(F) + ', in box ' + (box + 1) + '.');
          say(res, 'The fin is one blue dot. The ' + d + 's of these ' + bn + ' in ' + one + ' ' + (line + 1) + ' are another. If the fin is false, this is a plain fish and the count proves the second dot true. So the two cannot both be false: a link found by counting (solid line).');
          marks[v] = 't'; say(res, 'Suppose ' + candName(v) + ' were true.', snap());
          F.concat(dot).forEach(id => { marks[id] = 'f'; }); say(res, 'It shares box ' + (box + 1) + ' with the fin and ' + one + ' ' + (line + 1) + ' with the other dot, so both are false. That breaks the counted link. Contradiction, so ' + candName(v) + ' is false.', snap());
          if (elim.length > 1) say(res, 'The same argument, with the dot of its own ' + one + ', removes: ' + list(elim.slice(1)) + '.');
          out.push(res);
        }
      }
    }
    return out;
  }

  /* Unique rectangle: four cells in two rows, two columns and two boxes. Three hold only a and b; the fourth holds a, b and more.
     If the fourth were a or b, the four cells could swap a and b to give a second solution. A proper sudoku has one. */
  function findUniqueRectangle(st) {
    const out = [];
    for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
      const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
      if (cells.some(c => st.val[c]) || new Set(cells.map(BOX)).size !== 2) continue;
      const pair = cells.filter(c => bits(st.cand[c]) === 2);
      if (pair.length !== 3 || pair.some(c => st.cand[c] !== st.cand[pair[0]])) continue;
      const m = st.cand[pair[0]], odd = cells.find(c => !pair.includes(c));
      if ((st.cand[odd] & m) !== m || bits(st.cand[odd]) < 3) continue;
      const ab = digits(m), elim = ab.map(d => cid(odd, d));
      const res = mkResult('Unique rectangle', 'An even loop with two colorings, plus the fact that the puzzle has one solution');
      for (const c of pair) for (const d of ab) res.nodes.set(cid(c, d), 'loop');
      elim.forEach(e => res.nodes.set(e, 'elim')); res.elim = elim;
      say(res, 'The cells ' + cellList(pair) + ' hold only ' + digitList(ab) + '. With ' + cellName(odd) + ' they form a rectangle across two rows, two columns and two boxes.');
      say(res, 'If ' + cellName(odd) + ' were ' + ab[0] + ' or ' + ab[1] + ', the four corners would form an even loop holding only ' + digitList(ab) + '. An even loop can be colored two ways, and nothing outside it could tell them apart, so there would be two solutions.');
      say(res, 'A proper sudoku has exactly one solution, so ' + cellName(odd) + ' is neither. That removes: ' + list(elim) + '. The two colorings are graph theory; the one-solution fact is an extra assumption about the puzzle.');
      out.push(res);
    }
    return out;
  }

  /* Trial and error, the last resort. Suppose a candidate is true, keep filling single candidate cells, and look for a dead end.
     Of all candidates that lead to one, the shortest route is shown. If none does, the rest is searched in full. */
  function deadEnd(st) {
    for (let c = 0; c < 81; c++) if (!st.val[c] && !st.cand[c]) return cellName(c) + ' has no candidate left';
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) if (!UNITS[u].some(c => st.val[c] === d) && !cellsFor(st, u, d).length) return unitName(u) + ' has no place for ' + d;
    return null;
  }
  function findGuess(st) {
    if (solved(st)) return [];
    let best = null;
    for (let id = 0; id < 729; id++) if (alive(st, id)) {
      const t = clone(st), forced = []; place(t, cCell(id), cDig(id));
      let dead = deadEnd(t), s;
      while (!dead && forced.length < 81 && (s = findSingle(t))) { forced.push({ id: cid(s.cell, s.d), why: s.why }); place(t, s.cell, s.d); dead = deadEnd(t); }
      if (dead && (!best || forced.length < best.forced.length)) best = { id, forced, dead };
      if (best && best.forced.length === 0) break;
    }
    const res = mkResult('Trial and error', 'A last resort: this is a guess, not a link argument');
    if (!best) {
      const sol = solve(st.val).solution; if (!sol) return [];
      let v = -1; for (let id = 0; id < 729 && v < 0; id++) if (alive(st, id) && sol[cCell(id)] !== cDig(id)) v = id;
      if (v < 0) return [];
      res.nodes.set(v, 'elim'); res.elim = [v];
      say(res, 'No loop, coloring or counting argument applies here, so the only move left is a guess.');
      say(res, 'Suppose ' + candName(v) + ' were true.', { [v]: 't' });
      say(res, 'Filling single candidate cells does not settle it, so everything that follows was searched in full. No solution has ' + candName(v) + '.', { [v]: 't' });
      say(res, 'So ' + candName(v) + ' is false.');
      return [res];
    }
    const v = best.id, marks = {}, snap = () => Object.assign({}, marks);
    res.nodes.set(v, 'elim'); best.forced.forEach(f => res.nodes.set(f.id, 'loop')); res.elim = [v];
    say(res, 'No loop, coloring or counting argument applies here, so the only move left is a guess.');
    marks[v] = 't'; say(res, 'Suppose ' + candName(v) + ' were true, and fill the single candidate cells that follow.', snap());
    const shown = best.forced.slice(0, 5), rest = best.forced.slice(5);
    for (const f of shown) { marks[f.id] = 't'; say(res, 'Then ' + candName(f.id) + ': ' + f.why.charAt(0).toLowerCase() + f.why.slice(1) + '.', snap()); }
    if (rest.length) { rest.forEach(f => { marks[f.id] = 't'; }); say(res, 'Then ' + rest.length + ' more cell' + (rest.length === 1 ? ' is' : 's are') + ' forced the same way.', snap()); }
    say(res, 'Now ' + best.dead + '. Contradiction, so ' + candName(v) + ' is false.', snap());
    return [res];
  }

  /* Listed in the order they are tried, simplest first. `used` is how many times each was the move played over about
     1,100 random puzzles with that order; the page lists the buttons of each section from most used to least. */
  const TECHNIQUES = [
    { key: 'single', name: 'Single candidate', loop: 'only one choice', find: findSingles, blurb: 'A cell with one candidate left, or a digit with one place left.', easy: true },
    { key: 'locked', used: 3945, name: 'Locked pair', loop: 'triangle', find: findLockedPair, blurb: 'A candidate that sees both ends of a strong link.' },
    { key: 'naked', used: 755, name: 'Naked pair', loop: 'loop of 4', find: findNakedPair, blurb: 'Two cells that share the same two digits.' },
    { key: 'hidden', used: 463, name: 'Hidden pair', loop: 'loop of 4', find: findHiddenPair, blurb: 'Two digits that share the same two cells.' },
    { key: 'xwing', used: 180, name: 'X-Wing', loop: 'loop of 4', find: findXWing, blurb: 'One digit, two lines, the same two crossing lines.' },
    { key: 'sky', used: 416, name: 'Skyscraper', loop: 'loop of 5', find: findSkyscraper, blurb: 'Two parallel strong links that share a line at one end.' },
    { key: 'kite', used: 382, name: 'Two-String Kite', loop: 'loop of 5', find: findKite, blurb: 'A row link and a column link joined inside a box.' },
    { key: 'xywing', used: 430, name: 'XY-Wing', loop: 'loop of 7', find: findXYWing, blurb: 'Three two-digit cells: a pivot and two wings.' },
    { key: 'color', used: 72, name: 'Simple Coloring', loop: '2-coloring', find: findSimpleColoring, blurb: 'Color one digit’s strong links with two colors.' },
    { key: 'xchain', used: 217, name: 'One-digit loop', loop: 'Turbot Fish, X-Cycle, 2-2-2 Swordfish, Multi-Coloring', find: st => findChains(st, true, 5, 1), blurb: 'A longer odd loop of one digit.' },
    { key: 'medusa', used: 574, name: '3D Medusa', loop: '2-coloring', find: st => findColoring(st, 0), blurb: 'Coloring that hops between digits.' },
    { key: 'chain', used: 1599, name: 'Alternating chain', loop: 'W-Wing, XY-Chain, Remote Pairs', find: st => findChains(st, false, 6, 1), blurb: 'Any odd loop with alternating strong links.' },
    { key: 'group', used: 14, name: 'Locked triple', loop: 'a group as one dot', find: findLockedGroup, blurb: 'A digit confined to three cells that share a second line or box.' },
    { key: 'gchain', used: 29, name: 'Grouped chain', loop: 'a group as one dot: Empty Rectangle, grouped X-Cycle', find: findGroupedChains, blurb: 'An odd loop of one digit in which a dot may be a group of cells.'},
    { key: 'xyz', used: 6, name: 'XYZ-Wing', loop: 'triangle with a counted link', find: findXYZWing, blurb: 'A pivot with three candidates and two wings.' },
    /* Beyond links. These are tried only after every loop and coloring above has failed. */
    { key: 'subset', used: 11, name: 'Triples and quads', loop: 'naked or hidden', find: findSubsets, blurb: 'Three or four cells that must share three or four digits.', beyond: true, section: 'count' },
    { key: 'fish', used: 0, name: 'Bigger fish', loop: 'Swordfish, Jellyfish', find: findFish, blurb: 'One digit: three or four rows that fit only three or four columns.', beyond: true, section: 'count' },
    { key: 'finned', used: 2, name: 'Finned fish', loop: 'a fish with a counted link', find: findFinnedFish, blurb: 'A fish spoiled by a few extra places in one box.', beyond: true, section: 'count', late: true },
    { key: 'als', used: 81, name: 'Almost-locked sets', loop: 'ALS-XZ, WXYZ-Wing, ALS chain, Sue de Coq', find: findALS, blurb: 'Two sets of cells with one digit too many, joined by a shared digit.', beyond: true, section: 'count', late: true },
    { key: 'ur', used: 1, name: 'Unique rectangle', loop: 'uses: one solution', find: findUniqueRectangle, blurb: 'Four corners that would allow two solutions.', beyond: true, section: 'unique' },
    { key: 'guess', used: 0, name: 'Trial and error', loop: 'last resort', find: findGuess, blurb: 'Suppose a candidate is true and follow the single candidate cells to a contradiction.', beyond: true, section: 'last', lastResort: true }
  ];

  /* ---------- random puzzles ---------- */
  /* A random full grid: fill the most constrained empty cell with its options in random order, backtracking when stuck. */
  function randomGrid(rnd) {
    const v = new Array(81).fill(0);
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    const fits = (c, d) => { for (const q of PEERS[c]) if (v[q] === d) return false; return true; };
    const go = () => {
      let best = -1, opts = null;
      for (let c = 0; c < 81; c++) if (!v[c]) {
        const o = []; for (let d = 1; d <= 9; d++) if (fits(c, d)) o.push(d);
        if (!opts || o.length < opts.length) { best = c; opts = o; if (o.length <= 1) break; }
      }
      if (best < 0) return true;
      for (const d of shuffle(opts)) { v[best] = d; if (go()) return true; }
      v[best] = 0; return false;
    };
    go();
    return { grid: v, shuffle };
  }
  /* Solve a puzzle the way the page does: single candidate cells, then the simplest technique that applies, repeated. */
  function playThrough(str) {
    const st = fromString(str); fillSingles(st);
    let moves = 0, guesses = 0, beyond = 0;
    while (!solved(st) && moves < 300) {
      let res = null, tech = null;
      for (const t of TECHNIQUES) { const rs = t.find(st); if (rs.length) { res = rs[0]; tech = t; break; } }
      if (!res) return { solved: false, moves, guesses, beyond };
      apply(st, res); fillSingles(st); moves++;
      if (tech.lastResort) guesses++; else if (tech.beyond) beyond++;
    }
    return { solved: solved(st), moves, guesses, beyond };
  }
  /* A random puzzle with exactly one solution that needs at least one technique and that the techniques can finish without a guess.
     Clues are removed in random order for as long as the solution stays unique. About half of such puzzles qualify,
     so a few tries are enough; after 60 tries the last puzzle is returned whatever it needs.
     With easy = true the puzzle is instead one that single candidate cells alone finish. */
  function randomPuzzle(rnd, easy) {
    rnd = rnd || Math.random;
    let out = null;
    for (let tries = 1; tries <= 60; tries++) {
      const made = randomGrid(rnd), v = made.grid.slice();
      for (const i of made.shuffle(Array.from({ length: 81 }, (_, k) => k))) { const keep = v[i]; v[i] = 0; if (solve(v).count !== 1) v[i] = keep; }
      const puzzle = v.map(x => x || '.').join(''), run = playThrough(puzzle);
      out = { puzzle, moves: run.moves, finishes: run.solved && run.guesses === 0, tries };
      if (easy ? run.solved && run.moves === 0 : out.finishes && run.moves >= 1) break;
    }
    return out;
  }

  root.SudokuEngine = { ROW, COL, BOX, UNITS, PEERS, sees, unitName, cellName, cid, cCell, cDig, candName, bits, digits, fromString, check, randomPuzzle, playThrough, chainFor, deadEnd, toString, clone, has, alive, place, eliminate, cellsFor,
    solve, linked, linkInfo, strongInfo, neighbors, strongPartners, linkWhy, strongWhy, findSingle, fillSingles, apply, solved, broken, TECHNIQUES, findChains, findColoring };
})(typeof window !== 'undefined' ? window : globalThis);
