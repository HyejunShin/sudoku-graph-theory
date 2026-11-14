# Solving Sudoku Using Graph Coloring

Advanced sudoku strategies (X-Wing, XY-Wing, Skyscraper, Simple Coloring and others) are usually memorized as separate tricks. This project shows they are one idea: color a graph with two colors, true and false, and see where the coloring breaks.

**Try it:** [the solver](https://hyejunshin.github.io/sudoku-graph-theory/) · **Read it:** [the write-up](https://hyejunshin.github.io/sudoku-graph-theory/writeup/)

[![The solver explaining a move: the board with its graph, and the steps of the argument](writeup/figures/loop-finder.png)](https://hyejunshin.github.io/sudoku-graph-theory/)

## The idea

A **candidate** is a digit that could still go in a cell. In each empty cell exactly one candidate is the real answer: call it **true** and the rest **false**. Solving means proving candidates false and removing them.

Each candidate is a node. Two candidates that can't both be true are joined by an edge. The edge is **strong** when exactly one of them must be true, and **weak** when at most one can be.

Assume one candidate is true and color the graph in two colors, true and false. A true node makes all its neighbors false. A false node makes its strong neighbors true. If two connected nodes end up both true, the assumption was false: remove that node.

## Every move is a small graph

![Seven moves, each shown on the board and as a graph: Locked pair, Skyscraper, X-Wing, XY-Wing, 3D Medusa, naked triple, almost-locked sets](writeup/figures/board-and-graph.png)

*Left: the move on the board. Right: the same nodes and edges, with a group of candidates as one node.*

## Step by step

**1. Edges carry facts.** If a candidate is true, every node adjacent to it is false. Across a strong edge it also works backwards: if one end is false, the other is true. Every strategy is a chain of these steps, so on the graph it is a path or a loop.

![A strong edge forces one end true; a weak edge only forbids both](writeup/figures/fig06.png)

**2. True and false are two colors.** Adjacent nodes are never both true, so round a loop the colors try to alternate. An even loop can do that. An odd loop cannot.

![Colors can alternate round an even cycle but not round an odd one](writeup/figures/fig01.png)

**3. Strong edges form a bipartite graph.** Across a strong edge the colors always differ, so each connected piece has only two colorings: one color all true, the other all false. A node adjacent to both colors is false. That is Simple Coloring and 3D Medusa.

![A component of strong edges can be colored in only two ways](writeup/figures/fig09.png)

**4. Odd loops break the coloring.** On an odd loop some edge has both ends false, and it cannot be a strong one. When strong edges pair up every node but one, that node is false. Skyscraper, Two-String Kite, Turbot Fish and XY-Wing are all this picture.

![An odd loop forces a candidate out, in four steps](writeup/figures/fig10.png)

**5. Even loops keep the coloring.** When strong edges pair up every node on an even loop, every edge on it has exactly one true end. Anything adjacent to both ends of such an edge is false. That is X-Wing, naked pair and hidden pair.

Strictly, only step 3 is about a bipartite graph. Steps 4 and 5 use the same two-color fact on single loops in the full graph, which is not bipartite; its odd loops are what step 4 exploits.

## Going further

Edges join two candidates at a time. Some moves need more, and the write-up proves each extension:

| Extension | Covers |
| --- | --- |
| **A group as one node**: cells of one box in one row or column, true when one of them holds the digit | Locked triple, Grouped chain (Empty Rectangle, grouped X-Cycle) |
| **Counted edges**: in a set of cells with one digit too many, two digits cannot both be missing | XYZ-Wing, almost-locked sets (ALS-XZ, WXYZ-Wing, chains, basic Sue de Coq), finned fish |
| **The sets rule**: k sets covered by k sets. The solver draws these as cells against digits (or rows against columns), the second bipartite graph | Triples and quads, Swordfish, Jellyfish |
| **One more fact**: the puzzle has exactly one solution | Unique rectangle |
| **Last resort**: suppose a candidate is true and follow the single candidate cells to a contradiction | Trial and error |

In 2,500 random puzzles, about half were finished by single candidate cells alone, almost all the rest by loops and colorings, and about 0.7% still needed a guess. With the guess, every puzzle can be finished.

## Using the solver

- Pick an example, press **Random**, or paste 81 characters (row by row, `.` or `0` for empty cells). Only proper sudokus load: one solution, no repeated digit.
- **Play** solves the puzzle step by step. Pick a speed, or *Moves only* to skip the reasoning. Click the board to pause.
- **Choose a technique** to see one move: the steps beside it, the board marking true and false, and the **Graph of this move**. Click a step, or use the arrow keys. **Apply** carries the move out.
- **Skip single candidate cells** fills cells with only one option left. Switch it off, or press **Random (single cells only)**, to watch them one by one.
- Click a candidate to see its edges, or pick a digit to see its strong edges in two colors.

Open `index.html` directly; it needs no server.

## Code

GitHub Pages serves this repository from `main`: the solver is the [home page](https://hyejunshin.github.io/sudoku-graph-theory/), the write-up is at [`/writeup/`](https://hyejunshin.github.io/sudoku-graph-theory/writeup/). The source, tests and proof checks are described in [`src/README.md`](src/README.md).
