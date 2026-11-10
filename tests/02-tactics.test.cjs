'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {makeContext,played}=require('./helpers/load-project.cjs');
const before='r2qr1k1/ppp2pb1/6p1/8/6N1/2P1PQ1P/P4PP1/R3K2R b KQ - 0 16';

test('Checking bishop fork: highlight checked king and attacked rook, not an invented material gain',()=>{
 const {window,Chess,evalJS}=makeContext();
 const board=new Chess(before);
 assert.equal(board.move({from:'g7',to:'c3'}).san,'Bxc3+');
 const ev=window.ChessTactics.analyzeMove(before,'g7c3');
 assert.equal(ev.check,true);
 assert.equal(ev.fork.isCheckFork,true);
 assert.equal(ev.fork.forcedMaterialWin.target,'a1');
 assert(ev.fork.forcedMaterialWin.minimumGain>=2);
 const result={fens:[before,board.fen()],moves:['Bxc3+']};
 const idea=evalJS(`deriveMoveIdea({uci:'g7c3',type:'best'},0,${JSON.stringify(result)})`);
 assert.match(idea.text,/rook on a1/);
 assert.match(idea.text,/king on e1/);
 assert(idea.arrows.some(a=>a.from==='c3'&&a.to==='e1'));
 assert(idea.arrows.some(a=>a.from==='c3'&&a.to==='a1'));
 assert(!idea.arrows.some(a=>a.from==='g7'));
});

test('When the tactical analyzer is absent, do not invent a forced material win',()=>{
 const {evalJS,Chess}=makeContext({tactics:false});
 const board=new Chess(before);board.move({from:'g7',to:'c3'});
 const result={fens:[before,board.fen()],moves:['Bxc3+']};
 const idea=evalJS(`deriveMoveIdea({uci:'g7c3',type:'best'},0,${JSON.stringify(result)})`);
 assert.match(idea.text,/rook on a1/);
 assert.doesNotMatch(idea.text,/material gain/i);
});

test('Legal recapture evidence never labels any capture as automatically free',()=>{
 const {Chess,window}=makeContext();
 const board=new Chess();
 for(const move of ['e4','d5'])board.move(move);
 const fen=board.fen();
 const evidence=window.ChessTactics.analyzeMove(fen,'e4d5');
 assert(evidence && evidence.capture);
 assert.equal(evidence.san,'exd5');
 assert(Number.isFinite(evidence.capture.netExchangeGain));
 // A normal trade/capture is not, by itself, evidence of a forced fork.
 assert.equal(evidence.fork,null);
});

test('Tactics analyzer rejects an illegal move instead of making up arrows',()=>{
 const {window,Chess}=makeContext();
 assert.equal(window.ChessTactics.analyzeMove(new Chess().fen(),'e2e5'),null);
});
