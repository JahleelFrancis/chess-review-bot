'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeContext,played}=require('./helpers/load-project.cjs');

test('Special move FENs: en passant and promotion retain board truth',()=>{
 const {Chess}=makeContext();
 const ep=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 const m=ep.move({from:'e5',to:'d6'});
 assert(m);assert.equal(m.san,'exd6');assert(!ep.get('d5'));
 assert.equal(ep.get('d6')?.type,'p');
 const promotion=new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
 const promote=promotion.move({from:'a7',to:'a8',promotion:'q'});
 assert(promote);assert.equal(promotion.get('a8').type,'q');
 assert.match(promote.san,/=Q/);
});

test('No book move should appear deep into a game with an EMPTY opening database',()=>{
 const {window,Chess,context,evalJS}=makeContext();
 const game=played(Chess,['e4','e5','Nf3','Nc6','Bc4','Nf6','O-O','Be7','Re1','O-O','c3','d6']);
 const evs=game.fens.map((_,i)=>({type:'cp',value:0,best_move:game.uci_moves[i]||null,lines:[]}));
 context.game=game;context.evs=evs;
 window.currentGameMeta={whiteRating:1200,blackRating:1200};
 window.analysisResult={...game,evaluations:evs};
 const q=evalJS('computeMoveQualities(evs,game.moves,game.uci_moves,game.fens,{}, {})');
 assert.equal(q.length,game.moves.length);
 for(let i=10;i<q.length;i++)assert.notEqual(q[i].type,'book',`ply ${i+1} improperly marked book`);
});

test('Long review remains deterministic and all derived scores finite',()=>{
 const {window,Chess,context,evalJS}=makeContext();
 const seq=[];
 for(let i=0;i<12;i++)seq.push('Nf3','Nf6','Ng1','Ng8');
 const game=played(Chess,seq);
 const evs=game.fens.map((_,i)=>({type:'cp',value:(i%3-1)*10,lines:[]}));
 context.game=game;context.evs=evs;
 window.currentGameMeta={whiteRating:1600,blackRating:1600};
 window.analysisResult={...game,evaluations:evs};
 const q=evalJS('computeMoveQualities(evs,game.moves,game.uci_moves,game.fens,{}, {})');
 assert.equal(q.length,48);
 const original=q.map(x=>[x.type,x.epLoss,x.evalLoss]);
 const again=evalJS('computeMoveQualities(evs,game.moves,game.uci_moves,game.fens,{}, {})');
 assert.deepEqual(again.map(x=>[x.type,x.epLoss,x.evalLoss]),original);
 for(const row of q){ assert(Number.isFinite(row.epLoss));assert(row.epLoss>=0);assert(row.epLoss<=1);}
});
