'use strict';
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const command = (label, exe, args) => {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(exe,args,{cwd:root,stdio:'inherit',env:process.env});
  if(r.error) { console.error(`${label}: unavailable: ${r.error.message}`); return 2; }
  return r.status ?? 2;
};
let fail = 0;
fail |= command('v1 regression foundation',process.execPath,['scripts/run-harness.cjs']);
fail |= command('v2 fixture and claim contracts',process.execPath,['--test','tests/v2/10-fixture-contracts.test.cjs','tests/v2/11-source-mutations.test.cjs']);
const python = process.env.CHESS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
fail |= command('v2 independent chess-rule oracle',python,['scripts/v2/oracle.py']);
fail |= command('v2.1 engine adapter negative controls (NO engine run)',python,['scripts/v2/test_engine_probe.py']);
if (fail) console.error('\nVerification gate NOT satisfied: one or more checks failed or could not run.');
else console.log('\nVerified rules and adapter gates satisfied; real Stockfish evidence remains a separate opt-in run.');
process.exit(fail?1:0);
