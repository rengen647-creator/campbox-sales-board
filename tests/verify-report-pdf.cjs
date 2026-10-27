/* Checks text extracted from the real printed PDF, never an HTML surrogate. */
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const normalize=v=>String(v).normalize('NFKC').replace(/[\u200b\u00ad]/g,'').replace(/\s+/g,' ').trim();
function verifyReportPdf(file,context,rows){
 const text=normalize(execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8'}));
 for(const v of [context.start,context.periodEnd,context.cutoff,context.method])assert.ok(text.includes(normalize(v)),'PDF missing context: '+v);
 for(const [label,value] of [['Цель',context.target],['Факт',context.fact],['Прогноз',context.forecast],['Риск',context.risk]])assert.ok(text.includes(normalize(label.toUpperCase()+' '+(value??'—'))),'PDF KPI mismatch: '+label);
 let cursor=0,count=0;
 for(const row of rows.slice(9).filter(r=>r.length)){
  const expected=normalize(row.map(v=>v==null?'—':typeof v==='number'?Math.round(v*100)/100:v).join(' '));
  const index=text.indexOf(expected,cursor);assert.ok(index>=0,'PDF row missing/out of order: '+expected);cursor=index+expected.length;count++;
 }
 return {file,rows:count,context:true,kpis:true};
}
module.exports={verifyReportPdf};
