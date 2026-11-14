const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<link[^>]*fonts.googleapis[^>]*>/, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => errors.push(String(e.error || e.message)));
const { document } = dom.window; const $ = id => document.getElementById(id);
const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const E = dom.window.SudokuEngine;
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
for (let i = 0; i < 4; i++) click($('fwd'));
if (!document.querySelector('#steps li.on')) throw new Error('no step highlighted');
// 3. solve the tour puzzle by hand: tap the first technique that has a move, then Apply
if ($('next') || $('easy')) throw new Error('the Next step and Fill easy cells buttons should be gone');
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
if (sel.options[0].value !== '0' || sel.options[1].value !== 'random' || sel.options[1].textContent !== 'Random sudoku') throw new Error('"Random sudoku" is not right after the tour puzzle');
for (const opt of [...sel.options].filter(o => /^[1-9]\d*$/.test(o.value))) {
  sel.value = opt.value; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const name = opt.textContent, shown = $('tname').textContent;
  if ($('stepnav').hidden) throw new Error('sample ' + name + ' did not show a technique');
  log.push(name + ' -> ' + shown + ' | ' + $('steps').children.length + ' steps | ' + $('theorem').textContent.slice(0, 40));
  click($('fwd')); click($('fwd')); click($('prev')); click($('apply'));
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
  if (play.textContent !== 'Play all steps') throw new Error('fresh puzzle: button says ' + play.textContent);
  if (!(play.compareDocumentPosition($('undo')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING) || !($('speed').compareDocumentPosition($('undo')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING)) throw new Error('play and speed are not above the manual buttons');
  const speeds = [...$('speed').options].map(o => o.textContent + '=' + o.value + (o.selected ? '*' : '')).join(' ');
  if (speeds !== 'Slow=1700 Normal=800* Fast=400 Moves only=1000') throw new Error('unexpected speeds: ' + speeds);
  click(play);
  if (play.textContent !== 'Pause' || play.getAttribute('aria-pressed') !== 'true') throw new Error('play did not start');
  await until(() => play.textContent !== 'Pause', 20000, 'play to finish the tour puzzle');
  if ($('tname').textContent !== 'Solved' || $('grid').querySelector('rect[data-id]')) throw new Error('play stopped before the puzzle was solved: ' + $('status').textContent);
  if (!play.disabled) throw new Error('play should be disabled once the puzzle is solved');
  if (play.textContent !== 'Play all steps') throw new Error('after finishing, button says ' + play.textContent);
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
  if (play.textContent !== 'Play all steps') throw new Error('a new puzzle should reset the button, but it says ' + play.textContent);
  click(play); click($('grid')); click($('reset'));
  if (play.textContent !== 'Play all steps') throw new Error('Start over should reset the button, but it says ' + play.textContent);
  // 6c. any manual button also stops play
  click(play); click($('undo'));
  if (play.textContent !== 'Resume') throw new Error('a manual button did not stop play');
  // 6d. with waits switched on, Apply first shows the candidates leaving, then changes the board
  document.documentElement.removeAttribute('data-instant');
  $('speed').value = '400';
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
  if (/removed/.test($('status').textContent)) throw new Error('a cancelled removal was still applied: ' + $('status').textContent);
  // 6f. play at real speed shows the steps one by one
  loadSample(4);
  click(play);
  await until(() => document.querySelector('#steps li.on'), 4000, 'play to highlight a step');
  if (!$('theorem').textContent.includes('tap the board to pause')) throw new Error('no pause hint while playing');
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
  const again = $('again');
  loadSample(4);
  if (!again.hidden) throw new Error('"Another random sudoku" should be hidden for built-in examples');
  const pickRandom = () => { sel.value = 'random'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };
  pickRandom();
  if (again.hidden) throw new Error('"Another random sudoku" is not shown');
  const seen = new Set();
  for (let n = 0; n < 6; n++) {
    if (n) click(again);
    const p = $('puzzle').value, chk = E.check(p);
    if (!chk.ok) throw new Error('random puzzle is not a proper sudoku: ' + chk.reason + ' ' + p);
    if ($('loadmsg').className.includes('bad') || !$('loadmsg').textContent.includes('random sudoku')) throw new Error('random puzzle did not load: ' + $('loadmsg').textContent);
    if ($('tname').textContent === 'Solved') throw new Error('random puzzle was solved by easy cells alone: ' + p);
    if (play.textContent !== 'Play all steps') throw new Error('a new random puzzle should reset the play button');
    seen.add(p);
    click(play);
    await until(() => play.textContent !== 'Pause', 20000, 'play to finish a random puzzle');
    if ($('tname').textContent !== 'Solved') throw new Error('play could not finish random puzzle ' + p + ': ' + $('status').textContent);
  }
  if (seen.size !== 6) throw new Error('random puzzles repeated: ' + seen.size + ' distinct out of 6');
  click($('reset'));
  if ($('puzzle').value !== [...seen].pop() || $('tname').textContent === 'Solved') throw new Error('Start over did not restore the same random puzzle');
  log.push('random: 6 different proper puzzles, each finished by play; Start over keeps the puzzle');
  if (scrolls) throw new Error('the page scrolled by itself ' + scrolls + ' times');
  log.push('scrolling: none');
  console.log(log.join('\n')); console.log('errors:', errors.length ? errors : 'none');
  if (errors.length) process.exit(1);
  dom.window.close();
})().catch(e => { console.error(e); process.exit(1); });
