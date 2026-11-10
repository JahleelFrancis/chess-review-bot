'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {makeContext,played} = require('../helpers/load-project.cjs');
const {auditClaims} = require('../../scripts/v2/claim-contract.cjs');
const fixtures = require('../../fixtures/v2/positions.json').fixtures;

function classificationContext() {
  const h = makeContext();
  const g = played(h.Chess,['e4','e5','Nf3','Nc6']);
  // An intentionally synthetic engine snapshot, NOT a real evaluation of 1.e4.
  // Its unambiguous 800cp deterioration creates a classifier threshold sentinel.
  const ev = [0,-800,0,0,0].map(value=>({type:'cp',value,lines:[]}));
  h.window.currentGameMeta = {whiteRating:1000,blackRating:1000};
  h.context.fixtureGame = g;
  h.context.fixtureEvals = ev;
  return h;
}
const compute = h => h.evalJS('computeMoveQualities(fixtureEvals, fixtureGame.moves, fixtureGame.uci_moves, fixtureGame.fens, {}, {})');

test('an independently fixed bad-score sentinel kills all-Excellent source mutation', () => {
  const original = classificationContext();
  const baseline = compute(original);
  assert.equal(baseline[0].type,'blunder', 'fixed score sentinel must have known expected behavior');
  assert(baseline[0].epLoss > 0.20, 'the oracle cutoff is independent of the UI title');

  const mutant = classificationContext();
  mutant.evalJS(`
    const _originalCompute = computeMoveQualities;
    computeMoveQualities = function (...args) {
      return _originalCompute(...args).map(q => ({...q,type:'excellent',insight:{title:'Excellent move'}}));
    };
  `);
  const poisoned = compute(mutant);
  assert(poisoned.every(q=>q.type==='excellent'), 'confirm mutant was actually injected');
  assert.notEqual(poisoned[0].type,'blunder',
    'an independent expected category must reject even a mutually consistent wrong title/label');
});

test('mutated arrow endpoints in real explanation function violate tactical evidence', () => {
  const row=fixtures.find(x=>x.id==='TAC-DISCOVERED-001');
  const h=makeContext(), {fen,played_uci}=row.position;
  const board = new h.Chess(fen);
  const actual=board.move({from:played_uci.slice(0,2),to:played_uci.slice(2,4)});
  assert(actual);
  h.context.fixtureQuality={uci:played_uci,type:'best'};
  h.context.fixtureResult={fens:[fen,board.fen()],moves:[actual.san],evaluations:[{},{}]};
  assert.deepEqual(auditClaims(h.evalJS('deriveMoveIdea(fixtureQuality,0,fixtureResult)'),row),[]);

  h.evalJS(`
    const _originalIdea = deriveMoveIdea;
    deriveMoveIdea = function (...args) {
      const idea=_originalIdea(...args);
      return {...idea, arrows:(idea.arrows||[]).map(a=>({...a,from:a.to,to:a.from}))};
    };
  `);
  const mutated = h.evalJS('deriveMoveIdea(fixtureQuality,0,fixtureResult)');
  assert(auditClaims(mutated,row).some(e=>e.startsWith('missing arrow')),
    'the contract must reject changed source behavior, not just a manually edited screenshot');
});
