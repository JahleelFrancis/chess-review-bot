'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeContext,played,fen4}=require('./helpers/load-project.cjs');

function setup(pv){
  const {window,Chess,context,evalJS}=makeContext();
  const playedGame=played(Chess,['e4']);
  const startingFen=playedGame.fens[1];
  window.analysisResult={...playedGame,evaluations:[{}, {lines:[{pv}]}]};
  window.moveQualities=[{type:'inaccuracy',severity:'inaccuracy',uci:'e2e4',badMoveLesson:null,idea:null}];
  window.currentMoveIndex=1;window.maxIndex=1;
  let boardFen=startingFen;
  window.boardApi={position(fen){boardFen=fen;},orientation(){return 'white';}};
  return {window,Chess,evalJS,startingFen,getFen:()=>boardFen};
}

test('Explain line is optional; original ply and FEN are restored by Got it',()=>{
 const h=setup(['e7e5','g1f3','b8c6','f1b5','a7a6','b5a4']);
 const candidate=h.window.getExplainCandidate(0);
 assert(candidate && candidate.steps.length === 6);
 assert.equal(candidate.steps[0].move.san,'e5');
 assert.equal(candidate.steps[1].move.san,'Nf3');
 h.evalJS('startExplanation()');
 assert.equal(h.getFen(),h.startingFen);
 h.evalJS('setExplanationStep(3)');
 assert.notEqual(h.getFen(),h.startingFen);
 assert.equal(h.window.currentMoveIndex,1);
 h.evalJS('finishExplanation()');
 assert.equal(h.getFen(),h.startingFen);
 assert.equal(h.window.currentMoveIndex,1);
});

test('Never follow an illegal PV move or invent positions after it',()=>{
 const h=setup(['e7e5','g1f3','e7e6','b8c6']);
 const candidate=h.window.getExplainCandidate(0);
 assert(candidate && candidate.steps.length===2);
 assert.equal(candidate.steps[1].move.san,'Nf3');
 const invalid=setup(['e2e4','g1f3']);
 assert.equal(invalid.window.getExplainCandidate(0),null);
});

test('PV length is dynamic, capped for safety but not hardcoded to 5',()=>{
 const p=['e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1','f8e7','f1e1',
          'b7b5','a4b3','e8g8'];
 const h=setup(p);
 const candidate=h.window.getExplainCandidate(0);
 assert(candidate && candidate.steps.length>5);
 assert(candidate.steps.length<=20);
 const short=setup(['e7e5','g1f3']);
 assert.equal(short.window.getExplainCandidate(0).steps.length,2);
});

test('Explainer describes checks as forced responses; material gains are NOT guaranteed for all replies',()=>{
 const {evalJS}=makeContext();
 const text=evalJS(`describeExplanationStep({move:{piece:'n',to:'f7',color:'w',san:'Nf7+'},after:'4k3/5N2/8/8/8/8/8/4K3 b - - 0 1'},null)`);
 assert.match(text,/check/i);
 assert.match(text,/must respond/i);
 // The summary must explicitly call the PV illustrative, never assert inevitability.
 const summary=evalJS(`explanationSummary({startingFen:'8/8/8/8/8/8/4k3/4K3 w - - 0 1',steps:[{after:'8/8/8/8/8/8/4k3/4K3 b - - 0 1'}]})`);
 assert.match(summary,/not proof of a forced win|not a guarantee/i);
});
