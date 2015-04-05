# JSForth

This is a micro-Forth implementation in Javascript. It is built around an HTML REPL.

I wrote this two years ago on a Friday night during a PL course in college. The code is not the greatest; it only took a few hours to throw together. That said, it is pretty cool.

# Try It Out

A demonstration REPL is available via CodePen [here](http://codepen.io/eatonphil/pen/YPbWVN?editors=001).

Alternatively, it can be run locally by navigating to the provided index.html file.

# Built-in Commands

```
+ - / * ^ < > <= >= =  
    ex: a b + // displays: Stack: (a+b)  

. - returns the top element of the Stack  
    ex: a b . // displays: b; Stack: a  

.s - displays the current Stack and the size  
    ex: a b .s // displays: a b <2>; Stack: a b  

drop - pops off the top element without returning it  
    ex: a b drop // displays: nothing; Stack: a  

pick - puts a copy of the nth element on the top of the Stack  
    ex: a b c 2 pick // displays: nothing; Stack: a b c a  

swap - swaps the top two elements  
    ex: a b // displays: nothing; Stack: b a  

over - copies the second-to-last element to the top of the Stack  
    ex: a b over // displays: nothing; Stack: a b a  

dup - copies the top element  
    ex: a b dup // displays: nothing; Stack: a b b  

if ... then - executes what follows "if" if it evaluates true, continues on normally after optional "then"  
    ex: a b > if c then d // displays: nothing; Stack: a b c d //if a > b; Stack: a b d //if a <= b  

do ... [loop] - executes what is between "do" and "loop" or the end of the line  
    ex: a b c do a + // displays: nothing; Stack: adds a to itself b times starting at c 

invert - negates the top element of the Stack  
    ex: a invert // displays: nothing; Stack: 0 //a != 0; Stack: 1 //a == 0  

clear - empties the Stack  
    ex: a b clear // displays: nothing; Stack:  

: - creates a new custom (potentially recursive) definition  
    ex: a b c : add2 + + ; add2 // displays: nothing; Stack: (a+b+c)  

allocate - reallocates the max recursion for a single line of input  
    ex: 10 allocate  
cls - clears the screen  

debug - toggles console debug mode
```

# Examples

## Basics

```
>>> 3 4 +
    <ok>
>>> .s
    7 <ok>
>>> 3 4 - .s
    -1 <ok>
>>> 3 4 < .s
    1 <ok>
>>> 3 4 > .s
    0 <ok>
>>> 3 dup .s
    3 3 <ok>
>>> = .s
    1 <ok>
>>> drop
    <ok>
>>> .s
    <ok>
```

## Conditions

```
>>> 3 4 < if 11 then 12
    <ok>
>>> .s
    11 12 <ok>
>>> 3 4 > if 12 then 14 .s
    14
```

## Functions

```
>>> : plus + ;
    <ok>
>>> 2 3 plus
    5 <ok>
```

## Loops

### Power Function

```
>>> : pow 1 do dup + ;
    <ok>
>>> 2 3 pow .s
    8 <ok>
```

## Recursion

### Fibonacci

```
>>> : fib dup 1 > if 1 - dup fib swap 1 - fib + then ;
    <ok>
>>> 6 fib .s
    8 <ok>
```

### Factorial

```
>>> : fac dup 1 > if dup 1 - fac * then dup 0 = if drop 1 then dup 1 = if drop 1 then ;
    <ok>
>>> 3 fac
    6 <ok>
```
