/* Real browser CSS parity against immutable reviewed release, same DOM and data. */
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{PNG}=require('pngjs'),pixelmatch=require('pixelmatch');
const base=require('../docs/css-consolidation.json').baseline;
const old=cp.execFileSync('git',['show',base+':index.html'],{encoding:'utf8'}).split('</head>')[0];
let css='';for(const m of old.matchAll(/<link\s+rel="stylesheet"\s+href="(?:\.\/)?([^"?]+)[^"]*"\s*\/?\s*>|<style[^>]*>([\s\S]*?)<\/style>/g))css+='\n'+(m[1]?cp.execFileSync('git',['show',base+':'+m[1]],{encoding:'utf8'}):m[2]);
(async()=>{const browser=await chromium.launch();const out='qa/os3-evidence';fs.mkdirSync(out,{recursive:true});let checks=[];try{
const page=await browser.newPage();await page.goto('file://'+path.resolve('qa/os3-app-fixture.html'));await page.waitForSelector('html.os3');
await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
await page.evaluate(css=>{const style=document.createElement('style');style.id='qaOldStyles';style.textContent=css;document.querySelector('link[href*="sales-board.css"]').after(style);style.disabled=true;},css);
for(const theme of ['light','dark'])for(const width of [375,430,820,1024,1280,1440,1593,1920])for(const screen of ['today','month','analytics','funnel','contracts','finance','team','salary','summary','report']){
 await page.setViewportSize({width,height:900});await page.evaluate(({theme,screen})=>{document.documentElement.classList.toggle('cb-apple-light',theme==='light');window.v13Go(screen);},{theme,screen});
 if(screen==='finance')await page.locator('#finMatrixRows tr').waitFor();if(screen==='salary')await page.locator('#salaryMine .salary-kpi').first().waitFor();
 const label=`${theme}-${width}-${screen}`;
 await page.evaluate(()=>{document.getElementById('qaOldStyles').disabled=false;document.querySelector('link[href*="sales-board.css"]').disabled=true;});
 const geometryBefore=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return [e.tagName,e.id,...[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100)];}));
 const before=await page.screenshot({fullPage:true,animations:'disabled'});
 await page.evaluate(()=>{document.getElementById('qaOldStyles').disabled=true;document.querySelector('link[href*="sales-board.css"]').disabled=false;});
 const after=await page.screenshot({fullPage:true,animations:'disabled'});const geometryAfter=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return [e.tagName,e.id,...[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100)];}));
 const a=PNG.sync.read(before),b=PNG.sync.read(after);const pixels=a.width===b.width&&a.height===b.height?pixelmatch(a.data,b.data,null,a.width,a.height,{threshold:0.05,includeAA:true}):-1;const geometryEqual=JSON.stringify(geometryBefore)===JSON.stringify(geometryAfter);const equal=pixels===0&&geometryEqual;checks.push({label,equal,pixels,geometryEqual});if(!equal){fs.writeFileSync(`${out}/css-before-${label}.png`,before);fs.writeFileSync(`${out}/css-after-${label}.png`,after);}
}
fs.writeFileSync(out+'/css-parity.json',JSON.stringify({base,checks},null,2));assert.deepEqual(checks.filter(x=>!x.equal),[],'Pixel differences require investigation');
}finally{await browser.close();}console.log('PASS CSS: 160 pixel comparisons (0.05 luminance tolerance, zero differing pixels) and exact geometry checks against reviewed release');})().catch(e=>{console.error(e);process.exit(1);});
