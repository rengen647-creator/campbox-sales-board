const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const path of ['index.html','salary-v1.js']){
 const src=fs.readFileSync(path,'utf8');
 const fn=src.match(/function isCreditedInMonth\(c,month\)\{[^\n]+\}/);
 assert.ok(fn,path+': credit-month helper missing');
 const f=new Function(fn[0]+';return isCreditedInMonth')();
 const nov={signed_date:'2026-10-28',credited_date:'2026-11-03',status:'active'};
 assert.equal(f(nov,'2026-11'),true,path+' November attribution');
 assert.equal(f(nov,'2026-10'),false,path+' not October');
 assert.equal(f({signed_date:'2026-10-19',credited_date:null},'2026-10'),true,path+' historical fallback');
}
const salary=fs.readFileSync('salary-v1.js','utf8'),index=fs.readFileSync('index.html','utf8');
assert.match(salary,/actual=\(ds\.data\|\|\[\]\)\.filter\(c=>isCreditedInMonth\(c,S\.month\)\)/);
assert.match(salary,/c\.contractor_id===userId&&isCreditedInMonth\(c,S\.month\)/);
assert.match(index,/monthSignedContracts=\(signed\|\|\[\]\)\.filter\(c=>isCreditedInMonth\(c,selectedMonth\)\)/);
assert.match(fs.readFileSync('sw.js','utf8'),/20261103credit/);
const migration=fs.readFileSync('migrations/20261103_sales_status_credit_month.sql','utf8');
assert.match(migration,/old\.sales_source_contract_key is null/);
assert.match(migration,/tg_op='INSERT'/);
console.log('PASS month attribution, legacy fallback and server-side first transition stamp');
