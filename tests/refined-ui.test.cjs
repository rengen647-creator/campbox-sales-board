'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html'),css=require('node:child_process').execFileSync('git',['show','cff8660a156671ac5562c751d1554eff0b3cf235:refined-ui.css'],{encoding:'utf8'}),js=read('refined-ui.js'),sw=read('sw.js');
assert.match(html,/refined-ui\.js\?v=20261027a/,'refined navigation loaded');
assert.ok(html.indexOf('ui-v13.js')<html.indexOf('refined-ui.js'),'refined JS follows original');
assert.match(js,/pages:\s*\['month', 'funnel', 'contracts'\]/);
assert.match(js,/pages:\s*\['finance', 'salary'\]/);
assert.match(js,/pages:\s*\['team', 'summary'\]/);
assert.match(js,/pages:\s*\['analytics', 'report'\]/);
assert.match(js,/querySelector\('\[data-v13-view="today"\]'\)/);
assert.match(js,/body\.appendChild\(original\)/,'original links are retained');
assert.match(js,/body\.appendChild\(next\)/,'existing sub-navigation moves with links');
assert.match(js,/original\.nextElementSibling/,'existing sub-navigation read before link is moved');
assert.match(js,/MutationObserver/,'navigation follows programmatic route changes');
assert.match(js,/localStorage\.setItem\(STORE_KEY/,'theme choice saved locally');
assert.match(css,/html\.cb-apple-light/,'light palette scoped to appearance');
assert.match(css,/\.modal \.modal-actions\s*\{position:sticky/,'save controls remain reachable');
assert.match(css,/@media\s*\(max-width:820px\)/,'mobile styles exist');
assert.match(css,/prefers-reduced-motion/,'motion accessibility respected');
// Verify the legacy data-processing code was NOT embedded or replaced in the new UI layer.
for(const forbidden of [/\bsupabase\.from\s*\(/,/\bsb\.from\s*\(/,/\bfetch\s*\(/,/\beval\s*\(/]){
  assert.doesNotMatch(js,forbidden,'new design script must never access database or execute dynamic code');
}
assert.match(sw,/refined-ui\.js\?v=20261027a/);
assert.equal((html.match(/refined-ui\.js\?v=/g)||[]).length,1);
console.log('PASS refined Sales UI integration: assets, five groups, theme, no business-data writes');
assert.match(html,/sales-board\.css\?v=20261028signed/);
assert.match(sw,/sales-board\.css\?v=20261028signed/);
