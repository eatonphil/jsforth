/*	
Copyright (C) 2013-2015 Phil Eaton

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

/*
 * CONSTANTS
 */
 var FORTH_TEXT = "JSForth Interpreter v0.1  Copyright (C) 2013-2015  Phil Eaton \
 \nType \"help\" to see some documentation.";

 var FORTH_PROMPT = "\n>>> ";
 var FORTH_EOF = "bye";
 var FORTH_DEFAULT_ALLOCATION = 1000;
 var FORTH_ALLOCATION = FORTH_DEFAULT_ALLOCATION;
 var FORTH_FALSE = 0;
 var FORTH_TRUE = !FORTH_FALSE;
 var FORTH_DEBUG = false;
 var FORTH_HELP = "\For more documentation on the FORTH language, visit http://www.complang.tuwien.ac.at/forth/gforth/Docs-html/ \
 \nFor a concise tutorial/introduction to FORTH, visit http://www.ece.cmu.edu/~koopman/forth/hopl.html \
 \nwww.forth.com is also a great resource. \
 \nPlease feel free to submit any bugs/comments/suggestions to me<at>eatonphil<dot>com \
 \n\nSupported Commands: \
 \n+ - / * ^ < > <= >= = != \
 \n    ex: a b + // displays: Stack: (a+b) \
 \n. - returns the top element of the Stack \
 \n    ex: a b . // displays: b; Stack: a \
 \n.s - displays the current Stack and the size \
 \n    ex: a b .s // displays: a b <2>; Stack: a b \
 \ndrop - pops off the top element without returning it \
 \n    ex: a b drop // displays: nothing; Stack: a \
 \npick - puts a copy of the nth element on the top of the Stack \
 \n    ex: a b c 2 pick // displays: nothing; Stack: a b c a \
 \nswap - swaps the top two elements \
 \n    ex: a b // displays: nothing; Stack: b a \
 \nover - copies the second-to-last element to the top of the Stack \
 \n    ex: a b over // displays: nothing; Stack: a b a \
 \ndup - copies the top element \
 \n    ex: a b dup // displays: nothing; Stack: a b b \
 \nif ... then - executes what follows \"if\" if it evaluates true, continues on normally after optional \"then\" \
 \n    ex: a b > if c then d // displays: nothing; Stack: a b c d //if a > b; Stack: a b d //if a <= b \
 \ndo ... [loop] - executes what is between \"do\" and \"loop\" or the end of the line \
 \n    ex: a b c do a + // displays: nothing; Stack: adds a to itself b times starting at c\
 \ninvert - negates the top element of the Stack \
 \n    ex: a invert // displays: nothing; Stack: 0 //a != 0; Stack: 1 //a == 0 \
 \nclear - empties the Stack \
 \n    ex: a b clear // displays: nothing; Stack: \
 \n: - creates a new custom (potentially recursive) definition \
 \n    ex: a b c : add2 + + ; add2 // displays: nothing; Stack: (a+b+c) \
 \nallocate - reallocates the max recursion for a single line of input \
 \n    ex: 10 allocate \
 \ncls - clears the screen \
 \ndebug - toggles console debug mode";

// Ignore potential Stack underflow errors if an operator is within a definition.
var IN_DEFINITION = false;

/*
 * ERRORS
 */

 var FORTH_OK = "<ok>";
 var FORTH_ERROR = "";

// CODES
var CMD_NOT_FOUND = -1;
var STACK_UNDERFLOW = -2;
var PICK_OUT_OF_BOUNDS = -3;
var STACK_OVERFLOW = -4;
var BAD_DEF_NAME = -5;
var IF_EXPECTED_THEN = -6;

// MESSAGES
var FORTH_ERROR_GENERIC = "Forth Error.";
var FORTH_ERROR_MESSAGE = "";

var main;
var terminal;
var user_def = {};

function valid_def_name(name)
{
	var chr = name.charAt(0);
	if (chr >= 'a' && chr <= 'z')
		return true;
	return false;
}

