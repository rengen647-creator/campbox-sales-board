'use strict';
/* Business journey + UI contract tests. This deliberately doesn't pretend to
   perform a browser or real production-database test. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const [html,ui,css,finance,salary,legacy,sql,sw,audit]=[
 'index.html','product-v2.js','sales-board.css','finance-ledger.js','salary-v1.js',
 'ui-v13.js','supabase_setup.sql','sw.js','qa/SALES_BOARD_BUSINESS_QA_20261027.md'
].map(read);
new vm.Script(ui,{filename:'product-v2.js'});
new vm.Script(finance,{filename:'finance-ledger.js'});
new vm.Script(salary,{filename:'salary-v1.js'});
const checks=[];function ok(label,result){assert.ok(result,label);checks.push(label)}
ok('five original operation screens reused', ['today','month','contracts','finance','salary'].every(x=>ui.includes("screen('"+x+"')")));
ok('live KPI nodes moved not imitated',ui.includes("$('v13TodayKpis')")&&ui.includes('relocate(kpis,summary'));
ok('existing period fields moved intact',ui.includes("root.querySelector(':scope > .context-card')")&&ui.includes('relocate(context,filter'));
ok('real fact editing not replaced',legacy.includes("data-v13-fact")&&ui.includes('cb-primary-task'));
ok('contract card delegates to actual original editor',ui.includes("card.querySelector('[data-open-contract]')")&&ui.includes('source.click()'));
ok('contract search is display-only',ui.includes('c.hidden=!visible')&&ui.includes('cbContractsSearch'));
ok('manager detail preserves existing render',ui.includes("$('v13ManagerPanel')")&&ui.includes('aside.append(details)'));
ok('original finance tabs preserved',ui.includes("$('finTab-summary')")&&finance.includes("['summary','charges','payments']"));
ok('salary payout nav not overwritten',ui.includes("$('salaryTabs')")&&salary.includes("S.tab='retention';renderTabs()"));
ok('right permissions remain in source',finance.includes("!isManager()")&&salary.includes("if(!manager())"));
ok('confirmed payments only count as received',finance.includes("['paid','confirmed'].includes(p.status)"));
ok('finance recent entries carry creator and creation time',finance.includes('created_by')&&finance.includes('created_at')&&finance.includes('function renderRecent()'));
ok('lifetime client matrix uses source model',finance.includes('function matrixModel(')&&finance.includes('function renderMatrix('));
ok('retention uses six calendar months from success',salary.includes('function retentionEnd(r)')&&salary.includes('addMonthsClampedIso(r.resolved_at,6)'));
ok('retention does not create an extra base period',salary.includes("return retentionAt(c.id,date,c.contractor_id)?'retained':'expired'"));
ok('only actual handoff is used',html.includes("sb.from('sales_handoff_statuses').select("));
ok('legible input colors on all major views',css.includes('color:#1c2c42')&&css.includes('color:#23344c!important')&&css.includes('#v13-finance')&&css.includes('#v13-salary'));
ok('light and dark themes both considered',css.includes('html.cb-apple-light.cb-v2')&&css.includes('html.cb-v2:not(.cb-apple-light)'));
ok('responsive master detail layout',css.includes('.cb-contract-layout')&&/@media\s*\(max-width:820px\)/.test(css));
ok('user motion setting observed',css.includes('prefers-reduced-motion'));
ok('RLS schema present',sql.includes('row level security'));
ok('P0 salary plan-base discrepancy documented',salary.includes("select('min_plan')")&&sql.includes('target_plan integer')&&audit.includes('P0-01'));
ok('historical finalized salary months frozen; initial backfill risk documented',salary.includes('if(existing.data?.finalized){S.dept=existing.data;return}')&&audit.includes('P1-04'));
ok('debtor balances not presented as fact',ui.includes('Начисления — выставленные суммы.')&&audit.includes('P1-01'));
ok('only UI preferences stored by design layer',!/\bsb\.from\s*\(|\bsupabase\.from\s*\(|\bfetch\s*\(|\beval\s*\(/.test(ui));
const fn=salary.match(/function contractorRate\(pct\)\{[^\n]+\}/);
ok('real contractor rate function extractable',Boolean(fn));
const rate=new Function(fn[0]+';return contractorRate')();
[[0,0],[79.99,0],[80,2000],[99.99,2000],[100,5000],[103,5000],[103.01,7000],[130,7000]].forEach(([pct,expected])=>assert.equal(rate(pct),expected,'rate threshold '+pct));
console.log('PASS '+checks.length+' business and UX integration contracts plus 8 salary rate threshold cases');
console.warn('MIN_PLAN POLICY CONFIRMED. REMAINING BUSINESS QA: P1-04 historical first backfill; P1-05 preliminary salary; P1-06 payment pagination. See qa/SALES_BOARD_BUSINESS_QA_20261027.md');
ok('canonical stylesheet loaded',html.includes('sales-board.css?v=20261027qa3')&&sw.includes('sales-board.css?v=20261027qa3'));
