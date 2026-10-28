function setCoachUser(v){
  coachUserId=isManager()?v:currentUser.id;
  renderSalesCoach();
}
function coachScopeRows(source,userId,cut){
  if(cut===undefined)cut=true;
  var ids=userId==='team'?profiles.map(function(p){return p.id;}):[userId];
  var rows=source;
  if(source===monthRows&&Array.isArray(dayRows)&&dayRows.length){
    rows=monthRows.filter(function(r){return String(r.report_date)!==selectedDate;}).concat(dayRows.map(function(r){return Object.assign({},r,{report_date:selectedDate});}));
  }
  return rows.filter(function(r){
    return ids.indexOf(r.user_id)>=0&&(!cut||String(r.report_date)<=selectedDate);
  });
}
function coachTarget(userId){
  return userId==='team'?num($('monthTarget').value):PERSONAL_MONTH_TARGET;
}
function coachPersonName(userId){
  if(userId==='team')return 'Команда';
  var p=profiles.find(function(x){return x.id===userId;});
  return p?(p.full_name||p.email||'Менеджер'):'Менеджер';
}
function coachForecastData(userId){
  var rows=coachScopeRows(monthRows,userId,true);
  var target=coachTarget(userId);
  var fact=SalesFactUI.model(userId).value;
  var wdTotal=totalWorkdays(selectedMonth)||1;
  var day=Number(selectedDate.slice(8,10));
  var wdDone=Math.max(1,workdaysThrough(selectedMonth,day));
  var need=Math.ceil(target*wdDone/wdTotal);
  var forecast=fact===null?null:Math.round(fact/wdDone*wdTotal);
  var risk=forecast===null?null:Math.max(target-forecast,0);
  return {target:target,fact:fact,wdTotal:wdTotal,wdDone:wdDone,need:need,forecast:forecast,risk:risk};
}
function coachConversionRows(rows){
  var vals={
    calls:sum(rows,'calls_fact'),
    booked:sum(rows,'booked_fact'),
    meetings:sum(rows,'meetings_fact'),
    offers:sum(rows,'offers_fact')
  };
  return [
    {key:'call_book',label:'Звонок → назначенная встреча',num:vals.booked,den:vals.calls,v:pct(vals.booked,vals.calls)},
    {key:'book_meet',label:'Назначенная → проведённая встреча',num:vals.meetings,den:vals.booked,v:pct(vals.meetings,vals.booked)},
    {key:'meet_offer',label:'Встреча → КП / расчёт',num:vals.offers,den:vals.meetings,v:pct(vals.offers,vals.meetings)}
  ];
}
function coachBenchmark(userId,key){
  var prev=coachConversionRows(coachScopeRows(prevMonthRows,userId,false)).find(function(x){return x.key===key;});
  if(prev&&prev.den>=3)return {v:prev.v,label:'прошлый месяц'};
  if(userId!=='team'){
    var team=coachConversionRows(coachScopeRows(monthRows,'team',true)).find(function(x){return x.key===key;});
    if(team&&team.den>=3)return {v:team.v,label:'команда сейчас'};
  }
  return null;
}
function coachDiagnostics(userId){
  var rows=coachScopeRows(monthRows,userId,true);
  var list=[];
  activityKeys.forEach(function(k){
    var plan=sum(rows,k+'_plan');
    var fact=sum(rows,k+'_fact');
    if(plan<=0&&fact<=0)return;
    var ach=plan>0?pct(fact,plan):100;
    var tone=ach>=100?'good':ach>=80?'warn':'bad';
    list.push({
      type:'activity',key:k,label:metricLabels[k],
      guide:plan?String(plan):'без плана',
      fact:String(fact),
      delta:plan?((fact-plan>0?'+':'')+(fact-plan)):'—',
      tone:tone,
      score:Math.min(ach,100),
      diagnosis:plan?(ach>=100?'Темп активности выполнен':ach>=80?'Небольшое отставание':'Не хватает объёма'):'Есть факт, но нет плана'
    });
  });
  coachConversionRows(rows).forEach(function(c){
    if(c.den<3)return;
    var b=coachBenchmark(userId,c.key);
    if(!b){
      list.push({type:'conversion',key:c.key,label:c.label,guide:'нет базы',fact:c.v+'%',delta:'—',tone:'warn',score:100,diagnosis:'Нужно больше данных для сравнения'});
      return;
    }
    var delta=c.v-b.v;
    var tone=delta>=-3?'good':delta>=-10?'warn':'bad';
    var score=b.v?Math.min(100,Math.round(c.v/b.v*100)):100;
    list.push({
      type:'conversion',key:c.key,label:c.label,
      guide:b.v+'% · '+b.label,
      fact:c.v+'%',
      delta:(delta>0?'+':'')+delta+' п.п.',
      tone:tone,score:score,
      diagnosis:tone==='good'?'Конверсия не хуже ориентира':tone==='warn'?'Есть просадка конверсии':'Сильная просадка конверсии'
    });
  });
  return list;
}
function coachReasonsData(userId){
  var map=new Map();
  coachScopeRows(monthRows,userId,true).forEach(function(r){
    var ref=parseReflection(r.comment);
    (ref.reasons||[]).filter(function(x){return x&&x!=='Нет блокеров';}).forEach(function(x){
      map.set(x,(map.get(x)||0)+1);
    });
  });
  return Array.from(map.entries()).sort(function(a,b){return b[1]-a[1];});
}
function coachContractRisk(userId){
  var all=SalesFactUI.pipeline(userId).open.map(function(c){return Object.assign({},c,{id:c.contract_key,user_id:c.sales_user_id,client:SalesFactUI.campName(c.camp_id),age:contractAge(c)});});
  var over7=all.filter(function(c){return c.age>7;}).length;
  var over3=all.filter(function(c){return c.age>=4&&c.age<=7;}).length;
  var late=all.filter(function(c){return (c.next_contact&&c.next_contact<selectedDate)||(c.target_date&&c.target_date<selectedDate);}).length;
  var ours=all.filter(function(c){return c.ball==='us';}).length;
  return {all:all,over7:over7,over3:over3,late:late,ours:ours};
}

