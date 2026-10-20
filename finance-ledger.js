/* CampBox Finance: managerial commission ledger linked to Salary contracts / receipts. */
(function(){
'use strict';
var state={clients:[],contracts:[],charges:[],payments:[],busy:false,month:''};
var $=id=>document.getElementById(id);
var esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
var money=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(Number(v)||0);
var n=v=>Number(v)||0;
var month=()=>($('reportMonth')?.value||selectedMonth||new Date().toISOString().slice(0,7));
var first=m=>m+'-01';
var next=m=>{var [y,mm]=m.split('-').map(Number);return new Date(Date.UTC(y,mm,1)).toISOString().slice(0,10)};
var stamp=s=>String(s||'').slice(0,10);
var managerName=id=>{var p=(window.profiles||profiles||[]).find(x=>x.id===id);return p?(p.full_name||p.email||'Менеджер'):'Не назначен';};
function section(){
 var root=$('v13-finance');if(!root)return null;
 if(root.dataset.ready)return root;root.dataset.ready='1';
 root.innerHTML='<section class="card pad" style="margin-bottom:14px"><h2>Финансы лагерей · комиссии CampBox</h2><p style="color:var(--muted)">Помесячные начисления и фактические поступления. Платежи берутся из общего реестра зарплатного модуля — повторного учёта нет.</p><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div><label>Месяц</label><input type="month" id="finMonth"></div><div><label>Менеджер</label><select id="finManager"><option value="all">Все менеджеры</option></select></div><button class="btn" id="finReload">Обновить</button><button class="btn" id="finExport">Excel / CSV</button></div><div id="finMessage" style="margin-top:12px" role="status"></div></section>'+
 '<div id="finStats" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:14px"></div>'+
 '<section class="card pad"><div style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap"><div><h2>Комиссии по лагерям</h2><p style="color:var(--muted)">Внести план можно только для договора из реестра «Зарплата».</p></div><button class="btn primary" id="finAdd">+ Начисление</button></div><div class="table-wrap" style="margin-top:12px"><table style="min-width:900px"><thead><tr><th>Лагерь / договор</th><th>Менеджер</th><th>Начислено</th><th>Получено в месяце</th><th>Остаток</th><th>Оплатить до</th><th></th></tr></thead><tbody id="finRows"></tbody></table></div></section>'+
 '<section class="card pad" style="margin-top:14px"><h2>Эффективность продаж по деньгам</h2><p style="color:var(--muted)">Рейтинг по начисленной комиссии, без смешения качества продажи со сроками оплаты.</p><div id="finRanking"></div></section>'+
 '<section class="card pad" style="margin-top:14px"><h2>Фактические платежи</h2><p style="color:var(--muted)">Новая оплата появится также в зарплатном модуле. Указывай продукт и договор, чтобы исключить двойной учёт.</p><button class="btn" id="finPayAdd">+ Зафиксировать поступление</button><div id="finPayments" style="margin-top:12px"></div></section>';
 $('finMonth').value=month();
 $('finMonth').onchange=load;
 $('finManager').onchange=render;
 $('finReload').onclick=load;
 $('finExport').onclick=exportCsv;
 $('finAdd').onclick=()=>editCharge();
 $('finPayAdd').onclick=()=>editPayment();
 return root;
}
function note(t,error){var e=$('finMessage');if(e){e.textContent=t||'';e.style.color=error?'#ff9dad':'var(--muted)';}}
async function load(){
 if(typeof isManager!=='function'||!isManager()){if(section())note('Финансовый раздел доступен руководителю.');return;}
 if(state.busy)return;section();state.busy=true;note('Загрузка…');
 try{
 var m=$('finMonth').value||month(),begin=first(m),end=next(m);
 var queries=await Promise.all([
  sb.from('salary_clients').select('id,client_name'),
  sb.from('salary_contracts').select('id,client_id,contractor_id,contract_number,signed_date,status'),
  sb.from('sales_finance_charges').select('*').eq('month',begin),
  sb.from('salary_payments').select('id,contract_id,client_id,payment_date,product_type,amount,status,event_type,comment').gte('payment_date',begin).lt('payment_date',end)
 ]);
 for(var r of queries)if(r.error)throw r.error;
 state.clients=queries[0].data||[];state.contracts=queries[1].data||[];state.charges=queries[2].data||[];state.payments=(queries[3].data||[]).filter(p=>p.event_type==='payment'&&['paid','confirmed'].includes(p.status));
 state.month=m;
 var selected=$('finManager').value;
 $('finManager').innerHTML='<option value="all">Все менеджеры</option>'+[...new Set(state.contracts.map(c=>c.contractor_id).filter(Boolean))].map(id=>'<option value="'+esc(id)+'">'+esc(managerName(id))+'</option>').join('');
 $('finManager').value=[...$('finManager').options].some(o=>o.value===selected)?selected:'all';
 note('Данные обновлены. Начисление — план, поступление — подтверждённый факт.');
 render();
 }catch(e){note('Не удалось открыть финансы: '+(e.message||e)+'. Если таблица начислений отсутствует, сначала нужна миграция базы.',true)}
 finally{state.busy=false;}
}
function client(id){return state.clients.find(x=>x.id===id)?.client_name||'Лагерь не найден'}
function contract(id){return state.contracts.find(x=>x.id===id)}
function receipts(id){return state.payments.filter(p=>p.contract_id===id).reduce((s,p)=>s+n(p.amount),0)}
function filtered(){var id=$('finManager').value;return state.charges.filter(c=>id==='all'||contract(c.contract_id)?.contractor_id===id)}
function render(){
 if(!$('finRows'))return;
 var rows=filtered(),planned=rows.reduce((s,x)=>s+n(x.amount),0),paid=rows.reduce((s,x)=>s+receipts(x.contract_id),0);
 // Receipt totals are month-based, while remaining represents the due month's unpaid portion.
 var outstanding=Math.max(0,planned-paid);
 var stats=[['Начислено',planned],['Получено по этим договорам',paid],['Остаток за месяц',outstanding]];
 $('finStats').innerHTML=stats.map(x=>'<div class="card pad"><div class="kpi-label">'+x[0]+'</div><div class="kpi-value" style="font-size:24px">'+money(x[1])+'</div></div>').join('')+'<div class="card pad"><div class="kpi-label">Собираемость</div><div class="kpi-value" style="font-size:24px">'+(planned?Math.round(paid/planned*100):0)+'%</div></div>';
 $('finRows').innerHTML=rows.map(c=>{var sc=contract(c.contract_id),got=receipts(c.contract_id),rem=Math.max(0,n(c.amount)-got);
 return '<tr><td><b>'+esc(client(sc?.client_id))+'</b><div style="font-size:11px;color:var(--muted)">'+esc(sc?.contract_number||sc?.signed_date||'Договор')+'</div></td><td>'+esc(managerName(sc?.contractor_id))+'</td><td>'+money(c.amount)+'</td><td>'+money(got)+'</td><td style="color:'+(rem?'#ffc880':'#8be6bb')+'">'+money(rem)+'</td><td>'+esc(c.due_date||'—')+'</td><td><button class="btn" data-charge="'+esc(c.id)+'">Изменить</button></td></tr>';
 }).join('')||'<tr><td colspan="7">Начислений за выбранный месяц пока нет.</td></tr>';
 $('finRows').querySelectorAll('[data-charge]').forEach(b=>b.onclick=()=>editCharge(state.charges.find(x=>x.id===b.dataset.charge)));
 var groups=new Map();rows.forEach(c=>{var id=contract(c.contract_id)?.contractor_id||'none';var g=groups.get(id)||{amount:0,paid:0,count:0};g.amount+=n(c.amount);g.paid+=receipts(c.contract_id);g.count++;groups.set(id,g)});
 $('finRanking').innerHTML='<div class="table-wrap"><table style="min-width:540px"><thead><tr><th>Менеджер</th><th>Лагерей</th><th>Начислено</th><th>Получено</th><th>Среднее на лагерь</th></tr></thead><tbody>'+[...groups].sort((a,b)=>b[1].amount-a[1].amount).map(([id,g])=>'<tr><td>'+esc(managerName(id))+'</td><td>'+g.count+'</td><td>'+money(g.amount)+'</td><td>'+money(g.paid)+'</td><td>'+money(g.amount/g.count)+'</td></tr>').join('')+'</tbody></table></div>';
 var pay=state.payments.filter(p=>{var sc=contract(p.contract_id);return $('finManager').value==='all'||sc?.contractor_id===$('finManager').value});
 $('finPayments').innerHTML=pay.map(p=>'<div style="padding:8px 0;border-bottom:1px solid var(--line)">'+esc(p.payment_date)+' · '+esc(client(p.client_id))+' · '+money(p.amount)+' · '+esc(p.product_type)+'</div>').join('')||'Подтверждённых поступлений за месяц нет.';
}
function picker(existing){
 var options=state.contracts.map(c=>'<option value="'+esc(c.id)+'" '+(existing?.contract_id===c.id?'selected':'')+'>'+esc(client(c.client_id))+' · '+esc(managerName(c.contractor_id))+' · '+esc(c.signed_date||'без даты')+'</option>').join('');
 return options;
}
async function editCharge(item){
 if(!state.contracts.length){alert('Сначала добавь клиента и договор в разделе «Зарплата».');return;}
 var form=document.createElement('div');form.className='modal-backdrop';form.innerHTML='<div class="modal" style="max-width:560px"><h3>'+(item?'Изменить начисление':'Новое начисление')+'</h3><label>Договор</label><select id="fcContract" '+(item?'disabled':'')+'>'+picker(item)+'</select><label>Комиссия, ₽</label><input type="number" id="fcAmount" min="0" step=".01" value="'+esc(item?.amount||0)+'"><label>Оплатить до</label><input type="date" id="fcDue" value="'+esc(item?.due_date||'')+'"><label>Примечание</label><input id="fcNote" value="'+esc(item?.note||'')+'"><div class="modal-actions"><button class="btn" id="fcClose">Отмена</button><button class="btn primary" id="fcSave">Сохранить</button></div><div id="fcError" role="alert"></div></div>';document.body.appendChild(form);
 form.querySelector('#fcClose').onclick=()=>form.remove();
 form.querySelector('#fcSave').onclick=async()=>{
 var val=Number(form.querySelector('#fcAmount').value);if(!Number.isFinite(val)||val<0){form.querySelector('#fcError').textContent='Укажи корректную сумму';return}
 var payload={contract_id:item?.contract_id||form.querySelector('#fcContract').value,month:first(state.month),amount:val,due_date:form.querySelector('#fcDue').value||null,note:form.querySelector('#fcNote').value,updated_at:new Date().toISOString()};
 var result=item?await sb.from('sales_finance_charges').update(payload).eq('id',item.id):await sb.from('sales_finance_charges').insert({...payload,created_by:currentUser.id});
 if(result.error){form.querySelector('#fcError').textContent=result.error.message;return;}form.remove();await load();
 };
}
async function editPayment(){
 if(!state.contracts.length){alert('Нет договоров для привязки оплаты.');return;}
 var form=document.createElement('div');form.className='modal-backdrop';form.innerHTML='<div class="modal" style="max-width:560px"><h3>Зафиксировать оплату</h3><p style="color:var(--muted)">Запись попадёт в реестр поступлений и в расчёт зарплаты.</p><label>Договор</label><select id="fpContract">'+picker()+'</select><label>Продукт</label><select id="fpProduct"><option value="campbox">CampBox</option><option value="order_management">Управление заказами</option><option value="comfort_booking">Комфортное бронирование</option><option value="maps">Карты</option><option value="site">Сайт</option><option value="site_support">Поддержка сайта</option></select><label>Дата оплаты</label><input type="date" id="fpDate" value="'+new Date().toISOString().slice(0,10)+'"><label>Сумма, ₽</label><input type="number" id="fpAmount" min="0.01" step=".01"><label>Комментарий / платёжный идентификатор</label><input id="fpNote" placeholder="Для проверки дублей"><div class="modal-actions"><button class="btn" id="fpCancel">Отмена</button><button class="btn primary" id="fpSave">Записать поступление</button></div><div id="fpError" role="alert"></div></div>';document.body.appendChild(form);
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
 var lines=[['Месяц','Лагерь','Менеджер','Начислено','Получено','Остаток','Дата оплаты','Комментарий']];
 filtered().forEach(x=>{var sc=contract(x.contract_id),got=receipts(x.contract_id);lines.push([state.month,client(sc?.client_id),managerName(sc?.contractor_id),x.amount,got,Math.max(0,n(x.amount)-got),x.due_date||'',x.note||''])});
 var csv='\uFEFF'+lines.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='CampBox_Финансы_'+state.month+'.csv';a.click();URL.revokeObjectURL(url);
}
window.salesFinanceOpen=()=>{if(section())load();};
})();
