/* CampBox Finance: managerial commission ledger linked to Salary contracts / receipts. */
(function(){
'use strict';
var state={clients:[],contracts:[],charges:[],payments:[],recentByTab:{},busy:false,month:'',tab:'summary',paymentTab:'all'};
var productNames={campbox:'Комиссия CampBox',order_management:'МУЗ',comfort_booking:'КБ',site:'Сайт',maps:'Карты',site_support:'Поддержка сайта'};
var paymentTabs=[{id:'all',label:'Все'},{id:'campbox',label:'Комиссия CampBox'},{id:'order_management',label:'МУЗ'},{id:'comfort_booking',label:'КБ'},{id:'site',label:'Сайт'},{id:'site_support',label:'Поддержка сайта'},{id:'maps',label:'Карты'}];
function paymentGroup(p){return typeof p==='string'?p:p?.product_type}
function paymentMatches(p,tab){return tab==='all'||paymentGroup(p)===tab}
function receiptCount(n){var mod=n%100,unit=n%10;return n+' '+(mod>=11&&mod<=14?'поступлений':unit===1?'поступление':unit>=2&&unit<=4?'поступления':'поступлений')}

var productOptions=()=>[['campbox','Комиссия CampBox'],['order_management','МУЗ'],['comfort_booking','КБ'],['site','Сайт']].map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('');
function switchTab(tab){state.tab=tab;var rank=$('finPanel-summary-ranking');if(rank)rank.hidden=tab!=='summary';['summary','charges','payments'].forEach(id=>{var el=$('finPanel-'+id),b=$('finTab-'+id);if(el)el.hidden=id!==tab;if(b){b.classList.toggle('primary',id===tab);b.setAttribute('aria-selected',String(id===tab));}})}
var $=id=>document.getElementById(id);
var esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
var money=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(Number(v)||0);
var n=v=>Number(v)||0;
var month=()=>($('reportMonth')?.value||selectedMonth||new Date().toISOString().slice(0,7));
var first=m=>m+'-01';
var next=m=>{var [y,mm]=m.split('-').map(Number);return new Date(Date.UTC(y,mm,1)).toISOString().slice(0,10)};
var stamp=s=>String(s||'').slice(0,10);

/* Pure, read-only monthly matrix: no changes to salary or finance ledger records. */
function matrixMonths(chosen){
 var base=String(chosen||'').split('-').map(Number),y=base[0],m=base[1];
 return Array.from({length:12},(_,i)=>new Date(Date.UTC(y,m-12+i,1)).toISOString().slice(0,7));
}
function matrixModel(clients,contracts,payments,chosen,manager,today){
 var months=matrixMonths(chosen),windowSet=new Set(months),monthEnd=String(chosen||'');
 var managerContracts=contracts.filter(c=>manager==='all'||c.contractor_id===manager);
 var allowedContracts=new Set(managerContracts.map(c=>c.id));
 var contractOwners=new Map(contracts.map(c=>[c.id,c.client_id]));
 var allowedClients=new Set(managerContracts.map(c=>c.client_id));
 var rows=new Map();
 (clients||[]).forEach(c=>{if(manager==='all'||allowedClients.has(c.id))rows.set(c.id,{id:c.id,name:c.client_name||'Без названия',total:0,period:0,byMonth:Object.create(null),drop:false,quiet:false,peak:0});});
 (payments||[]).forEach(p=>{
  if(p.event_type!=='payment'||!['paid','confirmed'].includes(p.status))return;
  var mk=String(p.payment_date||'').slice(0,7);
  if(!mk||mk>monthEnd||(manager!=='all'&&!allowedContracts.has(p.contract_id)))return;
  var id=p.client_id||contractOwners.get(p.contract_id),row=rows.get(id);
  if(!row)return;
  var amount=Number(p.amount);
  if(!Number.isFinite(amount))return;
  row.total+=amount;
  if(windowSet.has(mk)){row.byMonth[mk]=(row.byMonth[mk]||0)+amount;row.period+=amount;}
 });
 var pastMonths=months.filter(m=>m<today);
 var last=pastMonths[pastMonths.length-1],prev=pastMonths[pastMonths.length-2];
 var result=[...rows.values()];
 result.forEach(row=>{
  row.peak=pastMonths.reduce((best,m)=>Math.max(best,row.byMonth[m]||0),0);
  var previous=prev?(row.byMonth[prev]||0):0,current=last?(row.byMonth[last]||0):0;
  row.drop=!!(prev&&previous>0&&current<previous*.7);
  row.quiet=!!(last&&current===0&&row.total>0);
 });
 result.sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ru'));
 return {months:months,rows:result,lastClosed:last||'',previousClosed:prev||''};
}
window.CampBoxFinanceMatrixModel=matrixModel;
var matrixMonthLabel=m=>{var parts=m.split('-');return ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][Number(parts[1])-1]+' '+parts[0].slice(2)};
var matrixShortMoney=v=>v===0?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1,notation:'compact'}).format(v);
function renderMatrix(){
 if(!$('finMatrixRows')||!state.month)return;
 var manager=$('finManager').value,now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 var model=matrixModel(state.clients,state.contracts,state.payments,state.month,manager,today);
 state.matrix=model;
 var query=($('finMatrixSearch').value||'').toLocaleLowerCase('ru').trim(),mode=$('finMatrixFilter').value;
 var rows=model.rows.filter(r=>(!query||r.name.toLocaleLowerCase('ru').includes(query))&&(mode==='all'||(mode==='drop'&&r.drop)||(mode==='quiet'&&r.quiet)));
 var sort=$('finMatrixSort')?.value||'total';rows.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ru'):sort==='period'?b.period-a.period:b.total-a.total);
 state.matrixVisible=rows;
 $('finMatrixStatus').textContent='Показано '+rows.length+' из '+model.rows.length+' лагерей · спад ≥30%: '+model.rows.filter(r=>r.drop).length;
 var head='<tr><th scope="col" class="fin-col-name">Лагерь</th><th scope="col" class="fin-col-total">ИТОГО за всё время</th><th scope="col" class="fin-col-period">За 12 мес.</th>';
 model.months.forEach(m=>{head+='<th scope="col"'+(m===state.month?' class="fin-col-selected"':'')+'>'+matrixMonthLabel(m)+(m===today?' *':'')+'</th>'});
 $('finMatrixHead').innerHTML=head+'</tr>';
 if(!rows.length){$('finMatrixRows').innerHTML='<tr><td colspan="15" class="fin-matrix-empty">Лагеря не найдены. Измени поиск или фильтр.</td></tr>';}else{
  $('finMatrixRows').innerHTML=rows.map(r=>{
   var html='<tr><th scope="row" class="fin-col-name" title="'+esc(r.name)+'">'+esc(r.name)+(r.drop?'<span class="fin-alert" title="Спад более 30% между двумя последними закрытыми месяцами">↓</span>':'')+'</th><td class="fin-col-total">'+money(r.total)+'</td><td class="fin-col-period">'+money(r.period)+'</td>';
   model.months.forEach((m,i)=>{
    var value=r.byMonth[m]||0,previous=i?Number(r.byMonth[model.months[i-1]]||0):0;
    var full=m<today,change=full&&previous>0?(value-previous)/previous:null;
    var style=change!==null&&change<=-.3?' fin-cell-drop':change!==null&&change<0?' fin-cell-down':change!==null&&change>0?' fin-cell-rise':'';
    if(full&&value>0&&r.peak===value)style+=' fin-cell-peak';
    var desc=value===0?'Нет поступлений':money(value);
    html+='<td class="fin-matrix-value'+style+'"><button type="button" data-fin-client="'+esc(r.id)+'" data-fin-month="'+esc(m)+'" title="'+esc(matrixMonthLabel(m)+': '+desc+'. Открыть поступления')+'">'+matrixShortMoney(value)+'</button></td>';
   });
   return html+'</tr>';
  }).join('');
 }
 var totals={all:0,period:0,byMonth:Object.create(null)};
 rows.forEach(r=>{totals.all+=r.total;totals.period+=r.period;model.months.forEach(m=>{totals.byMonth[m]=(totals.byMonth[m]||0)+(r.byMonth[m]||0)})});
 $('finMatrixFoot').innerHTML='<tr><th class="fin-col-name">Итого по списку</th><td class="fin-col-total">'+money(totals.all)+'</td><td class="fin-col-period">'+money(totals.period)+'</td>'+model.months.map(m=>'<td title="'+esc(money(totals.byMonth[m]||0))+'">'+matrixShortMoney(totals.byMonth[m]||0)+'</td>').join('')+'</tr>';
 $('finMatrixRows').querySelectorAll('[data-fin-month]').forEach(btn=>btn.onclick=async()=>{
  inspectClient(btn.dataset.finClient,btn.dataset.finMonth,btn);
 });
}
function inspectClient(id,m,trigger){
 var old=$('os3FinanceInspector');if(old)old.remove();
 var dialog=document.createElement('dialog');dialog.id='os3FinanceInspector';dialog.className='os3-inspector';dialog.setAttribute('aria-label','Поступления по лагерю');
 var manager=$('finManager').value,contracts=state.contracts.filter(c=>c.client_id===id&&(manager==='all'||c.contractor_id===manager)),ids=new Set(contracts.map(c=>c.id));
 var rows=state.payments.filter(p=>(p.client_id===id||ids.has(p.contract_id))&&(manager==='all'||ids.has(p.contract_id))&&String(p.payment_date).startsWith(m));
 var model=state.matrix.rows.find(r=>r.id===id);
 dialog.innerHTML='<form method="dialog"><button class="btn" aria-label="Закрыть инспектор">Закрыть</button></form><h2>'+esc(client(id))+'</h2><p>'+esc(m)+' · только подтверждённые поступления</p><strong>'+money(rows.reduce((t,p)=>t+n(p.amount),0))+'</strong><p>Поступления не являются расчётом задолженности.</p>'+ (model&&window.CampBoxCharts?CampBoxCharts.chart({labels:state.matrix.months,kind:'bars',title:'История поступлений',unit:' ₽',series:[{name:'Подтверждено',values:state.matrix.months.map(m=>model.byMonth[m]||0),tone:'positive'}]}):'')+'<div class="os3-table-scroll"><table><thead><tr><th>Дата</th><th>Продукт</th><th>Сумма</th><th>Менеджер</th></tr></thead><tbody>'+rows.map(p=>'<tr><td>'+esc(p.payment_date)+'</td><td>'+esc(productNames[p.product_type]||p.product_type)+'</td><td>'+money(p.amount)+'</td><td>'+esc(managerName(contract(p.contract_id)?.contractor_id))+'</td></tr>').join('')+'</tbody></table></div>'+(rows.length?'':'<p>Подтверждённых поступлений нет.</p>');
 document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus();});dialog.showModal();
}
function exportMatrixCsv(){
 if(!state.matrix)return;
 var model=state.matrix,rows=state.matrixVisible||[],headers=['Лагерь','ИТОГО за всё время до '+state.month,'За 12 месяцев',...model.months.map(matrixMonthLabel)];
 var all=[headers,...rows.map(r=>[r.name,r.total.toFixed(2),r.period.toFixed(2),...model.months.map(m=>(r.byMonth[m]||0).toFixed(2))])];
 var csv='\uFEFF'+all.map(row=>row.map(v=>{
  var s=String(v??'');
  if(/^[\s]*[=+@-]/.test(s)&&!(/^-?\d+(\.\d+)?$/.test(s)))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 }).join(';')).join('\r\n');
 var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');
 a.href=url;a.download='CampBox_Поступления_Лагеря_12м_'+state.month+'.csv';a.click();URL.revokeObjectURL(url);
}