function coachRatioFromRows(rows,numKey,denKey){
  var den=sum(rows,denKey+'_fact'),n=sum(rows,numKey+'_fact');
  if(den<3||n<=0)return null;
  return Math.max(0.03,Math.min(1,n/den));
}
function coachFunnelRatios(userId){
  var ownPrev=coachScopeRows(prevMonthRows,userId,false);
  var ownNow=coachScopeRows(monthRows,userId,true);
  var teamPrev=coachScopeRows(prevMonthRows,'team',false);
  var teamNow=coachScopeRows(monthRows,'team',true);
  function pick(numKey,denKey){
    var candidates=[
      {v:coachRatioFromRows(ownPrev,numKey,denKey),src:'прошлый месяц'},
      {v:coachRatioFromRows(ownNow,numKey,denKey),src:'текущий месяц'}
    ];
    if(userId!=='team'){
      candidates.splice(1,0,
        {v:coachRatioFromRows(teamPrev,numKey,denKey),src:'команда · прошлый месяц'},
        {v:coachRatioFromRows(teamNow,numKey,denKey),src:'команда · текущий месяц'}
      );
    }
    if(userId==='team'){
      candidates=[
        {v:coachRatioFromRows(teamPrev,numKey,denKey),src:'прошлый месяц'},
        {v:coachRatioFromRows(teamNow,numKey,denKey),src:'текущий месяц'}
      ];
    }
    return candidates.find(function(x){return x.v!==null;})||null;
  }
  return {
    callBook:pick('booked','calls'),
    bookMeet:pick('meetings','booked'),
    meetOffer:pick('offers','meetings'),
    offerConnect:pick('connected','offers')
  };
}
// Stable baseline: use a low early-month reference instead of the feedback-inflated average.
function coachDailyBase(userId,key){
  function earliest(rows){
    var dates={};
    rows.forEach(function(r){
      var value=num(r[key+'_plan']);
      if(value>0){
        var d=String(r.report_date);
        if(!dates[d])dates[d]=[];
        dates[d].push(value);
      }
    });
    var keys=Object.keys(dates).sort().slice(0,3);
    if(!keys.length)return 0;
    var values=keys.map(function(d){return dates[d].reduce(function(a,b){return a+b;},0);});
    return Math.max(1,Math.round(values.reduce(function(a,b){return a+b;},0)/values.length));
  }
  var earlier=coachScopeRows(monthRows,userId,true).filter(function(r){return String(r.report_date)<selectedDate;});
  var baseline=earliest(earlier);
  if(baseline>0)return {v:baseline,src:'первые три плановых дня текущего месяца'};
  baseline=earliest(coachScopeRows(prevMonthRows,userId,false));
  if(baseline>0)return {v:baseline,src:'первые три плановых дня прошлого месяца'};
  var today=coachScopeRows(dayRows,userId,true);
  baseline=earliest(today);
  return {v:baseline,src:baseline?'дневной норматив':'нет дневного норматива'};
}
function coachAutoPlan(userId){
  var target=coachTarget(userId);
  var beforeRows=coachScopeRows(monthRows,userId,true).filter(function(r){return String(r.report_date)<selectedDate;});
  var wdTotal=totalWorkdays(selectedMonth)||1;
  var day=Number(selectedDate.slice(8,10));
  var wdBefore=Math.max(0,workdaysThrough(selectedMonth,day)-(isWorkdayISO(selectedDate)?1:0));
  var remaining=Math.max(1,wdTotal-wdBefore);
  var ratios=coachFunnelRatios(userId),metrics={};
  activityKeys.forEach(function(k){
    var base=coachDailyBase(userId,k);
    var baseline=Math.max(0,Math.ceil(base.v));
    var factBefore=sum(beforeRows,k+'_fact');
    // Avoid feeding historical auto-inflated targets back into today's target.
    var plannedBefore=baseline*wdBefore;
    var backlog=Math.max(0,plannedBefore-factBefore);
    var backlogAdd=Math.ceil(backlog/remaining);
    var remainingNeed=Math.max(0,baseline*wdTotal-factBefore);
    var goalRate=Math.ceil(remainingNeed/remaining);
    // Operational daily target remains stable. Recovery is guidance, never a mandate.
    var plan=baseline;
    var uplift=0,pressure=baseline?1:0;
    var shortReason='база '+baseline+(backlog?', отставание '+backlog+' отдельно':'');
    var reason='Рабочий дневной план: '+baseline+' ('+base.src+'). За прошедшие рабочие дни по стабильной базе '+plannedBefore+', факт '+factBefore+', отставание '+backlog+'. Рекомендуемый темп восстановления '+goalRate+' в день и дополнительно '+backlogAdd+' в день для компенсации долга показываются справочно, но не увеличивают обязательный план. Месячная цель новых лагерей '+target+' учитывается отдельно.';
    metrics[k]={plan:plan,requiredMonth:baseline*wdTotal,factBefore:factBefore,plannedBefore:plannedBefore,backlog:backlog,remainingNeed:remainingNeed,remainingDays:remaining,baseline:baseline,uplift:uplift,pressure:pressure,shortReason:shortReason,reason:reason,advisoryRate:goalRate};
  });
  return {userId:userId,target:target,remainingDays:remaining,source:'стабильный дневной норматив (без переноса долга в план)',ratios:ratios,metrics:metrics};
}
function applyAutoDailyPlans(){
  if(selectedDate!==todayISO())return;
  dayRows.forEach(function(r){
    var auto=coachAutoPlan(r.user_id);
    activityKeys.forEach(function(k){r[k+'_plan']=auto.metrics[k].plan;});
  });
}
function coachTeamFocusItems(){
  var auto=coachAutoPlan('team');
  var diag=coachDiagnostics('team');
  var convWeak=diag.filter(function(x){return x.type==='conversion'&&x.tone!=='good';});
  var items=activityKeys.map(function(k){
    var m=auto.metrics[k];
    var related=k==='booked'?'call_book':k==='meetings'?'book_meet':k==='offers'?'meet_offer':null;
    var conv=related?convWeak.find(function(x){return x.key===related;}):null;
    var severity=(m.pressure||0)+(conv?(conv.tone==='bad'?1.5:.7):0);
    return {key:k,m:m,conv:conv,severity:severity};
  }).filter(function(x){return x.m.plan>0;}).sort(function(a,b){return b.severity-a.severity;});
  return items.slice(0,3).map(function(x){
    var why=x.conv?('просадка конверсии '+x.conv.fact+' при ориентире '+x.conv.guide):('нужно добрать '+x.m.remainingNeed+' до месячной потребности');
    return metricLabels[x.key]+': план команды сегодня '+x.m.plan+' — '+why+'.';
  });
}
function applyAutoTeamFocus(){
  if(selectedDate!==todayISO())return;
  var items=coachTeamFocusItems();
  for(var i=1;i<=3;i++){
    var value=items[i-1]||'';
    daySettings['focus'+i]=value;
    var el=$('focus'+i);
    if(el)el.value=value;
  }
}

