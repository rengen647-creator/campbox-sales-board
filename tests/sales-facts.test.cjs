const assert=require('node:assert/strict'),{aggregate,pipeline}=require('../sales-facts.js');
const e=(key,date,other={})=>({sales_user_id:'a',contract_key:key,contract_number:'SHARED',state:'confirmed',signed_date:date,revision:1,...other});
const args={month:'2026-10',cutoff:'2026-10-28',target:10,min:5,max:15,available:true,reconciled:true};
const events=[e('a','2026-10-01'),e('b','2026-10-28'),e('a','2026-10-01'),e('old','2026-09-30'),e('future','2026-10-30'),e('void','2026-10-03',{state:'void'})];
let x=aggregate({...args,events});assert.equal(x.value,2);assert.equal(x.fact[27],2);assert.equal(x.fact[28],null);assert.equal(x.remaining,8);
x=aggregate({...args,events:[...events,e('a','2026-09-30',{revision:2})]});assert.equal(x.value,1);
assert.equal(aggregate({...args,events,scope:'b'}).value,0);assert.equal(aggregate({...args,events,available:false}).value,null);
assert.equal(aggregate({...args,events:[e('terminated','2026-10-03',{deal_status:'terminated'})]}).value,1);
assert.equal(pipeline([],{start:'2026-10-01',end:'2026-10-28',asOf:'2026-10-28'}).conversion,null);
const p=pipeline([{sales_user_id:'a',contract_key:'a',sent_date:'2026-10-01',source_report_date:'2026-10-01',status:'signed',revision:1},{sales_user_id:'a',contract_key:'b',sent_date:'2026-09-01',source_report_date:'2026-10-01',status:'signing',revision:1}],{start:'2026-10-01',end:'2026-10-28',asOf:'2026-10-28',events});assert.equal(p.open.length,1);assert.equal(p.started.length,1);
console.log('PASS signed sales: identity, common document number, corrected dates, termination, void, future cutoff, scope, missing source and cohorts');

assert.equal(p.cohortSigned.length,1);assert.equal(p.conversion,100);
assert.equal(pipeline([],{start:"2026-10-01",end:"2026-10-31",asOf:"2026-10-28",events}).signed.length,2);
assert.equal(pipeline([],{start:"2026-10-01",end:"2026-10-31",asOf:"2026-10-28",events:[...events,e("a","2026-10-01",{revision:2,state:"void"})]}).signed.length,1);
