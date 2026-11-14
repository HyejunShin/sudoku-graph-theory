# Why Advanced Sudoku Strategies Work

Advanced sudoku strategies (X-Wing, XY-Wing, Skyscraper, Simple Colouring and others) are usually memorised as separate tricks. This project shows they are one idea from graph theory, proves it step by step, and lets you watch it work on real puzzles.

**Try it:** [Sudoku Loop Finder](https://hyejunshin.github.io/sudoku-graph-theory/) · **Read it:** [the write-up](https://hyejunshin.github.io/sudoku-graph-theory/writeup/)

The idea in three lines:

1. Every pencil mark is a dot. Two dots are linked when the rules forbid both from being true.
2. A link is strong when exactly one of the two must be true.
3. Round any loop of k dots, the links with both ends false number k minus twice the true dots. Strong links are never among them.

## What is here

| Path | What it is |
| --- | --- |
| [`writeup/README.md`](writeup/README.md) | The write-up, readable here on GitHub: six steps, 24 figures, a short proof for every claim |
| `writeup/index.html` | The same write-up as a web page |
| `index.html` | **Sudoku Loop Finder**: one self-contained page. Open it in a browser, load a puzzle, pick a technique, and step through the loop behind it |
| `src/engine.js` | The link-graph engine: candidates, links, strong links, and a finder for each technique |
| `src/index.src.html` | The page's markup, styles and interface code |
| `build.js` | Inlines the engine into the page and writes `index.html` |
| `test/` | Checks every move the engine finds against the true solution of generated puzzles, and drives the page in a simulated browser |
| `proofs/` | Brute-force checks of the lemmas and theorems in the write-up |

## The Loop Finder

Open `index.html` directly; it needs no server and no build step.

- Paste a puzzle as 81 characters, row by row, with `.` or `0` for empty cells (spaces and line breaks are fine). Or pick one of the built-in examples.
- Only proper sudokus load: no digit twice in a row, column or box, and exactly one solution. Anything else is refused with the reason.
- **Next step** shows the simplest move available. Each move lists the chain of forced steps behind it, and the board marks candidates true or false as you walk through.
- Tap any pencil mark to see everything it is linked to. Pick a digit to see its strong links coloured in two colours.

Techniques it finds: locked pair, naked pair, hidden pair, X-Wing, Skyscraper, Two-String Kite, XY-Wing, Simple Colouring, one-digit odd loops (Turbot Fish, X-Cycle), 3D Medusa, and general alternating chains (which include W-Wing and XY-Chain).

It only knows techniques that follow from links. When a puzzle needs something else, such as a naked triple or a larger fish, it says so. The write-up proves that this limit is real.

## Build and test

```
node build.js            # rebuild index.html after editing src/
npm install              # once, for the simulated-browser test
npm test                 # engine check on 120 generated puzzles, then the page test
python3 proofs/verify_cycles.py
```

`npm test` fails loudly if any technique ever removes a candidate that belongs to the solution.

## The website

GitHub Pages serves this repository from the root of the main branch: the Loop Finder is the [home page](https://hyejunshin.github.io/sudoku-graph-theory/) and the write-up is at [`/writeup/`](https://hyejunshin.github.io/sudoku-graph-theory/writeup/). Every push to `main` updates the site.
