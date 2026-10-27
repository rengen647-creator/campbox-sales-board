/* Executed by GitHub Actions against generated synthetic app; never production. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),ExcelJS=require('exceljs');
(async()=>{
 const out='qa/os3-evidence';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});const checks=[],failures=[];
 try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.resolve('qa/os3-app-fixture.html'));await page.waitForSelector('html.os3');
 await page.addScriptTag({path:require.resolve('exceljs/dist/exceljs.min.js')});await page.addScriptTag({path:require.resolve('jszip/dist/jszip.min.js')});
 const screens=['today','month','analytics','funnel','contracts','finance','team','salary','summary','report'];
 for(const theme of ['light','dark'])for(const width of [375,430,820,1024,1280,1440,1593,1920]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.classList.toggle('cb-apple-light',theme==='light'),theme);
  for(const screen of screens){
   await page.evaluate(screen=>window.v13Go(screen),screen);await page.locator('#v13-'+screen+'.active').waitFor();
   if(screen==='finance')await page.locator('#finMatrixRows tr').waitFor();if(screen==='salary')await page.locator('#salaryMine .salary-kpi').first().waitFor();
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const state=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return {width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,duplicates:ids.filter((x,i)=>ids.indexOf(x)!==i),inputs:document.querySelectorAll('#v13TodayPlan [data-v13-fact]').length};});
   const label=theme+'-'+width+'-'+screen;checks.push({label,...state});if(state.scroll>state.width+3)failures.push(label+': horizontal overflow '+JSON.stringify(state));if(state.duplicates.length)failures.push(label+': duplicate IDs '+state.duplicates);assert.equal(state.inputs,5);
   if(screen==='report'){const reportStyle=await page.evaluate(()=>({background:getComputedStyle(document.querySelector('.v13-report-kpis>div')).backgroundColor,width:document.getElementById('v13ReportPeriod').getBoundingClientRect().width}));assert.ok(reportStyle.width>=180,'Readable report select '+label);if(theme==='dark')assert.notEqual(reportStyle.background,'rgb(255, 255, 255)','Dark KPI background');}
   await page.screenshot({path:out+'/'+label+'.png',fullPage:true});
  }
 }
 // Every screen at 125% and 200%, including expanded disclosures.
 for(const zoom of [1.25,2])for(const screen of screens){await page.setViewportSize({width:1280,height:900});await page.evaluate(({zoom,screen})=>{document.documentElement.style.zoom=zoom;window.v13Go(screen);document.querySelectorAll('#v13-'+screen+' details').forEach(d=>d.open=true);},{zoom,screen});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));const size=await page.evaluate(()=>[document.documentElement.clientWidth,document.documentElement.scrollWidth]);checks.push({screen,zoom,size});if(size[1]>size[0]+3)failures.push(screen+' zoom '+zoom+': overflow '+size);await page.screenshot({path:out+'/zoom-'+zoom+'-'+screen+'.png'});}
 await page.evaluate(()=>{document.documentElement.style.zoom=1;window.v13Go('report');});
 // Actual XLSX download and print use exactly the report data shown on screen.
 for(const role of ['manager','employee'])for(const period of ['current','month'])for(const type of ['short','team']){
  await page.evaluate(role=>{currentProfile.role=role;CampBoxReport.render();},role);
  await page.selectOption('#v13ReportPeriod',period);await page.selectOption('#v13ReportType',type);
  const context=await page.evaluate(()=>window.CampBoxReport.snapshot);
  const expected=await page.evaluate(()=>window.CampBoxReport.table(window.CampBoxReport.snapshot));
  const dl=page.waitForEvent('download');await page.click('#v13ExcelReport');const download=await dl;const file=out+'/report-'+role+'-'+period+'-'+type+'.xlsx';await download.saveAs(file);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);const sheet=workbook.getWorksheet('Отчёт');assert.ok(workbook.getWorksheet('Обзор'));const zip=await require('jszip').loadAsync(fs.readFileSync(file));assert.ok(zip.file('xl/charts/chart_sb_1.xml'));const chartXml=await zip.file('xl/charts/chart_sb_1.xml').async('string');assert.ok(chartXml.includes('dispBlanksAs val="gap"')); for(let r=0;r<expected.length;r++)for(let c=0;c<expected[r].length;c++)assert.equal(sheet.getRow(r+1).getCell(c+1).value??null,expected[r][c]??null,'XLSX mismatch '+r+','+c);
  await page.evaluate(()=>document.body.classList.add('v13-print-report'));await page.pdf({path:out+'/report-'+role+'-'+period+'-'+type+'.pdf',format:'A4',printBackground:true});await page.evaluate(()=>document.body.classList.remove('v13-print-report'));
  checks.push(require('./verify-report-pdf.cjs').verifyReportPdf(out+'/report-'+role+'-'+period+'-'+type+'.pdf',context,expected));
 }
 await page.evaluate(()=>{currentProfile.role='manager';window.v13Go('finance');});await page.locator('#finMatrixRows tr').waitFor();const finance=await page.locator('#finStats').innerText();assert.match(finance,/6\s*000/);assert.match(finance,/10\s*000/);assert.ok(!/8\s*000/.test(finance));
 await page.locator('[data-fin-month="2026-10"]').click();await page.locator('#os3FinanceInspector[open]').waitFor();assert.match(await page.locator('#os3FinanceInspector').innerText(),/6\s*000/);await page.keyboard.press('Escape');
 await page.evaluate(()=>window.v13Go('analytics'));assert.equal(await page.locator('.os3-spark').count(),4);await page.locator('#v13-analytics .os3-point').first().focus();assert.ok((await page.locator('#v13-analytics .os3-chart-readout').first().innerText()).includes('·'));
 await page.evaluate(()=>window.v13Go('salary'));await page.locator('[data-salary-confirmed] b').waitFor();assert.equal((await page.locator('[data-salary-confirmed] b').innerText()).replace(/\s/g,''),'491,80₽');assert.equal((await page.locator('[data-salary-total] b').innerText()).replace(/\s/g,''),'655,73₽');assert.match(await page.locator('[data-salary-total]').innerText(),/включая предварительные/);
 fs.writeFileSync(out+'/results.json',JSON.stringify({checks,failures,errors},null,2));assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 await page.goto('file://'+path.resolve('qa/os3-components.html'));assert.equal(await page.locator('.os3-state').count(),3);await page.screenshot({path:out+'/component-states.png',fullPage:true});
 }finally{await browser.close();}
 console.log('PASS OS3: 160 screen/theme/width states, 20 expanded zoom states, 8 workbooks and 8 PDFs checked numerically for both roles, salary confirmed vs preliminary, financial inspector and keyboard chart.');
})().catch(e=>{console.error(e);process.exit(1);});