function coachPriorityData(userId,diag,fd,cr){
  var out=[];
  var auto=coachAutoPlan(userId);
  var weakByKey={};
  diag.filter(function(x){return x.tone!=='good';}).forEach(function(x){weakByKey[x.key]=x;});
  var ranked=activityKeys.map(function(k){
    var m=auto.metrics[k];
    var related=k==='booked'?'call_book':k==='meetings'?'book_meet':k==='offers'?'meet_offer':null;
    var weak=weakByKey[k]||(related?weakByKey[related]:null);
    var severity=(m.pressure||0)+(weak?(weak.tone==='bad'?1.5:.7):0)+(m.uplift>0?0.5:0);
    return {key:k,m:m,weak:weak,severity:severity};
  }).filter(function(x){return x.m.plan>0;}).sort(function(a,b){return b.severity-a.severity;});
  ranked.slice(0,2).forEach(function(x){
    var extra=x.m.uplift>0?' Это на '+x.m.uplift+' выше базового темпа.':'';
    out.push({
      tone:x.weak?x.weak.tone:(x.m.uplift>0?'warn':'good'),
      title:'Сегодня: '+metricLabels[x.key]+' — '+x.m.plan,
      text:x.m.reason+extra
    });
  });
  if(cr.over7||cr.late){
    out.push({
      tone:cr.over7?'bad':'warn',
      title:'Дожать контрактинг',
      text:'Активных договоров '+cr.all.length+'; старше 7 дней — '+cr.over7+'; с просроченной датой — '+cr.late+'.'
    });
  }
  if(out.length<3&&fd.forecast!==null&&fd.forecast<fd.target){
    out.push({
      tone:fd.risk>1?'bad':'warn',
      title:'Риск месяца: '+fd.forecast+' из '+fd.target,
      text:'Если текущая скорость подключений не изменится, недобор составит '+fd.risk+'. Автоплан выше уже распределяет нужный объём по оставшимся рабочим дням.'
    });
  }
  if(!out.length)out.push({tone:'good',title:'Сохранить текущий темп',text:'Критичных просадок по текущим данным нет. План на сегодня рассчитан из оставшегося объёма месяца.'});
  return out.slice(0,3);
}
function coachWorstLabel(userId){
  var d=coachDiagnostics(userId).filter(function(x){return x.tone!=='good';}).sort(function(a,b){return a.score-b.score;})[0];
  if(d)return d.label+': '+d.diagnosis.toLowerCase();
  var cr=coachContractRisk(userId);
  if(cr.over7)return 'Контрактинг: '+cr.over7+' договор(а) старше 7 дней';
  return 'Критичных просадок нет';
}
function renderCoachSelect(){
  var el=$('coachUser');
  if(!el)return;
  var allowed;
  if(isManager()){
    allowed=[{id:'team',name:'Вся команда'}].concat(profiles.map(function(p){return {id:p.id,name:p.full_name||p.email||'Сотрудник'};}));
  }else{
    allowed=profiles.filter(function(p){return p.id===currentUser.id;}).map(function(p){return {id:p.id,name:p.full_name||p.email||'Я'};});
  }
  if(!allowed.some(function(x){return x.id===coachUserId;}))coachUserId=isManager()?'team':currentUser.id;
  el.innerHTML=allowed.map(function(x){
    return '<option value="'+esc(x.id)+'" '+(x.id===coachUserId?'selected':'')+'>'+esc(x.name)+'</option>';
  }).join('');
  el.disabled=!isManager();
}
function renderSalesCoach(){
  if(!$('coachUser')||!currentUser)return;
  renderCoachSelect();
  var uid=isManager()?coachUserId:currentUser.id;
  var fd=coachForecastData(uid);
  var diag=coachDiagnostics(uid);
  var reasons=coachReasonsData(uid);
  var cr=coachContractRisk(uid);
  var prio=coachPriorityData(uid,diag,fd,cr);
  $('coachTarget').textContent=fd.target;
  $('coachTargetNote').textContent=uid==='team'?'цель команды':'KPI менеджера';
  $('coachFact').textContent=fd.fact??'—';
  $('coachNeed').textContent=fd.need;
  $('coachForecast').textContent=fd.forecast??'—';
  $('coachRisk').textContent=fd.risk===null?'—':fd.risk?'-'+fd.risk:'0';
  $('coachRiskNote').textContent=fd.risk===null?'Нет сверенных данных':fd.risk?'ожидаемый недобор при текущем темпе':'по текущему темпу риска нет';
  var tone=fd.forecast===null?'warn':fd.forecast>=fd.target?'good':fd.risk<=1?'warn':'bad';
  $('coachForecastCard').className='coach-kpi '+tone;
  $('coachRiskCard').className='coach-kpi '+tone;
  var weak=diag.filter(function(x){return x.tone!=='good';}).sort(function(a,b){return a.score-b.score;})[0];
  var box=$('coachDiagnosis');
  box.className='coach-diagnosis '+(weak?weak.tone:tone);
  if(weak){
    box.innerHTML='<b>'+esc(coachPersonName(uid))+': главная просадка — '+esc(weak.label)+'</b>'+esc(weak.diagnosis)+'. Ориентир: '+esc(weak.guide)+', факт: '+esc(weak.fact)+'.';
  }else{
    box.innerHTML='<b>'+esc(coachPersonName(uid))+': критичных просадок не видно</b>Текущие активности и конверсии держатся около планового / исторического уровня. Контролируем месячный результат и контрактинг.';
  }
  $('coachDiagBody').innerHTML=diag.length?diag.map(function(x){
    return '<tr><td class="metric">'+esc(x.label)+'</td><td>'+esc(x.guide)+'</td><td>'+esc(x.fact)+'<div class="coach-meter"><i class="'+x.tone+'" style="width:'+Math.max(3,Math.min(x.score,100))+'%"></i></div></td><td class="delta '+x.tone+'">'+esc(x.delta)+'</td><td><span class="pill '+x.tone+'">'+esc(x.diagnosis)+'</span></td></tr>';
  }).join(''):'<tr><td colspan="5" class="empty">Пока недостаточно данных для диагностики.</td></tr>';
  $('coachPriorities').innerHTML=prio.map(function(p,i){
    return '<div class="coach-priority '+p.tone+'"><div class="num">'+(i+1)+'</div><div><b>'+esc(p.title)+'</b><small>'+esc(p.text)+'</small></div></div>';
  }).join('');
  $('coachReasons').innerHTML=reasons.length?reasons.slice(0,5).map(function(r){
    return '<span class="coach-reason">'+esc(r[0])+' · '+r[1]+'</span>';
  }).join(''):'<span class="hint">Менеджер пока не отметил причины в итогах дня.</span>';
  $('coachContracts').innerHTML=
    '<span>На подписании: <b>'+cr.all.length+'</b></span>'+
    '<span class="'+(cr.over3?'warn':'')+'">4–7 дней: <b>'+cr.over3+'</b></span>'+
    '<span class="'+(cr.over7?'bad':'')+'">&gt;7 дней: <b>'+cr.over7+'</b></span>'+
    '<span class="'+(cr.late?'bad':'')+'">Просрочены: <b>'+cr.late+'</b></span>'+
    '<span class="'+(cr.ours?'warn':'')+'">Мяч у нас: <b>'+cr.ours+'</b></span>';
  var wrap=$('coachTeamWrap');
  if(wrap)wrap.classList.toggle('hidden',!isManager());
  if(isManager()){
    $('coachTeam').innerHTML=profiles.map(function(p){
      var d=coachForecastData(p.id);
      var pt=d.forecast===null?'warn':d.forecast>=d.target?'good':d.risk<=1?'warn':'bad';
      return '<div class="coach-person" data-coach-user="'+esc(p.id)+'" onclick="setCoachUser(this.dataset.coachUser)">'+
        '<div class="coach-person-head"><div><h3>'+esc(p.full_name||p.email||'Сотрудник')+'</h3><small>нажми для диагностики</small></div><span class="pill '+pt+'">'+(d.forecast===null?'Нет сверенных данных':d.forecast>=d.target?'по плану':'риск')+'</span></div>'+
        '<div class="coach-person-kpis"><div><span>Факт</span><b>'+(d.fact??'—')+'/'+d.target+'</b></div><div><span>Прогноз</span><b>'+(d.forecast??'—')+'/'+d.target+'</b></div><div><span>До цели</span><b>'+(d.fact===null?'—':Math.max(d.target-d.fact,0))+'</b></div></div>'+
        '<div class="coach-person-diagnosis">'+esc(coachWorstLabel(p.id))+'</div></div>';
    }).join('');
  }
}
