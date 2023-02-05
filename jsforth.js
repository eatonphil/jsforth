/*	
Copyright 2013-2015 Phil Eaton
Additional contributions 2023 The Geek on Skates (https://www.geekonskates.com)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

if (!String.prototype.trim) {
	String.prototype.trim = function() {
    	return this.replace(/^\s+|\s+$/g,'');
	};
}

var PROMPT = "\r\n>>> ",            // Text to display to let the user know the REPL is ready for input
	DEFAULT_ALLOCATION = 2000,      // Default max recursions (I think this is to prevent crashing the browser due to infinite loops)
	ALLOCATION = 2000,              // Max recursions for interpret() - this can be reset with the word ALLOCATE
	DEBUG = false,                  // Turns a debug mode on or off; in debug mode, JSForth prints info on what it's doing to the JS console
	IN_DEFINITION = false,          // Ignore potential Stack underflow errors if an operator is within a definition.
	OK = " ok",                     // The "ok" message to show when everything works
	ERROR = "",                     // An error code set if something goes wrong - not sure if we need it, but it looks like we do, so I'm leaving it for now
	// Error codes
	CMD_NOT_FOUND = -1,                   // Unknown word
	STACK_UNDERFLOW = -2,                 // Stack underflow
	PICK_OUT_OF_BOUNDS = -3,              // Pick (or roll) out of bounds
	STACK_OVERFLOW = -4,                  // Stack overflow
	IF_EXPECTED_THEN = -5,                // Missing "THEN"
	DIVISION_BY_ZERO = -6,                // Divisiion by zero
	EXPECTED_VAR_NAME = -7,               // Expected variable (or constant) name
	JS_ERROR = -8,                        // JavaScript error (in the "JS" word)
	ERROR_MESSAGE = "",                   // The message to show the user
	// Misc.
	terminal,                             // The terminal (lol obviously); now it's an xterm.js Terminal object
	user_def = {},                        // Dictionary of user-defined words (and also variables)
	constants = {                         // Dictionary of user-defined constants
		true: -1, false: 0,               // These two are self-explanatory :D
		base: 0,                          // Memory address of BASE
		pad: 65536-1024                   // Let "pad" be 1K, at the very end of memory, to minimize overwriting by accident
	},
	main = [],                            // Data stack
	memory = new Int32Array(65536),       // Memory for strings, variables and constants
	memoryPointer = 1,                    // Used when assigning variables/constants (starts at 1 because 0 is BASE)
	RECUR_COUNT = 0,					  // I think this tells interpret() how many recursions deep we are (see ALLOCATION)
	printBuffer = [],                     // Stores terminal output
	line = [],                            // Stores terminal input
	linePointer = 0,                      // Used for keys like HOme/End/arrows
	cmdHistory = [],                      // Command history, like most modern terminals (and even a lot of retro ones) have
	historyPointer = 0;                   // For the up/down arrow keys

/**
 * This is where most of the heavy lifting is done.  It actually interprets the user's code.
 * @param {string} input The user's code
 * @returns {?????} Looks like it returns strings and/or numbers, but then again if that's the case than what's printBuffer for?
 * @todo Make sense of this - completely understand how it all works.  A lot of it is familiar, some is very much not. :D
 */
