'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeContext,played}=require('./helpers/load-project.cjs');
const {score,compare}=require('../scripts/inspect-snapshot.cjs');
const references=require('../fixtures/chesscom-reference-counts.json');
function snap(){
 const {Chess}=makeContext();
 const game=played(Chess,['e4','e5','Nf3','Nc6','Bb5','a6']);
 return {
  raw:{}, result:{...game,evaluations:game.fens.map(()=>({type:'cp',value:0,lines:[]}))},
  qualities:game.moves.map((_,i)=>({type:i<2?'book':'best',uci:game.uci_moves[i],evalLoss:0,epLoss:0,idea:null}))
 };
}
test('Valid synthetic game review passes complete snapshot structure checks',()=>{
 const v=score(snap());
 assert.deepEqual(v.problems,[]);
 assert.equal(v.counts.white.book,1);assert.equal(v.counts.black.book,1);
});
test('Snapshot audit finds illegal SAN, malformed arrow, wrong ply and invalid losses',()=>{
 const bad=snap();
 bad.result.moves[0]='Ke4';
 bad.qualities[2].epLoss=1.23;
 bad.qualities[2].idea={arrows:[{from:'z9',to:'f2'}]};
 bad.qualities.pop();
 const v=score(bad);
 assert(v.problems.some(x=>/SAN/.test(x)));
 assert(v.problems.some(x=>/invalid epLoss/.test(x)));
 assert(v.problems.some(x=>/malformed arrow/.test(x)));
 assert(v.problems.some(x=>/moveQualities/.test(x)));
});
test('Perspective audit compares classifications by ply, not which side was searched',()=>{
 const a=snap(), b=snap();
 assert.deepEqual(compare(a,b),[]);
 b.qualities[2].type='excellent';
 assert(compare(a,b).some(x=>/perspective/.test(x)));
});
test('All five screenshot references have complete known category fields',()=>{
 assert.equal(references.games.length,5);
 const types=['brilliant','great','book','best','excellent','good','inaccuracy','mistake','miss','blunder'];
 for(const game of references.games)for(const side of ['white','black']) {
  for(const type of types)assert(Number.isInteger(game[side].counts[type]),`${game.id} ${side} ${type}`);
  assert(Number.isFinite(game[side].accuracy));
 }
});
