/* Shared, pure view components. Data arrives through arguments; no storage or network. */
(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function state(kind,title,description){const allowed=['empty','error','loading'];if(!allowed.includes(kind))throw new Error('Unknown state');return '<section class="os3-state os3-'+kind+'" role="'+(kind==='error'?'alert':'status')+'"'+(kind==='loading'?' aria-busy="true"':'')+'><b>'+esc(title)+'</b><p>'+esc(description)+'</p></section>';}
function metric(label,value){return '<div class="os3-metric"><span>'+esc(label)+'</span><b>'+esc(value??'—')+'</b></div>';}
function disclosure(label,body){return '<details class="os3-disclosure"><summary>'+esc(label)+'</summary>'+body+'</details>';}
root.CampBoxComponents={state,metric,disclosure,esc};if(typeof module!=='undefined')module.exports=root.CampBoxComponents;
})(typeof window==='undefined'?globalThis:window);
