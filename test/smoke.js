const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/<link[^>]*fonts.googleapis[^>]*>/, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
dom.window.addEventListener('error', e => errors.push(String(e.error || e.message)));
const { document } = dom.window; const $ = id => document.getElementById(id);
const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const E = dom.window.SudokuEngine;
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
console.log(log.join('\n')); console.log('errors:', errors.length ? errors : 'none');
