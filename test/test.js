require('../src/engine.js');
const E = globalThis.SudokuEngine;
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function randomFull() {
  const perm = shuffle([1,2,3,4,5,6,7,8,9]);
  const sh = () => { const out = []; for (const b of shuffle([0,1,2])) for (const i of shuffle([0,1,2])) out.push(3*b+i); return out; };
  const R = sh(), C = sh(), g = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const rr = R[r], cc = C[c]; g.push(perm[(3*(rr%3) + Math.floor(rr/3) + cc) % 9]); }
  return g;
}
function makePuzzle() {
  const g = randomFull(), v = g.slice();
  for (const i of shuffle([...Array(81).keys()])) { const keep = v[i]; v[i] = 0; if (E.solve(v).count !== 1) v[i] = keep; }
  return { puzzle: v.map(x => x || '.').join(''), solution: g };
}
function check(st, sol, res, tag) {
  for (const id of res.elim) if (sol[E.cCell(id)] === E.cDig(id)) throw new Error(tag + ': eliminated a true candidate ' + E.candName(id));
  for (const id of res.place) if (sol[E.cCell(id)] !== E.cDig(id)) throw new Error(tag + ': placed a false candidate ' + E.candName(id));
  if (!res.elim.length && !res.place.length) throw new Error(tag + ': empty result');
  for (const l of res.links) { if (!E.linked(l.a, l.b)) throw new Error(tag + ': drawn link is not a link'); if (l.strong && !E.strongInfo(st, l.a, l.b)) throw new Error(tag + ': drawn strong link is not strong'); }
}
const used = {}, firstAfterSingles = {}, counts = { puzzles: 0, solvedByThese: 0, results: 0 };
const t0 = Date.now();
const N = +process.argv[2] || 150;
for (let n = 0; n < N; n++) {
  const { puzzle, solution } = makePuzzle();
  const st = E.fromString(puzzle); counts.puzzles++;
  E.fillSingles(st);
  let first = true, guard = 0;
  while (!E.solved(st) && guard++ < 200) {
    // check EVERY technique on this state
    let chosen = null;
    for (const t of E.TECHNIQUES) {
      const rs = t.find(st);
      for (const r of rs) { check(st, solution, r, t.key + ' on ' + puzzle); counts.results++; }
      if (rs.length) {
        if (first && !firstAfterSingles[t.key]) firstAfterSingles[t.key] = puzzle;
        if (!chosen) { chosen = rs[0]; used[t.key] = (used[t.key] || 0) + 1; }
      }
    }
    first = false;
    if (!chosen) break;
    E.apply(st, chosen); E.fillSingles(st);
    if (E.broken(st)) throw new Error('state broken on ' + puzzle);
    for (let c = 0; c < 81; c++) if (st.val[c] && st.val[c] !== solution[c]) throw new Error('wrong placement on ' + puzzle);
  }
  if (E.solved(st)) counts.solvedByThese++;
}
console.log(JSON.stringify({ counts, used, ms: Date.now() - t0 }, null, 1));
console.log(JSON.stringify(firstAfterSingles, null, 1));

// Random puzzles from the engine: proper sudokus that need a technique and that the techniques can finish.
{
  let s2 = 2024; const rnd2 = () => (s2 = (s2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const t1 = Date.now(), M = 40; let tries = 0, moves = 0; const distinct = new Set();
  for (let n = 0; n < M; n++) {
    const made = E.randomPuzzle(rnd2), chk = E.check(made.puzzle);
    if (!chk.ok) throw new Error('randomPuzzle made an improper sudoku: ' + chk.reason);
    if (!made.finishes || made.moves < 1) throw new Error('randomPuzzle returned a puzzle the techniques cannot finish, or that needs none: ' + made.puzzle);
    const st = E.fromString(made.puzzle); E.fillSingles(st);
    if (E.solved(st)) throw new Error('randomPuzzle returned a puzzle solved by easy cells: ' + made.puzzle);
    const again = E.playThrough(made.puzzle);
    if (!again.solved || again.moves !== made.moves) throw new Error('playThrough disagrees with randomPuzzle on ' + made.puzzle);
    tries += made.tries; moves += made.moves; distinct.add(made.puzzle);
  }
  if (distinct.size !== M) throw new Error('randomPuzzle repeated itself');
  console.log('random puzzles: ' + M + ' made, ' + (tries / M).toFixed(1) + ' tries each, ' + (moves / M).toFixed(1) + ' moves each on average, ' + ((Date.now() - t1) / M).toFixed(0) + ' ms each');
}