function interpret(input) {
	terminal = window.terminal;
	RECUR_COUNT++;
	
	if (RECUR_COUNT == FORTH_ALLOCATION)
	{
		FORTH_ERROR = STACK_OVERFLOW;
		FORTH_ERROR_MESSAGE = "Stack Overflow. If this is generated incorrectly, the Stack can be reallocated. Default max recursion for a line of input is "+FORTH_DEFAULT_ALLOCATION+".";
	}
	else
	{
		if (FORTH_DEBUG)
		{
			console.log("current_line: "+input);
		}
		tokens = input.split(" ");
		for (var i = 0; i < tokens.length; i++) {
			token = tokens[i];
			if (FORTH_DEBUG)
				console.log("current_token: "+token);
			if (!isNaN(parseFloat(token)) && isFinite(token)) {
				main.push(token);
			} else {
				token = token.toLowerCase();
				if (token == "cls") {
					terminal.value = "";
					return;
				} else if (token == "help") {
					terminal.value = FORTH_HELP;
					return;
				} else if (token == "debug") {
					FORTH_DEBUG = (FORTH_DEBUG?false:true);
					return "console debugging enabled: "+FORTH_DEBUG;
				} else if (token == "allocate") {
					FORTH_ALLOCATION = Number(main.pop());
					return "Stack max reallocated: "+FORTH_ALLOCATION;
				} else if (token == ".s") {
					return main.join(" ");
				}

				if (token == "." || token == "if" || token == "invert" || token == "drop" || token == "dup")// if token represents a binary operator
				{
					if (main.length < 1 || IN_DEFINITION == true) {
						FORTH_ERROR = STACK_UNDERFLOW;
						FORTH_ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
					} else if (!IN_DEFINITION) {
						if (token == ".") {
							return main.pop();
						} else if (token == "if") {
							var top = (Number(main.pop())==FORTH_FALSE);
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
								FORTH_ERROR = IF_EXPECTED_THEN;
								FORTH_ERROR_MESSAGE = "Expected \"then\" in input line.";
								return;
							}
						} else if (token == "invert")
						{
							top = main.pop();
							if (top == FORTH_TRUE)
								top = FORTH_FALSE;
							else
								top = 1;
							main.push(top);
						} else if (token == "drop")
						{
							main.pop();
						} else if (token == "dup") {
							first = main.pop();
							main.push(first);
							main.push(first);
						}
					}
				} else if (token == "+" || token == "-" || token == "*" || token == "^" || token == "/" || token == "swap" || token == "over" || token == "pick" || token == "=" || token == "!=" || token == ">=" || token == "<=" || token == ">" || token == "<" || token == "do") {
					if (main.length < 2) {
						FORTH_ERROR = STACK_UNDERFLOW;
						FORTH_ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
					} else if (!IN_DEFINITION) {
						if (token == "+") {
							first = Number(main.pop());
							second = Number(main.pop());
							main.push(second + first);
						} else if (token == "-") {
							first = Number(main.pop());
							second = Number(main.pop());
							main.push(second - first);
						} else if (token == "*") {
							first = Number(main.pop());
							second = Number(main.pop());
							main.push(second * first);
						} else if (token == "/") {
							first = Number(main.pop());
							second = Number(main.pop());
							main.push(second / first);
						} else if (token == "^") {
							first = Number(main.pop());
							second = Number(main.pop());
							main.push(pow(second, first));
						} else if (token == "swap") {
							first = main.pop();
							second = main.pop();
							main.push(first);
							main.push(second);
						} else if (token == "over") {
							first = main.pop();
							second = main.pop();
							main.push(second);
							main.push(first);
							main.push(second);
						} else if (token == "pick") {
							n = Number(main.pop());
							if (n < main.length && n >= 1) {
								var popped = Array();
								for (var j = 0; j < n; j++) {
									popped.push(main.pop());
								}
								var picked = Number(main.pop());
								main.push(picked);
								for (var j = 0; j < n; j++) {
									main.push(popped.pop());
								}
								main.push(picked);
							} else {
								FORTH_ERROR = PICK_OUT_OF_BOUNDS;
								FORTH_ERROR_MESSAGE = "Pick out of bounds.";
							}
						}
						else if (token == "<")
						{
							second = Number(main.pop());
							first = Number(main.pop());
							main.push((first<second)?Number(FORTH_TRUE):FORTH_FALSE);
						}
						else if (token == ">")
						{
							second = Number(main.pop());
							first = Number(main.pop());
							console.log(first, second, first > second, Number(FORTH_TRUE), "f");
							main.push((first>second)?Number(FORTH_TRUE):FORTH_FALSE);
						}
						else if (token == ">=")
						{
							second = Number(main.pop());
							first = Number(main.pop());
							main.push((first>=second)?Number(FORTH_TRUE):FORTH_FALSE);
						}
						else if (token == "<=")
						{
							second = Number(main.pop());
							first = Number(main.pop());
							main.push((first<=second)?Number(FORTH_TRUE):FORTH_FALSE);
						}
						else if (token == "=")
						{
							second = Number(main.pop());
							first = Number(main.pop());
							main.push((first==second)?Number(FORTH_TRUE):FORTH_FALSE);
						} else if (token == "!=")
						{
							second = Number(main.pop());
							first = Number(main.pop());
							main.push((first!=second)?Number(FORTH_TRUE):FORTH_FALSE);
						} else if (token == "do")
						{
							var rest = Array();
							var func_def = Array();
							var index = main.pop();
							var iterations = main.pop();
							IN_DEFINITION = true;
							for (i++; i<tokens.length && tokens[i].toLowerCase() != "loop"; i++)
								func_def.push(tokens[i]);
							for (i++;i < tokens.length;i++) // gather up remaining tokens
								rest.push(tokens[i]);
							IN_DEFINITION = false;
							for (;index < iterations; index++)
								interpret(func_def.join(" "));
							if (rest.length)
								interpret(rest.join(" "));
						}
					}
				// These functions have no requirements or are not found.
				} else {
					if (token == ":")
					{
						i++;
						if (valid_def_name(tokens[i])) // if func_name is not a valid function name
						{
							var existed = false;
							var rest = Array();
							var func = tokens[i].toLowerCase();					
							var func_def = Array();
							IN_DEFINITION = true;
							for (i++;i<tokens.length && tokens[i] != ";"; i++)
								func_def.push(tokens[i]);
							for (i++;i < tokens.length;i++) // gather up remaining tokens
								rest.push(tokens[i]);
							IN_DEFINITION = false;
							if (func in window.user_def)
								existed = true;
							window.user_def[func] = func_def.join(" ").trim();
							if (rest.length)
								interpret(rest.join(" "));
							if (existed)
								return "<def:" + func + "> modified";
							return "<def:" + func + "> created";
						}
						else {
							FORTH_ERROR = BAD_DEF_NAME;
							FORT_ERROR_MESSAGE = "Definition must begin with a letter.";
						}
						i++;
					}
					else if ((token in window.user_def) && !IN_DEFINITION) // !IN_DEFINITION allows recursion
					{
						var def = window.user_def[token];
						var rest = Array();
						for (i++;i < tokens.length;i++) // gather up remaining tokens
						{
							rest.push(tokens[i]);
						}
						if (FORTH_DEBUG)
						{
							console.log("recursive_def: "+window.user_def[token]);
							console.log(main.join(" "));
						}
						interpret(def);
						if (rest.length)
							interpret(rest.join(" "));// interpret any remaining tokens
					} else if (token == "clear")
					{
						main = [];
					}
					else {
						FORTH_ERROR = CMD_NOT_FOUND;
						if (token == "")
							token = "null";
						FORTH_ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> not found";
					}
				}
			}
		}
	}
}

