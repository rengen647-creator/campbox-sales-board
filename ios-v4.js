/* CampBox iOS V4 — architectural presentation changes only.
   No new Supabase requests, no KPI math, no fact saves or permission overrides. */
(function(){
 'use strict';
 var icons={
 month:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 funnel:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
 contracts:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h5m-5 4h3"/>',
 team:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><circle cx="9" cy="8" r="3"/><path d="M17 6a3 3 0 0 1 0 6M18 16a4 4 0 0 1 3 4"/>',
 analytics:'<path d="M4 20V4m0 16h16m-13-5 4-4 3 3 5-7"/>',
 summary:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 11 2 2 5-5M8 17h8"/>',
 report:'<path d="M7 3h8l4 4v14H5V3zM15 3v5h4M8 12h8m0 4H8"/>',
 salary:'<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M2 10h20M6 6V4h12v2m-3 10h5"/>',
 finance:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M7 15h4"/>'
 };
 function svg(page){
   return '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(icons[page]||icons.analytics)+'</svg>';
 }
 function decoratePage(root){
   if(!root)return;
   root.querySelectorAll('.v13-screen .cb-page-intro:not(.cb-today-hero)').forEach(function(section){
      if(section.dataset.ios4Decorated)return;
      var page=section.closest('.v13-screen')?.id.replace(/^v13-/,'')||'analytics';
      var pict=document.createElement('span');
      pict.className='ios4-page-symbol';
      pict.innerHTML=svg(page);
      section.appendChild(pict);
      section.dataset.ios4Decorated='1';
   });
 }
 function helpNav(){
   // A single compact route to the operational next step; existing tab handlers untouched.
   var summary=document.getElementById('v13-summary');
   if(summary&&!summary.querySelector('.ios4-summary-links')){
      var nav=document.createElement('div');
      nav.className='ios4-summary-links';
      [['Контрактинг','contracts'],['Команда','team'],['Поступления','finance']].forEach(function(it){
         var b=document.createElement('button');
         b.type='button';b.className='cb-action';
         b.dataset.cbGo=it[1];b.textContent=it[0];
         if(it[1]==='finance')b.classList.add('cb-role-manager');
         nav.appendChild(b);
      });
      var intro=summary.querySelector('.cb-page-intro');if(intro)intro.insertAdjacentElement('afterend',nav);
   }
 }
 function init(){
   var root=document.getElementById('mainApp');
   if(!root||!document.getElementById('v13TodayPlan'))return false;
   document.documentElement.classList.add('cb-v4');
   decoratePage(root);
   helpNav();
   // Banners generated asynchronously by original finance and salary modules:
   // watch only structural child insertion, never rewrite their content.
   ['v13-finance','v13-salary'].forEach(function(id){
     var node=document.getElementById(id);
     if(!node)return;
     var observer=new MutationObserver(function(){decoratePage(root)});
     observer.observe(node,{childList:true});
   });
   window.CampBoxDesignVersion='ios-v4-20261027';
   return true;
 }
 function start(){
   if(init())return;
   var host=document.getElementById('mainApp')||document.body;
   var obs=new MutationObserver(function(){if(init())obs.disconnect()});
   obs.observe(host,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
 else start();
})();