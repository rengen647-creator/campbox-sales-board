function setCoachUser(v){
  coachUserId=isManager()?v:currentUser.id;
  renderSalesCoach();
}
function coachScopeRows(source,userId,cut){
  if(cut===undefined)cut=true;
  var ids=userId==='team'?profiles.map(function(p){return p.id;}):[userId];
  return source.filter(function(r){
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
  var fact=sum(rows,'connected_fact');
  var wdTotal=totalWorkdays(selectedMonth)||1;
  var day=Number(selectedDate.slice(8,10));
  var wdDone=Math.max(1,workdaysThrough(selectedMonth,day));
  var need=Math.ceil(target*wdDone/wdTotal);
  var forecast=Math.round(fact/wdDone*wdTotal);
  var risk=Math.max(target-forecast,0);
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
  if(userId!=='team'&&isManager()){
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
  var all=activeContractEntries().filter(function(c){return userId==='team'||c.user_id===userId;});
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
    if(isManager()&&userId!=='team'){
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
function coachDailyBase(userId,key){
  function avgDaily(rows){
    if(userId!=='team'){
      var own=rows.filter(function(r){return num(r[key+'_plan'])>0;});
      return own.length?sum(own,key+'_plan')/own.length:0;
    }
    var byDate={};
    rows.forEach(function(r){if(num(r[key+'_plan'])>0)byDate[r.report_date]=(byDate[r.report_date]||0)+num(r[key+'_plan']);});
    var vals=Object.values(byDate);
    return vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:0;
  }
  var before=coachScopeRows(monthRows,userId,true).filter(function(r){return String(r.report_date)<selectedDate;});
  var beforeAvg=avgDaily(before);
  if(beforeAvg>0)return {v:beforeAvg,src:'средний план этого месяца'};
  var prev=coachScopeRows(prevMonthRows,userId,false);
  var prevAvg=avgDaily(prev);
  if(prevAvg>0)return {v:prevAvg,src:'средний план прошлого месяца'};
  if(userId!=='team'){
    var row=dayRows.find(function(r){return r.user_id===userId;});
    if(row&&num(row[key+'_plan'])>0)return {v:num(row[key+'_plan']),src:'последний заданный план'};
  }
  return {v:0,src:'нет базы'};
}
function coachAutoPlan(userId){
  var target=coachTarget(userId);
  var beforeRows=coachScopeRows(monthRows,userId,true).filter(function(r){return String(r.report_date)<selectedDate;});
  var wdTotal=totalWorkdays(selectedMonth)||1;
  var day=Number(selectedDate.slice(8,10));
  var wdBefore=Math.max(0,workdaysThrough(selectedMonth,day)-(isWorkdayISO(selectedDate)?1:0));
  var remaining=Math.max(1,wdTotal-wdBefore);
  var ratios=coachFunnelRatios(userId);
  var required={};
  var source='';
  if(ratios.callBook&&ratios.bookMeet&&ratios.meetOffer&&ratios.offerConnect){
    required.connected=target;
    required.offers=Math.ceil(required.connected/ratios.offerConnect.v);
    required.meetings=Math.ceil(required.offers/ratios.meetOffer.v);
    required.booked=Math.ceil(required.meetings/ratios.bookMeet.v);
    required.calls=Math.ceil(required.booked/ratios.callBook.v);
    var followBase=coachDailyBase(userId,'follow');
    required.follow=Math.max(0,Math.ceil(followBase.v*wdTotal));
    source='от цели месяца и реальной конверсии';
  }else{
    activityKeys.forEach(function(k){
      var base=coachDailyBase(userId,k);
      required[k]=Math.ceil(base.v*wdTotal);
    });
    source='от рабочего темпа прошлых планов';
  }
  var metrics={};
  activityKeys.forEach(function(k){
    var factBefore=sum(beforeRows,k+'_fact');
    var needMonth=Math.max(0,num(required[k]));
    var remainingNeed=Math.max(0,needMonth-factBefore);
    var plan=Math.ceil(remainingNeed/remaining);
    var base=coachDailyBase(userId,k);
    var baseline=Math.ceil(base.v);
    var uplift=baseline>0?plan-baseline:0;
    var pressure=baseline>0?plan/baseline:(plan>0?1:0);
    var shortReason='осталось '+remainingNeed+' / '+remaining+' раб. дн.';
    var reason='До конца месяца по показателю «'+metricLabels[k]+'» нужно '+needMonth+'. До сегодня сделано '+factBefore+'. Осталось '+remainingNeed+' на '+remaining+' рабочих дней → план на сегодня '+plan+'. Основа расчёта: '+source+'.';
    metrics[k]={plan:plan,requiredMonth:needMonth,factBefore:factBefore,remainingNeed:remainingNeed,remainingDays:remaining,baseline:baseline,uplift:uplift,pressure:pressure,shortReason:shortReason,reason:reason};
  });
  return {userId:userId,target:target,remainingDays:remaining,source:source,ratios:ratios,metrics:metrics};
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
    var severity=(m.pressure||0)+(weak?(weak.tone==='bad'?1.5:.7):0)+(m.uplift>0?.5:0);
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
  if(out.length<3&&fd.forecast<fd.target){
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
  $('coachFact').textContent=fd.fact;
  $('coachNeed').textContent=fd.need;
  $('coachForecast').textContent=fd.forecast;
  $('coachRisk').textContent=fd.risk?'-'+fd.risk:'0';
  $('coachRiskNote').textContent=fd.risk?'ожидаемый недобор при текущем темпе':'по текущему темпу риска нет';
  var tone=fd.forecast>=fd.target?'good':fd.risk<=1?'warn':'bad';
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
      var pt=d.forecast>=d.target?'good':d.risk<=1?'warn':'bad';
      return '<div class="coach-person" data-coach-user="'+esc(p.id)+'" onclick="setCoachUser(this.dataset.coachUser)">'+
        '<div class="coach-person-head"><div><h3>'+esc(p.full_name||p.email||'Сотрудник')+'</h3><small>нажми для диагностики</small></div><span class="pill '+pt+'">'+(d.forecast>=d.target?'по плану':'риск')+'</span></div>'+
        '<div class="coach-person-kpis"><div><span>Факт</span><b>'+d.fact+'/'+d.target+'</b></div><div><span>Прогноз</span><b>'+d.forecast+'/'+d.target+'</b></div><div><span>До цели</span><b>'+Math.max(d.target-d.fact,0)+'</b></div></div>'+
        '<div class="coach-person-diagnosis">'+esc(coachWorstLabel(p.id))+'</div></div>';
    }).join('');
  }
}
