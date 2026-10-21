'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../finance-ledger.js'),'utf8');
const ctx={window:{},Intl,Date,Set,Map,Number,Array,String,console};
vm.runInNewContext(source,ctx,{filename:'finance-ledger.js'});
const model=ctx.window.CampBoxFinanceMatrixModel;
assert.equal(typeof model,'function','pure matrix model is exposed for QA');

const clients=[{id:'a',client_name:'Лагерь А'},{id:'b',client_name:'Лагерь Б'},{id:'c',client_name:'Лагерь без оплат'}];
const contracts=[
 {id:'c1',client_id:'a',contractor_id:'m1'},
 {id:'c2',client_id:'a',contractor_id:'m2'},
 {id:'c3',client_id:'b',contractor_id:'m2'},
 {id:'c4',client_id:'c',contractor_id:'m1'}
];
const make=(id,contract,client,date,amount,status='paid',event_type='payment')=>({id,contract_id:contract,client_id:client,payment_date:date,amount,status,event_type});
const payments=[
 make(1,'c1','a','2025-10-10',100),
 make(2,'c1','a','2026-08-08',100),
 make(3,'c1','a','2026-09-09',50,'confirmed'),
 make(4,'c1','a','2026-10-04',999),
 make(5,'c2','a','2026-07-20',75),
 make(6,'c3','b','2026-09-15',600),
 make(7,'c1','a','2026-09-10',300,'excluded'),
 make(8,'c1','a','2026-09-10',200,'paid','site_live'),
 make(9,'c1','a','2026-11-05',1000),
 make(10,'c1','a','2026-09-12',200,'pending')
];
let out=model(clients,contracts,payments,'2026-10','all','2026-10');
assert.equal(out.months[0],'2025-11');
assert.equal(out.months[11],'2026-10');
assert.equal(out.lastClosed,'2026-09');
assert.equal(out.previousClosed,'2026-08');
let a=out.rows.find(r=>r.id==='a'),b=out.rows.find(r=>r.id==='b'),c=out.rows.find(r=>r.id==='c');
assert.equal(a.total,1324,'cumulative receipts include older history and multiple contracts');
assert.equal(a.period,1224,'12-month subtotal reconciles monthly columns');
assert.equal(out.months.reduce((x,k)=>x+(a.byMonth[k]||0),0),a.period);
assert.equal(a.byMonth['2026-08'],100);
assert.equal(a.byMonth['2026-09'],50);
assert.equal(a.byMonth['2026-10'],999);
assert.equal(a.drop,true,'compare last two CLOSED months only, not the incomplete October');
assert.equal(a.quiet,false);
assert.equal(b.total,600);
assert.equal(c.total,0,'camp with no payment remains visible');
assert.equal(c.quiet,false,'never-paid camp is not a payment interruption');
out=model(clients,contracts,payments,'2026-10','m1','2026-10');
assert.equal(out.rows.length,2,'filter clients by manager contracts');
assert.equal(out.rows.find(r=>r.id==='a').total,1249,'shared client counts only selected manager contracts');
assert.equal(out.rows.find(r=>r.id==='b'),undefined);
out=model(clients,contracts,payments,'2026-09','all','2026-10');
assert.equal(out.rows.find(r=>r.id==='a').total,325,'later payments excluded from historical as-of totals');
out=model(clients,contracts,payments,'2026-10','all','2026-09');
assert.equal(out.lastClosed,'2026-08','a selected or future month is not automatically closed');
console.log('finance matrix: 16 logic and safety checks passed');
