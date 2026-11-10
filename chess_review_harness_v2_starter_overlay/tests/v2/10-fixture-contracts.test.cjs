'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {makeContext} = require('../helpers/load-project.cjs');
const {auditClaims} = require('../../scripts/v2/claim-contract.cjs');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/v2/positions.json'), 'utf8'));

function userFacingIdea(row) {
  const h = makeContext();
  const before = row.position.fen;
  const uci = row.position.played_uci;
  const board = new h.Chess(before);
  const move = board.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci.length===5?{promotion:uci[4]}:{})});
  assert(move, `${row.id}: move is illegal to chess.js`);
  assert.equal(move.san, row.position.expected_san);
  h.context.fixtureQuality = {uci, type:'best'};
  h.context.fixtureResult = {fens:[before,board.fen()], moves:[move.san],evaluations:[{},{}]};
  return h.evalJS('deriveMoveIdea(fixtureQuality, 0, fixtureResult)');
}

test('v2 registry cannot silently upgrade historical candidates into PASS', () => {
  assert.equal(source.schema_version, '2.0.0');
  const ids = new Set();
  assert(source.fixtures.length >= 10);
  for (const row of source.fixtures) {
    assert.match(row.id, /^[A-Z][A-Z0-9-]+$/);
    assert(!ids.has(row.id), `duplicate ${row.id}`);ids.add(row.id);
    assert(['rules_verified','unverified'].includes(row.evidence_status));
    assert(row.provenance?.source);
    if (row.evidence_status === 'rules_verified') {
      assert(row.position && row.oracle, `${row.id} lacks independently reviewable rule evidence`);
    } else {
      assert(Array.isArray(row.blocked_on) && row.blocked_on.length,
        `${row.id}: must disclose what is missing`);
      assert(!row.frontend, `${row.id}: can't assert uncertain UI ground truth`);
    }
  }
});

for (const row of source.fixtures.filter(x=>x.evidence_status==='rules_verified' && x.frontend)) {
  test(`evidence-driven text and arrow contract: ${row.id}`, () => {
    const actual = userFacingIdea(row);
    const errors = auditClaims(actual, row);
    assert.deepEqual(errors, [], `${row.id}: ${errors.join('; ')}`);
  });
}

test('mutated false pin, invented guarantee, reversed arrow are killed by same contracts', () => {
  const fake = source.fixtures.find(x=>x.id==='TAC-FALSE-PIN-001');
  const actual = userFacingIdea(fake);
  const mutant = {...actual, text: 'This pins the knight and is a forced win',
    arrows:[...actual.arrows, {from:'e3',to:'b6'}]};
  assert(auditClaims(mutant,fake).length >= 2,
    'test should reject intentionally invented tactical text/arrow');
  const discovery = source.fixtures.find(x=>x.id==='TAC-DISCOVERED-001');
  const actualDiscovery = userFacingIdea(discovery);
  const wrongArrow = {...actualDiscovery, arrows:(actualDiscovery.arrows||[])
    .map(a => a.from==='e1' && a.to==='e7' ? {...a, from:'e7',to:'e1'} : a)};
  assert(auditClaims(wrongArrow,discovery).some(x => x.startsWith('missing arrow')));
});
