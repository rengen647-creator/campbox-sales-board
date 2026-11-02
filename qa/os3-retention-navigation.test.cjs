const fs=require('node:fs'),assert=require('node:assert/strict'),test=require('node:test');
test('final OS3 navigation adds Retention after legacy groups are removed',()=>{
 const code=fs.readFileSync('os3-ui.js','utf8');
 const cleanup=code.indexOf("nav?.querySelectorAll('.cb-group').forEach(n=>n.remove());");
 const retention=code.indexOf("if(nav&&!nav.querySelector('#retentionSidebarNav'))");
 assert.ok(cleanup>=0&&retention>cleanup,'Retention must be inserted after OS3 navigation cleanup');
 assert.ok(code.includes("E('div','os3-nav-group','Удержание клиентов')"));
 assert.ok(code.includes("button.id='retentionSidebarNav'"));
 assert.ok(code.includes("window.openRetentionView()"));
});
test('salary Retention tab stays removed',()=>{
 const code=fs.readFileSync('salary-v1.js','utf8');
 assert.ok(!code.includes('data-salary-tab="retention"'));
});
