# Code, build and tests

This is the code behind the [Solving Sudoku Using Graph Coloring](https://hyejunshin.github.io/sudoku-graph-theory/). Paths below are from the top of the repository.

## What is here

| Path | What it is |
| --- | --- |
| [`writeup/README.md`](../writeup/README.md) | The write-up, readable on GitHub: six steps, 24 figures, a short proof for every claim |
| [`writeup/index.html`](../writeup/index.html) | The same write-up as a web page |
| [`index.html`](../index.html) | **Solving Sudoku Using Graph Coloring**: one self-contained page, built from the two files below. Open it in a browser; it needs no server |
| [`src/engine.js`](engine.js) | The link-graph engine: candidates, links, strong links, the strict puzzle check, and a finder for each technique |
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
python3 proofs/verify_cycles.py
```

`npm test` fails loudly if any technique ever removes a candidate that belongs to the solution.

Edit only the files in `src/`. `index.html` at the top level is generated, so changes made there are lost on the next build.
