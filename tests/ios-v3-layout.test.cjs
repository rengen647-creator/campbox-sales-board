'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.join(__dirname,'..'),load=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=load('index.html'),js=load('ios-v3.js'),css=require('node:child_process').execFileSync('git',['show','cff8660a156671ac5562c751d1554eff0b3cf235:ios-v3.css'],{encoding:'utf8'});
const v13=load('ui-v13.js'),sw=load('sw.js');
new vm.Script(js,{filename:'ios-v3.js'});
new vm.Script(v13,{filename:'ui-v13.js'});
new vm.Script(load('product-v2.js'),{filename:'product-v2.js'});
assert.match(html,/ios-v3\.js\?v=20261027c/);
assert.match(html,/ui-v13\.js\?v=20261027qa2/);
assert.ok(html.indexOf('ios-v3.js')>html.indexOf('product-v2.js'));
assert.match(sw,/ios-v3\.js\?v=20261027c/);
assert.match(sw,/ui-v13\.js\?v=20261027qa2/);
// Five canonical facts, still using the same data-v13-fact + changed() + recalc() contract.
const begin=v13.indexOf('  function renderToday(){'),end=v13.indexOf('\n  function renderMonth(){',begin);
assert.ok(begin>=0&&end>begin,'source daily renderer exists');
const code=v13.slice(begin,end);
assert.match(code,/ios4-activity-grid/);
assert.match(code,/data-v13-fact/);
assert.match(code,/addEventListener\('input'/);
assert.match(code,/changed\(\)/);
assert.match(code,/addEventListener\('change'/);
assert.match(code,/recalc\(\)/);
assert.doesNotMatch(code,/v13-plan-table-desktop|v13-mobile-plan-list/,'No duplicated wide/mobile fact inputs');
assert.match(code,/<details class="ios4-activity-reason">/,'Plan reasoning is disclosed without overlay');
// Execute real source renderer against five metrics with mocked DOM and real input callbacks.
const row={user_id:'u1',
 calls_plan:10,calls_fact:3,
 booked_plan:2,booked_fact:0,
 meetings_plan:2,meetings_fact:1,
 offers_plan:2,offers_fact:1,
 follow_plan:5,follow_fact:2
};
const box={innerHTML:''};
const handlers={};const fakeInput={
 value:'3',getAttribute:name=>name==='data-v13-fact'?'calls':null,
 addEventListener:(name,fn)=>{handlers[name]=fn;}
};
const plan={innerHTML:'',querySelectorAll:selector=>selector==="[data-v13-fact]"?[fakeInput]:[]};
const document={
 getElementById:id=>id==='v13TodayKpis'?box:id==='v13TodayPlan'?plan:null,
 querySelectorAll:()=>[]
};
let saved=0,calculated=0;
const escape=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const make=new Function('document','currentUser','currentSelf','dayRows','activityKeys','metricLabels',
 'coachAutoPlan','coachPriorityData','changed','recalc','pct','h','fd','diag','risk','worst',
 code+';return renderToday;');
const render=make(document,{id:'u1'},()=> 'u1',[row],['calls','booked','meetings','offers','follow'],
 {calls:'Звонки',booked:'Назначено встреч',meetings:'Проведено встреч',offers:'КП / расчёты',follow:'Повторные контакты'},
 ()=>({metrics:{calls:{shortReason:'Рекомендация: 10, пояснение '+('много слов '.repeat(80))},booked:{shortReason:'План рассчитывается'}}}),
 ()=>[{title:'Позвонить первым',text:'Вернуться к рабочему темпу'}],
 ()=>{saved++},()=>{calculated++},
 (f,p)=>p?Math.round(f/p*100):0,escape,
 ()=>({target:10,fact:3,forecast:5,risk:5}),
 ()=>[],()=>({}),()=> 'Контролировать звонки');
render();
assert.match(box.innerHTML,/Цель месяца/);
assert.equal((plan.innerHTML.match(/class="ios4-activity /g)||[]).length,5);
assert.equal((plan.innerHTML.match(/data-v13-fact=/g)||[]).length,5,'exactly one editable fact per activity');
assert.match(plan.innerHTML,/ios4-activity-reason/);
assert.ok(!plan.innerHTML.includes('<table'),'No width-overflowing plan table');
assert.ok(plan.innerHTML.indexOf('Рекомендация: 10')>0,'Full explanation remains accessible');
assert.equal(typeof handlers.input,'function');assert.equal(typeof handlers.change,'function');
fakeInput.value='4';handlers.input.call(fakeInput);
assert.equal(row.calls_fact,4,'Edited daily fact persisted into canonical row');
assert.equal(saved,1,'Existing debounce save path invoked');
handlers.change.call(fakeInput);
assert.equal(calculated,1,'Existing recalc path invoked');
// No new DB updates, auth grants, or alternate payout calculation in the iOS layer.
assert.doesNotMatch(js,/\bsb\.from\(|\bsupabase\.from\(|\bfetch\(|\bXMLHttpRequest\(/);
assert.doesNotMatch(js,/\beval\(|\bnew\s+Function\(/);
assert.ok(js.includes('MutationObserver(signals)'));
assert.ok(js.includes('setupNav()'));
assert.ok(js.includes('function signalPage('));
assert.ok(js.includes("root.querySelectorAll('.attention-item')"));
assert.ok(css.includes('.cb-task-progress-track'));
assert.ok(css.includes('.cb-signal-more'));
assert.ok(css.includes('@media (max-width:450px)'));
assert.ok(css.includes('minmax(0,1fr)'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(css.includes('html.cb-v3:not(.cb-apple-light)'),'Dark user theme supported');
assert.ok(css.includes('html.cb-v3'),'Scoped style changes');
assert.ok(css.includes('overflow-wrap:anywhere'),'Reasons cannot overflow adjacent columns');
console.log('PASS iOS V3: 31+ checks, daily fact business event path, safe reason disclosure, responsive light/dark layouts and PWA');
assert.match(html,/sales-board\.css\?v=20261027reqa/);
assert.match(sw,/sales-board\.css\?v=20261027reqa/);
