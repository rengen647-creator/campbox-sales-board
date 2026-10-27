const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync('salary-v1.js','utf8');
function extract(name){const start=s.indexOf('  function '+name+'(');assert.ok(start>=0);const end=s.indexOf('\n  function ',start+1);return s.slice(start,end);}
const {status,summary}=new Function(extract('totals')+extract('salaryStatusTotals')+extract('salarySummaryRows')+';return {status:salaryStatusTotals,summary:salarySummaryRows};')();
for(const rows of [[],[{status:'preliminary',amount:300}],[{status:'confirmed',amount:600},{status:'paid',amount:100},{status:'preliminary',amount:200}]]){
 const original=JSON.stringify(rows),a=status(rows),report=summary(rows);assert.equal(report[0][1],a.confirmed);assert.equal(report[1][1],a.preliminary);assert.equal(report[2][1],a.confirmed+a.preliminary);assert.equal(JSON.stringify(rows),original);
}
assert.deepEqual(status([{status:'confirmed',amount:600},{status:'paid',amount:100},{status:'preliminary',amount:200}]),{confirmed:700,preliminary:200});
assert.equal(status([{status:'preliminary',amount:999}]).confirmed,0);
assert.match(s,/data-salary-confirmed/);assert.doesNotMatch(s,/Правило подтверждено владельцем/);
console.log('PASS salary status split: confirmed/paid vs preliminary, zero confirmation, Excel summary and no mutation');
