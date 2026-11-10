'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {makeContext,played,fen4} = require('./helpers/load-project.cjs');

test('Loads browser chess.js, tactical analyzer, and UI functions in isolation',()=>{
 const {window,evalJS,Chess}=makeContext();
 assert.equal(typeof window.ChessTactics.analyzeMove,'function');
 assert.equal(typeof evalJS('computeMoveQualities'),'function');
 assert.equal(typeof window.getExplainCandidate,'function');
 assert.equal(typeof window.reconcileRepeatedMoveQualities,'function');
 assert.equal(new Chess().moves().length,20);
});

test('SAN, UCI and FEN stay aligned including castling and captures',()=>{
 const {Chess}=makeContext();
 const game=played(Chess,['e4','e5','Nf3','Nc6','Bc4','Nf6','O-O','Nxe4','Re1']);
 assert.equal(game.fens.length,game.moves.length+1);
 const board=new Chess(game.fens[0]);
 game.uci_moves.forEach((uci,i)=>{
   const m=board.move({from:uci.slice(0,2),to:uci.slice(2,4), ...(uci.length>4?{promotion:uci[4]}:{})});
   assert(m,`Illegal move at ply ${i+1}: ${uci}`);
   assert.equal(m.san,game.moves[i]);
   assert.equal(fen4(board.fen()),fen4(game.fens[i+1]));
 });
});

test('Winning side is retained for mate 0 when the checkmated side is to move',()=>{
 const {evalJS,context}=makeContext();
 const payload = {evaluations:[{type:'mate',value:0},{type:'mate',value:0}],
   fens:['7k/7R/5K2/8/8/8/8/8 b - - 0 1','7K/8/5k2/8/8/8/8/7r w - - 0 1']};
 context.testResult=payload;
 evalJS('normalizeTerminalMateEvals(testResult)');
 assert.equal(payload.evaluations[0].winner,'white');
 assert.equal(payload.evaluations[1].winner,'black');
});
