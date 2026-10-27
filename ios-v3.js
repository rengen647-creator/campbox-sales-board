/* CampBox iOS V3 interface behavior — icons, signals, navigation.
   All business data and the five fact-save handlers remain in existing modules. */
(function(){
 'use strict';
 const ICONS={
  today:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m13 7-5 6h4l-1 4 5-6h-4z"/>',
  month:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  funnel:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  contracts:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h5m-5 4h3"/>',
  team:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  analytics:'<path d="M4 20V4m0 16h16"/><path d="m7 15 4-4 3 3 5-7"/>',
  summary:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 11 2 2 5-5M8 17h8"/>',
  report:'<path d="M7 3h8l4 4v14H5V3zM15 3v5h4M8 12h8m-8 4h8"/>',
  salary:'<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M2 10h20M6 6V4h12v2m-3 9h4"/>',
  finance:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M7 15h4"/>',
  phone:'<path d="M7 3 5 4a3 3 0 0 0-2 3c0 8 6 14 14 14a3 3 0 0 0 3-2l1-2-5-3-2 3c-3-1-5-3-6-6l2-2z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18M8 15h3"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4 2 2"/>',
  file:'<path d="M6 3h9l4 4v14H6zM15 3v5h4M9 13h7M9 17h5"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  sparkle:'<path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z"/>',
  alert:'<path d="m12 3 10 18H2zM12 10v4m0 4h.01"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  menu:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
 };
 const PAGES={today:'Главная',month:'План месяца',funnel:'Воронка',contracts:'Контрактинг',team:'Команда',analytics:'Аналитика',summary:'Итоги',report:'Отчёты',salary:'Зарплата',finance:'Финансы'};
 function icon(name){
  const paths=ICONS[name]||ICONS.today;
  return '<svg viewBox="0 0 24 24" width="20" height="20" role="presentation" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
 }
 function setupIcons(root){
  if(!root)return;
  root.querySelectorAll('[data-cb-icon]').forEach(function(el){
   if(el.dataset.cbDrawn==='1')return;
   el.innerHTML=icon(el.dataset.cbIcon);
   el.dataset.cbDrawn='1';
  });
 }
 function setupNav(){
  const side=document.querySelector('.v13-sidebar .v13-nav');
  if(side)side.querySelectorAll('button[data-v13-view]').forEach(function(b){
   const id=b.dataset.v13View;
   if(b.dataset.cbNavIcon==='1')return;
   b.innerHTML='<span class="cb-nav-symbol">'+icon(id)+'</span><span class="cb-nav-label">'+(PAGES[id]||'Раздел')+'</span>';
   b.dataset.cbNavIcon='1';
  });
  const mobile=document.getElementById('v13MobileNav');
  if(mobile)mobile.querySelectorAll('button').forEach(function(b){
   const id=b.dataset.v13View||'menu',glyph=b.querySelector('.mi');
   if(!glyph||glyph.dataset.cbDrawn==='1')return;
   glyph.innerHTML=icon(id);glyph.dataset.cbDrawn='1';
  });
  const more=document.getElementById('v13MobileMore');
  if(more)more.querySelectorAll('[data-v13-view]').forEach(function(b){
   const id=b.dataset.v13View,glyph=b.querySelector('span');
   if(!glyph||glyph.dataset.cbDrawn==='1')return;
   glyph.innerHTML=icon(id);glyph.dataset.cbDrawn='1';
  });
 }
 function signalPage(label){
  if(/договор/i.test(label))return 'contracts';
  if(/воронк|КП/i.test(label))return 'funnel';
  if(/месяц|темп/i.test(label))return 'month';
  if(/итог/i.test(label))return 'summary';
  return 'today';
 }
 function signals(){
  const root=document.getElementById('attentionList');
  if(!root)return;
  for(const item of root.querySelectorAll('.attention-item')){
   if(item.dataset.cbSignal==='1')continue;
   const label=item.querySelector('b')?.textContent.trim()||'Сигнал';
   const explanation=item.textContent.slice(label.length).trim();
   const severity=item.classList.contains('bad')?'danger':item.classList.contains('warn')?'warning':'success';
   const htmlIcon=document.createElement('span');
   htmlIcon.className='cb-signal-symbol '+severity;
   htmlIcon.innerHTML=icon(severity==='success'?'check':'alert');
   const head=document.createElement('div');
   head.className='cb-signal-header';
   const title=document.createElement('strong');
   title.className='cb-signal-title';title.textContent=label;
   head.append(htmlIcon,title);
   const body=document.createElement('p');
   body.className='cb-signal-copy';body.textContent=explanation;
   const footer=document.createElement('div');footer.className='cb-signal-footer';
   const more=document.createElement('details');
   more.className='cb-signal-more';
   const summary=document.createElement('summary');summary.textContent='Подробности';
   const whole=document.createElement('p');whole.textContent=explanation;
   more.append(summary,whole);
   const nav=document.createElement('button');nav.type='button';nav.className='cb-signal-link';
   nav.setAttribute('data-cb-go',signalPage(label));
   nav.innerHTML='Разобрать '+icon('arrow');
   footer.append(more,nav);
   item.replaceChildren(head,body,footer);
   item.dataset.cbSignal='1';
  }
 }
 function actions(){
  document.querySelectorAll('.cb-today-hero [data-cb-go]').forEach(function(b){
   if(b.dataset.cbActionIcon==='1')return;
   const wrapper=document.createElement('span');
   wrapper.className='cb-action-ico';wrapper.innerHTML=icon(b.dataset.cbGo);
   b.prepend(wrapper);b.dataset.cbActionIcon='1';
  });
 }
 function decorate(){
  setupNav();actions();setupIcons(document.getElementById('v13TodayPlan'));signals();
  const brand=document.querySelector('.v13-sidebar .v13-brand small');
  if(brand)brand.textContent='Sales Workspace';
 }
 function boot(){
  const plan=document.getElementById('v13TodayPlan'),alerts=document.getElementById('attentionList');
  if(!plan||!alerts)return false;
  document.documentElement.classList.add('cb-v3');
  decorate();
  const planWatcher=new MutationObserver(function(){setupIcons(plan)});
  planWatcher.observe(plan,{childList:true});
  const alertWatcher=new MutationObserver(signals);
  alertWatcher.observe(alerts,{childList:true});
  const nav=document.getElementById('v13MobileNav');
  if(nav)new MutationObserver(setupNav).observe(nav,{childList:true});
  const more=document.getElementById('v13MobileMore');
  if(more)new MutationObserver(setupNav).observe(more,{childList:true});
  window.CampBoxDesignVersion='ios-v3-20261027';
  return true;
 }
 function init(){
  if(boot())return;
  const host=document.getElementById('mainApp')||document.body;
  const observer=new MutationObserver(function(){if(boot())observer.disconnect()});
  observer.observe(host,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();