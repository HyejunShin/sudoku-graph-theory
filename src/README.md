# Code, build and tests

This is the code behind [the solver](https://hyejunshin.github.io/sudoku-graph-theory/). Paths below are from the top of the repository.

## What is here

| Path | What it is |
| --- | --- |
| [`writeup/README.md`](../writeup/README.md) | The write-up: definitions, proofs and 27 figures |
| [`writeup/index.html`](../writeup/index.html) | The same write-up as a web page |
| [`index.html`](../index.html) | The solver: one self-contained page, built from the two files below. Open it in a browser; it needs no server |
| [`src/engine.js`](engine.js) | The engine: candidates, edges, strong edges, the puzzle check, a finder and an explanation for each technique, and the random puzzle maker |
| [`src/index.src.html`](index.src.html) | The page's markup, styles and interface code |
| [`build.js`](../build.js) | Inlines the engine into the page and writes `index.html` |
| [`test/`](../test) | Checks every move the engine finds against the true solution of generated puzzles, and drives the page in a simulated browser |
| [`proofs/`](../proofs) | Brute-force checks of the lemmas and theorems in the write-up |

## Build and test

Run these from the top of the repository.

```
node build.js            # rebuild index.html after editing src/
npm install              # once, for the simulated-browser test
npm test                 # engine check on 120 generated puzzles, then the page test
python3 proofs/verify_cycles.py   # and the other scripts in proofs/
```

`npm test` fails if any technique removes a candidate that belongs to the solution.

Edit only the files in `src/`. `index.html` at the top level is generated, so changes made there are lost on the next build.
