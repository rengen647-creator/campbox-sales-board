
(function(){
  'use strict';

  const S={
    ready:false,loading:false,schemaReady:true,tab:'mine',month:'',
    clients:[],products:[],payments:[],dept:null,audit:[],config:null,
    importRows:[],lastError:''
  };

  const PRODUCTS={
    campbox:{label:'CampBox / комиссия',short:'CampBox',rate:.10,period:true},
    order_management:{label:'Модуль управления заказами',short:'Order Management',rate:.0805,period:true},
    comfort_booking:{label:'Comfort Booking',short:'Comfort Booking',rate:.0805,period:true},
    maps:{label:'Актуализация 2ГИС + Яндекс',short:'2ГИС + Яндекс',fixed:6000},
    site:{label:'Разработка сайта',short:'Сайт',rate1:.11,rateN:.0805,live:4025},
    site_support:{label:'Сопровождение сайта',short:'Сопровождение',rate1:.11,rateN:.0805}
  };

  function q(id){return document.getElementById(id)}
  function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function money(v){return Number(v||0).toLocaleString('ru-RU',{minimumFractionDigits:Number(v||0)%1?2:0,maximumFractionDigits:2})+' ₽'}
  function isoMonth(v){return /^\d{4}-\d{2}$/.test(v||'')?v:(typeof selectedMonth!=='undefined'&&selectedMonth?selectedMonth:new Date().toISOString().slice(0,7))}
  function monthStartIso(m){return m+'-01'}
  function nextMonthIso(m){const [y,mo]=m.split('-').map(Number);return new Date(Date.UTC(y,mo,1)).toISOString().slice(0,10)}
  function currentMonth(){const d=new Date(),z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,7)}
  function monthName(m){try{return new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(m+'-01T12:00:00')).replace(/^./,x=>x.toUpperCase())}catch(e){return m}}
  function dateRu(v){if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?p.reverse().join('.'):v}
  function addMonthsIso(date,n){const [y,m,d]=String(date).slice(0,10).split('-').map(Number);const x=new Date(Date.UTC(y,m-1+n,d));return x.toISOString().slice(0,10)}
  function active12(first,payDate){return !!first&&payDate>=first&&payDate<addMonthsIso(first,12)}
  function monthIndex(first,payDate){if(!first||!payDate)return null;const a=new Date(first+'T12:00:00'),b=new Date(payDate+'T12:00:00');return Math.max(1,(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth())+1)}
  function contractorRate(pct){pct=Number(pct)||0;if(pct<80)return 0;if(pct<100)return 2000;if(pct<=103)return 5000;return 7000}
  function manager(){try{return typeof isManager==='function'&&isManager()}catch(e){return false}}
  function profileName(id){const p=(typeof profiles!=='undefined'?profiles:[]).find(x=>x.id===id);return p?(p.full_name||p.email||'Сотрудник'):'—'}
  function userRole(id){const p=(typeof profiles!=='undefined'?profiles:[]).find(x=>x.id===id);return p?.role||'employee'}
  function product(id,type){return S.products.find(x=>x.client_id===id&&x.product_type===type)}
  function client(id){return S.clients.find(x=>x.id===id)}
  function statusPill(status){
    const tone=status==='paid'||status==='Выплачено'?'good':status==='confirmed'||status==='Подтверждено'?'good':status==='excluded'?'bad':'warn';
    const label={paid:'Выплачено',confirmed:'Подтверждено',preliminary:'Предварительно',excluded:'Исключено'}[status]||status;
    return '<span class="salary-pill '+tone+'">'+esc(label)+'</span>';
  }
  function productOptions(selected=''){
    return Object.entries(PRODUCTS).map(([k,v])=>'<option value="'+k+'" '+(k===selected?'selected':'')+'>'+esc(v.label)+'</option>').join('');
  }
  function employeeOptions(selected=''){
    return (typeof profiles!=='undefined'?profiles:[]).filter(p=>p.active!==false).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.full_name||p.email||'Сотрудник')+'</option>').join('');
  }
  function clientOptions(selected=''){
    return S.clients.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selected?'selected':'')+'>'+esc(c.client_name)+'</option>').join('');
  }

  function screen(){return q('v13-salary')}
  function ensureRoot(){
    const root=screen();if(!root||S.ready)return false;
    S.ready=true;
    S.month=isoMonth('');
    root.innerHTML=
      '<div class="salary-tabs" id="salaryTabs">'+
        '<button data-salary-tab="mine" class="active">Моя зарплата</button>'+
        '<button data-salary-tab="payments" class="salary-manager-only">Поступления</button>'+
        '<button data-salary-tab="clients" class="salary-manager-only">База клиентов</button>'+
        '<button data-salary-tab="team" class="salary-manager-only">Команда</button>'+
        '<button data-salary-tab="rules" class="salary-manager-only">Настройки мотивации</button>'+
        '<button data-salary-tab="history" class="salary-manager-only">История изменений</button>'+
      '</div>'+
      '<div id="salarySetup" class="salary-setup hidden"><h3>Нужно подключить таблицы Salary V1</h3><p>Интерфейс уже установлен, но в Supabase ещё нет таблиц зарплаты. Выполни файл <b>salary_v1_migration.sql</b> в SQL Editor — после этого раздел заработает без дополнительных изменений.</p></div>'+
      '<div id="salaryMine" class="salary-panel active"></div>'+
      '<div id="salaryPayments" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryClients" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryTeam" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryRules" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryHistory" class="salary-panel salary-manager-only"></div>';
    q('salaryTabs').addEventListener('click',e=>{
      const b=e.target.closest('[data-salary-tab]');if(!b)return;
      S.tab=b.dataset.salaryTab;
      renderTabs();
    });
    applyRoles();
    return true;
  }

  function applyRoles(){
    document.querySelectorAll('.salary-manager-only').forEach(x=>x.classList.toggle('hidden',!manager()));
    if(!manager()&&S.tab!=='mine')S.tab='mine';
  }

  function renderTabs(){
    applyRoles();
    document.querySelectorAll('[data-salary-tab]').forEach(b=>b.classList.toggle('active',b.dataset.salaryTab===S.tab));
    const map={mine:'salaryMine',payments:'salaryPayments',clients:'salaryClients',team:'salaryTeam',rules:'salaryRules',history:'salaryHistory'};
    Object.entries(map).forEach(([k,id])=>q(id)?.classList.toggle('active',k===S.tab));
    if(S.tab==='mine')renderMine();
    if(S.tab==='payments')renderPayments();
    if(S.tab==='clients')renderClients();
    if(S.tab==='team')renderTeam();
    if(S.tab==='rules')renderRules();
    if(S.tab==='history')renderHistory();
  }

  async function schemaProbe(){
    try{
      const {error}=await sb.from('salary_clients').select('id').limit(1);
      if(error)throw error;
      S.schemaReady=true;S.lastError='';
    }catch(e){
      S.schemaReady=false;S.lastError=e?.message||String(e);
    }
    q('salarySetup')?.classList.toggle('hidden',S.schemaReady);
    return S.schemaReady;
  }

  async function syncDepartmentMonth(){
    if(!manager()||!S.schemaReady)return;
    const first=monthStartIso(S.month),next=nextMonthIso(S.month);
    const existing=await sb.from('salary_department_months').select('*').eq('month',first).maybeSingle();
    if(existing.data?.finalized){S.dept=existing.data;return}
    const [ms,ds]=await Promise.all([
      sb.from('month_settings').select('target_plan').eq('month',first).maybeSingle(),
      sb.from('daily_sales').select('connected_fact').gte('report_date',first).lt('report_date',next)
    ]);
    if(ms.error||ds.error)return;
    const target=Number(ms.data?.target_plan||0),actual=(ds.data||[]).reduce((a,r)=>a+Number(r.connected_fact||0),0);
    const pct=target?Math.round(actual/target*10000)/100:0,rate=contractorRate(pct),finalized=S.month<currentMonth();
    const row={month:first,target_plan:target,actual_sales:actual,completion_pct:pct,contractor_rate:rate,finalized,updated_by:currentUser?.id||null,updated_at:new Date().toISOString()};
    const old=existing.data;
    const changed=!old||Number(old.target_plan)!==target||Number(old.actual_sales)!==actual||Number(old.completion_pct)!==pct||Number(old.contractor_rate)!==rate||!!old.finalized!==finalized;
    if(changed)await sb.from('salary_department_months').upsert(row,{onConflict:'month'});
    S.dept=row;
  }

  async function load(){
    if(!ensureRoot()&& !S.ready)return;
    if(typeof sb==='undefined'||!sb||typeof currentUser==='undefined'||!currentUser)return;
    if(S.loading)return;
    S.loading=true;
    try{
      const ok=await schemaProbe();if(!ok){renderAll();return}
      await syncDepartmentMonth();
      const first=monthStartIso(S.month),next=nextMonthIso(S.month);
      const tasks=[
        sb.from('salary_clients').select('*').eq('active',true).order('client_name'),
        sb.from('salary_client_products').select('*').eq('active',true),
        sb.from('salary_payments').select('*').gte('payment_date',first).lt('payment_date',next).order('payment_date',{ascending:false}),
        sb.from('salary_department_months').select('*').eq('month',first).maybeSingle(),
        sb.from('salary_config').select('*').eq('id',1).maybeSingle()
      ];
      if(manager())tasks.push(sb.from('salary_audit').select('*').order('created_at',{ascending:false}).limit(100));
      const res=await Promise.all(tasks);
      for(const r of res){if(r.error)throw r.error}
      S.clients=res[0].data||[];S.products=res[1].data||[];S.payments=res[2].data||[];S.dept=res[3].data||S.dept;S.config=res[4].data||null;S.audit=manager()?(res[5]?.data||[]):[];
      renderAll();
    }catch(e){
      console.error('Salary V1 load',e);
      S.lastError=e?.message||String(e);
      if((S.lastError||'').toLowerCase().includes('salary_'))S.schemaReady=false;
      renderAll();
    }finally{S.loading=false}
  }

  function paymentAccrual(p,c,userId){
    if(!c||p.status==='excluded')return null;
    const cfg=PRODUCTS[p.product_type];if(!cfg)return null;
    const prod=product(c.id,p.product_type);
    const isContractor=c.contractor_id===userId;
    if(!isContractor)return null;
    let amount=0,rate='',formula='',note='';
    if(p.product_type==='campbox'||p.product_type==='order_management'||p.product_type==='comfort_booking'){
      if(!active12(prod?.first_payment_date,p.payment_date))return null;
      amount=Number(p.amount||0)*cfg.rate;rate=(cfg.rate*100).toLocaleString('ru-RU')+'%';formula=money(p.amount)+' × '+rate;
      const mi=monthIndex(prod?.first_payment_date,p.payment_date);note=mi?mi+' месяц из 12':'';
    }else if(p.product_type==='maps'){
      if(p.event_type!=='payment')return null;
      amount=6000;rate='40%';formula='15 000 ₽ × 40%';
    }else if(p.product_type==='site'){
      if(p.event_type==='site_live'){amount=4025;rate='4 025 ₽';formula='фикс за выход сайта в ЖР';}
      else {const r=Number(p.payment_number||1)===1?.11:.0805;amount=Number(p.amount||0)*r;rate=(r*100).toLocaleString('ru-RU')+'%';formula=money(p.amount)+' × '+rate;}
    }else if(p.product_type==='site_support'){
      if(p.event_type!=='payment')return null;
      const r=Number(p.payment_number||1)===1?.11:.0805;amount=Number(p.amount||0)*r;rate=(r*100).toLocaleString('ru-RU')+'%';formula=money(p.amount)+' × '+rate;
    }
    if(amount<=0)return null;
    return {date:p.payment_date,client:c.client_name,direction:cfg.short,event:p.event_type==='site_live'?'Выход сайта в ЖР':'Поступление'+(p.payment_number?' №'+p.payment_number:''),base:Number(p.amount||0),rate,formula,amount,status:p.status,payment_id:p.id,note};
  }

  function salaryFor(userId){
    const rows=[];
    const dept=S.dept||{contractor_rate:0,completion_pct:0,finalized:false};
    S.clients.filter(c=>c.contractor_id===userId&&c.signed_date&&c.signed_date.slice(0,7)===S.month).forEach(c=>{
      const rate=Number(dept.contractor_rate||0);
      if(rate>0)rows.push({date:c.signed_date,client:c.client_name,direction:'Контракторство',event:'Договор подписан',base:0,rate:money(rate),formula:'1 договор × '+money(rate),amount:rate,status:dept.finalized?'confirmed':'preliminary',client_id:c.id,note:'Выполнение отдела '+Number(dept.completion_pct||0).toLocaleString('ru-RU')+'%'});
    });
    S.payments.forEach(p=>{
      const c=client(p.client_id),a=paymentAccrual(p,c,userId);if(a)rows.push(a);
    });
    if(S.config?.sales_head_id===userId){
      S.payments.forEach(p=>{
        if(p.status==='excluded'||p.product_type!=='campbox'||p.event_type!=='payment')return;
        const c=client(p.client_id),prod=product(p.client_id,'campbox');if(!c||!prod?.first_payment_date)return;
        if(p.payment_date>=addMonthsIso(prod.first_payment_date,12)){
          const amount=Number(p.amount||0)*.01;
          rows.push({date:p.payment_date,client:c.client_name,direction:'1% руководителю',event:'CampBox после 12 мес.',base:Number(p.amount||0),rate:'1%',formula:money(p.amount)+' × 1%',amount,status:p.status,payment_id:p.id,note:'12-месячный период '+profileName(c.contractor_id)+' завершён'});
        }
      });
    }
    rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    return rows;
  }

  function totals(rows){
    const t={total:0,contract:0,campbox:0,products:0,site:0,head:0};
    rows.forEach(r=>{
      t.total+=r.amount;
      if(r.direction==='Контракторство')t.contract+=r.amount;
      else if(r.direction==='CampBox')t.campbox+=r.amount;
      else if(r.direction==='1% руководителю')t.head+=r.amount;
      else if(r.direction==='Сайт'||r.direction==='Сопровождение')t.site+=r.amount;
      else t.products+=r.amount;
    });
    return t;
  }

  function mineRows(){return salaryFor(currentUser.id)}
  function renderAll(){if(!S.ready)return;applyRoles();renderTabs()}

  function monthControl(id){
    return '<div class="salary-field"><label>Месяц</label><input id="'+id+'" type="month" value="'+esc(S.month)+'"></div>';
  }
  function bindMonth(id){
    q(id)?.addEventListener('change',e=>{S.month=isoMonth(e.target.value);load()});
  }

  function renderMine(){
    const box=q('salaryMine');if(!box)return;
    if(!S.schemaReady){box.innerHTML='';return}
    const rows=mineRows(),t=totals(rows);
    const status=S.month<currentMonth()?'Закрытый период':'Предварительно';
    const activeProducts=S.products.filter(p=>{const c=client(p.client_id);return c?.contractor_id===currentUser.id&&p.first_payment_date&&active12(p.first_payment_date,S.month+'-28')});
    box.innerHTML=
      '<div class="salary-card"><div class="salary-head"><div><h2>Отчёт по зарплате</h2><p>Выбери месяц и сформируй настоящий Excel с полной расшифровкой.</p></div><span class="salary-pill blue">XLSX</span></div><div class="salary-body">'+
        '<div class="salary-toolbar">'+monthControl('salaryMineMonth')+'<div class="salary-field"><label>Сотрудник</label><input value="'+esc(profileName(currentUser.id))+'" disabled></div><button class="btn primary" id="salaryExcelBtn">Сформировать Excel</button></div>'+
        '<div class="salary-report-preview"><div><span>Период</span><b>'+esc(monthName(S.month))+'</b></div><div><span>Начислено</span><b>'+money(t.total)+'</b></div><div><span>Начислений</span><b>'+rows.length+'</b></div><div><span>Статус</span><b>'+status+'</b></div></div>'+
      '</div></div>'+
      '<div class="salary-kpis">'+
        '<div class="salary-kpi good"><span>Итого начислено</span><b>'+money(t.total)+'</b><small>за выбранный месяц</small></div>'+
        '<div class="salary-kpi"><span>Контракторство</span><b>'+money(t.contract)+'</b><small>разовая выплата за подписанные договоры</small></div>'+
        '<div class="salary-kpi good"><span>CampBox · 10%</span><b>'+money(t.campbox)+'</b><small>активные 12-месячные комиссии</small></div>'+
        '<div class="salary-kpi"><span>Доп. продукты</span><b>'+money(t.products)+'</b><small>модули и карты</small></div>'+
        '<div class="salary-kpi warn"><span>Сайты / 1% РОП</span><b>'+money(t.site+t.head)+'</b><small>сайты, сопровождение и управленческий 1%</small></div>'+
      '</div>'+
      '<div class="salary-grid2">'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Расшифровка начислений</h2><p>Каждый рубль связан с клиентом, событием и формулой.</p></div></div><div class="salary-body"><div class="salary-breakdown">'+
          '<div><span>Контракторство</span><b>'+money(t.contract)+'</b></div><div><span>CampBox</span><b>'+money(t.campbox)+'</b></div><div><span>Доп. продукты</span><b>'+money(t.products)+'</b></div><div><span>Сайты / сопровождение</span><b>'+money(t.site)+'</b></div><div><span>1% руководителю</span><b>'+money(t.head)+'</b></div>'+
        '</div></div></div>'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Активные 12-месячные комиссии</h2><p>Срок ведётся отдельно по каждому направлению.</p></div></div><div class="salary-body"><div class="salary-timeline">'+
          (activeProducts.length?activeProducts.map(p=>{const c=client(p.client_id),end=addMonthsIso(p.first_payment_date,12),m=monthIndex(p.first_payment_date,S.month+'-28');return '<div class="salary-event"><time>'+dateRu(p.first_payment_date)+'</time><div><b>'+esc(c?.client_name||'')+' · '+esc(PRODUCTS[p.product_type]?.short||p.product_type)+'</b><small>'+Math.min(m||1,12)+' месяц из 12</small></div><span class="salary-pill '+(end.slice(0,7)===S.month?'warn':'good')+'">до '+dateRu(end)+'</span></div>'}).join(''):'<div class="salary-empty">Нет активных 12-месячных направлений.</div>')+
        '</div></div></div>'+
      '</div>'+
      '<div class="salary-card"><div class="salary-head"><div><h2>Начисления за '+esc(monthName(S.month))+'</h2><p>Полная детализация для проверки зарплаты.</p></div></div><div class="salary-body">'+accrualTable(rows)+'</div></div>';
    bindMonth('salaryMineMonth');
    q('salaryExcelBtn')?.addEventListener('click',exportMineExcel);
  }

  function accrualTable(rows){
    if(!rows.length)return '<div class="salary-empty">За выбранный месяц начислений нет.</div>';
    return '<div class="salary-table-wrap"><table class="salary-table"><thead><tr><th>Дата</th><th>Клиент</th><th>Направление</th><th>Событие</th><th>База</th><th>Ставка</th><th>Формула</th><th>Начислено</th><th>Статус</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+dateRu(r.date)+'</td><td>'+esc(r.client)+'</td><td>'+esc(r.direction)+'</td><td>'+esc(r.event)+(r.note?'<br><small style="color:#8395b2">'+esc(r.note)+'</small>':'')+'</td><td>'+(r.base?money(r.base):'—')+'</td><td>'+esc(r.rate)+'</td><td>'+esc(r.formula)+'</td><td><b>'+money(r.amount)+'</b></td><td>'+statusPill(r.status)+'</td></tr>').join('')+
      '</tbody></table></div>';
  }

  async function exportMineExcel(){
    const rows=mineRows(),t=totals(rows),name=profileName(currentUser.id);
    if(typeof XLSX==='undefined'){alert('Библиотека Excel не загрузилась. Обнови страницу и попробуй ещё раз.');return}
    const summary=[
      ['Отчёт по зарплате CampBox'],['Сотрудник',name],['Период',monthName(S.month)],['Итого начислено',t.total],[],
      ['Категория','Сумма'],['Контракторство',t.contract],['CampBox · 10%',t.campbox],['Доп. продукты',t.products],['Сайты / сопровождение',t.site],['1% руководителю',t.head]
    ];
    const details=[['Дата','Клиент','Направление','Событие','База расчёта','Ставка','Формула','Начислено','Статус'],
      ...rows.map(r=>[r.date,r.client,r.direction,r.event,r.base,r.rate,r.formula,r.amount,{paid:'Выплачено',confirmed:'Подтверждено',preliminary:'Предварительно',excluded:'Исключено'}[r.status]||r.status])
    ];
    const wb=XLSX.utils.book_new(),ws1=XLSX.utils.aoa_to_sheet(summary),ws2=XLSX.utils.aoa_to_sheet(details);
    ws1['!cols']=[{wch:28},{wch:25}];ws2['!cols']=[{wch:12},{wch:24},{wch:22},{wch:25},{wch:16},{wch:12},{wch:28},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws1,'Итог');XLSX.utils.book_append_sheet(wb,ws2,'Начисления');
    XLSX.writeFile(wb,'Зарплата_'+name.replace(/[^\p{L}\p{N}_-]+/gu,'_')+'_'+S.month+'.xlsx');
  }

  function renderPayments(){
    const box=q('salaryPayments');if(!box||!manager())return;
    box.innerHTML=
      '<div class="salary-card"><div class="salary-head"><div><h2>Добавить поступление / событие</h2><p>Фиксируй фактические поступления. Система сама определит мотивацию.</p></div><span class="salary-pill blue">РУКОВОДИТЕЛЬ</span></div><div class="salary-body">'+
        '<div class="salary-form-grid">'+
          '<div class="salary-field"><label>Дата</label><input id="salPayDate" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
          '<div class="salary-field"><label>Клиент</label><select id="salPayClient">'+clientOptions()+'</select></div>'+
          '<div class="salary-field"><label>Направление</label><select id="salPayProduct">'+productOptions()+'</select></div>'+
          '<div class="salary-field"><label>Событие</label><select id="salPayEvent"><option value="payment">Поступление</option><option value="site_live">Выход сайта в ЖР</option></select></div>'+
          '<div class="salary-field"><label>Сумма</label><input id="salPayAmount" type="number" min="0" step="0.01" placeholder="0"></div>'+
          '<div class="salary-field"><label>№ платежа</label><input id="salPayNumber" type="number" min="1" placeholder="1"></div>'+
          '<div class="salary-field"><label>Статус</label><select id="salPayStatus"><option value="confirmed">Подтверждено</option><option value="preliminary">Предварительно</option><option value="paid">Выплачено</option></select></div>'+
          '<div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salPayAdd">Добавить</button></div>'+
        '</div><div id="salPayPreview" class="salary-callout good" style="margin-top:10px">Выбери клиента и направление — здесь появится расчёт мотивации.</div>'+
      '</div></div>'+
      '<div class="salary-card"><div class="salary-head"><div><h2>Реестр поступлений</h2><p>Все записи за '+esc(monthName(S.month))+'.</p></div><div class="salary-actions">'+monthControl('salaryPayMonth')+'<label class="btn">Импорт Excel<input id="salPayImport" type="file" accept=".xlsx,.xls" hidden></label></div></div><div class="salary-body">'+paymentsTable()+'</div></div>';
    bindMonth('salaryPayMonth');
    ['salPayClient','salPayProduct','salPayEvent','salPayAmount','salPayNumber','salPayDate'].forEach(id=>q(id)?.addEventListener('input',paymentPreview));
    q('salPayAdd')?.addEventListener('click',addPayment);
    q('salPayImport')?.addEventListener('change',e=>importPayments(e.target.files?.[0]));
    paymentPreview();
  }

  function paymentPreview(){
    const cid=q('salPayClient')?.value,type=q('salPayProduct')?.value,event=q('salPayEvent')?.value||'payment',date=q('salPayDate')?.value,amount=Number(q('salPayAmount')?.value||0),num=Number(q('salPayNumber')?.value||1);
    const c=client(cid),prod=product(cid,type),cfg=PRODUCTS[type];if(!c||!cfg){if(q('salPayPreview'))q('salPayPreview').textContent='Сначала добавь клиента и направление в базе.';return}
    let txt='';
    if(event==='site_live'&&type==='site')txt='Выход сайта в ЖР → фикс 4 025 ₽ контрактору '+profileName(c.contractor_id)+'.';
    else if(type==='maps')txt='Продажа 2ГИС + Яндекс → фикс 6 000 ₽ контрактору '+profileName(c.contractor_id)+'.';
    else if(type==='site'||type==='site_support'){const r=num===1?.11:.0805;txt=money(amount)+' × '+(r*100).toLocaleString('ru-RU')+'% = '+money(amount*r)+' контрактору '+profileName(c.contractor_id)+'.';}
    else if(cfg.period){
      if(!prod?.first_payment_date)txt='Это может быть первая оплата направления. После сохранения дата запустит 12-месячный период.';
      else if(active12(prod.first_payment_date,date))txt=money(amount)+' × '+(cfg.rate*100).toLocaleString('ru-RU')+'% = '+money(amount*cfg.rate)+' контрактору '+profileName(c.contractor_id)+' · '+monthIndex(prod.first_payment_date,date)+' месяц из 12.';
      else if(type==='campbox')txt='12 месяцев менеджера завершены → '+money(amount)+' × 1% = '+money(amount*.01)+' руководителю продаж.';
      else txt='12-месячный период менеджера завершён. По этому направлению начисление не создаётся.';
    }
    q('salPayPreview').innerHTML='<b>Предпросмотр:</b> '+esc(txt);
  }

  function paymentsTable(){
    if(!S.payments.length)return '<div class="salary-empty">За выбранный месяц поступлений нет.</div>';
    return '<div class="salary-table-wrap"><table class="salary-table"><thead><tr><th>Дата</th><th>Клиент</th><th>Направление</th><th>Событие</th><th>Сумма</th><th>№</th><th>Контрактор</th><th>Статус</th><th></th></tr></thead><tbody>'+
      S.payments.map(p=>{const c=client(p.client_id);return '<tr><td>'+dateRu(p.payment_date)+'</td><td>'+esc(c?.client_name||'—')+'</td><td>'+esc(PRODUCTS[p.product_type]?.short||p.product_type)+'</td><td>'+esc(p.event_type==='site_live'?'Выход в ЖР':'Поступление')+'</td><td>'+money(p.amount)+'</td><td>'+(p.payment_number||'—')+'</td><td>'+esc(profileName(c?.contractor_id))+'</td><td>'+statusPill(p.status)+'</td><td><button class="btn danger" data-sal-del-payment="'+esc(p.id)+'">Удалить</button></td></tr>'}).join('')+
      '</tbody></table></div>';
  }

  async function addPayment(){
    const cid=q('salPayClient')?.value,type=q('salPayProduct')?.value,event=q('salPayEvent')?.value,date=q('salPayDate')?.value,amount=Number(q('salPayAmount')?.value||0),num=Number(q('salPayNumber')?.value||0)||null,status=q('salPayStatus')?.value||'confirmed';
    if(!cid||!type||!date){alert('Заполни дату, клиента и направление.');return}
    if(event==='payment'&&amount<=0){alert('Для поступления сумма должна быть больше 0.');return}
    if(event==='site_live'&&type!=='site'){alert('Событие «Выход сайта в ЖР» доступно только для разработки сайта.');return}
    const duplicate=S.payments.some(p=>p.client_id===cid&&p.product_type===type&&p.payment_date===date&&p.event_type===event&&Number(p.amount)===amount&&Number(p.payment_number||0)===Number(num||0));
    if(duplicate&&!confirm('Похожая запись уже есть. Всё равно добавить?'))return;
    const row={payment_date:date,client_id:cid,product_type:type,event_type:event,amount:event==='site_live'?0:amount,payment_number:event==='site_live'?null:num,status,created_by:currentUser.id,updated_at:new Date().toISOString()};
    const {error}=await sb.from('salary_payments').insert(row);if(error){alert(error.message);return}
    if(event==='payment'){
      const prod=product(cid,type);
      if(prod&&!prod.first_payment_date){
        await sb.from('salary_client_products').update({first_payment_date:date,updated_at:new Date().toISOString()}).eq('id',prod.id);
      }
    }
    await load();
  }

  document.addEventListener('click',async e=>{
    const id=e.target.closest('[data-sal-del-payment]')?.dataset.salDelPayment;if(!id)return;
    if(!manager()||!confirm('Удалить поступление? История удаления сохранится в аудите.'))return;
    const {error}=await sb.from('salary_payments').delete().eq('id',id);if(error)alert(error.message);else load();
  });

  function renderClients(){
    const box=q('salaryClients');if(!box||!manager())return;
    box.innerHTML=
      '<div class="salary-grid2">'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Добавить клиента</h2><p>Дата подписания используется только для разового контракторского фикса.</p></div></div><div class="salary-body"><div class="salary-form-grid">'+
          '<div class="salary-field"><label>Клиент</label><input id="salClientName" placeholder="Название лагеря"></div>'+
          '<div class="salary-field"><label>Контрактор</label><select id="salClientContractor">'+employeeOptions(currentUser.id)+'</select></div>'+
          '<div class="salary-field"><label>Дата подписания</label><input id="salClientSigned" type="date"></div>'+
          '<div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salClientAdd">Добавить клиента</button></div>'+
        '</div></div></div>'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Добавить направление</h2><p>Первая оплата задаёт начало 12 месяцев для CampBox и модулей.</p></div></div><div class="salary-body"><div class="salary-form-grid">'+
          '<div class="salary-field"><label>Клиент</label><select id="salProdClient">'+clientOptions()+'</select></div>'+
          '<div class="salary-field"><label>Направление</label><select id="salProdType">'+productOptions()+'</select></div>'+
          '<div class="salary-field"><label>Первая оплата</label><input id="salProdFirst" type="date"></div>'+
          '<div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salProdAdd">Добавить направление</button></div>'+
        '</div></div></div>'+
      '</div>'+
      '<div class="salary-card"><div class="salary-head"><div><h2>База клиентов и мотивации</h2><p>Текущая база контракторов и первых оплат.</p></div><label class="btn">Импорт Excel<input id="salClientImport" type="file" accept=".xlsx,.xls" hidden></label></div><div class="salary-body">'+clientsTable()+'</div></div>';
    q('salClientAdd')?.addEventListener('click',addClient);
    q('salProdAdd')?.addEventListener('click',addProduct);
    q('salClientImport')?.addEventListener('change',e=>importClients(e.target.files?.[0]));
  }

  function clientsTable(){
    if(!S.clients.length)return '<div class="salary-empty">Клиентская база пока пустая.</div>';
    return '<div class="salary-table-wrap"><table class="salary-table"><thead><tr><th>Клиент</th><th>Контрактор</th><th>Подписание</th><th>Контракторский фикс</th><th>Направления / первая оплата</th><th>12 месяцев</th></tr></thead><tbody>'+
      S.clients.map(c=>{
        const ps=S.products.filter(p=>p.client_id===c.id),signedMonth=c.signed_date?.slice(0,7),bonus=signedMonth===S.month?Number(S.dept?.contractor_rate||0):null;
        const productText=ps.length?ps.map(p=>'<div style="margin-bottom:4px"><span class="salary-pill blue">'+esc(PRODUCTS[p.product_type]?.short||p.product_type)+'</span> '+(p.first_payment_date?dateRu(p.first_payment_date):'<span style="color:#8395b2">первая оплата не указана</span>')+'</div>').join(''):'—';
        const periods=ps.filter(p=>p.first_payment_date&&PRODUCTS[p.product_type]?.period).map(p=>{const end=addMonthsIso(p.first_payment_date,12);return PRODUCTS[p.product_type].short+': '+(S.month+'-28'<end?'активно до '+dateRu(end):'завершено')}).join('<br>')||'—';
        return '<tr><td><b>'+esc(c.client_name)+'</b></td><td>'+esc(profileName(c.contractor_id))+'</td><td>'+dateRu(c.signed_date)+'</td><td>'+(c.signed_date?(bonus!==null?(bonus?money(bonus):'0 ₽'):'считается в месяце подписания'):'—')+'</td><td>'+productText+'</td><td>'+periods+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  async function addClient(){
    const name=q('salClientName')?.value.trim(),contractor=q('salClientContractor')?.value,signed=q('salClientSigned')?.value||null;
    if(!name||!contractor){alert('Укажи клиента и контрактора.');return}
    if(S.clients.some(c=>c.client_name.trim().toLowerCase()===name.toLowerCase())&&!confirm('Клиент с похожим названием уже есть. Добавить ещё одного?'))return;
    const {error}=await sb.from('salary_clients').insert({client_name:name,contractor_id:contractor,signed_date:signed,created_by:currentUser.id,updated_at:new Date().toISOString()});
    if(error)alert(error.message);else load();
  }
  async function addProduct(){
    const cid=q('salProdClient')?.value,type=q('salProdType')?.value,first=q('salProdFirst')?.value||null;
    if(!cid||!type){alert('Выбери клиента и направление.');return}
    const {error}=await sb.from('salary_client_products').upsert({client_id:cid,product_type:type,first_payment_date:first,active:true,updated_at:new Date().toISOString()},{onConflict:'client_id,product_type'});
    if(error)alert(error.message);else load();
  }

  function renderTeam(){
    const box=q('salaryTeam');if(!box||!manager())return;
    const active=(typeof profiles!=='undefined'?profiles:[]).filter(p=>p.active!==false),rows=active.map(p=>({p,rows:salaryFor(p.id)}));
    const all=rows.reduce((a,x)=>a+totals(x.rows).total,0),contract=rows.reduce((a,x)=>a+totals(x.rows).contract,0),comm=rows.reduce((a,x)=>a+totals(x.rows).campbox,0),head=rows.reduce((a,x)=>a+totals(x.rows).head,0);
    box.innerHTML='<div class="salary-card"><div class="salary-head"><div><h2>Команда · '+esc(monthName(S.month))+'</h2><p>ФОТ и расшифровка по каждому сотруднику.</p></div>'+monthControl('salaryTeamMonth')+'</div><div class="salary-body">'+
      '<div class="salary-kpis"><div class="salary-kpi good"><span>ФОТ продаж</span><b>'+money(all)+'</b></div><div class="salary-kpi"><span>Контракторство</span><b>'+money(contract)+'</b></div><div class="salary-kpi good"><span>CampBox</span><b>'+money(comm)+'</b></div><div class="salary-kpi"><span>Сотрудников</span><b>'+rows.length+'</b></div><div class="salary-kpi warn"><span>1% руководителю</span><b>'+money(head)+'</b></div></div>'+
      '<div class="salary-team-cards">'+rows.map(x=>{const t=totals(x.rows);return '<div class="salary-person"><h3>'+esc(x.p.full_name||x.p.email||'Сотрудник')+'</h3><div class="sum">'+money(t.total)+'</div><small>'+x.rows.length+' начислений</small><div class="salary-breakdown"><div><span>Контракторство</span><b>'+money(t.contract)+'</b></div><div><span>CampBox</span><b>'+money(t.campbox)+'</b></div><div><span>Остальное</span><b>'+money(t.products+t.site+t.head)+'</b></div></div></div>'}).join('')+'</div>'+
    '</div></div>';
    bindMonth('salaryTeamMonth');
  }

  function renderRules(){
    const box=q('salaryRules');if(!box||!manager())return;
    const head=S.config?.sales_head_id||'';
    box.innerHTML=
      '<div class="salary-card"><div class="salary-head"><div><h2>Настройки мотивации</h2><p>Правила V1 и получатель управленческого 1%.</p></div></div><div class="salary-body">'+
        '<div class="salary-form-grid" style="margin-bottom:10px"><div class="salary-field"><label>Руководитель продаж · получатель 1%</label><select id="salaryHeadSelect"><option value="">Не выбран</option>'+employeeOptions(head)+'</select></div><div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salaryHeadSave">Сохранить</button></div></div>'+
        '<div class="salary-rule-list">'+
          rule('Контракторство','Разово за договор. Ставка по выполнению плана отдела в месяце подписания.','<80% = 0 ₽ · 80–99,99% = 2 000 ₽ · 100–103% = 5 000 ₽ · >103% = 7 000 ₽','1 раз')+
          rule('2ГИС + Яндекс','Стоимость продукта 15 000 ₽.','15 000 × 40% = 6 000 ₽','40%')+
          rule('CampBox / комиссия','От каждой оплаты в течение 12 месяцев от первой комиссии.','платёж × 10%','12 мес.')+
          rule('Order Management','От каждой оплаты в течение 12 месяцев от первой оплаты модуля.','платёж × 8,05%','12 мес.')+
          rule('Comfort Booking','От каждой оплаты в течение 12 месяцев от первой оплаты.','платёж × 8,05%','12 мес.')+
          rule('Разработка сайта','Первый платёж / следующие / выход в ЖР.','№1 = 11% · №2+ = 8,05% · ЖР = 4 025 ₽','по событиям')+
          rule('Сопровождение сайта','Первый и последующие платежи.','№1 = 11% · №2+ = 8,05%','по платежам')+
          rule('Руководитель продаж','CampBox после окончания 12 месяцев менеджера.','комиссия × 1%','после 12 мес.')+
        '</div><div class="salary-callout warn" style="margin-top:10px"><b>Защита:</b> контракторский фикс возникает только в месяце подписания. Один CampBox-платёж не даёт одновременно 10% менеджеру и 1% руководителю.</div>'+
      '</div></div>';
    q('salaryHeadSave')?.addEventListener('click',saveHead);
  }
  function rule(name,desc,formula,badge){return '<div class="salary-rule"><div><b>'+esc(name)+'</b><small>'+esc(desc)+'</small></div><code>'+esc(formula)+'</code><span class="salary-pill blue">'+esc(badge)+'</span></div>'}
  async function saveHead(){
    const id=q('salaryHeadSelect')?.value||null;
    const {error}=await sb.from('salary_config').upsert({id:1,sales_head_id:id,updated_by:currentUser.id,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)alert(error.message);else load();
  }

  function renderHistory(){
    const box=q('salaryHistory');if(!box||!manager())return;
    box.innerHTML='<div class="salary-card"><div class="salary-head"><div><h2>История изменений</h2><p>Автоматический аудит изменений зарплатных данных.</p></div></div><div class="salary-body"><div class="salary-timeline">'+
      (S.audit.length?S.audit.map(a=>'<div class="salary-event"><time>'+new Date(a.created_at).toLocaleString('ru-RU')+'</time><div><b>'+esc(a.entity_type)+' · '+esc(a.action)+'</b><small>'+esc(a.entity_id||'')+'</small></div><span class="salary-pill blue">'+esc(profileName(a.actor_id))+'</span></div>').join(''):'<div class="salary-empty">История пока пустая.</div>')+
      '</div></div></div>';
  }

  async function importClients(file){
    if(!file||typeof XLSX==='undefined')return;
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){alert('Файл пустой.');return}
      let added=0;
      for(const r of rows){
        const name=String(r['Клиент']||r['client']||'').trim();if(!name)continue;
        const contractorName=String(r['Контрактор']||r['contractor']||'').trim().toLowerCase();
        const prof=(profiles||[]).find(p=>String(p.full_name||p.email||'').trim().toLowerCase()===contractorName);
        if(!prof)continue;
        let c=S.clients.find(x=>x.client_name.trim().toLowerCase()===name.toLowerCase());
        if(!c){
          const ins=await sb.from('salary_clients').insert({client_name:name,contractor_id:prof.id,signed_date:excelDate(r['Дата подписания']||r['signed_date']),created_by:currentUser.id}).select('*').single();
          if(ins.error)continue;c=ins.data;S.clients.push(c);added++;
        }
        const rawType=String(r['Направление']||r['product']||'').trim();const type=parseProduct(rawType);
        if(type){
          await sb.from('salary_client_products').upsert({client_id:c.id,product_type:type,first_payment_date:excelDate(r['Первая оплата']||r['first_payment_date']),active:true},{onConflict:'client_id,product_type'});
        }
      }
      alert('Импорт завершён. Добавлено новых клиентов: '+added);load();
    }catch(e){alert('Ошибка импорта: '+e.message)}
  }

  async function importPayments(file){
    if(!file||typeof XLSX==='undefined')return;
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''});let added=0;
      for(const r of rows){
        const name=String(r['Клиент']||r['client']||'').trim(),c=S.clients.find(x=>x.client_name.trim().toLowerCase()===name.toLowerCase());if(!c)continue;
        const type=parseProduct(String(r['Направление']||r['product']||''));if(!type)continue;
        const date=excelDate(r['Дата']||r['payment_date']);if(!date)continue;
        const event=String(r['Событие']||'').toLowerCase().includes('жр')?'site_live':'payment';
        const amount=event==='site_live'?0:Number(r['Сумма']||r['amount']||0),num=Number(r['Номер оплаты']||r['payment_number']||0)||null;
        const ins=await sb.from('salary_payments').insert({payment_date:date,client_id:c.id,product_type:type,event_type:event,amount,payment_number:num,status:'confirmed',created_by:currentUser.id});
        if(!ins.error){added++;const prod=product(c.id,type);if(prod&&!prod.first_payment_date&&event==='payment')await sb.from('salary_client_products').update({first_payment_date:date}).eq('id',prod.id);}
      }
      alert('Импортировано поступлений: '+added);load();
    }catch(e){alert('Ошибка импорта: '+e.message)}
  }

  function parseProduct(v){
    const s=String(v||'').toLowerCase();
    if(s.includes('order')||s.includes('управлен')||s==='om')return 'order_management';
    if(s.includes('comfort')||s.includes('комфорт'))return 'comfort_booking';
    if(s.includes('2гис')||s.includes('яндекс')||s.includes('карт'))return 'maps';
    if(s.includes('сопровожд'))return 'site_support';
    if(s.includes('сайт'))return 'site';
    if(s.includes('campbox')||s.includes('комисс'))return 'campbox';
    return null;
  }
  function excelDate(v){
    if(!v)return null;
    if(typeof v==='number'&&typeof XLSX!=='undefined'){const d=XLSX.SSF.parse_date_code(v);if(d)return [d.y,String(d.m).padStart(2,'0'),String(d.d).padStart(2,'0')].join('-')}
    const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);return m?[m[3],m[2].padStart(2,'0'),m[1].padStart(2,'0')].join('-'):null;
  }

  function init(){
    if(!ensureRoot())return;
    load();
  }
  window.salaryRefresh=function(){
    if(!S.ready)ensureRoot();
    const wanted=isoMonth(typeof selectedMonth!=='undefined'?selectedMonth:S.month);
    if(!S.month)S.month=wanted;
    applyRoles();
    if(screen()?.classList.contains('active'))load();
  };
  window.salaryOpen=function(){if(!S.ready)ensureRoot();load()};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
