'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {chart}=require('../os3-charts');
for(const count of [0,1,7,30]){
 const out=chart({labels:Array.from({length:count},(_,i)=>String(i+1)),series:[{name:'Факт',values:Array.from({length:count},(_,i)=>i),tone:'positive'}]});
 assert.ok(!/NaN|Infinity/.test(out));assert.equal(out.includes('<svg'),count>0);
}
const gap=chart({labels:['1','2','3','4'],series:[{name:'Факт',values:[1,null,3,null]}]});
assert.equal((gap.match(/<g tabindex/g)||[]).length,2);
assert.match(gap,/d=" M[^"L]+ M/); // two disconnected paths, no fabricated bridge
assert.ok(!gap.includes('preserveAspectRatio="none"'));
assert.ok(gap.includes('Нет данных'));
assert.ok(chart({labels:['<script>'],series:[{name:'<img>',values:[0]}]}).includes('&lt;script&gt;'));
assert.ok(!chart({labels:['1'],series:[{name:'x',values:[null]}]}).includes('<svg'));
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
for(const [,src] of html.matchAll(/(?:src|href)="((?:\.\/)?(?:os3[^"?]*|ui-v13\.js|product-v2\.js)\?[^\"]+)"/g))assert.ok(sw.includes(src.replace(/^\.\//,'')),'Cache mismatch '+src);
for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script);
const base='a6bde851ce10d0bfd315036f00b22698fb62b45d';
for(const name of ['salary-v1.js','finance-ledger.js','sales-coach.js','sales-report-v2.js','supabase_setup.sql','salary_v1_migration.sql','salary_retention_v1_migration.sql']){
 assert.equal(fs.readFileSync(name,'utf8'),execFileSync('git',['show',base+':'+name],{encoding:'utf8'}),'Business source changed: '+name);
}
console.log('PASS OS3: 0/1/7/30 samples, disconnected missing data, null vs zero, escaping, cache parity, inline syntax and 7 unchanged business sources.');
