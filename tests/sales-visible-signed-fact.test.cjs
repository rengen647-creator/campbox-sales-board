const assert=require('node:assert/strict');
const fs=require('node:fs');
const coach=fs.readFileSync('sales-coach.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const source=coach.slice(coach.indexOf('function coachSignedCount('),coach.indexOf('function coachForecastData('));
assert.ok(source.startsWith('function coachSignedCount('),'Signed count helper missing');
const contracts=[
 {id:'nov',contractor_id:'user-1',signed_date:'2026-10-28',credited_date:'2026-11-03'},
 {id:'legacy-nov',contractor_id:'user-1',signed_date:'2026-11-01',credited_date:null},
 {id:'another',contractor_id:'user-2',signed_date:'2026-11-02',credited_date:'2026-11-02'}
];
const count=new Function('monthSignedContracts','selectedDate',source+';return coachSignedCount;')(contracts,'2026-11-03');
assert.equal(count('team'),3);
assert.equal(count('user-1'),2);
assert.equal(count('user-2'),1);
assert.equal(count('user-1','2026-11-02'),1);
assert.ok(coach.includes("var fact=coachSignedCount(userId);"),'Sales Coach still uses manually entered daily connected_fact');
const pace=index.slice(index.indexOf('function paceSnapshot()'),index.indexOf('function renderPaceCorridor('));
assert.ok(pace.includes('coachSignedCount('),'Visible month pace still uses old report data');
assert.ok(!pace.includes('connected_fact'),'Visible month pace must not read old daily connected fact');
assert.ok(index.includes('fn=monthSignedContracts.length'),'Sales funnel monthly result must match confirmed contracts');
const report=require('../os3-report.js').build;
const synthetic=report({
 month:'2026-11',date:'2026-11-03',today:'2026-11-03',period:'current',type:'team',
 manager:true,scope:'team',self:'user-1',target:10,personalTarget:5,
 rows:[{report_date:'2026-11-03',user_id:'user-1',connected_fact:0,calls_fact:2}],
 dayRows:[],members:[{id:'user-1',full_name:'Менеджер 1'}],
 signedContracts:[contracts[0]]
});
assert.equal(synthetic.fact,1,'Report must count one November signature despite daily fact=0');
assert.equal(synthetic.members[0].fact,1);
assert.equal(synthetic.metrics.find(m=>m.key==='connected').fact,1);
assert.equal(synthetic.series[0].values[2],1);
assert.equal(synthetic.series[0].values[1],null,'Future/unobserved dates should not fabricate actual values');
assert.ok(fs.readFileSync('sw.js','utf8').includes('signed-fact-2026-11-03b'));
assert.ok(index.includes('sales-coach.js?v=20261103signedfact'));
console.log('PASS: November Sales OS fact and reports use credited signed contracts; old daily zero ignored');
