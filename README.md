# Why Advanced Sudoku Strategies Work

Advanced sudoku strategies (X-Wing, XY-Wing, Skyscraper, Simple Colouring and others) are usually memorised as separate tricks. This project shows they are one idea from graph theory, proves it step by step, and lets you watch it work on real puzzles.

**Try it:** [Sudoku Loop Finder](https://hyejunshin.github.io/sudoku-graph-theory/) · **Read it:** [the write-up](https://hyejunshin.github.io/sudoku-graph-theory/writeup/)

[![The Sudoku Loop Finder explaining an X-Wing: the loop drawn on the board, with the steps of the argument beside it](writeup/figures/loop-finder.png)](https://hyejunshin.github.io/sudoku-graph-theory/)

*The Loop Finder explaining an X-Wing on a real puzzle. Click the picture to open it.*

The idea in three lines:

1. Every pencil mark is a dot. Two dots are linked when the rules forbid both from being true.
2. A link is strong when exactly one of the two must be true.
3. Round any loop of k dots, the links with both ends false number k minus twice the true dots. Strong links are never among them.

![A strong link forces one end true; a weak link only forbids both](writeup/figures/fig06.png)

That counting rule is all it takes. For example, on a loop of five where two links are strong, assuming the top pencil mark is true leads straight to a contradiction, so it can be removed. Skyscraper, Two-String Kite and Turbot Fish are all this picture:

![An odd loop forces a pencil mark out, in four steps](writeup/figures/fig10.png)

The [write-up](https://hyejunshin.github.io/sudoku-graph-theory/writeup/) has 24 pictures like these.

## The Loop Finder

Open `index.html` directly; it needs no server and no build step.

- Paste a puzzle as 81 characters, row by row, with `.` or `0` for empty cells (spaces and line breaks are fine). Or pick one of the built-in examples.
- Only proper sudokus load: no digit twice in a row, column or box, and exactly one solution. Anything else is refused with the reason.
- **Next step** shows the simplest move available. Each move lists the chain of forced steps behind it, and the board marks candidates true or false as you walk through.
- Tap any pencil mark to see everything it is linked to. Pick a digit to see its strong links coloured in two colours.

Techniques it finds: locked pair, naked pair, hidden pair, X-Wing, Skyscraper, Two-String Kite, XY-Wing, Simple Colouring, one-digit odd loops (Turbot Fish, X-Cycle), 3D Medusa, and general alternating chains (which include W-Wing and XY-Chain).

It only knows techniques that follow from links. When a puzzle needs something else, such as a naked triple or a larger fish, it says so. The write-up proves that this limit is real.

## The website

GitHub Pages serves this repository from the root of the main branch: the Loop Finder is the [home page](https://hyejunshin.github.io/sudoku-graph-theory/) and the write-up is at [`/writeup/`](https://hyejunshin.github.io/sudoku-graph-theory/writeup/). Every push to `main` updates the site.

## Code

The source, the tests and the proof checks are described in [`src/README.md`](src/README.md).
