'use strict';

// The contract is separately reviewed fixture truth, not a string generated
// from the classifier itself. Renderer/arrow output must respect that truth.
function auditClaims(actual, oracleFixture) {
  const errors = [];
  const contract = oracleFixture.frontend;
  if (!contract) return errors;
  const text = String(actual?.text || '').toLowerCase();
  const arrows = Array.isArray(actual?.arrows) ? actual.arrows : [];
  const matches = (a, b) => a?.from === b?.from && a?.to === b?.to;
  for (const req of contract.required_text || []) {
    if (!text.includes(req.toLowerCase())) errors.push(`missing required text: ${req}`);
  }
  for (const req of contract.forbidden_text || []) {
    if (text.includes(req.toLowerCase())) errors.push(`forbidden text: ${req}`);
  }
  for (const arrow of contract.required_arrows || []) {
    if (!arrows.some(a => matches(a, arrow))) errors.push(`missing arrow: ${arrow.from}->${arrow.to}`);
  }
  for (const arrow of contract.forbidden_arrows || []) {
    if (arrows.some(a => matches(a, arrow))) errors.push(`forbidden arrow: ${arrow.from}->${arrow.to}`);
  }
  for (const arrow of arrows) {
    if (!/^[a-h][1-8]$/.test(arrow.from || '') || !/^[a-h][1-8]$/.test(arrow.to || '')) {
      errors.push('invalid square in arrow');
    }
  }
  return errors;
}
module.exports = {auditClaims};