var managerName=id=>{var p=(window.profiles||profiles||[]).find(x=>x.id===id);return p?(p.full_name||p.email||'Менеджер'):'Не назначен';};
function section(){
 var root=$('v13-finance');if(!root)return null;
 if(root.dataset.ready)return root;root.dataset.ready='1';

 var matrixHtml='<section class="card pad fin-matrix-card" aria-label="Помесячные поступления по лагерям"><div class="fin-matrix-intro"><div><h2>Поступления по лагерям · 12 месяцев</h2><p>Фактические оплаты по дате поступления. ИТОГО — накопленная сумма за всё время до конца выбранного месяца.</p></div><button type="button" class="btn" id="finMatrixCsv">Скачать CSV</button></div>'+
 '<div class="fin-matrix-controls"><label>Поиск лагеря<input id="finMatrixSearch" type="search" placeholder="Название лагеря"></label><label>Показать<select id="finMatrixFilter"><option value="all">Все лагеря</option><option value="drop">Спад ≥30%</option><option value="quiet">Без оплат в последнем закрытом месяце</option></select></label><label>Сортировка<select id="finMatrixSort"><option value="total">Получено всего</option><option value="period">За 12 месяцев</option><option value="name">Название</option></select></label><span id="finMatrixStatus" role="status"></span></div>'+
 '<div class="fin-matrix-scroll" tabindex="0" aria-label="Таблица поступлений по месяцам с прокруткой"><table class="fin-matrix-table"><thead id="finMatrixHead"></thead><tbody id="finMatrixRows"></tbody><tfoot id="finMatrixFoot"></tfoot></table></div>'+
 '<div class="fin-matrix-legend"><span><i class="fin-mark-rise"></i> Рост</span><span><i class="fin-mark-drop"></i> Спад ≥30%</span><span>Пик отмечен рамкой · * текущий месяц неполный · нажми сумму, чтобы увидеть платежи</span></div><p class="fin-matrix-note">Падение поступлений — повод проверить клиента, но не доказательство проблемы: учитывай сезонность, условия оплаты и график смен.</p></section>';

 root.innerHTML='<section class="card pad" style="margin-bottom:14px"><h2>Финансы лагерей · комиссии CampBox</h2><p style="color:var(--muted)">Начисления за выбранный месяц и все подтверждённые поступления клиента с начала учёта.</p><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div><label>Месяц</label><input type="month" id="finMonth"></div><div><label>Менеджер</label><select id="finManager"><option value="all">Все менеджеры</option></select></div><button class="btn" id="finReload">Обновить</button><button class="btn" id="finExport">Excel / CSV</button></div><div id="finMessage" style="margin-top:12px" role="status"></div></section>'+
 '<div style="display:flex;gap:7px;flex-wrap:wrap;margin:0 0 12px" role="tablist" aria-label="Разделы финансов"><button class="btn" id="finTab-summary" role="tab">Сводка</button><button class="btn" id="finTab-charges" role="tab">Начисления</button><button class="btn" id="finTab-payments" role="tab">Поступления</button></div><div id="finPanel-summary"><div id="finStats" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:14px"></div>'+
 matrixHtml+'</div><div id="finPanel-charges" hidden><section class="card pad"><div style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap"><div><h2>Начисления по лагерям</h2><p style="color:var(--muted)">Каждый лагерь показывает текущий месяц и накопленный итог.</p></div><button class="btn primary" id="finAdd">+ Начисление</button></div><div class="table-wrap" style="margin-top:12px"><table style="min-width:900px"><thead><tr><th>Лагерь / договор</th><th>Менеджер</th><th>Направление</th><th>Начислено</th><th>Оплачено за месяц</th><th>Оплатить до</th><th></th></tr></thead><tbody id="finRows"></tbody></table></div></section>'+
 '</div><div id="finPanel-summary-ranking"><section class="card pad" style="margin-top:14px"><h2>Эффективность продаж по деньгам</h2><p style="color:var(--muted)">Рейтинг по начисленной комиссии, без смешения качества продажи со сроками оплаты.</p><div id="finRanking"></div></section>'+
 '</div><div id="finPanel-payments" hidden><section class="card pad"><h2>Фактические поступления</h2><p style="color:var(--muted)">Новая оплата появится также в зарплатном модуле. Указывай продукт и договор, чтобы исключить двойной учёт.</p><button class="btn" id="finPayAdd">+ Зафиксировать поступление</button><div id="finPaymentTabs" class="fin-payment-tabs" role="tablist" aria-label="Направление поступлений">'+paymentTabs.map(t=>'<button type="button" class="fin-payment-tab" role="tab" aria-selected="false" data-fin-payment-tab="'+t.id+'">'+esc(t.label)+'</button>').join('')+'</div><div id="finPaymentSummary" class="fin-payment-summary" aria-live="polite"></div><div class="card pad" style="margin-top:14px;background:var(--panel3)"><h3 style="margin:0 0 5px">Последние внесённые записи</h3><p style="color:var(--muted);font-size:12px;margin:0 0 10px">Последние 50 записей по выбранному направлению, независимо от месяца. Дата поступления отдельно.</p><label for="finRecentSearch">Поиск лагеря</label><input id="finRecentSearch" type="search" placeholder="Название лагеря" style="max-width:430px"><div id="finRecent" style="margin-top:12px"></div></div><h3 style="margin-top:20px">Оплаты за выбранный месяц</h3><div id="finPayments" style="margin-top:12px"></div></section>';
 $('finMonth').value=month();
 ['summary','charges','payments'].forEach(x=>{$('finTab-'+x).onclick=()=>switchTab(x)});
 switchTab(state.tab);
 $('finMonth').onchange=load;
 $('finManager').onchange=render;
 $('finReload').onclick=load;
 $('finExport').onclick=exportCsv;
 $('finMatrixCsv').onclick=exportMatrixCsv;
 $('finMatrixSearch').oninput=renderMatrix;
 $('finMatrixFilter').onchange=renderMatrix;
 $('finMatrixSort').onchange=renderMatrix;
 $('finAdd').onclick=()=>editCharge();
 $('finPayAdd').onclick=()=>editPayment();
 $('finRecentSearch').oninput=renderRecent;
 $('finPaymentTabs').addEventListener('click',e=>{
  var b=e.target.closest('[data-fin-payment-tab]');if(!b)return;
  if(paymentTabs.some(t=>t.id===b.dataset.finPaymentTab)){state.paymentTab=b.dataset.finPaymentTab;renderPayments();}
 });
 $('finPaymentTabs').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  var idx=paymentTabs.findIndex(t=>t.id===state.paymentTab);
  var target=e.key==='Home'?0:e.key==='End'?paymentTabs.length-1:e.key==='ArrowRight'?(idx+1)%paymentTabs.length:(idx-1+paymentTabs.length)%paymentTabs.length;
  state.paymentTab=paymentTabs[target].id;renderPayments();
  $('finPaymentTabs').querySelector('[data-fin-payment-tab="'+state.paymentTab+'"]')?.focus();e.preventDefault();
 });
 return root;
}
function note(t,error){var e=$('finMessage');if(e){e.textContent=t||'';e.style.color=error?'#ff9dad':'var(--muted)';}}
async function load(){
 if(typeof isManager!=='function'||!isManager()){if(section())note('Финансовый раздел доступен руководителю.');return;}
 if(state.busy)return;section();state.busy=true;note('Загрузка…');
 try{
 var m=$('finMonth').value||month(),begin=first(m),end=next(m);
 async function recentPayments(){
  var cols='id,contract_id,client_id,payment_date,product_type,amount,status,event_type,comment,created_at,created_by';
  var pages=await Promise.all(paymentTabs.map(t=>{
   var q=sb.from('salary_payments').select(cols).eq('event_type','payment');
   if(t.id!=='all')q=q.eq('product_type',t.id);
   return q.order('created_at',{ascending:false}).limit(50);
  }));
  var result={};pages.forEach((p,i)=>{if(p.error)throw p.error;result[paymentTabs[i].id]=p.data||[]});return result;
 }
 async function allPayments(){var out=[],offset=0,limit=1000;for(;;){var page=await sb.from('salary_payments').select('id,contract_id,client_id,payment_date,product_type,amount,status,event_type,comment').lt('payment_date',end).order('id',{ascending:true}).range(offset,offset+limit-1);if(page.error)throw page.error;out.push(...(page.data||[]));if((page.data||[]).length<limit)break;offset+=limit;}return out;}
 var queries=await Promise.all([
  sb.from('salary_clients').select('id,client_name'),
  sb.from('salary_contracts').select('id,client_id,contractor_id,signed_date,status'),
  sb.from('sales_finance_charges').select('*').eq('month',begin),
  allPayments(),
  recentPayments()
 ]);
 for(var r of queries)if(r&&r.error)throw r.error;
 state.clients=queries[0].data||[];state.contracts=queries[1].data||[];state.charges=queries[2].data||[];state.recentByTab=queries[4]||{};state.payments=(queries[3]||[]).filter(p=>p.event_type==='payment'&&['paid','confirmed'].includes(p.status)&&p.payment_date<end);
 state.month=m;
 var selected=state.pendingManager||$('finManager').value;state.pendingManager=null;
 $('finManager').innerHTML='<option value="all">Все менеджеры</option>'+[...new Set(state.contracts.map(c=>c.contractor_id).filter(Boolean))].map(id=>'<option value="'+esc(id)+'">'+esc(managerName(id))+'</option>').join('');
 $('finManager').value=[...$('finManager').options].some(o=>o.value===selected)?selected:'all';
 note('«Принёс всего» — сумма подтверждённых поступлений за всю сохранённую историю платежей до конца выбранного месяца. Не прогноз и не задолженность.');
 render();
 }catch(e){note('Не удалось открыть финансы: '+(e.message||e)+'. Если таблица начислений отсутствует, сначала нужна миграция базы.',true)}
 finally{state.busy=false;}
}
function client(id){return state.clients.find(x=>x.id===id)?.client_name||'Лагерь не найден'}
function contract(id){return state.contracts.find(x=>x.id===id)}
function receipts(id){return state.payments.filter(p=>p.contract_id===id&&p.payment_date>=first(state.month)&&p.payment_date<next(state.month)).reduce((s,p)=>s+n(p.amount),0)}
function allClientReceipts(clientId){return state.payments.filter(p=>p.client_id===clientId).reduce((s,p)=>s+n(p.amount),0)}
function filtered(){var id=$('finManager').value;return state.charges.filter(c=>id==='all'||contract(c.contract_id)?.contractor_id===id)}
function render(){
 if(!$('finRows'))return;
 var rows=filtered(),selected=$('finManager').value;
 var planned=rows.reduce((s,x)=>s+n(x.amount),0);
 var contractSet=new Set(state.contracts.filter(c=>selected==='all'||c.contractor_id===selected).map(c=>c.id));
 var monthPaid=state.payments.filter(p=>p.payment_date>=first(state.month)&&p.payment_date<next(state.month)&&contractSet.has(p.contract_id)).reduce((s,p)=>s+n(p.amount),0);
 var allPaid=state.payments.filter(p=>contractSet.has(p.contract_id)).reduce((s,p)=>s+n(p.amount),0);
 var stats=[['Начислено в месяце',planned],['Поступило в месяце',monthPaid],['Получено всего',allPaid]];
 $('finStats').innerHTML=stats.map(x=>'<div class="card pad"><div class="kpi-label">'+x[0]+'</div><div class="kpi-value" style="font-size:24px">'+money(x[1])+'</div></div>').join('');
 var chargeMap=new Map();rows.forEach(c=>{var key=c.contract_id+'|'+c.product_type;chargeMap.set(key,c)});
 var contractRows=state.contracts.filter(c=>contractSet.has(c.id));
 $('finRows').innerHTML=contractRows.flatMap(sc=>{
 var own=rows.filter(c=>c.contract_id===sc.id);
 if(!own.length)return ['<tr><td><b>'+esc(client(sc.client_id))+'</b></td><td>'+esc(managerName(sc.contractor_id))+'</td><td colspan="4">Начислений нет</td><td><button class="btn" data-contract="'+esc(sc.id)+'">+ Начислить</button></td></tr>'];
 return own.map(c=>'<tr><td><b>'+esc(client(sc.client_id))+'</b></td><td>'+esc(managerName(sc.contractor_id))+'</td><td>'+esc(productNames[c.product_type]||c.product_type)+'</td><td>'+money(c.amount)+'</td><td>'+money(state.payments.filter(p=>p.contract_id===sc.id&&p.product_type===c.product_type&&p.payment_date>=first(state.month)).reduce((z,p)=>z+n(p.amount),0))+'</td><td>'+esc(c.due_date||'—')+'</td><td><button class="btn" data-charge="'+esc(c.id)+'" data-contract="'+esc(sc.id)+'">Изменить</button></td></tr>');
 }).join('')||'<tr><td colspan="7">Нет договоров. Добавь лагерь в разделе «Зарплата».</td></tr>';
 $('finRows').querySelectorAll('[data-contract]').forEach(b=>b.onclick=()=>editCharge(state.charges.find(x=>x.id===b.dataset.charge),b.dataset.contract));
 var groups=new Map();contractRows.forEach(c=>{var id=c.contractor_id||'none';var g=groups.get(id)||{amount:0,paid:0,clients:new Set()};g.amount+=rows.filter(ch=>ch.contract_id===c.id).reduce((sum,ch)=>sum+n(ch.amount),0);g.paid+=receipts(c.id);g.clients.add(c.client_id);groups.set(id,g)});
 $('finRanking').innerHTML='<div class="table-wrap"><table style="min-width:540px"><thead><tr><th>Менеджер</th><th>Лагерей</th><th>Начислено за месяц</th><th>Получено за месяц</th><th>Средняя комиссия</th></tr></thead><tbody>'+[...groups].sort((a,b)=>b[1].amount-a[1].amount).map(([id,g])=>'<tr><td>'+esc(managerName(id))+'</td><td>'+g.clients.size+'</td><td>'+money(g.amount)+'</td><td>'+money(g.paid)+'</td><td>'+money(g.clients.size?g.amount/g.clients.size:0)+'</td></tr>').join('')+'</tbody></table></div>';
 renderMatrix();
 renderPayments();
}
function selectedPayments(){
 var manager=$('finManager')?.value||'all',allowed=new Set(state.contracts.filter(c=>manager==='all'||c.contractor_id===manager).map(c=>c.id));
 return state.payments.filter(p=>p.payment_date>=first(state.month)&&p.payment_date<next(state.month)&&allowed.has(p.contract_id));
}
function renderPayments(){
 var el=$('finPayments');if(!el)return;
 var all=selectedPayments(),tab=state.paymentTab;
 $('finPaymentTabs')?.querySelectorAll('[data-fin-payment-tab]').forEach(b=>{
  var id=b.dataset.finPaymentTab,active=id===tab,count=all.filter(p=>paymentMatches(p,id)).length;
  b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
  b.textContent=paymentTabs.find(t=>t.id===id).label+' · '+count;
 });
 var rows=all.filter(p=>paymentMatches(p,tab)).sort((a,b)=>String(b.payment_date).localeCompare(String(a.payment_date))||String(b.id).localeCompare(String(a.id)));
 var amount=rows.reduce((sum,p)=>sum+n(p.amount),0),label=paymentTabs.find(t=>t.id===tab)?.label||'Все';
 $('finPaymentSummary').innerHTML='<strong>'+esc(label)+'</strong><span>За '+esc(state.month)+': '+receiptCount(rows.length)+' · <b>'+money(amount)+'</b></span>';
 el.innerHTML=rows.map(p=>'<div class="fin-payment-row"><span>'+esc(p.payment_date)+' · '+esc(client(p.client_id))+'</span><b>'+money(p.amount)+'</b><small>'+esc(productNames[p.product_type]||p.product_type)+'</small></div>').join('')||'<div class="hint">Подтверждённых поступлений по направлению за этот месяц нет.</div>';
 renderRecent();
}
function renderRecent(){
 var el=$('finRecent');if(!el)return;
 var tab=state.paymentTab,manager=$('finManager')?.value||'all',allowed=new Set(state.contracts.filter(c=>manager==='all'||c.contractor_id===manager).map(c=>c.id));
 var recent=state.recentByTab[tab]||[],search=String($('finRecentSearch')?.value||'').toLocaleLowerCase('ru').trim();
 var rows=recent.filter(p=>allowed.has(p.contract_id)&&(!search||client(p.client_id).toLocaleLowerCase('ru').includes(search)));
 var fmt=v=>v?new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 el.innerHTML='<p style="color:var(--muted);font-size:12px">Показано '+rows.length+' из '+recent.length+' последних записей направления. Предварительные и исключённые платежи видны, но не входят в итоги.</p>'+
  (rows.length?'<div class="table-wrap"><table class="fin-recent-table"><thead><tr><th>Когда внесено</th><th>Лагерь</th><th>Дата оплаты</th><th>Направление</th><th>Сумма</th><th>Внёс</th><th>Статус</th></tr></thead><tbody>'+
  rows.map(p=>'<tr><td>'+esc(fmt(p.created_at))+'</td><td><b>'+esc(client(p.client_id))+'</b></td><td>'+esc(p.payment_date||'—')+'</td><td>'+esc(productNames[p.product_type]||p.product_type)+'</td><td>'+money(p.amount)+'</td><td>'+esc(managerName(p.created_by))+'</td><td>'+esc(({paid:'Выплачено',confirmed:'Подтверждено',preliminary:'Предварительно',excluded:'Исключено'})[p.status]||p.status)+'</td></tr>').join('')+
  '</tbody></table></div>':'<div class="hint">По этому направлению и фильтру записей нет.</div>');
}
function picker(existing){
 var options=state.contracts.map(c=>'<option value="'+esc(c.id)+'" '+(existing?.contract_id===c.id?'selected':'')+'>'+esc(client(c.client_id))+' · '+esc(managerName(c.contractor_id))+' · '+esc(c.signed_date||'без даты')+'</option>').join('');
 return options;
}
async function editCharge(item,preferredContract){
 if(!state.contracts.length){alert('Сначала добавь клиента и договор в разделе «Зарплата».');return;}
 var form=document.createElement('div');form.className='modal-backdrop';form.innerHTML='<div class="modal" style="max-width:560px"><h3>'+(item?'Изменить начисление':'Новое начисление')+'</h3><label>Договор</label><select id="fcContract" '+(item?'disabled':'')+'>'+picker(item||{contract_id:preferredContract})+'</select><label>За что начисление</label><select id="fcProduct">'+productOptions()+'</select><label>Сумма начисления, ₽</label><input type="number" id="fcAmount" min="0" step=".01" value="'+esc(item?.amount||0)+'"><label>Оплатить до</label><input type="date" id="fcDue" value="'+esc(item?.due_date||'')+'"><label>Примечание</label><input id="fcNote" value="'+esc(item?.note||'')+'"><div class="modal-actions"><button class="btn" id="fcClose">Отмена</button><button class="btn primary" id="fcSave">Сохранить</button></div><div id="fcError" role="alert"></div></div>';document.body.appendChild(form);
 form.querySelector('#fcProduct').value=item?.product_type||'campbox';
 form.querySelector('#fcClose').onclick=()=>form.remove();
 form.querySelector('#fcSave').onclick=async()=>{
 var val=Number(form.querySelector('#fcAmount').value);if(!Number.isFinite(val)||val<0){form.querySelector('#fcError').textContent='Укажи корректную сумму';return}
 var payload={contract_id:item?.contract_id||form.querySelector('#fcContract').value,product_type:form.querySelector('#fcProduct').value,month:first(state.month),amount:val,due_date:form.querySelector('#fcDue').value||null,note:form.querySelector('#fcNote').value,updated_at:new Date().toISOString()};
 var result=item?await sb.from('sales_finance_charges').update(payload).eq('id',item.id):await sb.from('sales_finance_charges').insert({...payload,created_by:currentUser.id});
 if(result.error){form.querySelector('#fcError').textContent=result.error.message;return;}form.remove();await load();
 };
}
async function editPayment(){
 if(!state.contracts.length){alert('Нет договоров для привязки оплаты.');return;}
 var form=document.createElement('div');form.className='modal-backdrop';form.innerHTML='<div class="modal" style="max-width:560px"><h3>Зафиксировать оплату</h3><p style="color:var(--muted)">Запись попадёт в реестр поступлений и в расчёт зарплаты.</p><label>Договор</label><select id="fpContract">'+picker()+'</select><label>Продукт</label><select id="fpProduct"><option value="campbox">Комиссия CampBox</option><option value="order_management">МУЗ</option><option value="comfort_booking">КБ</option><option value="site">Сайт</option></select><label>Дата оплаты</label><input type="date" id="fpDate" value="'+new Date().toISOString().slice(0,10)+'"><label>Сумма, ₽</label><input type="number" id="fpAmount" min="0.01" step=".01"><label>Комментарий / платёжный идентификатор</label><input id="fpNote" placeholder="Для проверки дублей"><div class="modal-actions"><button class="btn" id="fpCancel">Отмена</button><button class="btn primary" id="fpSave">Записать поступление</button></div><div id="fpError" role="alert"></div></div>';document.body.appendChild(form);
 form.querySelector('#fpCancel').onclick=()=>form.remove();
 form.querySelector('#fpSave').onclick=async()=>{
 var id=form.querySelector('#fpContract').value,sc=contract(id),amount=Number(form.querySelector('#fpAmount').value),date=form.querySelector('#fpDate').value;
 if(!sc||!date||!Number.isFinite(amount)||amount<=0){form.querySelector('#fpError').textContent='Проверь договор, дату и сумму.';return;}
 var data={contract_id:id,client_id:sc.client_id,payment_date:date,amount,product_type:form.querySelector('#fpProduct').value,event_type:'payment',status:'paid',comment:form.querySelector('#fpNote').value,created_by:currentUser.id};
 if(!confirm('Подтвердить реальное поступление '+money(amount)+'? Оно повлияет на расчёт зарплаты.'))return;
 var r=await sb.from('salary_payments').insert(data);if(r.error){form.querySelector('#fpError').textContent=r.error.message;return;}form.remove();await load();
 };
}
function exportCsv(){
 var lines=[['Месяц','Лагерь','Менеджер','Направление','Начислено','Оплачено в месяце','Получено всего','Дата оплаты','Комментарий']];
 filtered().forEach(x=>{var sc=contract(x.contract_id),got=receipts(x.contract_id);lines.push([state.month,client(sc?.client_id),managerName(sc?.contractor_id),productNames[x.product_type]||x.product_type,x.amount,got,allClientReceipts(sc?.client_id),x.due_date||'',x.note||''])});
 var csv='\uFEFF'+lines.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='CampBox_Финансы_'+state.month+'.csv';a.click();URL.revokeObjectURL(url);
}
window.salesFinanceFor=id=>{state.pendingManager=id;if(section())load();};
window.salesFinanceOpen=()=>{if(section())load();};
})();
