'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {file}=require('./helpers/load-project.cjs');

test('Page loads browser-compatible chess before tactics and UI',()=>{
 const html=fs.readFileSync(file('index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi)]
   .map(match=>match[2].split(/[?#]/,1)[0]);
 const required=['/vendor/chess.browser.js','/tactics.js','/ui.js'];
 for(const src of required){
   assert.equal(scripts.filter(actual=>actual===src).length,1,
     `Expected exactly one script tag for ${src}`);
 }
 assert(!scripts.includes('/vendor/chess.js'),
   'Legacy CommonJS chess.js must not be loaded in the browser');
 assert(fs.existsSync(file('vendor/chess.browser.js')),
   'Browser-compatible vendor build must exist');
 const refs=required.map(src=>scripts.indexOf(src));
 assert(refs[0]<refs[1]&&refs[1]<refs[2],
   `Incorrect chess/tactics/ui order: ${refs}`);
});

test('Explain button, chips, and Got it have separate style targets',()=>{
 const css=fs.readFileSync(file('styles.css'),'utf8');
 for(const selector of ['.explainStart','.explainChip','.explainGotIt','.explainControls']){
    assert(css.includes(selector),`Missing ${selector}`);
 }
 assert(css.includes('align-items: center'),'Buttons need center alignment');
});

test('UI preserves split explanation versus moves and explicit return control',()=>{
 const js=fs.readFileSync(file('ui.js'),'utf8');
 for(const name of ['getExplainCandidate','startExplanation','setExplanationStep','finishExplanation']){
    assert(new RegExp(`function\\s+${name}\\s*\\(`).test(js),`Missing ${name}`);
 }
 assert(js.includes('currentMoveIndex'), 'Return must restore game ply');
 assert(js.includes('explainGotIt'), 'Explicit return button missing');
});
