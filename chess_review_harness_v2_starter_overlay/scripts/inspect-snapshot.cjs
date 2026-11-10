#!/usr/bin/env node
'use strict';
/** Validates a capture of window.analysisResult + window.moveQualities.
 *  Strict failures = illegal/inconsistent data; warnings = diagnostic heuristics.
 *  No Stockfish installation, Python, or network needed. */
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const projectStatic = path.resolve(process.env.CHESS_STATIC_DIR || path.join(__dirname,'../static'));
const {Chess} = createRequire(__filename)(path.join(projectStatic, 'vendor/chess.js'));
const refDB = require('../fixtures/chesscom-reference-counts.json');
const TYPES = ['brilliant','great','book','best','excellent','good','inaccuracy','mistake','miss','blunder'];
const f4 = f => String(f || '').trim().split(/\s+/).slice(0,4).join(' ');
const normalize = value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const dataFrom = file => {
  const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const result = raw.analysisResult || raw.result || raw;
  const qualities = raw.moveQualities || raw.qualities || result.moveQualities || [];
  return {raw,result,qualities};
};
function score(snapshot) {
  const {raw,result,qualities} = snapshot;
  const problems=[], warnings=[];
  const fail=message=>problems.push(message), warn=message=>warnings.push(message);
  const moves=result.moves, uci=result.uci_moves || result.uciMoves, fens=result.fens, evaluations=result.evaluations;
  if (!Array.isArray(moves)||!Array.isArray(uci)||!Array.isArray(fens)||!Array.isArray(evaluations)||!Array.isArray(qualities)) {
    fail('Required arrays: moves, uci_moves, fens, evaluations, moveQualities');
    return {problems,warnings,counts:{}};
  }
  const n=moves.length;
  if(uci.length!==n)fail(`uci_moves ${uci.length}, expected ${n}`);
  if(fens.length!==n+1)fail(`fens ${fens.length}, expected ${n+1}`);
  if(evaluations.length!==n+1)fail(`evaluations ${evaluations.length}, expected ${n+1}`);
  if(qualities.length!==n)fail(`moveQualities ${qualities.length}, expected ${n}`);
  const counts={white:Object.fromEntries(TYPES.map(t=>[t,0])),black:Object.fromEntries(TYPES.map(t=>[t,0]))};
  if(fens[0]) {
    try {
      const board=new Chess(fens[0]);
      for(let i=0;i<Math.min(n,uci.length,fens.length-1);i++){
        const move=uci[i];
        if(typeof move!=='string'||!/^([a-h][1-8]){2}[nbrq]?$/.test(move)){
          fail(`ply ${i+1}: invalid UCI ${String(move)}`);break;
        }
        let actual=null;
        try {actual=board.move({from:move.slice(0,2),to:move.slice(2,4),...(move.length===5?{promotion:move[4]}:{})});}catch(_){}
        if(!actual){fail(`ply ${i+1}: illegal move ${move} in ${board.fen()}`);break;}
        if(String(moves[i]).replace(/[!?]/g,'')!==actual.san)fail(`ply ${i+1}: SAN ${moves[i]} disagrees with legal ${actual.san}`);
        if(f4(board.fen())!==f4(fens[i+1]))fail(`ply ${i+1}: FEN differs after ${actual.san}`);
      }
    } catch(e){fail(`Cannot parse starting FEN: ${e.message}`);}
  }
  for(let i=0;i<n;i++){
    const q=qualities[i];
    if(!q||typeof q!=='object'){fail(`ply ${i+1}: missing quality`);continue;}
    if(!TYPES.includes(q.type)){fail(`ply ${i+1}: unknown type ${q.type}`);continue;}
    counts[i%2===0?'white':'black'][q.type]++;
    if(q.uci && q.uci!==uci[i])fail(`ply ${i+1}: quality UCI differs from game`);
    for(const [field,min,max] of [['evalLoss',0,Infinity],['epLoss',0,1]]){
      if(q[field]!==undefined && (!Number.isFinite(Number(q[field]))||Number(q[field])<min||Number(q[field])>max))fail(`ply ${i+1}: invalid ${field}: ${q[field]}`);
    }
    for(const obj of [q.idea,q.badMoveLesson]){
      for(const a of obj?.arrows||[]){
        if(!/^[a-h][1-8]$/.test(a.from)||!/^[a-h][1-8]$/.test(a.to))fail(`ply ${i+1}: malformed arrow ${JSON.stringify(a)}`);
        if(a.from===a.to)fail(`ply ${i+1}: arrow points to its own square`);
      }
    }
    if(q.idea?.text?.match(/\b(pin|fork|skewer|forced|wins)\b/i) && !q.tactics){
      warn(`ply ${i+1}: tactical insight has no attached tactical evidence; check arrow manually`);
    }
  }
  // PV sequences need to be legal from exactly their evaluation position.
  for(let i=0;i<Math.min(evaluations.length,fens.length);i++){
    for(const [lineIndex,line] of (evaluations[i]?.lines||[]).entries()){
      const pv=Array.isArray(line.pv)?line.pv:typeof line.pv==='string'?line.pv.trim().split(/\s+/):[];
      if(!pv.length)continue;
      let board;
      try{board=new Chess(fens[i]);}catch(e){continue;}
      for(let j=0;j<pv.length;j++){
        const m=pv[j];
        if(!/^([a-h][1-8]){2}[nbrq]?$/.test(m)){warn(`evaluation ${i} line ${lineIndex} step ${j}: invalid PV notation ${m}`);break;}
        let played=null;
        try{played=board.move({from:m.slice(0,2),to:m.slice(2,4),...(m.length===5?{promotion:m[4]}:{})});}catch(_){}
        if(!played){warn(`evaluation ${i} line ${lineIndex} step ${j}: illegal PV ${m}; continuation must stop here`);break;}
      }
    }
  }
  // Detect perspective-independent category drift for the SAME position + move.
  const groups=new Map();
  for(let i=0;i<Math.min(n,qualities.length);i++){
    const half=Number(String(fens[i]||'').split(/\s+/)[4]);
    if(Number.isFinite(half)&&half>=90)continue; // draw-right-sensitive; intentionally conservative
    const key=f4(fens[i])+'|'+uci[i];
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
  }
  for(const indexes of groups.values())if(indexes.length>=2){
    const names=[...new Set(indexes.map(i=>qualities[i]?.type))];
    if(names.length>1)warn(`Repeated equivalent board + move have different labels: plies ${indexes.map(i=>i+1).join(', ')}, ${names.join(' vs ')}`);
  }
  return {problems,warnings,counts};
}
function compare(a,b){
  const issues=[];
  for(const side of ['white','black']){
    const left=a.raw.reviewByColor?.[side],right=b.raw.reviewByColor?.[side];
    if(left&&right){
      for(const field of ['accuracy','estimatedRating']){
        if(Number(left[field])!==Number(right[field]))issues.push(`${side} ${field} changed with searched username (${left[field]} → ${right[field]})`);
      }
    }
  }
  const n=a.qualities.length;
  if(a.result.moves.length!==b.result.moves.length||n!==b.qualities.length)return ['Different number of moves; cannot compare perspectives'];
  for(let i=0;i<n;i++){
    if(a.result.uci_moves?.[i]!==b.result.uci_moves?.[i])issues.push(`ply ${i+1}: different UCI move`);
    if(f4(a.result.fens?.[i])!==f4(b.result.fens?.[i]))issues.push(`ply ${i+1}: different board`);
    for(const field of ['type','scoringType','severity']){
      if((a.qualities[i]?.[field]??null)!==(b.qualities[i]?.[field]??null))issues.push(`ply ${i+1}: ${field} changed with perspective (${a.qualities[i]?.[field]} → ${b.qualities[i]?.[field]})`);
    }
  }
  return issues;
}
function main(){
 const [source,...args]=process.argv.slice(2);
 if(!source){console.error('Usage: node scripts/inspect-snapshot.cjs snapshot.json [--reference id] [--compare other.json]');process.exit(2);}
 let snapshot;
 try {snapshot=dataFrom(source);}catch(e){console.error('Cannot load snapshot:',e.message);process.exit(2);}
 const report=score(snapshot);
 console.log(`\n${path.basename(source)} | ${snapshot.result.moves?.length||0} plies | ${snapshot.raw.uiVersion||'unknown UI build'}`);
 for(const [side,counts] of Object.entries(report.counts))console.log(`${side.padEnd(6)} ${TYPES.map(k=>`${k}:${counts[k]}`).join('  ')}`);
 const refAt=args.indexOf('--reference');
 if(refAt!==-1){
  const ref=refDB.games.find(g=>g.id===args[refAt+1]);
  if(!ref){console.error('Unknown reference ID. Available:',refDB.games.map(g=>g.id).join(', '));process.exit(2);}
  console.log(`\nChess.com counts comparison — ${ref.id} (diagnostic, not strict):`);
  for(const side of ['white','black']){
   const diffs=TYPES.map(k=>[k,(report.counts[side]?.[k]||0)-(ref[side]?.counts?.[k]||0)]);
   console.log(`${side}: `+diffs.filter(([,d])=>d).map(([k,d])=>`${k} ${d>0?'+':''}${d}`).join(' | '));
   console.log(`   absolute count error: ${diffs.reduce((s,[,d])=>s+Math.abs(d),0)}`);
   const actualReview=snapshot.raw.reviewByColor?.[side];
   if(actualReview) {
     const accuracy=Number(actualReview.accuracy), estimatedRating=Number(actualReview.estimatedRating);
     if(Number.isFinite(accuracy))console.log(`   accuracy: bot ${accuracy.toFixed(1)} / Chess.com ${ref[side].accuracy.toFixed(1)} (delta ${(accuracy-ref[side].accuracy).toFixed(1)})`);
     if(Number.isFinite(estimatedRating))console.log(`   game rating: bot ${estimatedRating} / Chess.com ${ref[side].gameRating} (delta ${estimatedRating-ref[side].gameRating})`);
   }
  }
 }
 const compareAt=args.indexOf('--compare');
 if(compareAt!==-1){
   try{
    const issues=compare(snapshot,dataFrom(args[compareAt+1]));
    if(issues.length)report.problems.push(...issues);
    else console.log('\nPASS: Same moves, positions, and categories across both perspectives.');
   }catch(e){report.problems.push(`Cannot read comparison: ${e.message}`);}
 }
 if(report.warnings.length)console.log('\nWARNINGS:\n'+report.warnings.map(s=>'  - '+s).join('\n'));
 if(report.problems.length)console.error('\nFAILURES:\n'+report.problems.map(s=>'  - '+s).join('\n'));
 else console.log('\nPASS: hard data and legal-move invariants');
 process.exitCode=report.problems.length?1:0;
}
if(require.main===module)main();
module.exports={score,compare,dataFrom};
