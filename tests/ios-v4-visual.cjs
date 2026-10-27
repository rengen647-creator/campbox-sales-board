'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const output=path.join(__dirname,'..','qa','ios4-screenshots');
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const widths=[375,430,820,980,1280,1593];
 try{
  for(const dark of [false,true]){
   for(const width of widths){
    const page=await browser.newPage({viewport:{width,height:820},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto('file://'+path.join(__dirname,'..','qa','ios4-visual-fixture.html'),{waitUntil:'load'});
    if(dark)await page.evaluate(()=>document.documentElement.classList.remove('cb-apple-light'));
    const report=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('.ios4-activity')];
      const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};
      const items=cards.map(c=>{
       const r=rect(c),n=c.querySelector('input'),inp=rect(n),name=rect(c.querySelector('.ios4-activity-name'));
       return {r,inp,name,scrollHeight:c.scrollHeight,clientHeight:c.clientHeight,display:getComputedStyle(c).display,overflow:getComputedStyle(c).overflow};
      });
      return {items,screenWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,inputs:[...document.querySelectorAll('#v13TodayPlan [data-v13-fact]')].length};
    });
    assert.equal(errors.length,0,errors.join(';'));
    assert.equal(report.items.length,5,'five activities '+width);
    assert.equal(report.inputs,5,'exactly one canonical fact input per activity '+width);
    assert.ok(report.scrollWidth<=report.screenWidth+3,'Horizontal overflow at '+width+' '+JSON.stringify(report));
    for(const [i,item] of report.items.entries()){
      assert.equal(item.display,'flex','Must be a real flex card '+width);
      assert.ok(item.r.height>=145,'Card clipped (height '+item.r.height+') at width '+width+' index '+i);
      assert.ok(item.inp.top>=item.r.top&&item.inp.bottom<=item.r.bottom+2,'fact editor outside card '+width+' '+i);
      assert.ok(item.name.top>=item.r.top&&item.name.bottom<=item.r.bottom+2,'text outside card '+width+' '+i);
      assert.ok(item.scrollHeight<=item.clientHeight+4,'vertical card content clipped '+width+' '+i);
    }
    for(let i=0;i<report.items.length;i++)for(let j=i+1;j<report.items.length;j++){
      const a=report.items[i].r,b=report.items[j].r;
      const overlap=Math.min(a.right,b.right)-Math.max(a.left,b.left)>4 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4;
      assert.ok(!overlap,'cards overlap '+width+' '+i+'/'+j);
    }
    if(width===375||width===980||width===1593){
      await page.screenshot({path:path.join(output,(dark?'dark':'light')+'-'+width+'.png'),fullPage:true});
    }
    const first=page.locator('.ios4-activity').first();
    const h1=await first.evaluate(e=>e.getBoundingClientRect().height);
    await first.locator('summary').click();
    const h2=await first.evaluate(e=>e.getBoundingClientRect().height);
    assert.ok(h2>h1,'Expandable explanation should grow card at '+width);
    const detailVisible=await first.locator('details p').isVisible();
    assert.equal(detailVisible,true,'Full explanation remains accessible');
    await page.close();
   }
  }
 }finally{await browser.close()}
 console.log('PASS Visual V4: 12 browser renderings, 60 fact-input containment checks, no overlap, no horizontal overflow, expandable details; screenshots stored in qa/ios4-screenshots');
})().catch(err=>{console.error(err);process.exit(1)});
