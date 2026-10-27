/* Sales OS 3: structural presentation. Original DOM editors and save actions stay canonical. */
(function(){
'use strict';
const $=id=>document.getElementById(id),E=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const components={PageHeader:'.cb-page-intro',ContextBar:'.os3-context',HeroMetric:'.os3-hero',KpiTile:'.v13-kpi',DeltaBadge:'.pill',DecisionCard:'.os3-decision',ReasonDisclosure:'details',ActivityCard:'.ios4-activity',ChartShell:'.os3-chart',SegmentedControl:'.os3-conversions',FilterBar:'.fin-matrix-controls',DataTable:'.os3-table-scroll',MasterList:'.cb-contract-list',DetailInspector:'.cb-contract-detail',StatusTimeline:'.salary-timeline',MoneyMetric:'.salary-kpi',EmptyState:'.os3-empty',ErrorState:'.os3-error',LoadingSkeleton:'.os3-loading',ConfirmDialog:'.modal',SaveStatus:'#saveStatus',MobileBottomNav:'#v13MobileNav'};
window.CampBoxOS3={components};
function card(title,cls){const n=E('section','card os3-panel '+(cls||''));n.append(E('h2','',title));return n;}
function disclose(node,title){if(!node)return;const d=E('details','os3-disclosure');d.append(E('summary','',title));node.before(d);d.append(node);}
function mount(){
 if(!$('v13TodayPlan'))return;
 document.documentElement.classList.add('os3');
 // Period fields are moved, never duplicated. Their existing listeners remain attached.
 const context=document.querySelector('.cb-period-context');if(context){context.classList.add('os3-context');$('mainApp').querySelector('.topbar').after(context);}
 const status=$('saveStatus');if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');}
 const personal=$('personalStrip');if(personal){personal.classList.add('os3-personal');$('v13-today').append(personal);disclose(personal,'Мой день в цифрах');}
 const nav=document.querySelector('.v13-nav');
 if(nav){
  const groups=[['Работа',['today','month','funnel','contracts']],['Аналитика',['analytics','summary']],['Управление',['finance','team','salary','report']]];
  const nodes=new Map([...nav.querySelectorAll('[data-v13-view]')].map(n=>[n.dataset.v13View,n]));
  // Superseded subsection filters would conceal relocated cards. Remove their controls and reset all panels.
  if(window.v13ResetSubsections)window.v13ResetSubsections();
  nav.querySelectorAll('.v13-safe-subnav').forEach(n=>n.remove());
  groups.forEach(([title,ids])=>{nav.append(E('div','os3-nav-group',title));ids.forEach(id=>{const n=nodes.get(id);if(n)nav.append(n);});});
 }
 nav?.querySelectorAll('.cb-group').forEach(n=>n.remove());
 document.querySelector('.v13-brand small')?.replaceChildren(document.createTextNode('Sales OS 3.0 · preview'));
 document.querySelectorAll('.cb-eyebrow').forEach(n=>{n.textContent=n.textContent.replace(/^\d+\s*\/\s*/, '');});
 const a=$('v13-analytics');a.classList.add('show-legacy');
 const title=a.querySelector('.cb-page-h');if(title)title.textContent='Динамика и решения';
 const intro=a.querySelector('.cb-page-intro');
 const pace=card('Темп результата','os3-analytics-pace');const ch=E('div','os3-chart');ch.id='os3AnalyticsPace';pace.append(ch);
 const decision=E('aside','os3-decision');decision.id='os3PaceDecision';
 const lead=E('div','os3-analytics-lead');lead.append(pace,decision);intro.after(lead);
 const work=E('div','os3-analytics-work');lead.after(work);
 const activity=$('activityChart')?.closest('.card'),calendar=$('calendarHeatmap')?.closest('.card'),conversion=$('conversionChart')?.closest('.card');
 if(activity)work.append(activity);if(calendar){work.append(calendar);calendar.append(E('p','os3-calendar-legend','100%+ — выполнено · 70–99% — частично · <70% — ниже плана. Нет данных, нулевой факт и нерабочий день различаются.'));}
 if(conversion){work.after(conversion);conversion.classList.add('os3-conversion-card');conversion.querySelector('.chart-legend')?.remove();}
 const oldGrid=a.querySelector('.analytics-grid');if(oldGrid&&!oldGrid.children.length)oldGrid.remove();
 const guide=$('v13AnalyticsPanel')?.closest('.card');if(guide)disclose(guide,'Диагностика и пояснения');
 const dayStats=a.querySelector('.three-col');if(dayStats)disclose(dayStats,'Показатели выбранного дня');
 $('v13AnalyticsToggle')?.remove();
 activity?.querySelector('.chart-legend')?.remove();
 const month=$('v13-month'),layout=month.querySelector('.cb-month-layout');
 if(layout){const targets=layout.querySelector('.cb-month-targets');if(targets){layout.after(targets);disclose(targets,'Изменить минимум, цель и максимум');}}
 // Summary keeps the only live fields; lead with the daily reflection action.
 const summary=$('v13-summary'),note=E('div','os3-summary-intro');
 note.innerHTML='<b>Результат → препятствие → следующий шаг</b><p>Заполни итог дня в своей карточке. Общий вывод руководителя и контрольные точки находятся ниже.</p>';
 const reflect=E('button','btn primary','Мой итог дня');reflect.type='button';reflect.onclick=()=>{if(typeof currentUser!=='undefined'&&currentUser&&typeof openReflection==='function')openReflection(currentUser.id);};note.append(reflect);summary.querySelector('.cb-page-intro')?.after(note);
 // Contract dossier is text-only; editing delegates to the canonical editor in product-v2.
 // No DOM clones or secondary inputs are created here.
 const report=$('v13ReportPreview');if(report){const obs=new MutationObserver(()=>decorateReport());obs.observe(report,{childList:true});decorateReport();}
 const fin=$('v13-finance');if(fin){const obs=new MutationObserver(()=>{const rows=$('finRows');if(rows)rows.closest('.card')?.classList.add('os3-ledger');});obs.observe(fin,{childList:true});}
 if(typeof selectedMonth!=='undefined'&&selectedMonth&&typeof renderPace==='function')renderPace();
 window.CampBoxDesignVersion='sales-os3-20261027-preview';
}
function decorateReport(){
 const box=$('v13ReportPreview');if(!box||!box.querySelector('h2')||box.querySelector('.os3-report-charts'))return;
 const top=box.querySelector('.v13-report-callout');if(top){top.classList.add('os3-report-verdict');box.querySelector('.sub')?.after(top);}
 const chartWrap=E('section','os3-report-charts');chartWrap.append(E('h3','','Результат в динамике'));
 // A read-only rendering of the same prepared result series, with no inference of causality.
 const source=$('paceChart');if(source){const graph=E('div','os3-chart');graph.innerHTML=source.innerHTML;chartWrap.append(graph);}
 const kpis=box.querySelector('.v13-report-kpis');if(kpis)kpis.after(chartWrap);else box.append(chartWrap);
 box.querySelectorAll('.v13-report-section h3').forEach(n=>{if(n.textContent==='Что имеем')n.textContent='Показатели, требующие разбора';if(n.textContent==='Что делаем')n.textContent='Рекомендуемые действия';});
 const meta=E('p','os3-report-meta','Источник: Sales Board · сформировано '+new Date().toLocaleString('ru-RU'));
 box.append(meta);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
