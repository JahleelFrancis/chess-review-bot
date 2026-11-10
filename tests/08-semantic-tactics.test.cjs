'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeContext}=require('./helpers/load-project.cjs');

test('Real relative pin: bishop attacks a knight with a queen behind it',()=>{
 const {window}=makeContext();
 const fen='4k2r/8/1q6/8/3n4/8/5B2/6K1 w - - 0 1';
 const ev=window.ChessTactics.analyzeMove(fen,'f2e3');
 assert(ev);assert.equal(ev.attackerCanBeTaken,false);
 assert.equal(ev.pin?.attacker,'e3');
 assert.equal(ev.pin?.between?.square,'d4');
 assert.equal(ev.pin?.behind?.square,'b6');
});

test('False pin: if the pinning bishop is immediately capturable, suppress the pin claim',()=>{
 const {window}=makeContext();
 const fen='4k2r/8/1q6/8/3n1p2/8/5B2/6K1 w - - 0 1';
 const ev=window.ChessTactics.analyzeMove(fen,'f2e3');
 assert(ev);assert.equal(ev.attackerCanBeTaken,true);
 assert.equal(ev.pin,null);
});

test('Moving a knight unveils a ROOK attack on the queen (discovered attack)',()=>{
 const {window}=makeContext();
 const fen='6k1/4q3/8/8/8/8/4N3/4R1K1 w - - 0 1';
 const ev=window.ChessTactics.analyzeMove(fen,'e2g3');
 assert(ev);assert.equal(ev.fork,null);
 assert.equal(ev.discovered?.attacker?.square,'e1');
 assert.equal(ev.discovered?.victim?.square,'e7');
 assert.equal(ev.discovered?.victim?.piece?.type,'q');
});
