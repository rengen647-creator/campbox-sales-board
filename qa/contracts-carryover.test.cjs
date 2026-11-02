const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync('index.html','utf8');
const a=html.indexOf('function carryForwardContracts('),b=html.indexOf('\nfunction contractAge(',a);
assert.ok(a>0&&b>a,'carry-forward function found');
const script=html.slice(a,b);
function run(prevMonthRows,monthRows,date='2026-11-02'){
 const context={prevMonthRows,monthRows,parseReflection:raw=>{try{return JSON.parse(raw)}catch{return {contracts:[]}}}};
 vm.createContext(context);
 return vm.runInContext(script+"\ncarryForwardContracts('sales-user',"+JSON.stringify(date)+")",context);
}
const record=(date,contracts)=>({user_id:'sales-user',report_date:date,comment:JSON.stringify({__type:'daily_reflection',contracts})});
test('pending contracts survive October to November with blank Oct 30 report',()=>{
 const open=Array.from({length:7},(_,i)=>({id:'deal-'+i,status:'signing'}));
 const prev=[record('2026-10-29',open),{user_id:'sales-user',report_date:'2026-10-30',comment:''}];
 const result=run(prev,[]);assert.equal(result.length,7);assert.equal(result[0].id,'deal-0');
});
test('latest explicit empty snapshot does not reanimate removed deals',()=>{
 const prev=[record('2026-10-29',[{id:'deal-1',status:'signing'}]),record('2026-10-30',[])];
 assert.equal(run(prev,[]).length,0);
});
test('signed and lost contracts are not carried over',()=>{
 const prev=[record('2026-10-29',[{id:'a',status:'signed'},{id:'b',status:'lost'},{id:'c',status:'signing'}])];
 assert.equal(run(prev,[]).length,1);assert.equal(run(prev,[])[0].id,'c');
});
