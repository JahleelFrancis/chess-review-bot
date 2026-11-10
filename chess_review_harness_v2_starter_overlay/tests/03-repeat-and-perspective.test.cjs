'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeContext,played}=require('./helpers/load-project.cjs');
const F='r3r3/ppp2pk1/6pN/8/8/4PQ1P/P2q1PP1/b4K1R w - -';
const item=(type,loss,ep,rank)=>({type,severity:type==='inaccuracy'?'inaccuracy':null,
 uci:'h6f5',evalLoss:loss,epLoss:ep,playedTopLineIndex:rank});

test('Identical repeated position+move gets consistent labels, while preserving raw EP losses',()=>{
 const {window}=makeContext();
 const q=Array(43).fill(null), fens=Array(43).fill('8/8/8/8/8/8/K7/7k w - - 0 1');
 q[38]=item('excellent',93,.035041222,2); q[42]=item('inaccuracy',123,.047342851,-1);
 fens[38]=F+' 1 20'; fens[42]=F+' 5 22';
 const copy=[q[38].epLoss,q[42].epLoss];
 window.reconcileRepeatedMoveQualities(q,fens);
 assert.equal(q[38].type,q[42].type);
 assert.equal(q[38].type,'inaccuracy');
 assert.deepEqual([q[38].epLoss,q[42].epLoss],copy);
});

test('Different positions and near-50-move draw states are NOT forced to the same category',()=>{
 const {window}=makeContext();
 const changed=[item('excellent',90,.03,2),item('inaccuracy',125,.05,-1)];
 window.reconcileRepeatedMoveQualities(changed,[F+' 1 20',F.replace('b4K1R','b3K2R')+' 5 22']);
 assert.equal(changed[0].type,'excellent');
 const draw=[item('excellent',90,.03,2),item('inaccuracy',125,.05,-1)];
 window.reconcileRepeatedMoveQualities(draw,[F+' 95 20',F+' 97 22']);
 assert.equal(draw[0].type,'excellent');
});

test('Game move classifications do not depend on searched username or board perspective',()=>{
 const {window,Chess,evalJS,context}=makeContext();
 const game=played(Chess,['e4','e5','Nf3','Nc6','Bc4','Nf6']);
 const evs=game.fens.map((fen,i)=>({type:'cp',value:[0,24,10,33,12,43,30][i],
    best_move:game.uci_moves[i]||null,lines:[]}));
 context.testGame=game; context.testEvals=evs;
 window.analysisResult={...game,evaluations:evs};
 window.currentGameMeta={whiteUsername:'WhitePlayer',blackUsername:'BlackPlayer',whiteRating:850,blackRating:850};
 window.currentUsername='WhitePlayer';window.currentUsernameDisplay='WhitePlayer';
 const white=evalJS('computeMoveQualities(testEvals,testGame.moves,testGame.uci_moves,testGame.fens,{}, {})');
 const first=white.map(q=>[q.type,q.scoringType,q.epLoss,q.evalLoss]);
 window.currentUsername='BlackPlayer';window.currentUsernameDisplay='BlackPlayer';
 const black=evalJS('computeMoveQualities(testEvals,testGame.moves,testGame.uci_moves,testGame.fens,{}, {})');
 assert.deepEqual(black.map(q=>[q.type,q.scoringType,q.epLoss,q.evalLoss]),first);
 for(const q of black){assert(Number.isFinite(q.epLoss));assert(q.epLoss>=0&&q.epLoss<=1);assert(q.evalLoss>=0);}
});
