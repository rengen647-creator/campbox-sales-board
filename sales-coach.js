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
  var all=activeContractEntries().filter(function(c){return userId==='team'||c.user_id===userId;});
  var over7=all.filter(function(c){return c.age>7;}).length;
  var over3=all.filter(function(c){return c.age>=4&&c.age<=7;}).length;
  var late=all.filter(function(c){return (c.next_contact&&c.next_contact<selectedDate)||(c.target_date&&c.target_date<selectedDate);}).length;
  var ours=all.filter(function(c){return c.ball==='us';}).length;
  return {all:all,over7:over7,over3:over3,late:late,ours:ours};
}
function coachPriorityData(userId,diag,fd,cr){
  var out=[];
  if(fd.forecast<fd.target){
    out.push({
      tone:fd.risk>1?'bad':'warn',
      title:'Прогноз '+fd.forecast+' из '+fd.target,
      text:'При текущем темпе есть риск недобрать '+fd.risk+'. Нужен рост результата, а не просто активности.'
    });
  }
  var badAct=diag.filter(function(x){return x.type==='activity'&&x.tone!=='good';}).sort(function(a,b){return a.score-b.score;})[0];
  if(badAct){
    out.push({
      tone:badAct.tone,
      title:'Поджать: '+badAct.label,
      text:'Факт '+badAct.fact+' при ориентире '+badAct.guide+'. Сначала восстановить необходимый объём на этом участке.'
    });
  }
  var badConv=diag.filter(function(x){return x.type==='conversion'&&x.tone!=='good';}).sort(function(a,b){return a.score-b.score;})[0];
  if(badConv){
    out.push({
      tone:badConv.tone,
      title:'Разобрать качество: '+badConv.label,
      text:'Сейчас '+badConv.fact+'; ориентир '+badConv.guide+'. Больше действий не исправят эту просадку без работы со скриптом / следующим шагом.'
    });
  }
  if(cr.over7||cr.late){
    out.push({
      tone:cr.over7?'bad':'warn',
      title:'Дожать контрактинг',
      text:'Активных договоров '+cr.all.length+'; старше 7 дней — '+cr.over7+'; с просроченной датой — '+cr.late+'.'
    });
  }
  if(!out.length){
    out.push({
      tone:'good',
      title:'Сохранить текущий темп',
      text:'Критичных просадок по текущим данным нет. Не снижать активность и контролировать следующий шаг.'
    });
  }
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
      return '<div class="coach-person" onclick="setCoachUser(''+p.id+'')">'+
        '<div class="coach-person-head"><div><h3>'+esc(p.full_name||p.email||'Сотрудник')+'</h3><small>нажми для диагностики</small></div><span class="pill '+pt+'">'+(d.forecast>=d.target?'по плану':'риск')+'</span></div>'+
        '<div class="coach-person-kpis"><div><span>Факт</span><b>'+d.fact+'/'+d.target+'</b></div><div><span>Прогноз</span><b>'+d.forecast+'/'+d.target+'</b></div><div><span>До цели</span><b>'+Math.max(d.target-d.fact,0)+'</b></div></div>'+
        '<div class="coach-person-diagnosis">'+esc(coachWorstLabel(p.id))+'</div></div>';
    }).join('');
  }
}
