#!/usr/bin/env node
'use strict';
/** Optional real-browser smoke test. Requires: npm install -D playwright && npx playwright install chromium
 * Pass a LOCAL URL of a previously analyzed game, not the landing page.
 * Usage: node scripts/browser-smoke.cjs http://127.0.0.1:8000/user/analysis/123 */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
let chromium;
try { ({chromium}=require('playwright')); }
catch (_) {console.error('Playwright not installed. Run: npm install -D playwright && npx playwright install chromium');process.exit(2);}
const url=process.argv[2];
if(!url||!/^https?:\/\//.test(url)){console.error('Pass the URL of a local game analysis route.');process.exit(2);}
const out=path.resolve(process.env.HARNESS_OUTPUT_DIR||'harness-screenshots');fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
   for(const layout of [
     {name:'desktop',width:1440,height:900},
     {name:'tablet',width:900,height:900},
     {name:'mobile',width:390,height:844},
   ]){
    const page=await browser.newPage({viewport:{width:layout.width,height:layout.height}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.analysisResult?.moves?.length>0 && window.moveQualities?.length>0,{timeout:30000});
    await page.locator('#tabMoves').click();
    const position=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    assert(position.scrollWidth<=position.clientWidth+3,`${layout.name}: horizontal page overflow`);
    await page.screenshot({path:path.join(out,layout.name+'-normal.png')});
    const rawIndex=await page.evaluate(()=>window.currentMoveIndex);
    // Click forward to an explainable move (might be absent on a short opening).
    let explainVisible=false;
    for(let i=0;i<Math.min(40,await page.evaluate(()=>window.maxIndex));i++){
      if(await page.locator('.explainStart:visible').count()){explainVisible=true;break;}
      await page.locator('#analysisControls button').nth(2).click();
    }
    if(explainVisible){
      const trigger=page.locator('.explainStart:visible').first();
      const size=await trigger.boundingBox();
      assert(size.height<=46,`${layout.name}: Explain button too tall (${size.height}px)`);
      const indexBefore=await page.evaluate(()=>window.currentMoveIndex);
      await trigger.click();
      assert(await page.locator('#analysisControls .explainGotIt').count(),`${layout.name}: no Got it`);
      assert(await page.locator('#analysisControls .explainNext').count(),`${layout.name}: no Next`);
      // The board and original selected move should not be changed by entering Explain.
      assert.equal(await page.evaluate(()=>window.currentMoveIndex),indexBefore);
      const next=page.locator('#analysisControls .explainNext');
      if(await next.isEnabled())await next.click();
      assert.equal(await page.evaluate(()=>window.currentMoveIndex),indexBefore);
      // Explanation steps should be separate from scrolling moves list, and not clipped on desktop.
      const geom=await page.evaluate(()=>{
        const right=document.querySelector('#rightPanel').getBoundingClientRect();
        const bubble=[...document.querySelectorAll('#coachBubble,#panelCoachBubble')].find(e=>e.getBoundingClientRect().height>0);
        const b=bubble?.getBoundingClientRect();
        const move=document.querySelector('#moveListContainer').getBoundingClientRect();
        return {right:{top:right.top,bottom:right.bottom},bubble:b&&{top:b.top,bottom:b.bottom,scrollHeight:bubble.scrollHeight,clientHeight:bubble.clientHeight},move:{top:move.top,bottom:move.bottom}};
      });
      if(layout.name==='desktop'&&geom.bubble){
        assert(geom.bubble.bottom<=geom.move.top+3,`coach overlaps moves list: ${JSON.stringify(geom)}`);
        assert(geom.bubble.scrollHeight<=geom.bubble.clientHeight+3,`desktop coach text is clipped or scrollable: ${JSON.stringify(geom)}`);
      }
      await page.screenshot({path:path.join(out,layout.name+'-explain.png')});
      await page.locator('#analysisControls .explainGotIt').click();
      assert.equal(await page.evaluate(()=>window.currentMoveIndex),indexBefore);
      assert.equal(await page.locator('#analysisControls button').count(),4,'Normal navigation not restored');
    }else console.warn(`${layout.name}: No Explain button found in first 40 plies (not automatically a failure)`);
    // Summary tabs must not be obstructed by the explanation UI.
    await page.locator('#tabOverview').click();
    await page.screenshot({path:path.join(out,layout.name+'-overview.png')});
    await page.locator('#tabInfo').click();
    await page.screenshot({path:path.join(out,layout.name+'-info.png')});
    assert.equal(errors.length,0,`${layout.name} browser errors: ${errors.join('; ')}`);
    await page.close();
    console.log(`PASS ${layout.name}: viewport, navigation, tabs, Explain/Got it (when available).`);
   }
  }finally{await browser.close();}
})().catch(e=>{console.error('BROWSER SMOKE FAILED:',e.stack);process.exit(1);});
