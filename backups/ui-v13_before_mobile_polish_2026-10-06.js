
(function(){
  var V={built:false,view:'today',managerId:null,stage:'call_book',analytics:'activity'};

  function h(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function el(tag,cls,html){var x=document.createElement(tag);if(cls)x.className=cls;if(html!=null)x.innerHTML=html;return x;}
  function pill(tone,text){return '<span class="v13-pill '+tone+'">'+h(text)+'</span>';}
  function app(){return document.getElementById('mainApp');}
  function screen(id){return document.getElementById('v13-'+id);}
  function cardByTitle(title){
    return Array.from(app().querySelectorAll('.card')).find(function(c){
      var q=c.querySelector('.section-title h2,h2');return q&&q.textContent.trim()===title;
    })||null;
  }
  function cleanupEmpty(node){if(node&&node.parentNode&&node.children.length===0)node.remove();}
  function titleMeta(id){
    var m={
      today:['Сегодня','Что нужно сделать сегодня, чтобы не потерять месячный план.'],
      month:['Месяц','Темп выполнения цели и план восстановления.'],
      funnel:['Воронка','Где теряется результат и что именно нужно улучшить.'],
      contracts:['Контрактинг','Договоры, которые влияют на результат текущего месяца.'],
      team:['Команда','Кто отстаёт, почему и куда руководителю вмешаться.'],
      analytics:['Аналитика','Откуда берутся цифры, что они означают и что делать дальше.'],
      summary:['Итоги','Итоги дня, контрольные точки и управленческий вывод.'],
      report:['Отчёт','Готовый управленческий отчёт по живым данным доски.']
    };return m[id]||m.today;
  }
  function go(id){
    if(!screen(id))id='today';
    V.view=id;
    document.querySelectorAll('.v13-screen').forEach(function(x){x.classList.toggle('active',x.id==='v13-'+id);});
    document.querySelectorAll('[data-v13-view]').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-v13-view')===id);});
    var m=titleMeta(id),t=document.getElementById('v13PageTitle'),d=document.getElementById('v13PageDesc');
    if(t)t.textContent=m[0];if(d)d.textContent=m[1];
    refresh();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  window.v13Go=go;

  function navButton(id,icon,label){
    return '<button type="button" data-v13-view="'+id+'">'+icon+' &nbsp;'+label+'</button>';
  }

  function build(){
    var a=app();if(!a||V.built)return;
    V.built=true;a.classList.add('v13-live');

    var sidebar=el('aside','v13-sidebar',
      '<div class="v13-brand"><div class="v13-logo">CB</div><div><b>CampBox Sales</b><small>Sales Coach · V13</small></div></div>'+
      '<nav class="v13-nav">'+
      navButton('today','⚡','Сегодня')+navButton('month','🎯','Месяц')+navButton('funnel','📊','Воронка')+
      navButton('contracts','✍️','Контрактинг')+navButton('team','👥','Команда')+navButton('analytics','📈','Аналитика')+
      navButton('summary','✅','Итоги')+navButton('report','🧾','Отчёт')+
      '</nav><div class="v13-side-context"><span>Дата</span><b id="v13SideDate">—</b><span>Период</span><b id="v13SideMonth">—</b></div><div class="v13-side-tools" id="v13SideTools"></div>');
    document.body.appendChild(sidebar);
    sidebar.addEventListener('click',function(e){var b=e.target.closest('[data-v13-view]');if(b)go(b.getAttribute('data-v13-view'));});

    var top=a.querySelector(':scope > .topbar');
    if(top){
      var pt=el('div','v13-page-title','<h1 id="v13PageTitle">Сегодня</h1><p id="v13PageDesc">Что нужно сделать сегодня, чтобы не потерять месячный план.</p>');
      top.insertBefore(pt,top.firstChild);
      var tools=document.getElementById('v13SideTools');
      ['accessBtn','excelBtn'].forEach(function(id){var b=document.getElementById(id);if(b)tools.appendChild(b);});
      Array.from(top.querySelectorAll('button')).forEach(function(b){if(b.textContent.trim()==='PDF')b.style.display='none';});
    }

    var host=el('div','v13-view-host');
    ['today','month','funnel','contracts','team','analytics','summary','report'].forEach(function(id){
      var s=el('section','v13-screen');s.id='v13-'+id;host.appendChild(s);
    });
    a.appendChild(host);

    var mobile=el('nav','v13-mobile-nav',
      navButton('today','⚡','Сегодня')+navButton('month','🎯','Месяц')+navButton('funnel','📊','Воронка')+navButton('team','👥','Команда'));
    document.body.appendChild(mobile);
    mobile.addEventListener('click',function(e){var b=e.target.closest('[data-v13-view]');if(b)go(b.getAttribute('data-v13-view'));});

    var hiddenKpi=a.querySelector(':scope > .kpi-grid');
    if(hiddenKpi){hiddenKpi.classList.add('v13-data-only');screen('today').appendChild(hiddenKpi);}

    var context=a.querySelector(':scope > .context-card');if(context)screen('today').appendChild(context);

    var focus=cardByTitle('Фокус дня'),monthPlan=cardByTitle('План месяца');
    var focusParent=focus&&focus.parentNode,monthParent=monthPlan&&monthPlan.parentNode;
    if(focus)screen('today').appendChild(focus);
    if(monthPlan)screen('month').appendChild(monthPlan);
    cleanupEmpty(focusParent);if(monthParent!==focusParent)cleanupEmpty(monthParent);

    var pace=cardByTitle('Темп к цели месяца'),attention=cardByTitle('Что требует внимания');
    var paceParent=pace&&pace.parentNode,attParent=attention&&attention.parentNode;
    if(attention)screen('today').appendChild(attention);
    if(pace)screen('month').appendChild(pace);
    cleanupEmpty(paceParent);if(attParent!==paceParent)cleanupEmpty(attParent);

    var coach=a.querySelector('.coach-card');
    var teamWrap=document.getElementById('coachTeamWrap');
    if(teamWrap){
      teamWrap.classList.remove('manager-only');
      var tc=el('section','card v13-block','<div class="v13-section-title"><div><h2>Команда · у кого какая проблема</h2><p>Быстрый общий срез по просадкам менеджеров.</p></div></div>');
      var body=el('div','v13-body');body.appendChild(teamWrap);tc.appendChild(body);screen('team').appendChild(tc);
    }
    if(coach)screen('funnel').appendChild(coach);

    var daily=cardByTitle('Ежедневный отчёт команды');if(daily)screen('team').appendChild(daily);
    var funnel=cardByTitle('Воронка месяца');if(funnel)screen('funnel').appendChild(funnel);

    var analyticsGrid=Array.from(a.children).find(function(x){return x.classList&&x.classList.contains('analytics-grid');});
    if(analyticsGrid)screen('analytics').appendChild(analyticsGrid);
    var calendar=cardByTitle('Календарь выполнения плана');if(calendar)screen('analytics').appendChild(calendar);

    var checkpoints=cardByTitle('Контрольные точки месяца'),lead=cardByTitle('Командный итог руководителя');
    var cpParent=checkpoints&&checkpoints.parentNode,leadParent=lead&&lead.parentNode;
    if(checkpoints)screen('summary').appendChild(checkpoints);
    if(lead)screen('summary').appendChild(lead);
    cleanupEmpty(cpParent);if(leadParent!==cpParent)cleanupEmpty(leadParent);

    var miniGrid=Array.from(a.children).find(function(x){return x.classList&&x.classList.contains('three-col');});
    if(miniGrid)screen('analytics').appendChild(miniGrid);

    createLiveBlocks();

    var oldMobile=document.getElementById('mobileBar');if(oldMobile)oldMobile.style.display='none';
    var manualFocus=document.getElementById('daySummary');if(manualFocus&&manualFocus.parentElement)manualFocus.parentElement.style.display='none';

    patchLiveFunctions();
    go('today');
    setTimeout(refresh,100);setTimeout(refresh,700);setTimeout(refresh,1800);
  }

  function createLiveBlocks(){
    var k=el('div','v13-kpis');k.id='v13TodayKpis';screen('today').insertBefore(k,screen('today').firstChild);
    var p=el('section','card v13-block','<div class="v13-section-title"><div><h2>Мой план сегодня</h2><p>План рассчитан автоматически. Заполняй только факт.</p></div>'+pill('good','АВТОПЛАН')+'</div><div class="v13-body" id="v13TodayPlan"></div>');
    var ctx=screen('today').querySelector('.context-card');if(ctx&&ctx.nextSibling)screen('today').insertBefore(p,ctx.nextSibling);else screen('today').appendChild(p);

    var recovery=el('section','card v13-block','<div class="v13-section-title"><div><h2>План восстановления месяца</h2><p>Что должно измениться, чтобы вернуться к цели.</p></div></div><div class="v13-body"><div class="v13-recovery" id="v13Recovery"></div></div>');
    screen('month').appendChild(recovery);

    var team=el('section','card v13-block','<div class="v13-section-title"><div><h2>Команда</h2><p>Общий результат и детальный разбор каждого менеджера.</p></div></div><div class="v13-body"><div class="v13-team-summary" id="v13TeamSummary"></div><div class="v13-team-grid" id="v13TeamGrid"></div><div class="v13-manager-panel" id="v13ManagerPanel"></div></div>');
    screen('team').insertBefore(team,screen('team').firstChild);

    var fd=el('section','card v13-block','<div class="v13-section-title"><div><h2>Разбор каждого этапа</h2><p>Факт → ориентир → диагноз → самоанализ → действие.</p></div></div><div class="v13-body"><div class="v13-stage-tabs" id="v13StageTabs"></div><div class="v13-stage-panel" id="v13StagePanel"></div></div>');
    screen('funnel').appendChild(fd);

    var cont=el('section','card v13-block','<div class="v13-section-title"><div><h2>Контрактинг</h2><p>Только договоры, способные повлиять на результат текущего месяца.</p></div><span id="v13ContractBadge"></span></div><div class="v13-body"><div class="v13-contract-grid" id="v13ContractsGrid"></div></div>');
    screen('contracts').appendChild(cont);

    var ag=el('section','card v13-block','<div class="v13-section-title"><div><h2>Как читать аналитику</h2><p>Откуда цифра взялась, что она означает и куда идти дальше.</p></div>'+pill('good','COACH MODE')+'</div><div class="v13-body"><div class="v13-analytics-tabs" id="v13AnalyticsTabs"></div><div class="v13-analytics-panel" id="v13AnalyticsPanel"></div></div>');
    screen('analytics').insertBefore(ag,screen('analytics').firstChild);

    var rep=el('div','v13-report-layout','<section class="card v13-report-settings"><div class="v13-section-title" style="padding:0 0 8px"><div><h2>Сформировать отчёт</h2><p>Краткий управленческий отчёт из живых данных.</p></div></div><label>Период</label><select id="v13ReportPeriod"><option value="current">К выбранной дате</option><option value="month">Весь выбранный месяц</option></select><label>Формат</label><select id="v13ReportType"><option value="short">Краткий управленческий</option><option value="team">По команде</option></select><button type="button" class="btn primary" style="width:100%;margin-top:12px" id="v13BuildReport">Сформировать отчёт</button><div class="v13-report-actions"><button type="button" class="btn" id="v13PdfReport">PDF</button><button type="button" class="btn" id="v13ExcelReport">Excel</button></div></section><section class="v13-report-preview" id="v13ReportPreview"></section>');
    screen('report').appendChild(rep);
    document.getElementById('v13BuildReport').addEventListener('click',renderReport);
    document.getElementById('v13PdfReport').addEventListener('click',function(){document.body.classList.add('v13-print-report');window.print();setTimeout(function(){document.body.classList.remove('v13-print-report');},300);});
    document.getElementById('v13ExcelReport').addEventListener('click',function(){if(typeof exportExcel==='function')exportExcel();});
  }

  function safeScope(){
    if(typeof currentUser==='undefined'||!currentUser)return null;
    if(typeof isManager==='function'&&isManager())return 'team';
    return currentUser.id;
  }
  function currentSelf(){return typeof currentUser!=='undefined'&&currentUser?currentUser.id:null;}
  function fd(uid){try{return coachForecastData(uid);}catch(e){return {target:0,fact:0,need:0,forecast:0,risk:0,wdDone:0,wdTotal:0};}}
  function diag(uid){try{return coachDiagnostics(uid)||[];}catch(e){return [];}}
  function risk(uid){try{return coachContractRisk(uid);}catch(e){return {all:[],over7:0,over3:0,late:0,ours:0};}}
  function worst(uid){try{return coachWorstLabel(uid);}catch(e){return 'Недостаточно данных';}}

  function renderToday(){
    var uid=currentSelf(),box=document.getElementById('v13TodayKpis');if(!uid||!box)return;
    var f=fd(uid),tone=f.forecast>=f.target?'good':f.risk<=1?'warn':'bad';
    box.innerHTML='<div class="v13-kpi"><span>Цель месяца</span><b>'+f.target+'</b><small>KPI менеджера</small></div>'+
      '<div class="v13-kpi good"><span>Факт</span><b>'+f.fact+'</b><small>подключённых лагерей</small></div>'+
      '<div class="v13-kpi '+tone+'"><span>Прогноз</span><b>'+f.forecast+'</b><small>при текущем темпе</small></div>'+
      '<div class="v13-kpi '+tone+'"><span>Риск</span><b>'+(f.risk?'-'+f.risk:'0')+'</b><small>'+(f.risk?'ожидаемый недобор':'риск отсутствует')+'</small></div>';

    var plan=document.getElementById('v13TodayPlan');
    var row=(typeof dayRows!=='undefined'?dayRows:[]).find(function(r){return r.user_id===uid;});
    if(!row){plan.innerHTML='<div class="v13-empty">План появится после загрузки строки сотрудника.</div>';return;}
    var auto=null;try{auto=coachAutoPlan(uid);}catch(e){}
    var prio=[];try{prio=coachPriorityData(uid,diag(uid),f,risk(uid));}catch(e){}
    var rows=(typeof activityKeys!=='undefined'?activityKeys:[]).map(function(k){
      var why=auto&&auto.metrics&&auto.metrics[k]?auto.metrics[k].shortReason:'автоплан';
      return '<tr><td><b>'+h(metricLabels[k])+'</b></td><td><b>'+Number(row[k+'_plan']||0)+'</b></td><td><input type="number" min="0" data-v13-fact="'+k+'" value="'+Number(row[k+'_fact']||0)+'"></td><td class="v13-plan-why">'+h(why)+'</td></tr>';
    }).join('');
    var focus=prio[0]||{title:'Сохранить текущий темп',text:'Критичных просадок по текущим данным нет.'};
    plan.innerHTML='<div class="v13-my-plan"><div><table class="v13-plan-table"><thead><tr><th>Действие</th><th>План</th><th>Факт</th><th>Почему</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="v13-focus-hero"><b>'+h(focus.title)+'</b><p>'+h(focus.text)+'</p><strong>'+h(worst(uid))+'</strong></div></div>';
    plan.querySelectorAll('[data-v13-fact]').forEach(function(inp){
      inp.addEventListener('input',function(){
        var k=this.getAttribute('data-v13-fact');row[k+'_fact']=Number(this.value)||0;
        document.querySelectorAll('[data-user-id="'+uid+'"] [data-k="'+k+'_fact"]').forEach(function(x){x.value=row[k+'_fact'];});
        if(typeof changed==='function')changed();
      });
      inp.addEventListener('change',function(){if(typeof recalc==='function')recalc();});
    });
  }

  function renderMonth(){
    var uid=currentSelf();if(!uid)return;var f=fd(uid),d=diag(uid).filter(function(x){return x.tone!=='good';}).sort(function(a,b){return a.score-b.score;})[0];
    var r=document.getElementById('v13Recovery');if(!r)return;
    r.innerHTML='<div><span>Сейчас</span><b>Прогноз '+f.forecast+'/'+f.target+'</b><small>'+(f.risk?'риск недобора '+f.risk:'идём в цель')+'</small></div>'+
      '<div><span>Нужно поднять</span><b>'+h(d?d.label:'темп сохранить')+'</b><small>'+h(d?d.diagnosis:'критичных просадок нет')+'</small></div>'+
      '<div><span>Если исправим</span><b>'+(f.risk?'Возврат к цели':'Сохранение цели')+'</b><small>контроль по следующей рабочей дате</small></div>';
  }

  function renderTeam(){
    var grid=document.getElementById('v13TeamGrid'),sumBox=document.getElementById('v13TeamSummary');if(!grid||!sumBox||typeof profiles==='undefined')return;
    var ids=(typeof isManager==='function'&&isManager())?profiles.map(function(p){return p.id;}):[currentSelf()];
    ids=ids.filter(Boolean);if(!ids.length)return;
    var tf=fd((typeof isManager==='function'&&isManager())?'team':ids[0]);
    sumBox.innerHTML='<div><span>Цель</span><b>'+tf.target+'</b></div><div><span>Факт</span><b>'+tf.fact+'</b></div><div><span>Прогноз</span><b style="color:'+(tf.forecast>=tf.target?'#8fe2c5':'#ffd17e')+'">'+tf.forecast+'</b></div><div><span>Главная просадка</span><b style="font-size:12px">'+h(worst((typeof isManager==='function'&&isManager())?'team':ids[0]))+'</b></div>';
    if(!V.managerId||ids.indexOf(V.managerId)<0)V.managerId=ids[0];
    grid.innerHTML=ids.map(function(id){
      var p=profiles.find(function(x){return x.id===id;})||{},f=fd(id),w=worst(id),tone=f.forecast>=f.target?'good':f.risk<=1?'warn':'bad';
      return '<div class="v13-person '+(V.managerId===id?'active':'')+'" data-v13-manager="'+h(id)+'"><div class="v13-person-head"><div><h3>'+h(p.full_name||p.email||'Сотрудник')+'</h3><small>менеджер</small></div>'+pill(tone,tone==='good'?'по плану':'риск')+'</div><div class="v13-person-stats"><div><span>Факт</span><b>'+f.fact+'/'+f.target+'</b></div><div><span>Прогноз</span><b>'+f.forecast+'/'+f.target+'</b></div><div><span>До цели</span><b>'+Math.max(f.target-f.fact,0)+'</b></div></div><div class="v13-diagnosis">'+h(w)+'</div></div>';
    }).join('');
    grid.querySelectorAll('[data-v13-manager]').forEach(function(x){x.addEventListener('click',function(){V.managerId=this.getAttribute('data-v13-manager');renderTeam();});});
    renderManagerPanel(V.managerId);
  }

  function actionFor(item){
    var map={calls:'Вернуть необходимый объём звонков и закрыть накопленный долг.',booked:'Разобрать первые 30 секунд звонка и назначение встречи.',meetings:'Подтверждать встречу заранее и фиксировать ценность разговора.',offers:'Не завершать встречу без следующего шага и персонального КП.',follow:'Закрыть просроченные повторные контакты.',call_book:'Разобрать 5 последних звонков без назначения встречи.',book_meet:'Проверить причины недоходимости и подтверждение встреч.',meet_offer:'Разобрать, чем заканчиваются встречи и почему нет КП.'};
    return map[item&&item.key]||'Сохранить текущий темп и контролировать показатель.';
  }
  function renderManagerPanel(id){
    var box=document.getElementById('v13ManagerPanel');if(!box||!id)return;
    var p=(typeof profiles!=='undefined'?profiles:[]).find(function(x){return x.id===id;})||{},f=fd(id),ds=diag(id),cr=risk(id);
    var weak=ds.filter(function(x){return x.tone!=='good';}).sort(function(a,b){return a.score-b.score;});
    var good=ds.filter(function(x){return x.tone==='good';}).slice(0,3);
    function get(key){return ds.find(function(x){return x.key===key;});}
    var calls=get('calls'),cb=get('call_book'),bm=get('book_meet'),mo=get('meet_offer');
    box.innerHTML='<div class="v13-person-head"><div><h3>'+h(p.full_name||p.email||'Сотрудник')+'</h3><small>'+h(worst(id))+'</small></div>'+pill(f.forecast>=f.target?'good':f.risk<=1?'warn':'bad',f.forecast>=f.target?'ПО ПЛАНУ':'РИСК')+'</div>'+
      '<div class="v13-health"><div><span>Факт</span><b>'+f.fact+'/'+f.target+'</b></div><div><span>Прогноз</span><b>'+f.forecast+'/'+f.target+'</b></div><div><span>Звонки</span><b>'+(calls?h(calls.fact):'—')+'</b></div><div><span>Звонок→встреча</span><b>'+(cb?h(cb.fact):'—')+'</b></div><div><span>Встреча→КП</span><b>'+(mo?h(mo.fact):'—')+'</b></div></div>'+
      '<div class="v13-manager-columns"><div class="v13-coach-box"><h4>Что получается</h4><ul>'+(good.length?good.map(function(x){return '<li>'+h(x.label)+': '+h(x.diagnosis)+'</li>';}).join(''):'<li>Нужно больше данных для устойчивого вывода.</li>')+'</ul></div><div class="v13-coach-box"><h4>Что тянет вниз</h4><ul>'+(weak.length?weak.slice(0,4).map(function(x){return '<li>'+h(x.label)+': '+h(x.fact)+' при ориентире '+h(x.guide)+'</li>';}).join(''):'<li>Критичных просадок нет.</li>')+(cr.over7?'<li>Контрактинг: '+cr.over7+' договор(а) старше 7 дней.</li>':'')+'</ul></div></div>'+
      '<div class="v13-coach-box" style="margin-top:8px;border-color:rgba(163,109,245,.35)"><h4>Фокус Coach</h4><p>'+h(actionFor(weak[0]))+'</p></div>';
  }

  function renderContracts(){
    var grid=document.getElementById('v13ContractsGrid'),badge=document.getElementById('v13ContractBadge');if(!grid)return;
    var all=[];try{all=activeContractEntries();}catch(e){}
    var visible=(typeof isManager==='function'&&isManager())?all:all.filter(function(c){return c.user_id===currentSelf();});
    visible.sort(function(a,b){return b.age-a.age;});
    if(badge)badge.innerHTML=pill(visible.some(function(c){return c.age>7;})?'bad':visible.length?'warn':'good',visible.length+' активных');
    if(!visible.length){grid.innerHTML='<div class="v13-empty">Активных договоров на подписании нет.</div>';return;}
    grid.innerHTML=visible.map(function(c){
      var tone=c.age>7?'bad':c.age>=4?'warn':'good',next=c.next_action||'Следующий шаг не указан';
      return '<article class="v13-contract"><div class="v13-contract-head"><div><h3>'+h(c.client||'Без названия')+'</h3><small>'+h(c.manager||'')+'</small></div>'+pill(tone,c.age+' дн.')+'</div><div class="v13-contract-meta"><span class="v13-pill '+tone+'">'+(c.ball==='us'?'мяч у нас':'мяч у клиента')+'</span>'+(c.blocker?'<span class="v13-pill warn">'+h(c.blocker)+'</span>':'')+'</div><p>'+(c.age>7?'Высокий риск для месячного результата.':c.age>=4?'Требует контроля срока.':'Срок пока в норме.')+'</p><div class="v13-contract-next">'+h(next)+(c.next_contact?' · '+h(c.next_contact):'')+'</div><button type="button" class="btn" style="margin-top:8px" data-open-contract="'+h(c.user_id)+'">Открыть контрактинг</button></article>';
    }).join('');
    grid.querySelectorAll('[data-open-contract]').forEach(function(b){b.addEventListener('click',function(){if(typeof openContracts==='function')openContracts(this.getAttribute('data-open-contract'));});});
  }

  var stageInfo={
    calls:{label:'Звонки',diagKey:'calls',causes:['Недостаточный объём первичных контактов','Нерегулярная работа по дням'],questions:['Выполнен ли базовый объём?','Есть ли накопленный долг активности?'],actions:['Закрыть базовый дневной план','Не увеличивать объём, если он уже выполнен']},
    call_book:{label:'Звонок → встреча',diagKey:'call_book',causes:['Слабый заход в первые 30 секунд','Рано презентуем продукт','Нет конкретной фиксации встречи'],questions:['Я понял процесс лагеря до презентации?','Есть ли у звонка цель назначить встречу?'],actions:['Разобрать 5 последних звонков','Заканчивать звонок двумя вариантами времени']},
    book_meet:{label:'Назначенная → проведённая',diagKey:'book_meet',causes:['Нет подтверждения встречи','Слабая ценность встречи для клиента'],questions:['Подтвердил ли я встречу заранее?','Понимает ли клиент, зачем приходить?'],actions:['Подтверждать встречу за день','Повторять ценность встречи']},
    meet_offer:{label:'Встреча → КП',diagKey:'meet_offer',causes:['Не выявлена конкретная задача','Нет следующего шага','КП не связано с болью клиента'],questions:['Чем закончилась встреча?','Есть ли дата следующего контакта?'],actions:['Не завершать встречу без следующего шага','Строить КП от найденной проблемы']},
    signing:{label:'Контрактинг',diagKey:null,causes:['Юристы клиента','Согласование цены','Нет внутреннего дедлайна решения'],questions:['Я знаю, кто подписывает?','У каждого договора есть дата следующего контакта?'],actions:['Дожимать договоры старше 7 дней','Фиксировать владельца следующего шага']},
    connected:{label:'Подключение',diagKey:null,causes:['Подписание не перешло в запуск','Нет чёткого handoff'],questions:['Что мешает подключить подписанный лагерь?','Есть ли дата запуска?'],actions:['Назначать дату подключения заранее','Контролировать переход после подписи']}
  };
  function renderFunnel(){
    var tabs=document.getElementById('v13StageTabs'),panel=document.getElementById('v13StagePanel');if(!tabs||!panel)return;
    tabs.innerHTML=Object.keys(stageInfo).map(function(k){return '<button type="button" data-v13-stage="'+k+'" class="'+(V.stage===k?'active':'')+'">'+h(stageInfo[k].label)+'</button>';}).join('');
    tabs.querySelectorAll('[data-v13-stage]').forEach(function(b){b.addEventListener('click',function(){V.stage=this.getAttribute('data-v13-stage');renderFunnel();});});
    var uid=(typeof isManager==='function'&&isManager())?(typeof coachUserId!=='undefined'?coachUserId:'team'):currentSelf();if(!uid)uid=safeScope();
    var d=diag(uid),info=stageInfo[V.stage],item=info.diagKey?d.find(function(x){return x.key===info.diagKey;}):null,f=fd(uid),cr=risk(uid);
    var fact='—',guide='—',delta='—',tone='warn',diagnosis='Нужно больше данных.';
    if(item){fact=item.fact;guide=item.guide;delta=item.delta;tone=item.tone;diagnosis=item.diagnosis;}
    else if(V.stage==='signing'){fact=cr.all.length;guide='без просрочки';delta=cr.over7?cr.over7+' >7 дн.':'0 >7 дн.';tone=cr.over7?'bad':cr.over3?'warn':'good';diagnosis=cr.over7?'Есть договоры с высоким риском':'Контрактинг под контролем';}
    else if(V.stage==='connected'){fact=f.fact;guide=f.target;delta=(f.forecast-f.target>=0?'+':'')+(f.forecast-f.target);tone=f.forecast>=f.target?'good':f.risk<=1?'warn':'bad';diagnosis='Прогноз '+f.forecast+' из '+f.target+'.';}
    panel.innerHTML='<div class="v13-person-head"><div><h3>'+h(info.label)+'</h3><small>Детальный самоанализ показателя</small></div>'+pill(tone,tone==='good'?'НОРМА':tone==='warn'?'ВНИМАНИЕ':'ПРОСАДКА')+'</div>'+
      '<div class="v13-stage-kpis"><div><span>Факт</span><b>'+h(fact)+'</b></div><div><span>Ориентир</span><b>'+h(guide)+'</b></div><div><span>Отклонение</span><b>'+h(delta)+'</b></div><div><span>Диагноз</span><b style="font-size:10px">'+h(diagnosis)+'</b></div></div>'+
      '<div class="v13-insight"><b>Coach:</b> '+h(diagnosis)+' '+h(actionFor(item))+'</div>'+
      '<div class="v13-self"><details><summary>Почему так может происходить</summary><ul>'+info.causes.map(function(x){return '<li>'+h(x)+'</li>';}).join('')+'</ul></details><details><summary>Вопросы к себе</summary><ul>'+info.questions.map(function(x){return '<li>'+h(x)+'</li>';}).join('')+'</ul></details><div><b style="font-size:11px">Что делать</b><ul>'+info.actions.map(function(x){return '<li>'+h(x)+'</li>';}).join('')+'</ul></div></div>';
  }

  function renderAnalytics(){
    var tabs=document.getElementById('v13AnalyticsTabs'),panel=document.getElementById('v13AnalyticsPanel');if(!tabs||!panel)return;
    var modes={activity:'Активность',conversion:'Конверсия',pace:'Темп месяца',discipline:'Дисциплина'};
    tabs.innerHTML=Object.keys(modes).map(function(k){return '<button type="button" data-v13-analytics="'+k+'" class="'+(V.analytics===k?'active':'')+'">'+modes[k]+'</button>';}).join('');
    tabs.querySelectorAll('[data-v13-analytics]').forEach(function(b){b.addEventListener('click',function(){V.analytics=this.getAttribute('data-v13-analytics');renderAnalytics();});});
    var uid=safeScope();if(!uid)return;var d=diag(uid),f=fd(uid),title='',source='',diagnosis='',what='',why='',next='';
    if(V.analytics==='activity'){
      var aa=d.filter(function(x){return x.type==='activity';}),weak=aa.filter(function(x){return x.tone!=='good';}).sort(function(a,b){return a.score-b.score;})[0];
      title='Активность · хватает ли объёма работы';source='Источник: ежедневный автоплан и факт действий менеджеров.';diagnosis=weak?weak.label+': '+weak.diagnosis:'Объём активности выполняется.';what='Сравниваем накопленный план и факт по каждому действию.';why='Отделяем проблему объёма от проблемы качества конверсии.';next=weak?actionFor(weak):'Не увеличивать активность без необходимости.';
    }else if(V.analytics==='conversion'){
      var cc=d.filter(function(x){return x.type==='conversion';}),cw=cc.filter(function(x){return x.tone!=='good';}).sort(function(a,b){return a.score-b.score;})[0];
      title='Конверсия · где именно теряем клиентов';source='Источник: фактические переходы между этапами воронки за выбранный месяц.';diagnosis=cw?cw.label+': '+cw.fact+' при ориентире '+cw.guide:'Критичных просадок конверсии нет.';what='Смотрим каждый переход отдельно и сравниваем с рабочим ориентиром.';why='Понимаем, на каком конкретном этапе теряется результат.';next=cw?actionFor(cw):'Сохранить текущую механику работы.';
    }else if(V.analytics==='pace'){
      title='Темп месяца · добегаем ли до цели';source='Источник: фактические подключения и скорость результата по рабочим дням.';diagnosis='Факт '+f.fact+' из '+f.target+', прогноз '+f.forecast+'.';what='Сравниваем факт, ожидаемый темп и прогноз на конец месяца.';why='Связываем ежедневную работу с итоговым KPI месяца.';next=f.risk?'Вернуться к узкому месту воронки и поднять только отстающий показатель.':'Сохранить текущий темп.';
    }else{
      var rows=[];try{rows=coachScopeRows(monthRows,uid,true);}catch(e){}
      var dates={};rows.forEach(function(r){if(!dates[r.report_date])dates[r.report_date]=[];dates[r.report_date].push(r);});
      var low=0,ok=0;Object.keys(dates).forEach(function(date){var rs=dates[date],vals=activityKeys.filter(function(k){return sum(rs,k+'_plan')>0;}).map(function(k){return pct(sum(rs,k+'_fact'),sum(rs,k+'_plan'));});var sc=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:100;if(sc<70)low++;else ok++;});
      title='Дисциплина · системно ли выполняем план';source='Источник: ежедневные plan/fact. Один слабый день не считаем системной проблемой.';diagnosis='Дней в рабочем темпе: '+ok+', явных провалов: '+low+'.';what='Ищем повторяющиеся отклонения по дням.';why='Отделяем разовую неудачу от системной проблемы.';next=low>=2?'Открыть повторяющийся красный показатель и разобрать причину.':'Продолжить текущий ритм и наблюдать.';
    }
    panel.innerHTML='<h3 style="margin:0">'+h(title)+'</h3><div class="v13-source">'+h(source)+'</div><div class="v13-insight"><b>Диагноз Coach:</b> '+h(diagnosis)+'</div><div class="v13-analytics-actions"><div><h4>Что смотрим</h4><p>'+h(what)+'</p></div><div><h4>Зачем</h4><p>'+h(why)+'</p></div><div><h4>Что дальше</h4><p>'+h(next)+'</p></div></div>';
  }

  function renderReport(){
    var box=document.getElementById('v13ReportPreview');if(!box)return;var scope=(typeof isManager==='function'&&isManager())?'team':currentSelf();if(!scope)return;
    var f=fd(scope),d=diag(scope),cr=risk(scope),w=worst(scope),prio=[];try{prio=coachPriorityData(scope,d,f,cr);}catch(e){}
    var teamRows='';
    if(typeof isManager==='function'&&isManager()&&typeof profiles!=='undefined'){
      teamRows=profiles.map(function(p){var pf=fd(p.id);return '<tr><td>'+h(p.full_name||p.email||'Сотрудник')+'</td><td>'+pf.fact+' / '+pf.target+'</td><td>'+pf.forecast+' / '+pf.target+'</td><td>'+h(worst(p.id))+'</td></tr>';}).join('');
    }else{
      teamRows='<tr><td>Я</td><td>'+f.fact+' / '+f.target+'</td><td>'+f.forecast+' / '+f.target+'</td><td>'+h(w)+'</td></tr>';
    }
    var issues=d.filter(function(x){return x.tone!=='good';}).sort(function(a,b){return a.score-b.score;}).slice(0,4);
    box.innerHTML='<h2>Отчёт по продажам CampBox</h2><div class="sub">'+h(typeof selectedDate!=='undefined'?selectedDate:'')+' · автоматически сформирован из Sales Board</div>'+
      '<div class="v13-report-kpis"><div><span>План</span><b>'+f.target+'</b></div><div><span>Факт</span><b>'+f.fact+'</b></div><div><span>Прогноз</span><b>'+f.forecast+'</b></div><div><span>Риск</span><b>'+(f.risk?'-'+f.risk:'0')+'</b></div></div>'+
      '<div class="v13-report-section"><div class="v13-report-callout"><b>Главный вывод:</b> '+h(w)+'. '+(f.risk?'При текущем темпе ожидаемый недобор — '+f.risk+'.':'Текущий темп позволяет идти в цель.')+'</div></div>'+
      '<div class="v13-report-section"><h3>Что имеем</h3><table class="v13-report-table"><thead><tr><th>Показатель</th><th>Факт</th><th>Ориентир</th><th>Статус</th></tr></thead><tbody>'+issues.map(function(x){return '<tr><td>'+h(x.label)+'</td><td>'+h(x.fact)+'</td><td>'+h(x.guide)+'</td><td>'+h(x.diagnosis)+'</td></tr>';}).join('')+'</tbody></table></div>'+
      '<div class="v13-report-section"><h3>По менеджерам</h3><table class="v13-report-table"><thead><tr><th>Менеджер</th><th>Факт / цель</th><th>Прогноз</th><th>Главная проблема</th></tr></thead><tbody>'+teamRows+'</tbody></table></div>'+
      '<div class="v13-report-section"><h3>Что делаем</h3><div class="v13-report-callout good">'+(prio.length?prio.map(function(x,i){return (i+1)+'. '+h(x.title)+' — '+h(x.text);}).join('<br>'):'Сохраняем текущий темп и контролируем воронку.')+'</div></div>';
  }

  function updateSide(){
    var sd=document.getElementById('v13SideDate'),sm=document.getElementById('v13SideMonth');
    if(sd&&typeof selectedDate!=='undefined')sd.textContent=selectedDate||'—';
    if(sm&&typeof selectedMonth!=='undefined')sm.textContent=selectedMonth||'—';
  }
  function refresh(){
    if(!V.built)return;updateSide();
    var manager=typeof isManager==='function'&&isManager();
    document.querySelectorAll('[data-v13-view="report"]').forEach(function(b){b.style.display=manager?'':'none';});
    try{renderToday();renderMonth();renderTeam();renderContracts();renderFunnel();renderAnalytics();renderReport();}catch(e){console.error('V13 refresh',e);}
  }

  function patchLiveFunctions(){
    try{
      if(typeof recalc==='function'&&!recalc.__v13){
        var base=recalc;var wrap=function(){var r=base.apply(this,arguments);setTimeout(refresh,0);return r;};wrap.__v13=true;recalc=wrap;
      }
    }catch(e){}
    try{
      if(typeof setCoachUser==='function'&&!setCoachUser.__v13){
        var baseCoach=setCoachUser;var wc=function(v){var r=baseCoach.apply(this,arguments);setTimeout(function(){renderFunnel();renderTeam();},0);return r;};wc.__v13=true;setCoachUser=wc;
      }
    }catch(e){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();