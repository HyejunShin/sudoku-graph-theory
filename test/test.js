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
  for (const l of res.links) { if (!l.group && !E.linked(l.a, l.b)) throw new Error(tag + ': drawn link is not a link'); if (l.strong && !l.group && !E.strongInfo(st, l.a, l.b)) throw new Error(tag + ': drawn strong link is not strong'); }
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

// Beyond links: the extra finders are sound, and with them every puzzle can be finished.
{
  const sets = {
    'Locked triple': '4.29......9...2.....7.1...8..5....46...37.8..3.18....5.1.....7..6...1..9..3...6..',
    'Naked triple': '............4...97.973.68...548...696....238..8.....1.42..19..............6.5....',
    'Trial and error': '...4......3.86......23..1.7.78..13..35.....2.1.9....8.......63....5....8....839..'
  };
  for (const [want, puzzle] of Object.entries(sets)) {
    const sol = E.check(puzzle).solution, st = E.fromString(puzzle); E.fillSingles(st);
    const seen = new Set(); let g = 0, linkOnlyStuck = false;
    while (!E.solved(st) && g++ < 300) {
      let res = null, tech = null;
      for (const t of E.TECHNIQUES) { const rs = t.find(st); for (const r of rs) check(st, sol, r, t.key + ' on ' + puzzle); if (rs.length && !res) { res = rs[0]; tech = t; } if (res && t === tech) break; }
      if (!res) throw new Error('nothing applies on ' + puzzle);
      if (tech.beyond || tech.key === 'group' || tech.key === 'gchain' || tech.key === 'xyz') { linkOnlyStuck = true; seen.add(res.tech); }
      if (tech.lastResort && E.TECHNIQUES.some(t => !t.lastResort && t.find(st).length)) throw new Error('a guess was used while a pattern was available');
      E.apply(st, res); E.fillSingles(st);
    }
    if (!E.solved(st)) throw new Error('could not finish ' + puzzle);
    if (!linkOnlyStuck || !seen.has(want)) throw new Error(puzzle + ' was expected to need ' + want + ' but used ' + [...seen].join(', '));
    const run = E.playThrough(puzzle);
    if (!run.solved || (want === 'Trial and error') !== (run.guesses > 0)) throw new Error('playThrough disagrees on ' + puzzle + ': ' + JSON.stringify(run));
  }
  // every puzzle, random or not, now ends solved; count how many needed each kind of help
  let s3 = 31337; const rnd3 = () => (s3 = (s3 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd3() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const tally = { easy: 0, links: 0, patterns: 0, guess: 0 }, M = 300;
  for (let n = 0; n < M; n++) {
    const g = randomFull(), v = g.slice(); for (const i of sh([...Array(81).keys()])) { const keep = v[i]; v[i] = 0; if (E.solve(v).count !== 1) v[i] = keep; }
    const puzzle = v.map(x => x || '.').join(''), run = E.playThrough(puzzle);
    if (!run.solved) throw new Error('playThrough could not finish ' + puzzle);
    tally[run.guesses ? 'guess' : run.beyond ? 'patterns' : run.moves ? 'links' : 'easy']++;
  }
  console.log('all ' + M + ' random puzzles finished: easy cells only ' + tally.easy + ', links ' + tally.links + ', needed a locked triple or a triple/quad ' + tally.patterns + ', needed a guess ' + tally.guess);
}

// Easy puzzles and easy-cell moves.
{
  let s4 = 555; const rnd4 = () => (s4 = (s4 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let n = 0; n < 20; n++) {
    const made = E.randomPuzzle(rnd4, true), chk = E.check(made.puzzle);
    if (!chk.ok) throw new Error('easy puzzle is not proper');
    const st = E.fromString(made.puzzle), single = E.TECHNIQUES.find(t => t.easy); let g = 0;
    while (!E.solved(st) && g++ < 81) { const rs = single.find(st); if (!rs.length) throw new Error('easy puzzle got stuck on easy cells: ' + made.puzzle); for (const r of rs) check(st, chk.solution, r, 'single'); E.apply(st, rs[0]); }
    if (!E.solved(st)) throw new Error('easy puzzle not finished by easy cells');
  }
  console.log('easy puzzles: 20 made, each finished one easy cell at a time');
}
