
(function(){
  'use strict';

  const S={
    ready:false,loading:false,schemaReady:true,tab:'mine',clientView:'active',month:'',
    clients:[],contracts:[],pauses:[],products:[],payments:[],dept:null,audit:[],config:null,lastError:''
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
  function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function money(v){return Number(v||0).toLocaleString('ru-RU',{minimumFractionDigits:Number(v||0)%1?2:0,maximumFractionDigits:2})+' ₽'}
  function round2(v){return Math.round((Number(v||0)+Number.EPSILON)*100)/100}
  function isoMonth(v){return /^\d{4}-\d{2}$/.test(v||'')?v:(typeof selectedMonth!=='undefined'&&selectedMonth?selectedMonth:new Date().toISOString().slice(0,7))}
  function monthStartIso(m){return m+'-01'}
  function nextMonthIso(m){const [y,mo]=m.split('-').map(Number);return new Date(Date.UTC(y,mo,1)).toISOString().slice(0,10)}
  function currentMonth(){const d=new Date(),z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,7)}
  function monthName(m){try{return new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(m+'-01T12:00:00')).replace(/^./,x=>x.toUpperCase())}catch(e){return m}}
  function todayIso(){const d=new Date(),z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,10)}
  function dateRu(v){if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?p.reverse().join('.'):String(v)}
  function dateObj(s){return new Date(String(s).slice(0,10)+'T00:00:00Z')}
  function addDaysIso(s,n){const d=dateObj(s);d.setUTCDate(d.getUTCDate()+Number(n||0));return d.toISOString().slice(0,10)}
  function addMonthsIso(s,n){const [y,m,d]=String(s).slice(0,10).split('-').map(Number);const x=new Date(Date.UTC(y,m-1+n,d));return x.toISOString().slice(0,10)}
  function diffDaysInclusive(a,b){return Math.max(0,Math.floor((dateObj(b)-dateObj(a))/86400000)+1)}
  function maxDate(a,b){return !a?b:!b?a:(a>b?a:b)}
  function contractorRate(pct){pct=Number(pct)||0;if(pct<80)return 0;if(pct<100)return 2000;if(pct<=103)return 5000;return 7000}
  function vatRate(){const v=Number(S.config?.vat_rate);return Number.isFinite(v)&&v>=0?v:22}
  function netOfVat(gross){const k=1+vatRate()/100;return k>0?Number(gross||0)/k:Number(gross||0)}
  function manager(){try{return typeof isManager==='function'&&isManager()}catch(e){return false}}
  function profileName(id){const p=(typeof profiles!=='undefined'?profiles:[]).find(x=>x.id===id);return p?(p.full_name||p.email||'Сотрудник'):'—'}
  function client(id){return S.clients.find(x=>x.id===id)}
  function contract(id){return S.contracts.find(x=>x.id===id)}
  function contractClient(c){return c?client(c.client_id):null}
  function contractProducts(id){return S.products.filter(x=>x.contract_id===id)}
  function product(contractId,type){return S.products.find(x=>x.contract_id===contractId&&x.product_type===type)}
  function contractPauses(id){return S.pauses.filter(x=>x.contract_id===id).sort((a,b)=>String(a.pause_start).localeCompare(String(b.pause_start)))}
  function openPause(id){return contractPauses(id).filter(x=>!x.resumed_at).sort((a,b)=>String(b.pause_start).localeCompare(String(a.pause_start)))[0]||null}
  function pauseEnd(p){
    if(!p)return null;
    if(p.resumed_at){
      const x=addDaysIso(p.resumed_at,-1);
      return x>=p.pause_start?x:null;
    }
    return p.pause_until;
  }
  function pausedOn(contractId,date){
    return contractPauses(contractId).some(p=>{
      const end=pauseEnd(p);return !!end&&date>=p.pause_start&&date<=end;
    });
  }
  function commissionEnd(first,contractId){
    if(!first)return null;
    let end=addMonthsIso(first,12);
    contractPauses(contractId).forEach(p=>{
      const pe=pauseEnd(p);if(!pe)return;
      const ps=maxDate(p.pause_start,first);
      if(pe<ps||ps>=end)return;
      end=addDaysIso(end,diffDaysInclusive(ps,pe));
    });
    return end;
  }
  function contractValidOn(c,date){
    if(!c||!date)return false;
    if(c.signed_date&&date<c.signed_date)return false;
    if(c.terminated_date&&date>c.terminated_date)return false;
    if(pausedOn(c.id,date))return false;
    return true;
  }
  function commissionState(prod,c,date){
    if(!prod?.first_payment_date)return 'no_start';
    if(date<prod.first_payment_date)return 'before_start';
    if(c?.terminated_date&&date>c.terminated_date)return 'terminated';
    if(pausedOn(c.id,date))return 'paused';
    const end=commissionEnd(prod.first_payment_date,c.id);
    return date<end?'active':'expired';
  }
  function monthIndexActive(prod,c,date){
    if(!prod?.first_payment_date)return null;
    const first=dateObj(prod.first_payment_date),cur=dateObj(date);
    let days=Math.max(0,Math.floor((cur-first)/86400000));
    contractPauses(c.id).forEach(p=>{
      const pe=pauseEnd(p);if(!pe)return;
      const from=maxDate(p.pause_start,prod.first_payment_date),to=pe<date?pe:date;
      if(to>=from)days-=diffDaysInclusive(from,to);
    });
    return Math.min(12,Math.max(1,Math.floor(days/30.4375)+1));
  }
  function contractStatusLabel(c){
    if(c.status==='terminated')return 'Расторгнут';
    if(c.status==='paused'){
      const p=openPause(c.id);
      return p?'Пауза до '+dateRu(p.pause_until):'На паузе';
    }
    return 'Активный';
  }
  function statusPill(status){
    const tone=status==='paid'||status==='Выплачено'?'good':status==='confirmed'||status==='Подтверждено'?'good':status==='excluded'?'bad':'warn';
    const label={paid:'Выплачено',confirmed:'Подтверждено',preliminary:'Предварительно',excluded:'Исключено'}[status]||status;
    return '<span class="salary-pill '+tone+'">'+esc(label)+'</span>';
  }
  function contractPill(c){
    const tone=c.status==='active'?'good':c.status==='paused'?'warn':'bad';
    return '<span class="salary-pill '+tone+'">'+esc(contractStatusLabel(c))+'</span>';
  }
  function productOptions(selected=''){
    return Object.entries(PRODUCTS).map(([k,v])=>'<option value="'+k+'" '+(k===selected?'selected':'')+'>'+esc(v.label)+'</option>').join('');
  }
  function employeeOptions(selected=''){
    return (typeof profiles!=='undefined'?profiles:[]).filter(p=>p.active!==false).map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.full_name||p.email||'Сотрудник')+'</option>').join('');
  }
  function contractOptions(selected='',includeTerminated=false){
    return S.contracts.filter(c=>includeTerminated||c.status!=='terminated').sort((a,b)=>String(contractClient(a)?.client_name||'').localeCompare(String(contractClient(b)?.client_name||''),'ru')).map(c=>{
      const cc=contractClient(c);return '<option value="'+esc(c.id)+'" '+(c.id===selected?'selected':'')+'>'+esc((cc?.client_name||'Без названия')+' · '+dateRu(c.signed_date)+' · '+contractStatusLabel(c))+'</option>';
    }).join('');
  }

  function screen(){return q('v13-salary')}

  function ensureRoot(){
    const root=screen();if(!root||S.ready)return false;
    S.ready=true;S.month=isoMonth('');
    root.innerHTML=
      '<div class="salary-tabs" id="salaryTabs">'+
        '<button data-salary-tab="mine" class="active">Моя зарплата</button>'+
        '<button data-salary-tab="payments" class="salary-manager-only">Поступления</button>'+
        '<button data-salary-tab="clients" class="salary-manager-only">База клиентов</button>'+
        '<button data-salary-tab="team" class="salary-manager-only">Команда</button>'+
        '<button data-salary-tab="rules" class="salary-manager-only">Настройки мотивации</button>'+
        '<button data-salary-tab="history" class="salary-manager-only">История изменений</button>'+
      '</div>'+
      '<div id="salarySetup" class="salary-setup hidden"><h3>Нужно обновить таблицы Salary</h3><p>Интерфейс договорных циклов уже установлен, но Supabase ещё не обновлён. Выполни актуальный файл <b>salary_v1_migration.sql</b> целиком в SQL Editor. Он сохранит старую историю и автоматически перенесёт существующих клиентов в первый договорный цикл.</p></div>'+
      '<div id="salaryMine" class="salary-panel active"></div>'+
      '<div id="salaryPayments" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryClients" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryTeam" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryRules" class="salary-panel salary-manager-only"></div>'+
      '<div id="salaryHistory" class="salary-panel salary-manager-only"></div>';
    q('salaryTabs').addEventListener('click',e=>{
      const b=e.target.closest('[data-salary-tab]');if(!b)return;S.tab=b.dataset.salaryTab;renderTabs();
    });
    applyRoles();return true;
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
      const checks=await Promise.all([
        sb.from('salary_contracts').select('id').limit(1),
        sb.from('salary_contract_pauses').select('id').limit(1),
        sb.from('salary_client_products').select('id,contract_id').limit(1),
        sb.from('salary_payments').select('id,contract_id').limit(1)
      ]);
      const bad=checks.find(x=>x.error);if(bad?.error)throw bad.error;
      S.schemaReady=true;S.lastError='';
    }catch(e){S.schemaReady=false;S.lastError=e?.message||String(e)}
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
    if(!ensureRoot()&&!S.ready)return;
    if(typeof sb==='undefined'||!sb||typeof currentUser==='undefined'||!currentUser)return;
    if(S.loading)return;S.loading=true;
    try{
      const ok=await schemaProbe();if(!ok){renderAll();return}
      await syncDepartmentMonth();
      const first=monthStartIso(S.month),next=nextMonthIso(S.month);
      const tasks=[
        sb.from('salary_clients').select('*').order('client_name'),
        sb.from('salary_contracts').select('*').order('signed_date',{ascending:false}),
        sb.from('salary_contract_pauses').select('*').order('pause_start',{ascending:false}),
        sb.from('salary_client_products').select('*').eq('active',true),
        sb.from('salary_payments').select('*').gte('payment_date',first).lt('payment_date',next).order('payment_date',{ascending:false}),
        sb.from('salary_department_months').select('*').eq('month',first).maybeSingle(),
        sb.from('salary_config').select('*').eq('id',1).maybeSingle()
      ];
      if(manager())tasks.push(sb.from('salary_audit').select('*').order('created_at',{ascending:false}).limit(150));
      const res=await Promise.all(tasks);for(const r of res){if(r.error)throw r.error}
      S.clients=res[0].data||[];S.contracts=res[1].data||[];S.pauses=res[2].data||[];S.products=res[3].data||[];S.payments=res[4].data||[];S.dept=res[5].data||S.dept;S.config=res[6].data||null;S.audit=manager()?(res[7]?.data||[]):[];
      renderAll();
    }catch(e){
      console.error('Salary cycles load',e);S.lastError=e?.message||String(e);
      if((S.lastError||'').toLowerCase().includes('salary_')||(S.lastError||'').toLowerCase().includes('contract_id'))S.schemaReady=false;
      renderAll();
    }finally{S.loading=false}
  }

  function renderAll(){if(!S.ready)return;applyRoles();renderTabs()}
  function monthControl(id){return '<div class="salary-field"><label>Месяц</label><input id="'+id+'" type="month" value="'+esc(S.month)+'"></div>'}
  function bindMonth(id){q(id)?.addEventListener('change',e=>{S.month=isoMonth(e.target.value);load()})}

  function paymentAccrual(p,cnt,userId){
    if(!cnt||p.status==='excluded'||cnt.contractor_id!==userId)return null;
    const cc=contractClient(cnt),cfg=PRODUCTS[p.product_type],prod=product(cnt.id,p.product_type);if(!cc||!cfg)return null;
    if(!contractValidOn(cnt,p.payment_date))return null;
    let amount=0,rate='',formula='',note='',base=Number(p.amount||0),gross=null;

    if(cfg.period){
      const state=commissionState(prod,cnt,p.payment_date);if(state!=='active')return null;
      if(p.product_type==='campbox'){
        gross=Number(p.amount||0);base=round2(netOfVat(gross));amount=round2(base*.10);rate='10%';
        formula=money(gross)+' / '+(1+vatRate()/100).toLocaleString('ru-RU')+' = '+money(base)+' × 10%';
        note='Поступление с НДС '+money(gross)+' · НДС '+vatRate().toLocaleString('ru-RU')+'% · '+monthIndexActive(prod,cnt,p.payment_date)+' месяц из 12';
      }else{
        amount=round2(base*cfg.rate);rate=(cfg.rate*100).toLocaleString('ru-RU')+'%';formula=money(base)+' × '+rate;
        note=monthIndexActive(prod,cnt,p.payment_date)+' месяц из 12';
      }
    }else if(p.product_type==='maps'){
      if(p.event_type!=='payment')return null;amount=6000;rate='40%';formula='15 000 ₽ × 40%';
    }else if(p.product_type==='site'){
      if(p.event_type==='site_live'){base=0;amount=4025;rate='4 025 ₽';formula='фикс за выход сайта в ЖР'}
      else {const r=Number(p.payment_number||1)===1?.11:.0805;amount=round2(base*r);rate=(r*100).toLocaleString('ru-RU')+'%';formula=money(base)+' × '+rate}
    }else if(p.product_type==='site_support'){
      if(p.event_type!=='payment')return null;const r=Number(p.payment_number||1)===1?.11:.0805;amount=round2(base*r);rate=(r*100).toLocaleString('ru-RU')+'%';formula=money(base)+' × '+rate;
    }
    if(amount<=0)return null;
    return {date:p.payment_date,client:cc.client_name,direction:cfg.short,event:p.event_type==='site_live'?'Выход сайта в ЖР':'Поступление'+(p.payment_number?' №'+p.payment_number:''),base,rate,formula,amount,status:p.status,payment_id:p.id,note,gross,contract_id:cnt.id,contract_signed:cnt.signed_date};
  }

  function salaryFor(userId){
    const rows=[],dept=S.dept||{contractor_rate:0,completion_pct:0,finalized:false};

    S.contracts.filter(c=>c.contractor_id===userId&&c.signed_date&&c.signed_date.slice(0,7)===S.month).forEach(c=>{
      const rate=Number(dept.contractor_rate||0),cc=contractClient(c);
      if(rate>0&&cc)rows.push({date:c.signed_date,client:cc.client_name,direction:'Контракторство',event:'Договор подписан',base:0,rate:money(rate),formula:'1 договор × '+money(rate),amount:rate,status:dept.finalized?'confirmed':'preliminary',note:'Выполнение отдела '+Number(dept.completion_pct||0).toLocaleString('ru-RU')+'% · договорный цикл '+dateRu(c.signed_date),contract_id:c.id,contract_signed:c.signed_date});
    });

    S.payments.forEach(p=>{
      const cnt=contract(p.contract_id),a=paymentAccrual(p,cnt,userId);if(a)rows.push(a);
    });

    if(S.config?.sales_head_id===userId){
      S.payments.forEach(p=>{
        if(p.status==='excluded'||p.product_type!=='campbox'||p.event_type!=='payment')return;
        const cnt=contract(p.contract_id),cc=contractClient(cnt),prod=product(cnt?.id,'campbox');if(!cnt||!cc||!prod?.first_payment_date)return;
        if(!contractValidOn(cnt,p.payment_date))return;
        if(commissionState(prod,cnt,p.payment_date)==='expired'){
          const gross=Number(p.amount||0),base=round2(netOfVat(gross)),amount=round2(base*.01);
          rows.push({date:p.payment_date,client:cc.client_name,direction:'1% руководителю',event:'CampBox после 12 мес.',base,rate:'1%',formula:money(gross)+' / '+(1+vatRate()/100).toLocaleString('ru-RU')+' = '+money(base)+' × 1%',amount,status:p.status,payment_id:p.id,note:'Поступление с НДС '+money(gross)+' · период '+profileName(cnt.contractor_id)+' завершён с учётом пауз',gross,contract_id:cnt.id,contract_signed:cnt.signed_date});
        }
      });
    }
    rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));return rows;
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
    });return t;
  }

  function mineRows(){return salaryFor(currentUser.id)}

  function accrualTable(rows){
    if(!rows.length)return '<div class="salary-empty">За выбранный месяц начислений нет.</div>';
    return '<div class="salary-table-wrap"><table class="salary-table"><thead><tr><th>Дата</th><th>Клиент</th><th>Договор</th><th>Направление</th><th>Событие</th><th>База</th><th>Ставка</th><th>Формула</th><th>Начислено</th><th>Статус</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+dateRu(r.date)+'</td><td>'+esc(r.client)+'</td><td>'+dateRu(r.contract_signed)+'</td><td>'+esc(r.direction)+'</td><td>'+esc(r.event)+(r.note?'<br><small style="color:#8395b2">'+esc(r.note)+'</small>':'')+'</td><td>'+(r.base?money(r.base):'—')+'</td><td>'+esc(r.rate)+'</td><td>'+esc(r.formula)+'</td><td><b>'+money(r.amount)+'</b></td><td>'+statusPill(r.status)+'</td></tr>').join('')+
      '</tbody></table></div>';
  }

  function renderMine(){
    const box=q('salaryMine');if(!box)return;if(!S.schemaReady){box.innerHTML='';return}
    const rows=mineRows(),t=totals(rows),status=S.month<currentMonth()?'Закрытый период':'Предварительно';
    const myContracts=S.contracts.filter(c=>c.contractor_id===currentUser.id);
    const activeProducts=S.products.filter(p=>{
      const c=contract(p.contract_id);if(!c||c.contractor_id!==currentUser.id||!p.first_payment_date||!PRODUCTS[p.product_type]?.period)return false;
      return S.month+'-28'<commissionEnd(p.first_payment_date,c.id) && (!c.terminated_date||S.month+'-28'<=c.terminated_date);
    });

    box.innerHTML=
      '<div class="salary-card"><div class="salary-head"><div><h2>Отчёт по зарплате</h2><p>Месяц, итог и полная расшифровка по договорным циклам.</p></div><span class="salary-pill blue">XLSX</span></div><div class="salary-body">'+
        '<div class="salary-toolbar">'+monthControl('salaryMineMonth')+'<div class="salary-field"><label>Сотрудник</label><input value="'+esc(profileName(currentUser.id))+'" disabled></div><button class="btn primary" id="salaryExcelBtn">Сформировать Excel</button></div>'+
        '<div class="salary-report-preview"><div><span>Период</span><b>'+esc(monthName(S.month))+'</b></div><div><span>Начислено</span><b>'+money(t.total)+'</b></div><div><span>Начислений</span><b>'+rows.length+'</b></div><div><span>Статус</span><b>'+status+'</b></div></div>'+
      '</div></div>'+
      '<div class="salary-kpis">'+
        '<div class="salary-kpi good"><span>Итого начислено</span><b>'+money(t.total)+'</b><small>за выбранный месяц</small></div>'+
        '<div class="salary-kpi"><span>Контракторство</span><b>'+money(t.contract)+'</b><small>разово за каждый новый договорный цикл</small></div>'+
        '<div class="salary-kpi good"><span>CampBox · 10%</span><b>'+money(t.campbox)+'</b><small>12 месяцев с учётом пауз</small></div>'+
        '<div class="salary-kpi"><span>Доп. продукты</span><b>'+money(t.products)+'</b><small>модули и карты</small></div>'+
        '<div class="salary-kpi warn"><span>Сайты / 1% РОП</span><b>'+money(t.site+t.head)+'</b><small>сайты, сопровождение, управленческий 1%</small></div>'+
      '</div>'+
      '<div class="salary-grid2">'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Расшифровка</h2><p>Пауза не съедает срок мотивации, новый договор запускает новый цикл.</p></div></div><div class="salary-body"><div class="salary-breakdown">'+
          '<div><span>Контракторство</span><b>'+money(t.contract)+'</b></div><div><span>CampBox</span><b>'+money(t.campbox)+'</b></div><div><span>Доп. продукты</span><b>'+money(t.products)+'</b></div><div><span>Сайты / сопровождение</span><b>'+money(t.site)+'</b></div><div><span>1% руководителю</span><b>'+money(t.head)+'</b></div>'+
        '</div></div></div>'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Активные 12-месячные периоды</h2><p>Срок автоматически продлевается на длительность пауз.</p></div></div><div class="salary-body"><div class="salary-timeline">'+
          (activeProducts.length?activeProducts.map(p=>{const c=contract(p.contract_id),cc=contractClient(c),end=commissionEnd(p.first_payment_date,c.id),idx=monthIndexActive(p,c,S.month+'-28');return '<div class="salary-event"><time>'+dateRu(p.first_payment_date)+'</time><div><b>'+esc(cc?.client_name||'')+' · '+esc(PRODUCTS[p.product_type]?.short||p.product_type)+'</b><small>договор '+dateRu(c.signed_date)+' · '+(c.status==='paused'?'мотивация на паузе':'месяц '+(idx||1)+' из 12')+'</small></div><span class="salary-pill '+(c.status==='paused'?'warn':'good')+'">до '+dateRu(end)+'</span></div>'}).join(''):'<div class="salary-empty">Нет активных 12-месячных периодов.</div>')+
        '</div></div></div>'+
      '</div>'+
      '<div class="salary-card"><div class="salary-head"><div><h2>Начисления за '+esc(monthName(S.month))+'</h2><p>Договорный цикл указан отдельно, поэтому повторное подключение не смешивается со старой историей.</p></div></div><div class="salary-body">'+accrualTable(rows)+'</div></div>';

    bindMonth('salaryMineMonth');q('salaryExcelBtn')?.addEventListener('click',exportMineExcel);
  }

  async function exportMineExcel(){
    const rows=mineRows(),t=totals(rows),name=profileName(currentUser.id);
    if(typeof XLSX==='undefined'){alert('Библиотека Excel не загрузилась. Обнови страницу и попробуй ещё раз.');return}
    const summary=[['Отчёт по зарплате CampBox'],['Сотрудник',name],['Период',monthName(S.month)],['Итого начислено',t.total],[],['Категория','Сумма'],['Контракторство',t.contract],['CampBox · 10%',t.campbox],['Доп. продукты',t.products],['Сайты / сопровождение',t.site],['1% руководителю',t.head]];
    const details=[['Дата','Клиент','Дата договора','Направление','Событие','Поступление с НДС','База расчёта','Ставка','Формула','Начислено','Статус'],
      ...rows.map(r=>[r.date,r.client,r.contract_signed||'',r.direction,r.event,r.gross??'',r.base,r.rate,r.formula,r.amount,{paid:'Выплачено',confirmed:'Подтверждено',preliminary:'Предварительно',excluded:'Исключено'}[r.status]||r.status])
    ];
    const wb=XLSX.utils.book_new(),ws1=XLSX.utils.aoa_to_sheet(summary),ws2=XLSX.utils.aoa_to_sheet(details);
    ws1['!cols']=[{wch:28},{wch:25}];ws2['!cols']=[{wch:12},{wch:25},{wch:14},{wch:22},{wch:26},{wch:18},{wch:16},{wch:12},{wch:36},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws1,'Итог');XLSX.utils.book_append_sheet(wb,ws2,'Начисления');
    XLSX.writeFile(wb,'Зарплата_'+name.replace(/[^\p{L}\p{N}_-]+/gu,'_')+'_'+S.month+'.xlsx');
  }

  function renderPayments(){
    const box=q('salaryPayments');if(!box||!manager())return;
    const contracts=S.contracts.filter(c=>c.status!=='terminated');
    box.innerHTML=
      '<div class="salary-card"><div class="salary-head"><div><h2>Добавить поступление / событие</h2><p>Поступление привязывается к конкретному договорному циклу.</p></div><span class="salary-pill blue">РУКОВОДИТЕЛЬ</span></div><div class="salary-body">'+
        (contracts.length?
        '<div class="salary-form-grid">'+
          '<div class="salary-field"><label>Дата</label><input id="salPayDate" type="date" value="'+todayIso()+'"></div>'+
          '<div class="salary-field"><label>Клиент / договор</label><select id="salPayContract">'+contractOptions()+'</select></div>'+
          '<div class="salary-field"><label>Направление</label><select id="salPayProduct">'+productOptions()+'</select></div>'+
          '<div class="salary-field"><label>Событие</label><select id="salPayEvent"><option value="payment">Поступление</option><option value="site_live">Выход сайта в ЖР</option></select></div>'+
          '<div class="salary-field"><label>Сумма</label><input id="salPayAmount" type="number" min="0" step="0.01" placeholder="0"></div>'+
          '<div class="salary-field"><label>№ платежа</label><input id="salPayNumber" type="number" min="1" placeholder="1"></div>'+
          '<div class="salary-field"><label>Статус</label><select id="salPayStatus"><option value="confirmed">Подтверждено</option><option value="preliminary">Предварительно</option><option value="paid">Выплачено</option></select></div>'+
          '<div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salPayAdd">Добавить</button></div>'+
        '</div><div id="salPayPreview" class="salary-callout good" style="margin-top:10px"></div>':
        '<div class="salary-empty">Сначала добавь активный договор в базе клиентов.</div>')+
      '</div></div>'+
      '<div class="salary-card"><div class="salary-head"><div><h2>Реестр поступлений</h2><p>Все записи за '+esc(monthName(S.month))+'.</p></div><div class="salary-actions">'+monthControl('salaryPayMonth')+'<label class="btn">Импорт Excel<input id="salPayImport" type="file" accept=".xlsx,.xls" hidden></label></div></div><div class="salary-body">'+paymentsTable()+'</div></div>';
    bindMonth('salaryPayMonth');
    ['salPayContract','salPayProduct','salPayEvent','salPayAmount','salPayNumber','salPayDate'].forEach(id=>q(id)?.addEventListener('input',paymentPreview));
    q('salPayAdd')?.addEventListener('click',addPayment);q('salPayImport')?.addEventListener('change',e=>importPayments(e.target.files?.[0]));paymentPreview();
  }

  function paymentPreview(){
    const contractId=q('salPayContract')?.value,type=q('salPayProduct')?.value,event=q('salPayEvent')?.value||'payment',date=q('salPayDate')?.value,amount=Number(q('salPayAmount')?.value||0),num=Number(q('salPayNumber')?.value||1);
    const cnt=contract(contractId),cc=contractClient(cnt),prod=product(contractId,type),cfg=PRODUCTS[type];if(!cnt||!cc||!cfg){if(q('salPayPreview'))q('salPayPreview').textContent='Сначала выбери договор.';return}
    let txt='';
    if(cnt.terminated_date&&date>cnt.terminated_date)txt='Договор расторгнут '+dateRu(cnt.terminated_date)+'. Начисление после расторжения не создаётся.';
    else if(pausedOn(cnt.id,date)){const p=contractPauses(cnt.id).find(x=>{const e=pauseEnd(x);return e&&date>=x.pause_start&&date<=e});txt='На дату платежа договор на паузе до '+dateRu(p?.pause_until)+'. Мотивация не начисляется, а 12-месячный срок заморожен.'}
    else if(event==='site_live'&&type==='site')txt='Выход сайта в ЖР → фикс 4 025 ₽ контрактору '+profileName(cnt.contractor_id)+'.';
    else if(type==='maps')txt='Продажа 2ГИС + Яндекс → фикс 6 000 ₽ контрактору '+profileName(cnt.contractor_id)+'.';
    else if(type==='site'||type==='site_support'){const r=num===1?.11:.0805;txt=money(amount)+' × '+(r*100).toLocaleString('ru-RU')+'% = '+money(amount*r)+' контрактору '+profileName(cnt.contractor_id)+'.'}
    else if(cfg.period){
      if(!prod?.first_payment_date)txt='Это первая оплата направления. После сохранения начнётся новый 12-месячный период этого договорного цикла.';
      else {
        const state=commissionState(prod,cnt,date);
        if(state==='active'){
          if(type==='campbox'){const base=round2(netOfVat(amount)),mot=round2(base*.10);txt='С НДС '+money(amount)+' → без НДС '+money(base)+' → 10% = '+money(mot)+' контрактору '+profileName(cnt.contractor_id)+' · '+monthIndexActive(prod,cnt,date)+' месяц из 12.'}
          else txt=money(amount)+' × '+(cfg.rate*100).toLocaleString('ru-RU')+'% = '+money(amount*cfg.rate)+' контрактору '+profileName(cnt.contractor_id)+' · '+monthIndexActive(prod,cnt,date)+' месяц из 12.';
        }else if(state==='expired'&&type==='campbox'){const base=round2(netOfVat(amount)),mot=round2(base*.01);txt='12 месяцев с учётом пауз завершены → без НДС '+money(base)+' → 1% = '+money(mot)+' руководителю продаж.'}
        else if(state==='paused')txt='На эту дату мотивационный период заморожен из-за паузы.';
        else txt='По этому направлению мотивация менеджеру уже не начисляется.';
      }
    }
    q('salPayPreview').innerHTML='<b>Предпросмотр:</b> '+esc(txt);
  }

  function paymentsTable(){
    if(!S.payments.length)return '<div class="salary-empty">За выбранный месяц поступлений нет.</div>';
    return '<div class="salary-table-wrap"><table class="salary-table"><thead><tr><th>Дата</th><th>Клиент</th><th>Договор</th><th>Направление</th><th>Событие</th><th>Сумма</th><th>№</th><th>Контрактор</th><th>Статус</th><th></th></tr></thead><tbody>'+
      S.payments.map(p=>{const cnt=contract(p.contract_id),cc=contractClient(cnt);return '<tr><td>'+dateRu(p.payment_date)+'</td><td>'+esc(cc?.client_name||'—')+'</td><td>'+dateRu(cnt?.signed_date)+'</td><td>'+esc(PRODUCTS[p.product_type]?.short||p.product_type)+'</td><td>'+esc(p.event_type==='site_live'?'Выход в ЖР':'Поступление')+'</td><td>'+money(p.amount)+'</td><td>'+(p.payment_number||'—')+'</td><td>'+esc(profileName(cnt?.contractor_id))+'</td><td>'+statusPill(p.status)+'</td><td><button class="btn danger" data-sal-del-payment="'+esc(p.id)+'">Удалить</button></td></tr>'}).join('')+
      '</tbody></table></div>';
  }

  async function addPayment(){
    const contractId=q('salPayContract')?.value,type=q('salPayProduct')?.value,event=q('salPayEvent')?.value,date=q('salPayDate')?.value,amount=Number(q('salPayAmount')?.value||0),num=Number(q('salPayNumber')?.value||0)||null,status=q('salPayStatus')?.value||'confirmed';
    const cnt=contract(contractId),cc=contractClient(cnt);
    if(!cnt||!cc||!type||!date){alert('Заполни дату, договор и направление.');return}
    if(cnt.status==='terminated'){alert('Нельзя добавить новое поступление в расторгнутый договор. Создай новый договорный цикл.');return}
    if(event==='payment'&&amount<=0){alert('Для поступления сумма должна быть больше 0.');return}
    if(event==='site_live'&&type!=='site'){alert('Выход сайта в ЖР доступен только для разработки сайта.');return}
    const duplicate=S.payments.some(p=>p.contract_id===contractId&&p.product_type===type&&p.payment_date===date&&p.event_type===event&&Number(p.amount)===amount&&Number(p.payment_number||0)===Number(num||0));
    if(duplicate&&!confirm('Похожая запись уже есть в этом договоре. Всё равно добавить?'))return;

    let prod=product(contractId,type);
    if(!prod){
      const ins=await sb.from('salary_client_products').insert({client_id:cc.id,contract_id:contractId,product_type:type,first_payment_date:event==='payment'?date:null,active:true}).select('*').single();
      if(ins.error){alert(ins.error.message);return}prod=ins.data;S.products.push(prod);
    }
    const row={payment_date:date,client_id:cc.id,contract_id:contractId,product_type:type,event_type:event,amount:event==='site_live'?0:amount,payment_number:event==='site_live'?null:num,status,created_by:currentUser.id,updated_at:new Date().toISOString()};
    const {error}=await sb.from('salary_payments').insert(row);if(error){alert(error.message);return}
    if(event==='payment'&&!prod.first_payment_date)await sb.from('salary_client_products').update({first_payment_date:date,updated_at:new Date().toISOString()}).eq('id',prod.id);
    await load();
  }

  document.addEventListener('click',async e=>{
    const del=e.target.closest('[data-sal-del-payment]')?.dataset.salDelPayment;
    if(del){if(manager()&&confirm('Удалить поступление? История удаления сохранится в аудите.')){const {error}=await sb.from('salary_payments').delete().eq('id',del);if(error)alert(error.message);else load()}return}

    const pause=e.target.closest('[data-contract-pause]')?.dataset.contractPause;
    if(pause){await pauseContract(pause);return}
    const resume=e.target.closest('[data-contract-resume]')?.dataset.contractResume;
    if(resume){await resumeContract(resume);return}
    const edit=e.target.closest('[data-contract-edit-pause]')?.dataset.contractEditPause;
    if(edit){await editPause(edit);return}
    const terminate=e.target.closest('[data-contract-terminate]')?.dataset.contractTerminate;
    if(terminate){await terminateContract(terminate);return}
    const renew=e.target.closest('[data-contract-renew]')?.dataset.contractRenew;
    if(renew){await renewContract(renew);return}
    const view=e.target.closest('[data-client-view]')?.dataset.clientView;
    if(view){S.clientView=view;renderClients();return}
  });

  function renderClients(){
    const box=q('salaryClients');if(!box||!manager())return;
    const active=S.contracts.filter(c=>c.status==='active'),paused=S.contracts.filter(c=>c.status==='paused'),archived=S.contracts.filter(c=>c.status==='terminated');
    const counts={active:active.length,paused:paused.length,archive:archived.length};
    box.innerHTML=
      '<div class="salary-grid2">'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Новый клиент / договор</h2><p>Новый клиент создаёт первый договорный цикл. Повторный клиент восстанавливается из архива.</p></div></div><div class="salary-body"><div class="salary-form-grid">'+
          '<div class="salary-field"><label>Клиент</label><input id="salClientName" placeholder="Название лагеря"></div>'+
          '<div class="salary-field"><label>Контрактор</label><select id="salClientContractor">'+employeeOptions(currentUser.id)+'</select></div>'+
          '<div class="salary-field"><label>Дата подписания</label><input id="salClientSigned" type="date"></div>'+
          '<div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salClientAdd">Создать</button></div>'+
        '</div></div></div>'+
        '<div class="salary-card"><div class="salary-head"><div><h2>Направление договора</h2><p>Первая оплата относится только к выбранному договорному циклу.</p></div></div><div class="salary-body">'+
          (S.contracts.filter(c=>c.status!=='terminated').length?'<div class="salary-form-grid"><div class="salary-field"><label>Клиент / договор</label><select id="salProdContract">'+contractOptions()+'</select></div><div class="salary-field"><label>Направление</label><select id="salProdType">'+productOptions()+'</select></div><div class="salary-field"><label>Первая оплата</label><input id="salProdFirst" type="date"></div><div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salProdAdd">Добавить направление</button></div></div>':'<div class="salary-empty">Нет активных договоров.</div>')+
        '</div></div>'+
      '</div>'+
      '<div class="salary-card"><div class="salary-head"><div><h2>База клиентов и договоров</h2><p>Расторгнутые договоры не удаляются: они уходят в архив.</p></div><label class="btn">Импорт Excel<input id="salClientImport" type="file" accept=".xlsx,.xls" hidden></label></div><div class="salary-body">'+
        '<div class="salary-subtabs"><button class="'+(S.clientView==='active'?'active':'')+'" data-client-view="active">Активные · '+counts.active+'</button><button class="'+(S.clientView==='paused'?'active':'')+'" data-client-view="paused">На паузе · '+counts.paused+'</button><button class="'+(S.clientView==='archive'?'active':'')+'" data-client-view="archive">Архив · '+counts.archive+'</button></div>'+
        contractTable(S.clientView==='active'?active:S.clientView==='paused'?paused:archived)+
      '</div></div>';
    q('salClientAdd')?.addEventListener('click',addClient);q('salProdAdd')?.addEventListener('click',addProduct);q('salClientImport')?.addEventListener('change',e=>importClients(e.target.files?.[0]));
  }

  function contractTable(list){
    if(!list.length)return '<div class="salary-empty">В этом разделе пока нет договоров.</div>';
    return '<div class="salary-contract-list">'+list.map(c=>{
      const cc=contractClient(c),ps=contractProducts(c.id),op=openPause(c.id);
      const period=ps.filter(p=>p.first_payment_date&&PRODUCTS[p.product_type]?.period).map(p=>{
        const end=commissionEnd(p.first_payment_date,c.id);
        return '<div><span class="salary-pill blue">'+esc(PRODUCTS[p.product_type]?.short||p.product_type)+'</span> старт '+dateRu(p.first_payment_date)+' → до '+dateRu(end)+(c.status==='paused'?' · <b>заморожено</b>':'')+'</div>';
      }).join('')||'<span style="color:#8293af">12-месячные направления ещё не запущены</span>';
      let actions='';
      if(c.status==='active')actions='<button class="btn" data-contract-pause="'+c.id+'">Поставить на паузу</button><button class="btn danger" data-contract-terminate="'+c.id+'">Расторгнуть</button>';
      if(c.status==='paused')actions='<button class="btn good" data-contract-resume="'+c.id+'">Возобновить</button><button class="btn" data-contract-edit-pause="'+c.id+'">Изменить паузу</button><button class="btn danger" data-contract-terminate="'+c.id+'">Расторгнуть</button>';
      if(c.status==='terminated')actions='<button class="btn primary" data-contract-renew="'+c.id+'">↻ Новый договор</button>';
      return '<article class="salary-contract-card '+c.status+'"><div class="salary-contract-top"><div><h3>'+esc(cc?.client_name||'Без названия')+'</h3><small>Договор от '+dateRu(c.signed_date)+' · контрактор '+esc(profileName(c.contractor_id))+'</small></div>'+contractPill(c)+'</div>'+
        (op?'<div class="salary-pause-banner"><b>Пауза:</b> '+dateRu(op.pause_start)+' → '+dateRu(op.pause_until)+(op.reason?' · '+esc(op.reason):'')+'</div>':'')+
        (c.status==='terminated'?'<div class="salary-pause-banner terminated"><b>Расторгнут:</b> '+dateRu(c.terminated_date)+(c.termination_reason?' · '+esc(c.termination_reason):'')+'</div>':'')+
        '<div class="salary-contract-periods">'+period+'</div><div class="salary-contract-actions">'+actions+'</div></article>';
    }).join('')+'</div>';
  }

  async function addClient(){
    const name=q('salClientName')?.value.trim(),contractor=q('salClientContractor')?.value,signed=q('salClientSigned')?.value||null;
    if(!name||!contractor||!signed){alert('Укажи клиента, контрактора и дату подписания.');return}
    const same=S.clients.find(c=>c.client_name.trim().toLowerCase()===name.toLowerCase());
    if(same){alert('Такой клиент уже есть в базе. Если прошлый договор расторгнут — открой вкладку «Архив» и нажми «Новый договор».');return}
    const ins=await sb.from('salary_clients').insert({client_name:name,contractor_id:contractor,signed_date:signed,active:true,created_by:currentUser.id,updated_at:new Date().toISOString()}).select('*').single();
    if(ins.error){alert(ins.error.message);return}
    const ci=await sb.from('salary_contracts').insert({client_id:ins.data.id,contractor_id:contractor,signed_date:signed,status:'active',created_by:currentUser.id,updated_at:new Date().toISOString()});
    if(ci.error){alert(ci.error.message);return}await load();
  }

  async function addProduct(){
    const contractId=q('salProdContract')?.value,type=q('salProdType')?.value,first=q('salProdFirst')?.value||null,cnt=contract(contractId),cc=contractClient(cnt);
    if(!cnt||!cc||!type){alert('Выбери договор и направление.');return}
    const {error}=await sb.from('salary_client_products').upsert({client_id:cc.id,contract_id:contractId,product_type:type,first_payment_date:first,active:true,updated_at:new Date().toISOString()},{onConflict:'contract_id,product_type'});
    if(error)alert(error.message);else load();
  }

  async function pauseContract(id){
    const c=contract(id);if(!c||c.status!=='active')return;
    const start=prompt('Дата начала паузы (ГГГГ-ММ-ДД):',todayIso());if(!start)return;
    const until=prompt('Пауза ДО какой даты? (ГГГГ-ММ-ДД):',addMonthsIso(start,1));if(!until)return;
    if(until<start){alert('Дата окончания паузы не может быть раньше начала.');return}
    const reason=prompt('Причина паузы / комментарий:','')||'';
    const ins=await sb.from('salary_contract_pauses').insert({contract_id:id,pause_start:start,pause_until:until,reason,created_by:currentUser.id,updated_at:new Date().toISOString()});
    if(ins.error){alert(ins.error.message);return}
    const up=await sb.from('salary_contracts').update({status:'paused',updated_at:new Date().toISOString()}).eq('id',id);
    if(up.error)alert(up.error.message);else load();
  }

  async function editPause(id){
    const p=openPause(id);if(!p){alert('Активная пауза не найдена.');return}
    const until=prompt('Пауза ДО какой даты? (ГГГГ-ММ-ДД):',p.pause_until);if(!until)return;
    if(until<p.pause_start){alert('Дата окончания паузы не может быть раньше начала.');return}
    const reason=prompt('Причина / комментарий:',p.reason||'')??p.reason;
    const {error}=await sb.from('salary_contract_pauses').update({pause_until:until,reason,updated_at:new Date().toISOString()}).eq('id',p.id);
    if(error)alert(error.message);else load();
  }

  async function resumeContract(id){
    const c=contract(id),p=openPause(id);if(!c||!p)return;
    const resume=prompt('Дата фактического возобновления (ГГГГ-ММ-ДД):',addDaysIso(p.pause_until,1));if(!resume)return;
    if(resume<p.pause_start){alert('Дата возобновления не может быть раньше начала паузы.');return}
    const up1=await sb.from('salary_contract_pauses').update({resumed_at:resume,updated_at:new Date().toISOString()}).eq('id',p.id);
    if(up1.error){alert(up1.error.message);return}
    const up2=await sb.from('salary_contracts').update({status:'active',updated_at:new Date().toISOString()}).eq('id',id);
    if(up2.error)alert(up2.error.message);else load();
  }

  async function terminateContract(id){
    const c=contract(id),cc=contractClient(c);if(!c||!cc)return;
    const date=prompt('Дата расторжения (ГГГГ-ММ-ДД):',todayIso());if(!date)return;
    if(c.signed_date&&date<c.signed_date){alert('Дата расторжения не может быть раньше подписания.');return}
    const reason=prompt('Причина расторжения / комментарий:','')||'';
    if(!confirm('Расторгнуть договор '+cc.client_name+'? Он уйдёт в архив, история сохранится.'))return;
    const p=openPause(id);if(p&&!p.resumed_at){
      const resume=date>p.pause_start?date:p.pause_start;
      await sb.from('salary_contract_pauses').update({resumed_at:resume,updated_at:new Date().toISOString()}).eq('id',p.id);
    }
    const up=await sb.from('salary_contracts').update({status:'terminated',terminated_date:date,termination_reason:reason,updated_at:new Date().toISOString()}).eq('id',id);
    if(up.error){alert(up.error.message);return}
    const other=S.contracts.some(x=>x.client_id===cc.id&&x.id!==id&&x.status!=='terminated');
    if(!other)await sb.from('salary_clients').update({active:false,updated_at:new Date().toISOString()}).eq('id',cc.id);
    S.clientView='archive';await load();
  }

  async function renewContract(oldId){
    const old=contract(oldId),cc=contractClient(old);if(!old||!cc)return;
    const signed=prompt('Дата подписания НОВОГО договора (ГГГГ-ММ-ДД):',todayIso());if(!signed)return;
    const people=(profiles||[]).filter(p=>p.active!==false);
    const list=people.map((p,i)=>(i+1)+'. '+(p.full_name||p.email)).join('\n');
    const choice=prompt('Кто новый контрактор?\n'+list,'1');if(!choice)return;
    const idx=Number(choice)-1,person=people[idx];
    if(!person){alert('Не удалось определить сотрудника. Введи номер из списка.');return}
    const ins=await sb.from('salary_contracts').insert({client_id:cc.id,contractor_id:person.id,signed_date:signed,status:'active',created_by:currentUser.id,updated_at:new Date().toISOString()}).select('*').single();
    if(ins.error){alert(ins.error.message);return}
    const newId=ins.data.id;
    const oldTypes=[...new Set(contractProducts(oldId).map(p=>p.product_type))];
    for(const type of oldTypes){
      await sb.from('salary_client_products').insert({client_id:cc.id,contract_id:newId,product_type:type,first_payment_date:null,active:true});
    }
    await sb.from('salary_clients').update({active:true,contractor_id:person.id,signed_date:signed,updated_at:new Date().toISOString()}).eq('id',cc.id);
    S.clientView='active';alert('Новый договор создан. История старого договора сохранена в архиве. Первые оплаты направлений сброшены и начнут новый 12-месячный период.');await load();
  }

  function renderTeam(){
    const box=q('salaryTeam');if(!box||!manager())return;
    const active=(typeof profiles!=='undefined'?profiles:[]).filter(p=>p.active!==false),rows=active.map(p=>({p,rows:salaryFor(p.id)}));
    const all=rows.reduce((a,x)=>a+totals(x.rows).total,0),contractSum=rows.reduce((a,x)=>a+totals(x.rows).contract,0),comm=rows.reduce((a,x)=>a+totals(x.rows).campbox,0),head=rows.reduce((a,x)=>a+totals(x.rows).head,0);
    box.innerHTML='<div class="salary-card"><div class="salary-head"><div><h2>Команда · '+esc(monthName(S.month))+'</h2><p>ФОТ и расчёты с учётом пауз и повторных договоров.</p></div>'+monthControl('salaryTeamMonth')+'</div><div class="salary-body">'+
      '<div class="salary-kpis"><div class="salary-kpi good"><span>ФОТ продаж</span><b>'+money(all)+'</b></div><div class="salary-kpi"><span>Контракторство</span><b>'+money(contractSum)+'</b></div><div class="salary-kpi good"><span>CampBox</span><b>'+money(comm)+'</b></div><div class="salary-kpi"><span>Сотрудников</span><b>'+rows.length+'</b></div><div class="salary-kpi warn"><span>1% руководителю</span><b>'+money(head)+'</b></div></div>'+
      '<div class="salary-team-cards">'+rows.map(x=>{const t=totals(x.rows);return '<div class="salary-person"><h3>'+esc(x.p.full_name||x.p.email||'Сотрудник')+'</h3><div class="sum">'+money(t.total)+'</div><small>'+x.rows.length+' начислений</small><div class="salary-breakdown"><div><span>Контракторство</span><b>'+money(t.contract)+'</b></div><div><span>CampBox</span><b>'+money(t.campbox)+'</b></div><div><span>Остальное</span><b>'+money(t.products+t.site+t.head)+'</b></div></div></div>'}).join('')+'</div>'+
    '</div></div>';bindMonth('salaryTeamMonth');
  }

  function rule(name,desc,formula,badge){return '<div class="salary-rule"><div><b>'+esc(name)+'</b><small>'+esc(desc)+'</small></div><code>'+esc(formula)+'</code><span class="salary-pill blue">'+esc(badge)+'</span></div>'}

  function renderRules(){
    const box=q('salaryRules');if(!box||!manager())return;const head=S.config?.sales_head_id||'',vat=vatRate();
    box.innerHTML='<div class="salary-card"><div class="salary-head"><div><h2>Настройки мотивации</h2><p>Правила V1, договорные циклы, паузы и получатель 1%.</p></div></div><div class="salary-body">'+
      '<div class="salary-form-grid" style="margin-bottom:10px"><div class="salary-field"><label>Руководитель продаж · получатель 1%</label><select id="salaryHeadSelect"><option value="">Не выбран</option>'+employeeOptions(head)+'</select></div><div class="salary-field"><label>НДС CampBox, %</label><input id="salaryVatRate" type="number" min="0" max="99.99" step="0.01" value="'+vat+'"></div><div class="salary-field"><label>&nbsp;</label><button class="btn primary" id="salaryHeadSave">Сохранить настройки</button></div></div>'+
      '<div class="salary-rule-list">'+
        rule('Контракторство','Разово за каждый новый подписанный договорный цикл. Повторное подключение после расторжения — новый фикс.','<80% = 0 ₽ · 80–99,99% = 2 000 ₽ · 100–103% = 5 000 ₽ · >103% = 7 000 ₽','1 раз / договор')+
        rule('Пауза договора','12-месячный период не идёт во время паузы. Дата «пауза до» обязательна.','конец периода + длительность паузы','заморозка срока')+
        rule('Расторжение','Договорный цикл переносится в архив. Платежи и начисления не удаляются.','новый договор = новый цикл','архив')+
        rule('2ГИС + Яндекс','Стоимость продукта 15 000 ₽.','15 000 × 40% = 6 000 ₽','40%')+
        rule('CampBox / комиссия','Сумма вводится с НДС. 10% считается от суммы без НДС. 12 месяцев продлеваются на паузы.','(платёж / (1 + НДС)) × 10%','12 мес. + паузы')+
        rule('Order Management','8,05% от оплаты, 12 месяцев продлеваются на паузы.','платёж × 8,05%','12 мес. + паузы')+
        rule('Comfort Booking','8,05% от оплаты, 12 месяцев продлеваются на паузы.','платёж × 8,05%','12 мес. + паузы')+
        rule('Разработка сайта','Первый платёж / следующие / выход в ЖР.','№1 = 11% · №2+ = 8,05% · ЖР = 4 025 ₽','по событиям')+
        rule('Сопровождение сайта','Первый и последующие платежи.','№1 = 11% · №2+ = 8,05%','по платежам')+
        rule('Руководитель продаж','1% CampBox начинается только после завершения 12 месяцев менеджера с учётом пауз.','(платёж без НДС) × 1%','после срока')+
      '</div></div></div>';
    q('salaryHeadSave')?.addEventListener('click',saveConfig);
  }

  async function saveConfig(){
    const id=q('salaryHeadSelect')?.value||null,vat=Number(q('salaryVatRate')?.value);
    if(!Number.isFinite(vat)||vat<0||vat>=100){alert('Укажи корректный НДС от 0 до 99,99%.');return}
    const {error}=await sb.from('salary_config').upsert({id:1,sales_head_id:id,vat_rate:vat,updated_by:currentUser.id,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)alert(error.message);else load();
  }

  function renderHistory(){
    const box=q('salaryHistory');if(!box||!manager())return;
    box.innerHTML='<div class="salary-card"><div class="salary-head"><div><h2>История изменений</h2><p>Договоры, паузы, расторжения, платежи и настройки сохраняются в аудите.</p></div></div><div class="salary-body"><div class="salary-timeline">'+
      (S.audit.length?S.audit.map(a=>'<div class="salary-event"><time>'+new Date(a.created_at).toLocaleString('ru-RU')+'</time><div><b>'+esc(a.entity_type)+' · '+esc(a.action)+'</b><small>'+esc(a.entity_id||'')+'</small></div><span class="salary-pill blue">'+esc(profileName(a.actor_id))+'</span></div>').join(''):'<div class="salary-empty">История пока пустая.</div>')+
      '</div></div></div>';
  }

  async function importClients(file){
    if(!file||typeof XLSX==='undefined')return;
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''});if(!rows.length){alert('Файл пустой.');return}
      let addedClients=0,addedContracts=0;
      for(const r of rows){
        const name=String(r['Клиент']||r['client']||'').trim();if(!name)continue;
        const contractorName=String(r['Контрактор']||r['contractor']||'').trim().toLowerCase();
        const prof=(profiles||[]).find(p=>String(p.full_name||p.email||'').trim().toLowerCase()===contractorName);if(!prof)continue;
        const signed=excelDate(r['Дата подписания']||r['signed_date']);
        let cc=S.clients.find(x=>x.client_name.trim().toLowerCase()===name.toLowerCase());
        if(!cc){
          const ins=await sb.from('salary_clients').insert({client_name:name,contractor_id:prof.id,signed_date:signed,active:true,created_by:currentUser.id}).select('*').single();
          if(ins.error)continue;cc=ins.data;S.clients.push(cc);addedClients++;
        }
        let cnt=S.contracts.find(c=>c.client_id===cc.id&&((signed&&c.signed_date===signed)||(!signed&&c.status!=='terminated')));
        if(!cnt){
          const ci=await sb.from('salary_contracts').insert({client_id:cc.id,contractor_id:prof.id,signed_date:signed,status:'active',created_by:currentUser.id}).select('*').single();
          if(ci.error)continue;cnt=ci.data;S.contracts.push(cnt);addedContracts++;
        }
        const type=parseProduct(String(r['Направление']||r['product']||''));
        if(type)await sb.from('salary_client_products').upsert({client_id:cc.id,contract_id:cnt.id,product_type:type,first_payment_date:excelDate(r['Первая оплата']||r['first_payment_date']),active:true},{onConflict:'contract_id,product_type'});
      }
      alert('Импорт завершён. Новых клиентов: '+addedClients+'. Новых договоров: '+addedContracts+'.');load();
    }catch(e){alert('Ошибка импорта: '+e.message)}
  }

  async function importPayments(file){
    if(!file||typeof XLSX==='undefined')return;
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''});let added=0,skipped=0;
      for(const r of rows){
        const name=String(r['Клиент']||r['client']||'').trim(),cc=S.clients.find(x=>x.client_name.trim().toLowerCase()===name.toLowerCase());if(!cc){skipped++;continue}
        const signed=excelDate(r['Дата договора']||r['Дата подписания']||r['contract_date']);
        let cnt=signed?S.contracts.find(c=>c.client_id===cc.id&&c.signed_date===signed):S.contracts.find(c=>c.client_id===cc.id&&c.status!=='terminated');
        if(!cnt){skipped++;continue}
        const type=parseProduct(String(r['Направление']||r['product']||''));if(!type){skipped++;continue}
        const date=excelDate(r['Дата']||r['payment_date']);if(!date){skipped++;continue}
        const event=String(r['Событие']||'').toLowerCase().includes('жр')?'site_live':'payment',amount=event==='site_live'?0:Number(r['Сумма']||r['amount']||0),num=Number(r['Номер оплаты']||r['payment_number']||0)||null;
        let prod=product(cnt.id,type);
        if(!prod){
          const pi=await sb.from('salary_client_products').insert({client_id:cc.id,contract_id:cnt.id,product_type:type,first_payment_date:event==='payment'?date:null,active:true}).select('*').single();
          if(pi.error){skipped++;continue}prod=pi.data;S.products.push(prod);
        }
        const ins=await sb.from('salary_payments').insert({payment_date:date,client_id:cc.id,contract_id:cnt.id,product_type:type,event_type:event,amount,payment_number:num,status:'confirmed',created_by:currentUser.id});
        if(!ins.error){added++;if(!prod.first_payment_date&&event==='payment')await sb.from('salary_client_products').update({first_payment_date:date}).eq('id',prod.id)}else skipped++;
      }
      alert('Импортировано поступлений: '+added+'. Пропущено: '+skipped+'.');load();
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

  function init(){if(!ensureRoot())return;load()}
  window.salaryRefresh=function(){if(!S.ready)ensureRoot();const wanted=isoMonth(typeof selectedMonth!=='undefined'?selectedMonth:S.month);if(!S.month)S.month=wanted;applyRoles();if(screen()?.classList.contains('active'))load()};
  window.salaryOpen=function(){if(!S.ready)ensureRoot();load()};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
