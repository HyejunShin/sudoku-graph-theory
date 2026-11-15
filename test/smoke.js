const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<link[^>]*fonts.googleapis[^>]*>/, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => errors.push(String(e.error || e.message)));
const { document } = dom.window; const $ = id => document.getElementById(id);
const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const E = dom.window.SudokuEngine;
// steps are followed by tapping the next one in the list
const stepOn = () => { const li = [...$('steps').children], on = li.findIndex(x => x.classList.contains('on')); const nx = li[Math.min(on + 1, li.length - 1)]; if (nx) nx.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); };
const stepBack = () => { const li = [...$('steps').children], on = li.findIndex(x => x.classList.contains('on')); if (on > 0) li[on - 1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); };
// The page waits between steps and animates removals. data-instant="1" turns every wait off, so the checks below can stay synchronous.
document.documentElement.setAttribute('data-instant', '1');
// The page must never scroll by itself: count any attempt.
let scrolls = 0; dom.window.Element.prototype.scrollIntoView = () => { scrolls++; }; dom.window.scrollTo = () => { scrolls++; };
if (/scrollIntoView|scrollTo\(|scrollBy\(/.test(html)) throw new Error('the page contains scrolling code');
const log = [];
// 1. initial state: tour puzzle loaded, first technique shown
log.push('title: ' + $('tname').textContent + ' | steps: ' + $('steps').children.length + ' | status: ' + $('status').textContent);
if (!$('grid').innerHTML.includes('<circle')) throw new Error('no overlay drawn at start');
// 2. walk the argument steps
for (let i = 0; i < 4; i++) stepOn();
if (!document.querySelector('#steps li.on')) throw new Error('no step highlighted');
{ // buttons: within each section, most used first
  const keys = [...document.querySelectorAll('#techs button[data-key]')].map(b => b.getAttribute('data-key')), byKey = Object.fromEntries(E.TECHNIQUES.map(t => [t.key, t]));
  for (let i = 0; i + 1 < keys.length; i++) { const a = byKey[keys[i]], b = byKey[keys[i + 1]]; if ((a.section || '') === (b.section || '') && (a.used || 0) < (b.used || 0)) throw new Error('technique buttons are not ordered from most used to least: ' + keys.join(' ')); }
  if (keys[0] !== 'locked' || keys[1] !== 'chain') throw new Error('unexpected first buttons: ' + keys.slice(0, 3).join(' '));
}
// 3. solve the tour puzzle by hand: tap the first technique that has a move, then Apply
if ($('next') || $('easy')) throw new Error('the Next step and Fill easy cells buttons should be gone');
if ($('prev') || $('fwd') || $('apply').textContent !== 'Apply') throw new Error('expected only an Apply button under the steps');
if ([...document.querySelectorAll('#status, #loadmsg')].some(x => /Simplest move/.test(x.textContent))) throw new Error('the "Simplest move" message should be gone');
let guard = 0, techs = new Set();
while ($('tname').textContent !== 'Solved' && guard++ < 300) {
  const firstTech = document.querySelector('#techs button[data-key]:not([disabled])');
  if (!firstTech) { log.push('stopped: no technique available'); break; }
  click(firstTech);
  if (!$('stepnav').hidden) { techs.add($('tname').textContent.replace(/ \(.*/, '')); click($('apply')); }
  if ($('status').className.includes('bad')) { log.push('stopped: ' + $('status').textContent); break; }
}
log.push('tour: ' + $('tname').textContent + ' after ' + guard + ' clicks; techniques shown: ' + [...techs].join(', '));
// 4. every sample loads and shows its technique
const sel = $('sample');
if ([...sel.options].some(o => /random|easy/.test(o.value)) || sel.options[1].value !== '0' || !$('rand') || !$('randEasy') || $('again')) throw new Error('the list should hold only fixed puzzles, with Random buttons beside it');
for (const opt of [...sel.options].filter(o => /^[1-9]\d*$/.test(o.value))) {
  sel.value = opt.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const name = opt.textContent, shown = $('tname').textContent;
  if ($('stepnav').hidden) throw new Error('sample ' + name + ' did not show a technique');
  log.push(name + ' -> ' + shown + ' | ' + $('steps').children.length + ' steps | ' + $('theorem').textContent.slice(0, 40));
  stepOn(); stepOn(); stepBack(); click($('apply'));
  if ($('status').className.includes('bad')) throw new Error('apply failed on ' + name + ': ' + $('status').textContent);
}
// 5. probe a candidate, digit view, undo, reset, bad input, user puzzle
console.log(log.join('\n')); log.length = 0;
sel.value = '4'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
const rect = $('grid').querySelector('rect[data-id]'); click(rect);
log.push('probe: ' + $('tname').textContent + ' | ' + $('theorem').textContent);
click($('digits').querySelector('button[data-d="5"]')); log.push('digit: ' + $('tname').textContent);
click($('undo')); click($('reset'));
const EASY = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
const before = $('status').textContent;
const reject = (name, value, expect) => {
  $('puzzle').value = value; click($('load'));
  const m = $('loadmsg');
  if (!m.className.includes('bad') || !m.textContent.includes(expect)) throw new Error('strict check: ' + name + ' was not rejected as expected: ' + m.textContent);
  if ($('status').textContent !== before) throw new Error('strict check: board changed after rejecting ' + name);
  log.push('rejected ' + name + ': ' + m.textContent);
};
reject('too short', '123', '81 cells');
reject('letters', 'abc' + EASY, 'Found "a"');
reject('repeated digit', '55' + '.'.repeat(79), 'twice in row 1');
reject('column clash', '5........' + '5........' + '.'.repeat(63), 'twice in column 1');
reject('no solution', '12345678.' + '........9' + '.'.repeat(63), 'no solution');
reject('empty grid', '.'.repeat(81), 'more than one solution');
reject('one clue removed', EASY.slice(0, 20) + '.' + EASY.slice(21), 'more than one solution');
$('puzzle').value = EASY.match(/.{9}/g).join('\n').replace(/\./g, '0'); click($('load'));
if ($('loadmsg').className.includes('bad')) throw new Error('strict check: nine-line grid with zeros was rejected: ' + $('loadmsg').textContent);
log.push('nine lines with zeros: ' + $('loadmsg').textContent);
$('puzzle').value = EASY; click($('load'));
log.push('easy puzzle: ' + $('loadmsg').textContent + ' | ' + $('status').textContent + ' | ' + $('tname').textContent);
console.log(log.join('\n')); log.length = 0;

// 6. automatic play and the removal animation (these wait for the page's own timers)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms, what) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await sleep(5); } };
const loadSample = i => { sel.value = String(i); sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
(async () => {
  const play = $('play');
  // 6a. play solves the tour puzzle on its own and then stops
  loadSample(0);
  if (play.disabled) throw new Error('play is disabled on a fresh puzzle');
  if (play.textContent !== 'Play') throw new Error('fresh puzzle: button says ' + play.textContent);
  if (play.parentNode !== $('undo').parentNode || play.parentNode !== $('speed').parentNode || $('reset').textContent !== 'Reset' || !play.closest('.board')) throw new Error('Play, speed, Undo and Reset should share one row inside the board card');
  if ([...play.parentNode.children].pop() !== play) throw new Error('Play should be the last control in its row');
  const speeds = [...$('speed').options].map(o => o.textContent + '=' + o.value + (o.selected ? '*' : '')).join(' ');
  if (speeds !== 'Slow=1700 Normal=600* Fast=250 Moves only=1000') throw new Error('unexpected speeds: ' + speeds);
  click(play);
  if (play.textContent !== 'Pause' || play.getAttribute('aria-pressed') !== 'true') throw new Error('play did not start');
  await until(() => play.textContent !== 'Pause', 20000, 'play to finish the tour puzzle');
  if ($('tname').textContent !== 'Solved' || $('grid').querySelector('rect[data-id]')) throw new Error('play stopped before the puzzle was solved: ' + $('status').textContent);
  if (!play.disabled) throw new Error('play should be disabled once the puzzle is solved');
  if (play.textContent !== 'Play') throw new Error('after finishing, button says ' + play.textContent);
  log.push('play: tour puzzle solved automatically | ' + $('status').textContent);
  // 6b. play can be paused from the board, and nothing changes after the pause
  loadSample(4);
  click(play); await sleep(0);
  click($('grid'));
  if (play.textContent !== 'Resume') throw new Error('after pausing, button says ' + play.textContent + ' instead of Resume');
  const frozen = $('grid').innerHTML; await sleep(60);
  if ($('grid').innerHTML !== frozen) throw new Error('the board kept changing after pause');
  if ($('tname').textContent === 'Solved') throw new Error('puzzle was solved despite the pause');
  log.push('pause: ' + $('status').textContent + ' | button: ' + play.textContent);
  click(play);
  if (play.textContent !== 'Pause') throw new Error('Resume did not start play again');
  click(play);
  if (play.textContent !== 'Resume') throw new Error('Pause button did not pause');
  loadSample(4);
  if (play.textContent !== 'Play') throw new Error('a new puzzle should reset the button, but it says ' + play.textContent);
  click(play); click($('grid')); click($('reset'));
  if (play.textContent !== 'Play') throw new Error('Start over should reset the button, but it says ' + play.textContent);
  // 6c. any manual button also stops play
  click(play); click($('undo'));
  if (play.textContent !== 'Resume') throw new Error('a manual button did not stop play');
  // 6d. with waits switched on, Apply first shows the candidates leaving, then changes the board
  document.documentElement.removeAttribute('data-instant');
  $('speed').value = '250';
  loadSample(4);
  const cellsBefore = $('status').textContent;
  click($('apply'));
  const leaving = $('grid').querySelectorAll('g.going');
  if (!leaving.length) throw new Error('no candidate is shown leaving the board');
  if (!$('grid').querySelector('g.going line.strike')) throw new Error('leaving candidates are not struck through');
  if (!$('status').textContent.startsWith('Removing ')) throw new Error('status does not name what is being removed: ' + $('status').textContent);
  const leavingIds = [...leaving].map(g => g.getAttribute('data-anim'));
  if (!leavingIds.every(id => $('grid').querySelector('g.going[data-anim="' + id + '"] text'))) throw new Error('a leaving candidate lost its digit');
  await until(() => !$('grid').querySelector('g.going'), 3000, 'the removal to finish');
  if (leavingIds.some(id => $('grid').querySelector('rect[data-id="' + id + '"]'))) throw new Error('a removed candidate is still on the board');
  if ($('status').textContent === cellsBefore || !/removed \d+ candidate/.test($('status').textContent)) throw new Error('board did not change after the removal: ' + $('status').textContent);
  log.push('removal: ' + leaving.length + ' candidates shown leaving, then ' + $('status').textContent);
  // 6e. a second Apply during the animation, or a tap elsewhere, cannot apply a move twice or to the wrong board
  loadSample(4);
  click($('apply')); click($('apply'));
  click($('reset'));
  await sleep(900);
  if (/removed/.test($('status').textContent)) throw new Error('a canceled removal was still applied: ' + $('status').textContent);
  // 6f. play at real speed shows the steps one by one
  loadSample(4);
  click(play);
  await until(() => document.querySelector('#steps li.on'), 4000, 'play to highlight a step');
  if (!$('theorem').textContent.includes('click the board to pause')) throw new Error('no pause hint while playing');
  click($('grid'));
  log.push('timed play: step highlighted, then paused');
  // 6g. "Moves only" goes from the loop straight to the removal, without highlighting any step
  loadSample(4);
  $('speed').selectedIndex = [...$('speed').options].findIndex(o => o.getAttribute('data-skip') === '1');
  if ($('speed').selectedIndex < 0) throw new Error('no "Moves only" speed');
  let sawStep = false;
  click(play);
  await until(() => { if (document.querySelector('#steps li.on')) sawStep = true; return $('grid').querySelector('g.going'); }, 5000, 'the first removal in "Moves only"');
  if (sawStep) throw new Error('"Moves only" still walked through the steps');
  click($('grid'));
  if ($('grid').querySelector('g.going')) throw new Error('pausing did not cancel the removal in progress');
  log.push('moves only: loop shown, then removal, no steps');
  // 6h. "Random sudoku": a fresh proper puzzle each time, which play can finish
  document.documentElement.setAttribute('data-instant', '1');
  const again = $('rand');
  loadSample(4);
  const pickRandom = () => click(again);
  pickRandom();
  if (sel.value !== '' || sel.options[sel.selectedIndex].textContent !== 'Random puzzle') throw new Error('the list should read Random puzzle while a random puzzle is loaded');
  const seen = new Set();
  for (let n = 0; n < 6; n++) {
    if (n) click(again);
    const p = $('puzzle').value, chk = E.check(p);
    if (!chk.ok) throw new Error('random puzzle is not a proper sudoku: ' + chk.reason + ' ' + p);
    if ($('loadmsg').className.includes('bad') || !$('loadmsg').textContent.includes('random puzzle')) throw new Error('random puzzle did not load: ' + $('loadmsg').textContent);
    if ($('tname').textContent === 'Solved') throw new Error('random puzzle was solved by easy cells alone: ' + p);
    if (play.textContent !== 'Play') throw new Error('a new random puzzle should reset the play button');
    seen.add(p);
    click(play);
    await until(() => play.textContent !== 'Pause', 20000, 'play to finish a random puzzle');
    if ($('tname').textContent !== 'Solved') throw new Error('play could not finish random puzzle ' + p + ': ' + $('status').textContent);
  }
  if (seen.size !== 6) throw new Error('random puzzles repeated: ' + seen.size + ' distinct out of 6');
  click($('reset'));
  if ($('puzzle').value !== [...seen].pop() || $('tname').textContent === 'Solved') throw new Error('Start over did not restore the same random puzzle');
  log.push('random: 6 different proper puzzles, each finished by play; Start over keeps the puzzle');
  // 6i. the three "Beyond links" examples sit at the bottom of the list, and play finishes each using the named step
  document.documentElement.setAttribute('data-instant', '1');
  const lastThree = ['Locked triple', 'Naked triple', 'Trial and error'].map(nm => [...sel.options].find(o => o.textContent === nm));
  if (lastThree.some(o => !o)) throw new Error('an expected example is missing from the list');
  const wanted = [['locked triple', 'Locked triple'], ['naked triple', 'Naked triple'], ['trial and error', 'Trial and error']];
  for (let n = 0; n < 3; n++) {
    const opt = lastThree[n];
    sel.value = opt.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const names = new Set(); let lastResortAlone = true;
    const watch = setInterval(() => {
      const t = $('tname').textContent.replace(/ \(.*/, ''); if (!$('stepnav').hidden) names.add(t);
      const on = [...document.querySelectorAll('#techs button[data-key]:not([disabled])')].map(b => b.getAttribute('data-key'));
      if (on.includes('guess') && on.length > 1) lastResortAlone = false;
    }, 0);
    click(play);
    await until(() => play.textContent !== 'Pause', 30000, 'play to finish "' + opt.textContent + '"');
    clearInterval(watch);
    if ($('tname').textContent !== 'Solved') throw new Error('play could not finish "' + opt.textContent + '": ' + $('status').textContent);
    if (!names.has(wanted[n][1])) throw new Error('"' + opt.textContent + '" was solved without ' + wanted[n][1] + ': ' + [...names].join(', '));
    if (!lastResortAlone) throw new Error('Trial and error was offered while another technique was available');
    log.push(opt.textContent + ' -> solved, using ' + [...names].join(', '));
  }
  if (!document.querySelector('#techs .beyond')) throw new Error('no "Beyond links" divider in the technique list');
  // a group is drawn as one outlined dot
  const lt = [...sel.options].find(o => o.textContent === 'Locked triple'); sel.value = lt.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  for (let g = 0; g < 80 && !document.querySelector('#techs button[data-key=group]:not([disabled])'); g++) { click(document.querySelector('#techs button[data-key]:not([disabled])')); click($('apply')); }
  click(document.querySelector('#techs button[data-key=group]'));
  if ($('grid').querySelectorAll('.group').length !== 1) throw new Error('the locked triple is not drawn as one outlined group');
  for (const [nm, key] of [['Naked triple', 'subset'], ['Swordfish', 'fish']]) {
    const o = [...sel.options].find(x => x.textContent === nm); sel.value = o.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    for (let g = 0; g < 80 && !document.querySelector('#techs button[data-key=' + key + ']:not([disabled])'); g++) { click(document.querySelector('#techs button[data-key]:not([disabled])')); click($('apply')); }
    click(document.querySelector('#techs button[data-key=' + key + ']'));
    if (!$('grid').querySelector('path.group') || !$('grid').querySelector('circle[stroke="var(--must)"]')) throw new Error(nm + ' is not drawn with group dots');
    if (!/outlined/.test($('steps').textContent)) throw new Error(nm + ' is not explained with group dots');
    if (!$('grid').querySelector('[stroke-dasharray]')) throw new Error(nm + ' has no dashed edges from the removed candidates to the group nodes');
    { const red = $('graph').querySelectorAll('line[stroke="var(--out)"]').length, gr = $('graph').querySelectorAll('line[stroke="var(--ink)"]').length;
      const elimCount = $('grid').querySelectorAll('circle[stroke="var(--out)"]').length;
      if (red - 1 !== elimCount || gr < 3) throw new Error(nm + ': the graph should show the paired-up edges and one red edge per removed candidate (' + red + ' red, ' + gr + ' green, ' + elimCount + ' removed)'); }
  }
  // every removed candidate has a dashed link, and links lying along one another are bowed apart
  for (const i of [1, 2, 3, 4]) {
    loadSample(i);
    const reds = $('grid').querySelectorAll('circle[stroke="var(--out)"]').length / 1, dashed = $('grid').querySelectorAll('[stroke-dasharray]').length;
    if (!reds || dashed < reds) throw new Error(sel.options[sel.selectedIndex].textContent + ': ' + reds + ' removed candidates but only ' + dashed + ' dashed links');
  }
  { // the almost-locked-set and finned-fish example plays through using both, each drawn as two blue dots with a counted link
    const o = [...sel.options].find(x => x.textContent === 'Almost-locked sets and finned fish'); sel.value = o.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const seenNames = new Set(); let okPicture = true;
    const w3 = setInterval(() => { const t = $('tname').textContent.replace(/ \(.*/, ''); if ($('stepnav').hidden) return; seenNames.add(t);
      if ((t === 'Almost-locked sets' || t.indexOf('Finned') === 0) && ($('grid').querySelectorAll('path.group').length < 1 || !/outlined|node|set/.test($('steps').textContent))) okPicture = false; }, 0);
    click(play); await until(() => play.textContent !== 'Pause', 30000, 'play to finish the almost-locked-set example'); clearInterval(w3);
    if ($('tname').textContent !== 'Solved' || !seenNames.has('Almost-locked sets') || ![...seenNames].some(n => n.indexOf('Finned') === 0) || seenNames.has('Trial and error')) throw new Error('almost-locked-set example: ' + $('tname').textContent + ' using ' + [...seenNames].join(', '));
    if (!okPicture) throw new Error('almost-locked sets or finned fish shown without group dots');
  }
  const xz = [...sel.options].find(o => o.textContent === 'XYZ-Wing'); sel.value = xz.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  if ($('tname').textContent.indexOf('XYZ-Wing') !== 0 || $('grid').querySelectorAll('.group').length > 1 || !$('grid').querySelector('circle[stroke="var(--muted)"]')) throw new Error('the XYZ-Wing does not show its group dot');
  if (document.querySelectorAll('#techs .beyond').length !== 2) throw new Error('expected two dividers: counting, and outside the coloring');
  // 6j. the easy-cell switch and "Random easy sudoku"
  const auto = $('autofill'), easyBtn = () => document.querySelector('#techs button[data-key=single]');
  loadSample(4);
  if (!auto.checked || easyBtn()) throw new Error('automatic filling should be on by default, with no Easy cell button');
  const againEasy = $('randEasy'); if (againEasy.textContent !== 'Random easy') throw new Error('no Random easy button');
  click(againEasy);
  if (auto.checked) throw new Error('an easy puzzle should switch automatic filling off');
  const ep = $('puzzle').value, givens = ep.replace(/\./g, '').length;
  if (!E.check(ep).ok) throw new Error('easy puzzle is not a proper sudoku');
  if ($('grid').querySelectorAll('text[font-size="34"]').length !== givens) throw new Error('cells were filled in although automatic filling is off');
  if (!easyBtn() || easyBtn().disabled || $('tname').textContent.indexOf('Single candidate') !== 0) throw new Error('the first easy cell is not shown: ' + $('tname').textContent);
  if ($('steps').children.length !== 1 || !/goes in r\dc\d\.$/.test($('steps').textContent)) throw new Error('an easy cell should have a one-line reason: ' + $('steps').textContent);
  click($('apply'));
  if ($('grid').querySelectorAll('text[font-size="34"]').length !== givens + 1) throw new Error('applying an easy cell should fill exactly one cell');
  const kinds = new Set(); const w2 = setInterval(() => { if (!$('stepnav').hidden) kinds.add($('tname').textContent.replace(/ \(.*/, '')); }, 0);
  click(play); await until(() => play.textContent !== 'Pause', 30000, 'play to finish an easy puzzle'); clearInterval(w2);
  if ($('tname').textContent !== 'Solved' || [...kinds].join() !== 'Single candidate') throw new Error('easy puzzle: ' + $('tname').textContent + ' using ' + [...kinds].join(', '));
  click(againEasy); if ($('puzzle').value === ep || auto.checked) throw new Error('a second click did not give a new single-cells puzzle');
  loadSample(4);
  if (!auto.checked || easyBtn()) throw new Error('leaving the easy puzzle should switch automatic filling back on');
  auto.checked = false; auto.dispatchEvent(new dom.window.Event('change', { bubbles: true })); click($('reset'));
  if (!easyBtn() || easyBtn().disabled) throw new Error('with the switch off, Start over should leave easy cells to do');
  const before81 = $('grid').querySelectorAll('text[font-size="34"]').length;
  auto.checked = true; auto.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  if ($('grid').querySelectorAll('text[font-size="34"]').length <= before81 || easyBtn() || $('stepnav').hidden) throw new Error('switching it on should fill the easy cells and show the next move');
  log.push('easy cells: switch, one-line steps, Random easy sudoku finished by play using only Easy cell');
  // 6k. the graph view: one dot per candidate or group, the same marks as the board, and no two dots on top of each other
  document.documentElement.setAttribute('data-instant', '1');
  // no two dots may overlap, in any technique of any example, at every state on the way to the solution
  let closest = 1e9, graphsSeen = 0;
  const checkGraph = where => {
    const gn = [...$('graph').querySelectorAll('g[data-node]')]; if (!gn.length) return;
    const H = +$('graph').getAttribute('viewBox').split(' ')[3];
    const pts = gn.map(g => { const c = g.querySelector('circle:last-of-type'); return [+c.getAttribute('cx'), +c.getAttribute('cy')]; });
    for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) closest = Math.min(closest, Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]));
    if (closest < 46) throw new Error(where + ': two dots of the graph view overlap (' + closest.toFixed(0) + ' apart)');
    if (pts.some(q => q[0] < 15 || q[0] > 505 || q[1] < 15 || q[1] > H - 15)) throw new Error(where + ': a dot of the graph view is off the picture');
    // no straight edge may lie on top of another straight edge, or run through a dot that is not one of its ends
    const segs = [...$('graph').querySelectorAll('line:not(.strike)')].map(l => ['x1', 'y1', 'x2', 'y2'].map(k => +l.getAttribute(k)));
    const offLine = (s, x, y) => { const dx = s[2] - s[0], dy = s[3] - s[1], len = Math.hypot(dx, dy) || 1; return [((x - s[0]) * dx + (y - s[1]) * dy) / len, Math.abs((x - s[0]) * dy - (y - s[1]) * dx) / len, len]; };
    for (let a = 0; a < segs.length; a++) {
      for (const q of pts) { const [t, d, len] = offLine(segs[a], q[0], q[1]); if (t > 12 && t < len - 12 && d < 12) throw new Error(where + ': an edge of the graph view runs straight through a dot'); }
      for (let b = a + 1; b < segs.length; b++) { const [t1, d1, len] = offLine(segs[a], segs[b][0], segs[b][1]), [t2, d2] = offLine(segs[a], segs[b][2], segs[b][3]); if (d1 < 3 && d2 < 3 && Math.min(len, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > 14) throw new Error(where + ': two edges of the graph view lie on top of each other'); }
    }
    graphsSeen++;
  };
  for (const o of [...sel.options].filter(x => /^\d+$/.test(x.value))) {
    sel.value = o.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    for (let g = 0; g < 60 && $('tname').textContent !== 'Solved'; g++) {
      for (const b of [...document.querySelectorAll('#techs button[data-key]:not([disabled])')]) { click(document.querySelector('#techs button[data-key="' + b.getAttribute('data-key') + '"]')); checkGraph(o.textContent + ' / ' + $('tname').textContent); }
      click($('apply'));
    }
  }
  log.push('graph view: ' + graphsSeen + ' graphs drawn, closest pair of dots ' + closest.toFixed(0) + ' apart');
  for (const nm of ['Skyscraper', 'X-Wing', 'XY-Wing', '3D Medusa', 'Locked pair']) {
    const o = [...sel.options].find(x => x.textContent === nm); sel.value = o.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const boardRed = $('grid').querySelectorAll('circle[stroke="var(--out)"]').length, graphRed = $('graph').querySelectorAll('circle[stroke="var(--out)"]').length;
    if (boardRed !== graphRed) throw new Error(nm + ': board shows ' + boardRed + ' red dots, graph ' + graphRed);
    stepOn(); stepOn(); stepOn();
    const bt = $('grid').querySelectorAll('circle[stroke="var(--true)"]').length, gt = $('graph').querySelectorAll('circle[stroke="var(--true)"]').length;
    if (bt !== gt) throw new Error(nm + ': at the same step the board has ' + bt + ' green dots and the graph ' + gt);
  }
  { const o = [...sel.options].find(x => x.textContent === 'Locked triple'); sel.value = o.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    for (let g = 0; g < 80 && !document.querySelector('#techs button[data-key=group]:not([disabled])'); g++) { click(document.querySelector('#techs button[data-key]:not([disabled])')); click($('apply')); }
    click(document.querySelector('#techs button[data-key=group]'));
    const blue = [...$('graph').querySelectorAll('g[data-node]')].filter(g => g.getAttribute('data-node').split(' ').length === 3);
    if (blue.length !== 1) throw new Error('the locked triple should be one dot in the graph view'); }
  log.push('graph view: dots match the board, none overlap, a group is one dot');
  // the Apply row shows only for a technique's move, not when looking at links
  { const vis = () => !$('stepnav').hidden;   // the CSS rule that makes [hidden] win is checked in a real browser
    loadSample(4); if (!vis()) throw new Error('Apply should show for a move');
    click(document.querySelector('#digits button')); if (vis()) throw new Error('Apply should be hidden while showing a digit\'s strong links');
    click($('grid').querySelector('rect[data-id]')); if (vis()) throw new Error('Apply should be hidden while showing a candidate\'s links'); }
  if (scrolls) throw new Error('the page scrolled by itself ' + scrolls + ' times');
  log.push('scrolling: none');
  console.log(log.join('\n')); console.log('errors:', errors.length ? errors : 'none');
  if (errors.length) process.exit(1);
  dom.window.close();
})().catch(e => { console.error(e); process.exit(1); });
