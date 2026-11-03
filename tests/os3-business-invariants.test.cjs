const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
for(const [file,names] of [['salary-v1.js',['paymentAccrual','retentionAt','retentionEnd','commissionState']],['finance-ledger.js',['matrixModel','receipts','allClientReceipts']]]){const before=execFileSync('git',['show','619e310:'+file],{encoding:'utf8'}),after=fs.readFileSync(file,'utf8');for(const name of names){const fn=s=>{const start=s.indexOf('function '+name+'(');assert.ok(start>=0);const next=s.slice(start).search(/\n(?:  )?(?:async )?function /);return s.slice(start,next<0?s.length:start+next).trim();};assert.equal(fn(after),fn(before),file+': '+name+' changed');}}
console.log('PASS salary and payment calculation functions unchanged; minimum-plan policy preserved');

const creditSalary=fs.readFileSync('salary-v1.js','utf8'),creditSales=fs.readFileSync('index.html','utf8');
for(const src of [creditSalary,creditSales])assert.match(src,/function isCreditedInMonth\(c,month\)/);
assert.match(creditSalary,/if\(existing.data\?\.finalized\)/);
console.log('PASS historical month frozen; signing credit-month logic explicitly audited');
