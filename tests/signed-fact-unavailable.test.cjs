const assert=require('node:assert/strict'),fs=require('node:fs');
const {aggregate}=require('../sales-facts');
const options={month:'2026-10',cutoff:'2026-10-28',target:10,events:[{sales_user_id:'u',contract_key:'x',state:'confirmed',signed_date:'2026-10-02'}]};
for(const state of [{available:false,reconciled:true},{available:true,reconciled:false}]){const m=aggregate({...options,...state});for(const k of ['value','forecast','remaining','pace'])assert.equal(m[k],null,k);assert.ok(m.fact.every(x=>x===null));}
const source=fs.readFileSync('sales-coach.js','utf8'),a=source.indexOf('function coachForecastData('),b=source.indexOf('\nfunction ',a+1);
const coach=new Function('SalesFactUI','coachScopeRows','monthRows','coachTarget','totalWorkdays','selectedMonth','selectedDate','workdaysThrough',source.slice(a,b)+';return coachForecastData;')({model:()=>({value:null})},()=>[],[],()=>10,()=>22,'2026-10','2026-10-28',()=>20);
assert.equal(coach('u').forecast,null);assert.equal(coach('u').risk,null);
assert.equal(aggregate({...options,available:true,reconciled:true,events:[...options.events,{sales_user_id:'u',contract_key:'repeat',state:'confirmed',signed_date:'2026-10-03',plan_eligible:false}]}).value,1);
console.log('PASS unavailable, incomplete, coach null derivation and repeat contracts');