function interpret(input) {
	
	// Update the recursion counter
	RECUR_COUNT++;
	if (RECUR_COUNT == ALLOCATION) {
		ERROR = STACK_OVERFLOW;
		ERROR_MESSAGE = "Stack Overflow. If this is generated incorrectly, the Stack can be reallocated. Default max recursion for a line of input is "+DEFAULT_ALLOCATION+".";
		if (DEBUG) console.log(ERROR_MESSAGE);
		return;
	}
	
	// If in debug mode, show the user what's about to run
	if (DEBUG) console.log("current_line: "+input);
	
	// Split the input string into tokens
	tokens = input.split(" ");
	
	// Loop through the tokens, running each one
	for (var i = 0; i < tokens.length; i++) {
		
		// If it's a comment, we're done with the entire line
		token = tokens[i].toLowerCase();
		if (token == "\\") return;
		
		// Log the line if in debug mode
		if (DEBUG) console.log("current_token: "+token);
		
		// If it's the other kind of comment, skip until the )
		if (token == "(") {
			while(!token.endsWith(")")) {
				i++;
				token = tokens[i];
				if (DEBUG) console.log("skipping "+token);
			}
			continue;
		}
		
		// If it's a constant, push it to the stack
		if (constants.hasOwnProperty(token)) {
			main.push(constants[token]);
			continue;
		}
		
		// And from here on out it's all about the words.
		if (token == ".\"") {
			var printThis = [];
			while(1) {
				i++;
				token = tokens[i];
				if (DEBUG) console.log("in the string: "+token);
				if (token.endsWith("\"")) {
					printThis.push(token.substr(0, token.length - 1));
					break;
				}
				printThis.push(token);
			}
			var s = printThis.join(" ");
			if (DEBUG) console.log("Final string: " + s);
			printBuffer.push(s);
			continue;
		}
		if (token == "s\"") {
			var saveThis = [];
			i++;
			token = tokens[i];
			while(!token.endsWith("\"")) {
				saveThis.push(tokens[i]);
				i++;
				token = tokens[i];
				if (DEBUG) console.log("to be stored: "+token);
			}
			saveThis.push(tokens[i].replace('"', ''));
			saveThis = saveThis.join(" ");
			i++;
			if (DEBUG) {
				console.log("Full string to be stored: "+saveThis);
				console.log("Next word: " + tokens[i]);
			}
			main.push(memoryPointer);
			main.push(saveThis.length);
			for (var z = 0; z<saveThis.length; z++) {
				memory[memoryPointer] = saveThis.charCodeAt(z);
				memoryPointer++;
			}
			memoryPointer++;	// For the "NULL terminator"
			continue;
		}
		if (token == "align" || token == "aligned") {
			// These words were added for portability; I can't imagine them being super-relevant in JSForth, so for now I'm
			// quoting the standard: "Implementors may define these words as no-ops on systems for which they aren't functional."
			continue;
		}
		if (token == "cls") {
			terminal.write("\033[2J\033[H");
			continue;
		}
		if (token == "help") {
			window.open("manual.html");
			continue;
		}
		if (token == "debug") {
			DEBUG = !DEBUG;
			terminal.write(" Debug mode " + (DEBUG ? "on\r\n" : "off\r\n"));
			continue;
		}
		if (token == "allocate") {
			ALLOCATION = parseInt(main.pop());
			terminal.write("Stack max reallocated: "+ALLOCATION);
			continue;
		}
		if (token == "depth") {
			main.push(main.length);
			continue;
		}
		if (token == ".s") {
			printBuffer.push("<" + main.length.toString(memory[0]) + "> ");
			for (var i=0; i<main.length; i++) printBuffer.push(main[i].toString(memory[0]).toUpperCase() + " ");
			continue;
		}
		if (token == "emit") {
			printBuffer.push(String.fromCharCode(main.pop()));
			continue;
		}
		if (token == "variable") {
			i++;
			if (i == tokens.length) {
				ERROR = EXPECTED_VAR_NAME;
				ERROR_MESSAGE = "expected variable name";
				return;
			}
			if (DEBUG) console.log("Defining variable: " + tokens[i] + " " + memoryPointer + " ;")
			user_def[tokens[i]] = memoryPointer.toString();
			memoryPointer++;
			continue;
		}
		if (token == "rows") {
			main.push(terminal.rows);
			continue;
		}
		if (token == "cols") {
			main.push(terminal.cols);
			continue;
		}
		if (token == "random") {
			main.push(parseInt(Math.random().toString().replace("0.","")));
			continue;
		}

		if ([".", "if", "invert", "drop", "dup", "abs", "count", "@", "constant", "allot"].indexOf(token) > -1) {
			// These words require ONE number to be on the stack.
			if (main.length < 1 || IN_DEFINITION == true) {
				ERROR = STACK_UNDERFLOW;
				ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
			} else if (!IN_DEFINITION) {
				if (token == ".") {
					printBuffer.push(main.pop() + " ");
					continue;
				} else if (token == "if") {
					var top = (parseInt(main.pop())==0);
					var then = tokens.indexOf("then");
					if (then !== -1) {
						if (top) {
							tokens = tokens.slice(then+1);
							if (tokens.join(" ") == "")
								return;
						}
						else {
							tokens = tokens.slice(tokens.indexOf("if")+1);
							then = tokens.indexOf("then");
							tokens.splice(then, 1);
						}
						console.log(tokens);
						return interpret(tokens.join(" "));
					} else {
						ERROR = IF_EXPECTED_THEN;
						ERROR_MESSAGE = "Expected \"then\" in input line.";
						return;
					}
				} else if (token == "invert") {
					top = main.pop();
					// Yes, I get that INVERT is supposed to do something like a bitwise-NOT of all bits, BUT...
					// (a) idk how to do that in JS, and
					// (b) the previous implementation didn't handle numbers other than true/false (like what happens if you do i.e. 65 invert?)
					// (c) in practice, the result is always something like this:
					main.push((top * -1) - 1);
				} else if (token == "drop") {
					main.pop();
				} else if (token == "abs") {
					main.push(Math.abs(parseInt(main.pop())));
				} else if (token == "allot") {
					memoryPointer += main.pop();
				} else if (token == "@") {
					var addr = main.pop();
					if (!addr < 0 || addr > memory.length) {
						ERROR = DIVISION_BY_ZERO;
						ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> invalid memory address";
						return;
					}
					else main.push(memory[addr]);
				} else if (token == "constant") {
					i++;
					if (i == tokens.length) {
						ERROR = EXPECTED_VAR_NAME;
						ERROR_MESSAGE = "expected constant name";
						return;
					}
					if (DEBUG) console.log("Defining constant: " + tokens[i] + " " + memoryPointer + " ;")
					constants[tokens[i]] = main.pop().toString();
					continue;
				} else if (token == "count") {
					var n = 0, z = main.pop();
					main.push(z);
					for (; z<memory.length; z++) {
						if (memory[z] == 0) break;
						n++;
					}
					main.push(n);
				} else if (token == "dup") {
					first = main.pop();
					main.push(first);
					main.push(first);
				}
			}

		// These words require that TWO numbers be on the stack
		} else if (["+", "-", "*", "^", "/", "mod", "!", "swap", "over", "pick", "roll", "=", "<>", ">=", "<=", ">", "<", "do", "lshift", "rshift", "and", "or", "xor", "type", "prompt", "js"].indexOf(token) > -1) {
			if (main.length < 2) {
				ERROR = STACK_UNDERFLOW;
				ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
			} else if (!IN_DEFINITION) {
				if (token == "+") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second + first);
				} else if (token == "-") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second - first);
				} else if (token == "*") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second * first);
				} else if (token == "/") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					if (first == 0) {
						ERROR = DIVISION_BY_ZERO;
						ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> division by zero";
						return;
					}
					main.push(Math.floor(second / first));
				} else if (token == "mod") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					if (first == 0) {
						ERROR = DIVISION_BY_ZERO;
						ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> division by zero";
						return;
					}
					main.push(second % first);
				} else if (token == "lshift") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second << first);
				} else if (token == "rshift") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second >> first);
				} else if (token == "and") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second & first);
				} else if (token == "or") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second | first);
				} else if (token == "xor") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(second ^ first);
				} else if (token == "^") {
					first = parseInt(main.pop());
					second = parseInt(main.pop());
					main.push(Math.pow(second, first));
				} else if (token == "swap") {
					a = main.pop();
					b = main.pop();
					main.push(a);
					main.push(b);
				} else if (token == "over") {
					first = main.pop();
					second = main.pop();
					main.push(second);
					main.push(first);
					main.push(second);
				} else if (token == "type") {
					var length = main.pop(), start = main.pop(), str = "";
					for(; start<length; start++) {
						str += String.fromCharCode(memory[start]);
					}
					printBuffer.push(str);
				} else if (token == "!") {
					var addr = main.pop(), value = main.pop();
					if (!addr < 0 || addr > memory.length) {
						ERROR = DIVISION_BY_ZERO;
						ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> invalid memory address";
						return;
					}
					else memory[addr] = value;
				} else if (token == "prompt") {
					var length = main.pop(), start = main.pop(), str = "";
					for(; start<length; start++) {
						str += String.fromCharCode(memory[start]);
					}
					PROMPT = str;
				} else if (token == "js") {
					var length = main.pop(), start = main.pop(), str = "";
					for(; start<length; start++) {
						str += String.fromCharCode(memory[start]);
					}
					try { eval(str); } catch(e) {
						if (DEBUG) console.log("JS error: ", e);
						ERROR = JS_ERROR;
						ERROR_MESSAGE = e.message || e;
						return;
					}
				} else if (token == "pick") {
					n = parseInt(main.pop());
					if (n < main.length && n >= 1) {
						var popped = Array();
						for (var j = 0; j < n; j++) {
							popped.push(main.pop());
						}
						var picked = parseInt(main.pop());
						main.push(picked);
						for (var j = 0; j < n; j++) {
							main.push(popped.pop());
						}
						main.push(picked);
					} else {
						ERROR = PICK_OUT_OF_BOUNDS;
						ERROR_MESSAGE = "Pick out of bounds.";
					}
				} else if (token == "roll") {
					n = parseInt(main.pop());
					if (n < main.length && n >= 1) {
						var popped = Array();
						for (var j = 0; j < n; j++) {
							popped.push(main.pop());
						}
						var picked = parseInt(main.pop());
						for (var j = 0; j < n; j++) {
							main.push(popped.pop());
						}
						main.push(picked);
					} else {
						ERROR = PICK_OUT_OF_BOUNDS;
						ERROR_MESSAGE = "Roll out of bounds.";
					}
				} else if (token == "<") {
					second = parseInt(main.pop());
					first = parseInt(main.pop());
					main.push((first<second)?parseInt(-1):0);
				} else if (token == ">") {
					second = parseInt(main.pop());
					first = parseInt(main.pop());
					console.log(first, second, first > second, parseInt(-1), "f");
					main.push((first>second)?parseInt(-1):0);
				} else if (token == ">=") {
					second = parseInt(main.pop());
					first = parseInt(main.pop());
					main.push((first>=second)?parseInt(-1):0);
				} else if (token == "<=") {
					second = parseInt(main.pop());
					first = parseInt(main.pop());
					main.push((first<=second)?parseInt(-1):0);
				} else if (token == "=") {
					second = parseInt(main.pop());
					first = parseInt(main.pop());
					main.push((first==second)?parseInt(-1):0);
				} else if (token == "<>") {
					second = parseInt(main.pop());
					first = parseInt(main.pop());
					main.push((first!=second)?parseInt(-1):0);
				} else if (token == "do") {
					var rest = Array();
					var newWord = Array();
					var index = main.pop();
					var iterations = main.pop();
					IN_DEFINITION = true;
					for (i++; i<tokens.length && tokens[i].toLowerCase() != "loop"; i++)
						newWord.push(tokens[i]);
					for (i++;i < tokens.length;i++) // gather up remaining tokens
						rest.push(tokens[i]);
					IN_DEFINITION = false;
					for (;index < iterations; index++)
						interpret(newWord.join(" "));
					if (rest.length)
						interpret(rest.join(" "));
				}
			}

		// These words require that THREE numbers be on the stack
		} else if (["fill", "rot", "-rot", "place", "+place", "move"].indexOf(token) > -1) {
			if (main.length < 3) {
				ERROR = STACK_UNDERFLOW;
				ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
			} else if (!IN_DEFINITION) {
				if (token == "rot") {
					var a = main.pop(), b = main.pop(), c = main.pop();
					main.push(b); main.push(a); main.push(c);
				} else if (token == "-rot") {
					var a = main.pop(), b = main.pop(), c = main.pop();
					main.push(a); main.push(c); main.push(b);
				} else if (token == "fill") {
					var value = main.pop(), u = main.pop(), address = main.pop();
					for (var i=0; i<u; i++) memory[address + i] = value;
				} else if (token == "place") {
					var address = main.pop(), stringLength = main.pop(), stringPointer = main.pop();
					for (var i=0; i<stringLength; i++) memory[address + i] = memory[stringPointer + i];
				} else if (token == "+place") {
					var address = main.pop(), stringLength = main.pop(), stringPointer = main.pop();
					while(memory[address] != 0 && address < memory.length) address++;
					for (var i=0; i<stringLength; i++) memory[address + i] = memory[stringPointer + i];
				} else if (token == "move") {
					var count = main.pop(), to = main.pop(), from = main.pop();
					for (var i=0; i<count; i++) memory[to + i] = memory[from + i];
				}
			}
			
		// These functions have no requirements; the check for unknown words goes here too
		} else {
			if (token == ":") {
				i++;
				var existed = false, rest = [], newWord = [], func = tokens[i].toLowerCase();					
				IN_DEFINITION = true;
				
				// Put all the tokens inside the definition into "newWord"
				for (i++; i<tokens.length && tokens[i] != ";"; i++) newWord.push(tokens[i]);
				
				// gather up remaining tokens
				for (i++;i < tokens.length;i++) rest.push(tokens[i]);
				
				IN_DEFINITION = false;
				if (func in user_def) existed = true;
				user_def[func] = newWord.join(" ").trim();
				if (rest.length) interpret(rest.join(" "));
				return existed ? "redefined " + func : "";
			} else if ((token in user_def) && !IN_DEFINITION) {	// !IN_DEFINITION allows recursion 
				var def = user_def[token], rest = [];
				
				// gather up remaining tokens
				for (i++;i < tokens.length;i++) rest.push(tokens[i]);
				
				if (DEBUG) {
					console.log("recursive_def: "+user_def[token]);
					console.log(main.join(" "));
				}
				
				// Here we encounter an exasperating bug that's harder to track down than a single molecule hiding somehwere on Mars. :D
				// I've spent way too much time fishing for this elusive Unobtainium of a bug, but since I didn't design the engine that
				// powers custom word definitions... it might be a really long time before I can discover its origin and solution.  So for now.
				if (def.startsWith('." ') || def.startsWith('s" ')) {
					terminal.write("\r\nDEEP MAGIC FROM THE DAWN OF TIME.......\r\n\nBy the Lion's mane, we'll figure it out someday.\r\n\n");
				} else interpret(def);
					
				if (rest.length) interpret(rest.join(" "));// interpret any remaining tokens
			} else if (token == "clear") {
				main = [];
			} else {
				
				// If it's a number, put that on the stack
				// Haha, cheesy bug: "DECIMAL" starts with "DEC" so in base-16 that's not NaN...
				// Maybe move this check to the very last "else" lol
				if (DEBUG) console.log("Checking token is a number, using base " + memory[0] + ": ", parseInt(token, memory[0]));
				if (!isNaN(parseInt(token, memory[0])) && isFinite(parseInt(token, memory[0]))) {
					if (token.indexOf(".") > -1) {
						if (memory[0] != 10) {
							// In Gforth this throws an error; i.e. can't do ABC.DEF
							// Which makes sense, cuz it is called a DECIMAL point :D
							ERROR = EXPECTED_VAR_NAME;		// I'm beginning to see these names are not super-important
							ERROR_MESSAGE = "Undefined word: " + token;
							return;
						}
						// Else, remove the decimal point and push the number on the stack
						// Again, I'm just going by Gforth here (i.e. 3.14 ." gives me 314).
						var n = parseInt(token.replace(".", ""));
						main.push(n);
						main.push(n > 0 ? 0 : -1);
					}
					else main.push(parseInt(token, memory[0]));
					continue;
				}
				
				
				// Tried this as a quick-and-dirty-hack, hoping it would fix the stoooooopid ." bug.
				// of course, it didn't help.  Didn't do Jack.  Like I said, only God knows the answer.
				// Shoot, at this point I'm starting to think even the original programmer might not know! :D
				// https://www.youtube.com/watch?v=vINkWUe874c - "but the front-end's a pile of crap" :D
				// if (token.endsWith('"')) continue;
				ERROR = CMD_NOT_FOUND;
				if (token == "")
					token = "null";
				ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> unknown word";
			}
		}
	}
}

