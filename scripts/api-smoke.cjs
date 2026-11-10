#!/usr/bin/env node
'use strict';
/** Optional full pipeline check; starts NO server and uses a local running FastAPI.
 * Usage: node scripts/api-smoke.cjs http://127.0.0.1:8000 */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {createRequire}=require('node:module');
const projectStatic=path.resolve(process.env.CHESS_STATIC_DIR||path.join(__dirname,'../static'));
const vendor=createRequire(__filename)(path.join(projectStatic,'vendor/chess.js'));
const Chess=vendor.Chess||vendor;
const url=String(process.argv[2]||'http://127.0.0.1:8000').replace(/\/$/,'');
const pgn='[Event "Harness API smoke"]\n[White "FixtureWhite"]\n[Black "FixtureBlack"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
const f4=fen=>fen.split(/\s+/).slice(0,4).join(' ');
async function main(){
 const invalid=await fetch(url+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pgn:''})});
 assert.equal(invalid.status,400,'Empty PGN must be rejected cleanly');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
 let resp;
 try{resp=await fetch(url+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pgn}),signal:controller.signal});}
 finally{clearTimeout(timer);}
 assert.equal(resp.status,200,`Analyze API failed: ${resp.status} ${await resp.text()}`);
 const game=await resp.json();
 for(const key of ['moves','uci_moves','fens','evaluations'])assert(Array.isArray(game[key]),`Missing ${key}`);
 assert.equal(game.moves.length,6);
 assert.equal(game.fens.length,7);
 assert.equal(game.evaluations.length,7);
 const board=new Chess(game.fens[0]);
 for(let i=0;i<game.moves.length;i++){
  const uci=game.uci_moves[i];const move=board.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci.length===5?{promotion:uci[4]}:{})});
  assert(move,`illegal engine move ${i+1}: ${uci}`);
  assert.equal(move.san,game.moves[i]);
  assert.equal(f4(board.fen()),f4(game.fens[i+1]));
  const ev=game.evaluations[i];assert(['cp','mate'].includes(ev?.type),`bad evaluation at ${i}`);
 }
 console.log('PASS FastAPI/Stockfish contract: empty PGN validation, six legal plies, FEN and eval alignment.');
}
main().catch(e=>{console.error('API smoke failed:',e.stack);process.exit(1);});
