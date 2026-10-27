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
 document.querySelector('.v13-brand small')?.replaceChildren(document.createTextNode('Sales OS 3.0'));
 document.querySelectorAll('.cb-eyebrow').forEach(n=>{n.textContent=n.textContent.replace(/^\d+\s*\/\s*/, '');});
 const a=$('v13-analytics');a.classList.add('show-legacy');
 const title=a.querySelector('.cb-page-h');if(title)title.textContent='Динамика и решения';
 const intro=a.querySelector('.cb-page-intro');
 const filters=E('div','os3-analytics-filters');filters.innerHTML='<label>Область <select id="os3AnalyticsScope"><option value="team">Команда</option></select></label><label>Детализация <select id="os3Granularity"><option value="day">День</option><option value="week">Неделя</option><option value="month">Месяц</option></select></label>';intro.after(filters);
 const scope=$('os3AnalyticsScope');scope.onfocus=()=>{const old=scope.value;scope.replaceChildren();if(isManager())scope.add(new Option('Команда','team'));profiles.filter(p=>isManager()||p.id===currentUser?.id).forEach(p=>scope.add(new Option(p.full_name||p.email,p.id)));if([...scope.options].some(o=>o.value===old))scope.value=old;};
 const update=()=>{os3AnalyticsScope=isManager()?scope.value:currentUser.id;os3Granularity=$('os3Granularity').value;setCoachUser(os3AnalyticsScope);renderPace();renderActivityChart();renderConversionChart();renderCalendarHeatmap();};scope.onchange=update;$('os3Granularity').onchange=update;

 const pace=card('Темп результата','os3-analytics-pace');const ch=E('div','os3-chart');ch.id='os3AnalyticsPace';pace.append(ch);
 const decision=E('aside','os3-decision');decision.id='os3PaceDecision';
 const lead=E('div','os3-analytics-lead');lead.append(pace,decision);filters.after(lead);
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
 const settings=document.querySelector('.v13-report-settings');if(settings){const label=E('label','','Менеджер / команда'),select=E('select');select.id='os3ReportScope';label.append(select);settings.insertBefore(label,settings.querySelector('button'));const refresh=()=>{const old=select.value;select.replaceChildren();const manager=typeof isManager==='function'&&isManager();if(manager)select.add(new Option('Команда','team'));(typeof profiles==='undefined'?[]:profiles).filter(p=>manager||p.id===currentUser?.id).forEach(p=>select.add(new Option(p.full_name||p.email,p.id)));if([...select.options].some(o=>o.value===old))select.value=old;};select.addEventListener('focus',refresh);select.onchange=()=>window.CampBoxReport.render();refresh();}
 installSectionLinks();
 const fin=$('v13-finance');if(fin){const obs=new MutationObserver(()=>{const rows=$('finRows');if(rows)rows.closest('.card')?.classList.add('os3-ledger');});obs.observe(fin,{childList:true});}
 if(typeof selectedMonth!=='undefined'&&selectedMonth&&typeof renderPace==='function')renderPace();
 window.CampBoxDesignVersion='sales-os3-20261027-qa';
}
function installSectionLinks(){
 document.querySelectorAll('.v13-screen').forEach(root=>{const details=E('details','os3-section-links'),summary=E('summary','','Перейти к подразделу');details.append(summary);const list=E('div');details.append(list);root.prepend(details);details.addEventListener('toggle',()=>{if(!details.open)return;list.replaceChildren();root.querySelectorAll('h2,h3,details > summary').forEach((heading,i)=>{if(details.contains(heading))return;const button=E('button','btn',heading.textContent.trim());button.type='button';button.onclick=()=>{let node=heading;while(node&&node!==root){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}heading.tabIndex=-1;heading.focus();heading.scrollIntoView({block:'start'});details.open=false;};list.append(button);});});});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
