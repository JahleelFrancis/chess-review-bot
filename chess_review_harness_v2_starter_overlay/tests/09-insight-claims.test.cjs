'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeContext,played}=require('./helpers/load-project.cjs');
function idea(fen,uci){
 const h=makeContext();const b=new h.Chess(fen);
 const m=b.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci.length===5?{promotion:uci[4]}:{})});
 assert(m);h.context.q={uci,type:'best'};
 h.context.result={fens:[fen,b.fen()],moves:[m.san],evaluations:[{},{}]};
 return h.evalJS('deriveMoveIdea(q,0,result)');
}

test('Natural-language pin only when pinning piece cannot simply be captured',()=>{
 const actual=idea('4k2r/8/1q6/8/3n4/8/5B2/6K1 w - - 0 1','f2e3');
 assert.match(actual.text,/pins the knight on d4 to the queen on b6/i);
 assert(actual.arrows.some(a=>a.from==='e3'&&a.to==='b6'));
 const fake=idea('4k2r/8/1q6/8/3n1p2/8/5B2/6K1 w - - 0 1','f2e3');
 assert.doesNotMatch(fake.text,/pin/i);
 assert(!fake.arrows.some(a=>a.to==='b6'));
});

test('Discovered attack uses the rook-to-queen line, not an invented fork',()=>{
 const result=idea('6k1/4q3/8/8/8/8/4N3/4R1K1 w - - 0 1','e2g3');
 assert.match(result.text,/discovered attack/i);
 assert(result.arrows.some(a=>a.from==='e1'&&a.to==='e7'));
 assert.doesNotMatch(result.text,/fork/i);
});

test('A recoverable pawn capture is called an exchange, not a guaranteed free pawn',()=>{
 const {Chess}=makeContext();const b=new Chess();b.move('e4');b.move('d5');
 const result=idea(b.fen(),'e4d5');
 assert.match(result.text,/exchange/i);
 assert.doesNotMatch(result.text,/wins.+pawn|free pawn|forced win/i);
});

test('The displayed insight title agrees with its final computed category',()=>{
 const h=makeContext(),game=played(h.Chess,['e4','e5','Nf3','Nc6','Bc4','Nf6']);
 const es=game.fens.map((_,i)=>({type:'cp',value:i*5,lines:[]}));
 h.context.g=game;h.context.e=es;
 h.window.analysisResult={...game,evaluations:es};
 h.window.currentGameMeta={whiteRating:900,blackRating:900};
 const q=h.evalJS('computeMoveQualities(e,g.moves,g.uci_moves,g.fens,{}, {})');
 for(const row of q){
   assert(row.insight?.title,`Missing insight title for ${row.type}`);
   const expected={brilliant:'brilliant',great:'great',book:'book',best:'best',excellent:'excellent',good:'good',
    inaccuracy:'inaccuracy',mistake:'mistake',miss:'missed',blunder:'blunder'}[row.type];
   assert(row.insight.title.toLowerCase().includes(expected),`Stale insight: type=${row.type}, title=${row.insight.title}`);
 }
});
