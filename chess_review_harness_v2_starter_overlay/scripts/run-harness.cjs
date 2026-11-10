#!/usr/bin/env node
'use strict';
// Cross-platform runner (avoids shell glob issues on Windows PowerShell).
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=fs.readdirSync(path.join(root,'tests'))
  .filter(x=>/^\d+.*\.test\.cjs$/.test(x)).sort()
  .map(x=>path.join(root,'tests',x));
if(!files.length){console.error('No harness tests found. Extract the ZIP into your project root.');process.exit(2);}
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',env:process.env});
process.exit(result.status ?? 1);