/**
 * Displays a message followed by the prompt
 * @param {string} The message (either "ok" or an error)
 */
function displayPrompt(m) {
	m = m || "";
	terminal.write(m + PROMPT);
	terminal.focus();
}

/**
 * The terminal's onData event handler
 * @param {string} char The data (might not just be one character)
 */
function onInput(char) {
	
	// Up arrow key
	if (char == "\033[A") {
		if (!cmdHistory.length) return;
		historyPointer--;
		if (historyPointer < 0) historyPointer = cmdHistory.length - 1;
		for (var i=0; i<linePointer; i++) terminal.write("\033[D \033[D");
		line = cmdHistory[historyPointer].split("");
		linePointer = line.length;
		terminal.write(line.join(""));
		return;
	}
	
	// Down arrow key
	if (char == "\033[B") {
		if (!cmdHistory.length) return;
		historyPointer++;
		if (historyPointer >= cmdHistory.length) historyPointer = 0;
		for (var i=0; i<linePointer; i++) terminal.write("\033[D \033[D");
		line = cmdHistory[historyPointer].split("");
		linePointer = line.length;
		terminal.write(line.join(""));
		return;
	}
	
	// Right arrow key
	if (char == "\033[C") {
		if (linePointer < line.length) {
			terminal.write(char);
			linePointer++;
		}
		return;
	}
	
	// Left arrow key
	if (char == "\033[D") {
		if (linePointer > 0) {
			terminal.write(char);
			linePointer--;
		}
		return;
	}
	
	// End key
	if (char == "\033[F") {
		terminal.write("\033[" + (line.length - linePointer) + "C");
		linePointer = line.length;
		return;
	}
	
	// Home key
	if (char == "\033[H") {
		terminal.write("\033[" + linePointer + "D");
		linePointer = 0;
		return;
	}
	
	// Delete key
	if (char == "\033[3~") {
		line.splice(linePointer, 1);
		if (linePointer > 0) terminal.write("\033[" + (linePointer) + "D");
		terminal.write(line.join("") + " \033[" + (line.length + 1 - linePointer) + "D");
		console.log(line);
		return;
	}
	
	// Other non-printable keys (Escape, F1-F12, etc.) do nothing
	if (char[0] == "\033") return;
	
	// Enter
	var code = char.charCodeAt(0);
	if (char == "\r") {
		RECUR_COUNT = 0;
		var l = line.join("");
		if (cmdHistory.indexOf(l) == -1) cmdHistory.push(l);
		historyPointer = cmdHistory.length;
		var result = interpret(l);
		if (printBuffer.length) printBuffer.push(" ");
		if (ERROR == "") {
			if (result) result += " ";
			else result = "";
			if (result === "" && !printBuffer.length)
				displayPrompt(OK);
			else displayPrompt(" " + printBuffer.join("") + result + OK);
		}
		else displayPrompt("\033[1;31m " + (ERROR_MESSAGE || "Error: unknown") + "\033[0m\r\n");
		line = [];
		linePointer = 0;
		printBuffer = [];
		ERROR = "";
	} else if (code == 127) {
		// Backspace
		if (linePointer > 0) {
			linePointer--;
			line[linePointer] = "";
			terminal.write("\033[D \033[D");
		}
	} else {
		// All other printable characters
		terminal.write(char);
		line[linePointer] = char;
		linePointer++;
	}
}

