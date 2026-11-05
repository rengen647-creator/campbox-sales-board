/* Team daily cards — presentation layer over the existing daily_sales rows.
   The original table, RLS, save functions and calculations stay authoritative. */
(function(){
  'use strict';
  var icons={
    calls:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.9a2 2 0 0 1-.6 1.8L7 10.3a16 16 0 0 0 6.7 6.7l1.9-2a2 2 0 0 1 1.8-.6l2.9.5a2 2 0 0 1 1.7 2z"/>',
    booked:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5h4"/>',
    meetings:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    offers:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',
    follow:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>'
  };
  function icon(k){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[k]+'</svg>';}
  function cap(x){return Math.min(100,Math.max(0,x));}
  function score(r){return rowActivityPct(r);}
  function visibleRows(){return isManager()?dayRows:dayRows.filter(function(r){return currentUser&&r.user_id===currentUser.id;});}
  function metricCard(r,k,auto,editable){
    var plan=num(r[k+'_plan']),fact=num(r[k+'_fact']),remaining=Math.max(0,plan-fact);
    var completion=plan>0?cap(pct(fact,plan)):0;
    var note=auto&&auto.metrics&&auto.metrics[k];
    var why=note&&(note.reason||note.shortReason)||'План рассчитан автоматически по месячной цели и текущему темпу.';
    var status=plan===0?'План не задан':remaining===0?'Цель на сегодня достигнута':'Осталось '+remaining+' до плана';
    return '<div class="tdc-metric'+(plan>0&&remaining===0?' complete':'')+'" data-tdc-metric="'+esc(k)+'">'+
      '<div class="tdc-metric-head"><span class="tdc-symbol">'+icon(k)+'</span><div class="tdc-metric-info"><strong>'+esc(metricLabels[k])+'</strong><small class="tdc-metric-status">'+status+'</small></div></div>'+
      '<div class="tdc-metric-values"><div class="tdc-plan"><span>План</span><b>'+plan+'</b></div>'+
      '<label class="tdc-fact"><span>Факт</span><input type="number" min="0" step="1" inputmode="numeric" data-k="'+esc(k)+'_fact" data-tdc-fact="'+esc(k)+'" aria-label="'+esc(metricLabels[k])+': факт" value="'+fact+'"'+(editable?'':' disabled')+'></label></div>'+
      '<div class="tdc-metric-bottom"><div class="tdc-track" role="progressbar" aria-label="Выполнение '+esc(metricLabels[k])+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+completion+'"><i style="width:'+completion+'%"></i></div>'+
      '<details class="tdc-reason"><summary>Откуда план?</summary><p>'+esc(why)+'</p></details></div></div>';
  }
  function person(r){
    var pr=profiles.find(function(p){return p.id===r.user_id;})||{full_name:'Сотрудник'};
    var editable=isManager()||(currentUser&&r.user_id===currentUser.id);
    var cs=contractRowStats(r),rs=reflectionState(r.comment),percent=score(r);
    var auto=selectedDate===todayISO()?coachAutoPlan(r.user_id):null;
    var caption=rs.state==='done'?'Все три блока заполнены':rs.state==='partial'?rs.count+' из 3 блоков заполнено':'Результат / блокеры / завтра';
    var contractCaption=cs.active?'0–3 дня: '+cs.fresh+' · 4–7: '+cs.mid+' · более 7: '+cs.over7:'Нет активных договоров';
    return '<article class="tdc-person'+(currentUser&&r.user_id===currentUser.id?' is-me':'')+'" data-user-id="'+esc(r.user_id)+'">'+
      '<header class="tdc-person-head"><div class="tdc-heading"><span class="tdc-kicker">РАБОЧИЙ РИТМ · '+esc(selectedDate)+'</span><h3>'+esc(pr.full_name||pr.email||'Сотрудник')+'</h3><p>Активность за день. План автоматически, факт заполняет менеджер.</p></div>'+
      '<div class="tdc-ring" style="--tdc-pct:'+cap(percent)+'"><div class="tdc-ring-core"><strong>'+percent+'%</strong><small>за день</small></div></div></header>'+
      '<div class="tdc-grid">'+activityKeys.map(function(k){return metricCard(r,k,auto,editable);}).join('')+'</div>'+
      '<div class="tdc-results"><div class="tdc-result"><span class="tdc-result-label">Договоры на подписании</span>'+
      '<button type="button" class="tdc-link-action" data-tdc-contract><strong>'+cs.active+'</strong><span>На подписании</span></button>'+
      '<small>'+esc(contractCaption)+'</small></div>'+
      '<div class="tdc-result"><span class="tdc-result-label">Подключено лагерей</span>'+
      '<label class="tdc-connected"><span>Факт за день</span><input type="number" min="0" step="1" inputmode="numeric" data-k="connected_fact" aria-label="Подключено лагерей: факт" value="'+num(r.connected_fact)+'"'+(editable?'':' disabled')+'></label>'+
      '<small>Не входит в % активности</small></div>'+
      '<div class="tdc-result"><span class="tdc-result-label">Итог дня сотрудника</span>'+
      '<button type="button" class="tdc-link-action tdc-reflection" data-tdc-reflection><strong>'+esc(rs.label)+'</strong><span>Открыть итог дня</span></button>'+
      '<small>'+esc(caption)+'</small></div></div></article>';
  }
  function summary(rows){
    var ps=activityKeys.filter(function(k){return rows.reduce(function(t,r){return t+num(r[k+'_plan']);},0)>0;}).map(function(k){
      var p=rows.reduce(function(t,r){return t+num(r[k+'_plan']);},0),f=rows.reduce(function(t,r){return t+num(r[k+'_fact']);},0);
      return cap(pct(f,p));
    });
    var overall=ps.length?Math.round(ps.reduce(function(t,x){return t+x;},0)/ps.length):0;
    var done=rows.filter(function(r){return reflectionState(r.comment).state==='done';}).length;
    var connected=rows.reduce(function(t,r){return t+num(r.connected_fact);},0);
    return '<div class="tdc-overview"><div><span>Активность '+(isManager()?'команды':'за день')+'</span><strong data-tdc-overall>'+overall+'%</strong></div>'+
      '<div><span>Итоги сотрудников</span><strong data-tdc-reflections>'+done+' / '+rows.length+'</strong></div>'+
      '<div><span>Подключено за день</span><strong data-tdc-connected>'+connected+'</strong></div></div>';
  }
  function refreshOne(card,r){
    if(!card||!r)return;
    var percent=score(r),ring=card.querySelector('.tdc-ring');
    if(ring){ring.style.setProperty('--tdc-pct',cap(percent));ring.querySelector('strong').textContent=percent+'%';}
    activityKeys.forEach(function(k){
      var m=card.querySelector('[data-tdc-metric="'+k+'"]');if(!m)return;
      var plan=num(r[k+'_plan']),fact=num(r[k+'_fact']),remaining=Math.max(0,plan-fact);
      m.classList.toggle('complete',plan>0&&remaining===0);
      m.querySelector('.tdc-metric-status').textContent=plan===0?'План не задан':remaining===0?'Цель на сегодня достигнута':'Осталось '+remaining+' до плана';
      m.querySelector('.tdc-plan b').textContent=plan;
      var track=m.querySelector('.tdc-track'),v=plan>0?cap(pct(fact,plan)):0;
      track.setAttribute('aria-valuenow',v);track.querySelector('i').style.width=v+'%';
      var inp=m.querySelector('[data-tdc-fact]');if(inp!==document.activeElement)inp.value=fact;
    });
    var connected=card.querySelector('[data-k="connected_fact"]');
    if(connected&&connected!==document.activeElement)connected.value=num(r.connected_fact);
  }
  function refresh(){
    var root=document.getElementById('teamDailyCards');if(!root)return;
    visibleRows().forEach(function(r){
      var card=Array.from(root.querySelectorAll('.tdc-person')).find(function(x){return x.dataset.userId===r.user_id;});
      refreshOne(card,r);
    });
    var overview=root.querySelector('.tdc-overview');
    if(overview){
      var tmp=document.createElement('div');tmp.innerHTML=summary(visibleRows());
      overview.innerHTML=tmp.firstChild.innerHTML;
    }
  }
  function render(){
    var root=document.getElementById('teamDailyCards');if(!root)return;
    var rows=visibleRows();
    root.innerHTML=rows.length?summary(rows)+rows.map(person).join(''):'<p class="tdc-empty">Нет данных по сотрудникам за выбранный день.</p>';
    root.querySelectorAll('.tdc-person').forEach(function(card){
      var uid=card.dataset.userId;
      card.querySelectorAll('[data-k]').forEach(function(inp){
        inp.addEventListener('input',function(){
          var r=dayRows.find(function(x){return x.user_id===uid;});
          if(!r||!(isManager()||(currentUser&&currentUser.id===uid)))return;
          r[inp.dataset.k]=Math.max(0,Math.floor(num(inp.value)));
          syncSalesInputs(uid,card);
          refresh();
          changed();
        });
      });
      var contract=card.querySelector('[data-tdc-contract]');
      if(contract)contract.addEventListener('click',function(){openContracts(uid);});
      var reflection=card.querySelector('[data-tdc-reflection]');
      if(reflection)reflection.addEventListener('click',function(){openReflection(uid);});
    });
  }
  window.CampBoxTeamDailyCards={render:render,refresh:refresh};
})();