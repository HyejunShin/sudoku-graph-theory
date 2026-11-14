require('../src/engine.js');
const E = globalThis.SudokuEngine;
let seed = 987654; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function randomFull() { const perm = shuffle([1,2,3,4,5,6,7,8,9]); const sh = () => { const out = []; for (const b of shuffle([0,1,2])) for (const i of shuffle([0,1,2])) out.push(3*b+i); return out; }; const R = sh(), C = sh(), g = []; for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const rr = R[r], cc = C[c]; g.push(perm[(3*(rr%3) + Math.floor(rr/3) + cc) % 9]); } return g; }
function makePuzzle() { const g = randomFull(), v = g.slice(); for (const i of shuffle([...Array(81).keys()])) { const keep = v[i]; v[i] = 0; if (E.solve(v).count !== 1) v[i] = keep; } return v.map(x => x || '.').join(''); }
const best = {}; let full = null;
for (let n = 0; n < 600; n++) {
  const puzzle = makePuzzle(); const st = E.fromString(puzzle); E.fillSingles(st);
  if (E.solved(st)) continue;
  const avail = E.TECHNIQUES.filter(t => t.find(st).length).map(t => t.key);
  // prefer puzzles where few techniques are available at once (cleaner demo)
  for (const k of avail) if (!best[k] || avail.length < best[k].n) best[k] = { puzzle, n: avail.length, with: avail.join(',') };
  // a puzzle fully solvable with these techniques, using many different ones
  const s2 = E.clone(st); const usedT = new Set(); let g = 0;
  while (!E.solved(s2) && g++ < 200) { let r = null; for (const t of E.TECHNIQUES) { const rs = t.find(s2); if (rs.length) { r = rs[0]; usedT.add(t.key); break; } } if (!r) break; E.apply(s2, r); E.fillSingles(s2); }
  if (E.solved(s2) && (!full || usedT.size > full.k)) full = { puzzle, k: usedT.size, used: [...usedT].join(',') };
}
console.log(JSON.stringify({ best, full }, null, 1));
