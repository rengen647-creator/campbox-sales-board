const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync('salary-v1.js','utf8');const start=s.indexOf('  function salaryLifecycle('),end=s.indexOf('\n  function renderMine',start);assert.ok(start>0&&end>start);
const render=new Function('S','contractClient','dateRu','retentionEnd','esc',s.slice(start,end)+';return salaryLifecycle;')({pauses:[{contract_id:'c',pause_start:'2026-10-02',pause_until:'2026-10-20',resumed_at:'2026-10-15'},{contract_id:'c',pause_start:'2026-10-25',pause_until:'2026-11-02',resumed_at:null}],retentions:[]},()=>({client_name:'QA'}),x=>x,()=>'',x=>x);
const html=render([{id:'c',signed_date:'2026-10-01'}]);assert.match(html,/<time>2026-10-15<\/time><span>QA · возобновление/);assert.equal((html.match(/возобновление/g)||[]).length,1);assert.ok(!html.includes('<time>2026-10-20</time>'));
console.log('PASS lifecycle: actual resumed_at shown; scheduled end is not a resume event');
