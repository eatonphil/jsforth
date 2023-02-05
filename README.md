# JSForth

This is a Forth implementation in Javascript, with a REPL using [xterm.js](https://xtermjs.org/).
It started out as a student's college assignment; it only took a few hours to throw together, so
it's still very much a "work in progress". That said, it is pretty darn cool!  See manual.html
for the list of supported words, known bugs, and other fun stuff.  You can [try it here](https://geekonskates.com/apps/jsforth/).

## Change log

* Version 0.2: Added variables, constants, a memory map, and over 3 dozen new words
* Version 0.1: Initial release; it had if/then, do/loop, : and ; and about a dozen other words.







----------------------------------------------------------------------------------------------------------------

From here on down, it's all just low-level notes about the current project status; unless you're a programmer interested in contributing (and please, by all means do) there probably isn't much here of interest.

# Ideas / wish list for 0.3

* `ELSE`; that will enable a bunch of other words
* `BEGIN` and `AGAIN`
* `KEY` and `?KEY` if possible... like I said, maybe `ONKEY` is better... i.e. `ONKEY MYCALLBACK`
* Known bug, no obvious solution, fight for another night: in `."` and `s"`, for reasons only God and the original dev would understand, if running inside a user-defined word, the last word get treated like a Forth word.  For example:

```
: test ." This is an example." ;
\ If I run my "test" word, it sees 'example."' as a word to be interpreted.  Since it's not in the dictionary, it shows an error.
\ Sense?  We don't need to make no steenkin' sense! :P #BugInTheJavaScript
\ https://www.youtube.com/watch?v=vINkWUe874c
```

* Multi-line definitions; i.e.
```
: myWord
	." Oh my word :D"
	cr
	." Oh wait, this wouldn't compile anyway till that bug is fixed"
;
```
* I"d also kinda like a nice editor for files in localStorage; probably not gonna build one in the terminal; I'm thinking a fancy one with something like CodeMirror :)
* Once I've got that, add `INCLUDE` (with support for URLs instead of just "files" in localStorage)
* Canvas, audio, gamepad, speech... these will probably be scripts and not built into the language itself, but still... if possible, would be nice.
* Any harder-to-add standard words, maybe some of the ones in "core extensions" (and also strings etc.).
* `C@`, `C!` and `CMOVE`; these would require a major rework of how the program reads and writes memory.  For example, here's what it would take to get `c!` to work:

```js
var bits = memory[1].toString(2);				// The number as a string in binary format
while (bits.length < 32) bits = "0" + bits;		// Make sure it has 32 characters
var test = 255;									// This the 8-bit number to be stored
test = test.toString(2);						// Convert that to a binary string
var whichByte = 0;								// This is where we get into tricky territory.  if I do i.e. "myVar 1 + c!" it wouldn't work - it would go to the first byte of (myvar + 1 CELL)

// With that sorted, the rest is pretty easy... but getting there would be a PITA.
// memoryPointer would have to be dividied by... 4?... before it could do anything.
// Yeah, that can wait for 0.3 :)

console.log(bits);
if (whichByte == 3)
    bits = test + bits.substr(8);
else if (whichByte == 2)
    bits = bits.substr(0, 8) + test + bits.substr(0, 16);
else if (whichByte == 1)
    bits = bits.substr(0, 16) + test + bits.substr(0, 8);
else bits = bits.substr(0, 24) + test;
console.log(bits);
memory[1] = parseInt(bits, 2);
```