/**
 * Initial setup
 */
window.onload = function() {
	// Set up the terminal
	terminal = new Terminal({
		screenReaderMode: true,
		customGlyphs: true
	});
	terminal.open(document.getElementById('repl'));
	terminal.onData(onInput);
	terminal.write("\033[34mJSForth 0.2\033[0m\r\nType \033[1;33mhelp\033[0m to see some docs.");
	displayPrompt();

	// Add some more standard Forth words - written in Forth :)
	interpret(": cr 10 emit 13 emit ;");
	interpret(": space 32 emit ;");
	interpret(": spaces 0 do space loop ;");
	interpret(": 2dup over over ;");
	interpret(": /mod 2dup mod -rot / ;");
	interpret(": 2drop drop drop ;");
	interpret(": 2swap 3 roll 3 roll ;");
	interpret(": 2over 3 pick 3 pick ;");
	interpret(": 2! swap over ! cell+ ! ;");
	interpret(": 2@ dup cell+ @ swap @ ;");
	interpret(": */ -rot * swap / ;");
	interpret(": */mod -rot * swap /mod ;");
	interpret(": 0< 0 < ;");
	interpret(": 0> 0 > ;");
	interpret(": 0= 0 = ;");
	interpret(": 1+ 1 + ;");
	interpret(": 1- 1 - ;");
	interpret(": +! + ! ;");
	interpret(": cells 1 * ;");
	interpret(": cell+ 1+ ;");
	interpret(": bl 32 ;");
	interpret(": ?dup dup 0 <> if dup then ;");
	interpret(": decimal 10 base ! ;");
	interpret("10 base !");
	
	// Whoops!  no ELSE yet :P
	//interpret(": min 2dup > if dup else over then ;");
	//interpret(": max 2dup < if dup else over then ;");
};
