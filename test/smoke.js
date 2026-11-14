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
const log = [];
// 1. initial state: tour puzzle loaded, first technique shown
log.push('title: ' + $('tname').textContent + ' | steps: ' + $('steps').children.length + ' | status: ' + $('status').textContent);
if (!$('grid').innerHTML.includes('<circle')) throw new Error('no overlay drawn at start');
// 2. walk the argument steps
for (let i = 0; i < 4; i++) click($('fwd'));
if (!document.querySelector('#steps li.on')) throw new Error('no step highlighted');
// 3. solve the tour puzzle with Next step + Apply
let guard = 0, techs = new Set();
while ($('tname').textContent !== 'Solved' && guard++ < 300) {
  click($('next'));
  if (!$('stepnav').hidden) { techs.add($('tname').textContent.replace(/ \(.*/, '')); click($('apply')); }
  if ($('status').className.includes('bad')) { log.push('stopped: ' + $('status').textContent); break; }
}
log.push('tour: ' + $('tname').textContent + ' after ' + guard + ' clicks; techniques shown: ' + [...techs].join(', '));
// 4. every sample loads and shows its technique
const sel = $('sample');
for (let i = 1; i < sel.options.length; i++) {
  sel.value = String(i); sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const name = sel.options[i].textContent, shown = $('tname').textContent;
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
  click(play);
  if (play.textContent !== 'Pause' || play.getAttribute('aria-pressed') !== 'true') throw new Error('play did not start');
  await until(() => play.textContent !== 'Pause', 20000, 'play to finish the tour puzzle');
  if ($('tname').textContent !== 'Solved' || $('grid').querySelector('rect[data-id]')) throw new Error('play stopped before the puzzle was solved: ' + $('status').textContent);
  if (!play.disabled) throw new Error('play should be disabled once the puzzle is solved');
  log.push('play: tour puzzle solved automatically | ' + $('status').textContent);
  // 6b. play can be paused from the board, and nothing changes after the pause
  loadSample(4);
  click(play); await sleep(0);
  click($('grid'));
  if (play.textContent !== 'Play all steps') throw new Error('tapping the board did not pause');
  const frozen = $('grid').innerHTML; await sleep(60);
  if ($('grid').innerHTML !== frozen) throw new Error('the board kept changing after pause');
  if ($('tname').textContent === 'Solved') throw new Error('puzzle was solved despite the pause');
  log.push('pause: ' + $('status').textContent);
  // 6c. any manual button also stops play
  click(play); click($('undo'));
  if (play.textContent !== 'Play all steps') throw new Error('a manual button did not stop play');
  // 6d. with waits switched on, Apply first shows the candidates leaving, then changes the board
  document.documentElement.removeAttribute('data-instant');
  $('speed').value = '800';
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
  console.log(log.join('\n')); console.log('errors:', errors.length ? errors : 'none');
  if (errors.length) process.exit(1);
  dom.window.close();
})().catch(e => { console.error(e); process.exit(1); });