function displayPrompt(result) {
	terminal = window.terminal;
	if (!result)
		result = "";
	terminal.value += result + FORTH_PROMPT;
	terminal.focus();
}

function setKeyPressAction(terminal) {
	function get_line() {
		var lines = terminal.value.split("\n");
		var line = lines[lines.length - 1];
		return line;
	}


	terminal.onkeydown = function(e) {
		if (e.keyCode == 13) {
			var input = terminal.value.split("\n");
			var last_line = input[input.length - 1].slice(FORTH_PROMPT.length-1);
			RECUR_COUNT = 0;
			var result = interpret(last_line);
			if (FORTH_ERROR == "") {
				if (result)
					result += " ";
				else
					result = "";
				if (terminal.value !== "")
					displayPrompt("\n    " + result + FORTH_OK);
				else // clear screen
					terminal.value = ">>> ";
			} else {
				displayPrompt("\n<err:" + FORTH_ERROR + ";msg:" + (FORTH_ERROR_MESSAGE || FORTH_ERROR_GENERIC) + ">");
				FORTH_ERROR = "";
				FORTH_ERROR_MESSAGE = "";
			}
			window.setTimeout(function() {
				val = terminal.value.split("");
				terminal.value = val.splice(0, val.length - 1).join("");
			}, 1);
		} else if (e.keyCode == 8 || e.keyCode == 46) {
			if (get_line().length < FORTH_PROMPT.length) {
				terminal.value += " ";
			}
		}
	};
}

function init_interpreter() {
	terminal = window.terminal;
	/*
	 * Set interpreter style settings.
	 */
	 terminal.setAttribute("style", "width:100%;height:100%;position:absolute;left:0;right:0;top:0;bottom:0;background-color:black;color:red;font-size:20px;font-family:\"Courier New\"");
	 terminal.setAttribute("resize", "none");
	 terminal.setAttribute("spellcheck", "false");
	 terminal.focus();
	 terminal.value = FORTH_TEXT;

	 displayPrompt();

	 setKeyPressAction(terminal);
	}

	function init_env() {
		window.terminal = document.getElementById("interpreter");
		window.main = [];
	}

	window.onload = function() {
		init_env();
		init_interpreter();
	};