# Why Advanced Sudoku Strategies Work

Advanced sudoku strategies (X-Wing, XY-Wing, Skyscraper, Simple Colouring and others) are usually memorised as separate tricks. This project shows they are one idea from the theory of **bipartite graphs**.

The idea: take a loop of candidates (digits still possible in a cell) in which each one conflicts with the next, so the two cannot both be true. Now try to mark them true, false, true, false all the way round.

- **On a loop with an even number of candidates, the marking fits.** When the puzzle forces it, every neighbouring pair on the loop holds exactly one true candidate. So any other candidate that conflicts with both members of a pair must be false.
- **On a loop with an odd number, the marking cannot fit.** Somewhere on the loop two neighbours are both false. Working out where that has to happen shows which candidate is false.

Marking things with two labels so that neighbours always differ is called *two-colouring*, and a graph where that is possible is called *bipartite*.

**Try it:** [Sudoku Loop Finder](https://hyejunshin.github.io/sudoku-graph-theory/) · **Read it:** [the write-up](https://hyejunshin.github.io/sudoku-graph-theory/writeup/)

[![The Sudoku Loop Finder explaining an X-Wing: the loop drawn on the board, with the steps of the argument beside it](writeup/figures/loop-finder.png)](https://hyejunshin.github.io/sudoku-graph-theory/)

*The Loop Finder explaining an X-Wing on a real puzzle. Click the picture to open it.*

## First: what a candidate is

When a cell is still empty, solvers write in it, in small digits, every digit that could still go there. Each of these is a **candidate**: one digit in one cell. In the picture above, the top-left cell has three candidates, 2, 7 and 8, because its row, column and box already contain every other digit.

In each empty cell exactly one candidate is the real answer. Call that one **true** and the rest **false**. Solving a sudoku means working out which candidates are false and removing them until one is left in every cell. Every strategy below is a way of proving that some candidate is false.

## The idea, step by step

**1. Candidates are dots, and every line between them is a rule.** Draw each candidate as a dot. The rules of sudoku allow one digit per cell, and each digit once per row, column and box. So some pairs of candidates can never both be true: two digits in the same cell, or the same digit twice in a row, column or box. Join every such pair with a line, called a *link*. A link says "not both".

Why draw the lines? Because what you learn about one candidate travels along them. If a candidate is true, everything linked to it is false. Some links also work the other way: a link is *strong* when its two candidates are the only ones left in their cell, or the only places left for that digit in a row, column or box. Then exactly one of the two is true, so if one is false the other is true. Every strategy is a chain of these steps, and on the graph a chain of steps is simply a path or a loop you can see.

![A strong link forces one end true; a weak link only forbids both](writeup/figures/fig06.png)

**2. True and false are two colours.** Colour every candidate by whether it is true or false in the solution. Linked candidates are never both true, so round a loop the colours try to alternate. An even loop can do that. An odd loop cannot.

![Colours can alternate round an even cycle but not round an odd one](writeup/figures/fig01.png)

**3. Strong links form a bipartite graph.** Across a strong link the two colours always differ, so the strong links alone can always be two-coloured. Each connected piece has only two colourings: one colour is all true and the other all false. A candidate linked to candidates of both colours can be removed, since one of those colours is true. That is Simple Colouring and 3D Medusa.

![A component of strong links can be solved in only two ways](writeup/figures/fig09.png)

**4. Odd loops break the colouring, and that removes candidates.** On an odd loop the colours cannot alternate all the way round, so some link has both ends false, and it cannot be a strong one. When the strong links pair up every candidate but one, that candidate must be false. Skyscraper, Two-String Kite, Turbot Fish and XY-Wing are all this picture:

![An odd loop forces a candidate out, in four steps](writeup/figures/fig10.png)

**5. Even loops keep the colouring.** When the strong links pair up every candidate on an even loop, true and false alternate perfectly, so every link on it has exactly one true end. Anything linked to both ends of such a link can be removed. That is X-Wing, naked pair and hidden pair.

To be exact about the claim: only step 3 uses a bipartite graph as such. Steps 4 and 5 apply the same two-colour fact to single loops in the graph of all links, and that graph is not bipartite. Its odd loops are exactly what step 4 exploits.

The [write-up](https://hyejunshin.github.io/sudoku-graph-theory/writeup/) proves each step, shows where the method stops, and has 24 pictures like these.

## The Loop Finder

Open `index.html` directly; it needs no server and no build step.

- Paste a puzzle as 81 characters, row by row, with `.` or `0` for empty cells (spaces and line breaks are fine). Or pick one of the built-in examples.
- Choose **Random sudoku** from the list for a fresh puzzle each time. Every one has exactly one solution, needs at least one of the techniques, and can be finished without a guess.
- **Fill easy cells automatically** is on by default: cells with one candidate left, and digits with one place left, are filled without being shown. Switch it off to start from every candidate and have each easy cell appear as its own step. **Random easy sudoku** gives a puzzle that easy cells alone finish, with the switch off so there is something to watch.
- Only proper sudokus load: no digit twice in a row, column or box, and exactly one solution. Anything else is refused with the reason.
- Tap a technique to see a move of that kind. Each move lists the chain of forced steps behind it, and the board marks candidates true or false as you walk through. **Apply to the board** carries it out.
- **Play all steps** solves the puzzle by itself, one move after another. Each candidate that goes is circled in red, struck through and then fades from the board. Choose a speed, or pick *Moves only* to skip the reasoning and just watch the loops and removals. Tap the board to pause.
- Tap any candidate on the board to see everything it is linked to. Pick a digit to see its strong links coloured in two colours.

Techniques it finds: locked pair, naked pair, hidden pair, X-Wing, Skyscraper, Two-String Kite, XY-Wing, Simple Colouring, one-digit odd loops (Turbot Fish, X-Cycle), 3D Medusa, and general alternating chains (which include W-Wing and XY-Chain).

It only knows techniques that follow from links. When a puzzle needs something else, such as a naked triple or a larger fish, it says so. The write-up proves that this limit is real.

## Beyond links

Links join two candidates at a time, so some puzzles cannot be finished by loops and colourings alone. A test on 2,000 random puzzles gave:

| Outcome | Puzzles |
| --- | --- |
| Solved by easy cells alone | 971 |
| Solved by the link techniques | 965 |
| Stuck: no link argument exists | 64 (3.2%) |

A search for everything links can prove, on a smaller sample, solved nothing the Loop Finder had missed. So the stuck puzzles are a limit of pairwise reasoning, not of the tool. For those, the Loop Finder has three further steps, kept apart under **Beyond links** and tried only when no loop or colouring applies:

- **Locked triple**: a digit confined to three cells that share a second line or box. The three act as one candidate.
- **Triples and quads**, naked or hidden: three cells that hold only three digits between them, and the like. A counting argument on the cells and digits of one row, column or box.
- **Grouped chain** (Empty Rectangle, grouped X-Cycle): the odd loop again, where a dot may be a group of cells in one box that share a row or column. This one still follows the loop rule.
- **Bigger fish** (Swordfish, Jellyfish): the same counting as a triple, on the rows and columns of one digit.
- **XYZ-Wing**: a pivot with three candidates and two wings.
- **Unique rectangle**: four corners that would allow two solutions. It uses the fact that a proper sudoku has one.
- **Trial and error**, the last resort: suppose a candidate is true, fill the easy cells that follow, and reach a contradiction. It is offered only when nothing else applies.

Of the 64 stuck puzzles above, 22 were finished with locked triples and triples or quads alone, before the other steps were added. With all of them, a second test on 3,000 random puzzles ended with 36 (1.2%) still needing a guess. Swordfish, Jellyfish, XYZ-Wing and unique rectangles were never needed there: they exist, but random puzzles almost never require them. With the guess every puzzle can be finished. The last entries of the example list show these steps.

## The website

GitHub Pages serves this repository from the root of the main branch: the Loop Finder is the [home page](https://hyejunshin.github.io/sudoku-graph-theory/) and the write-up is at [`/writeup/`](https://hyejunshin.github.io/sudoku-graph-theory/writeup/). Every push to `main` updates the site.

## Code

The source, the tests and the proof checks are described in [`src/README.md`](src/README.md).
