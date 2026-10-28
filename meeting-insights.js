/* CampBox Meeting Insights v1: derived scorecards only, no transcripts or personal contacts. */
(function () {
'use strict';
var root=null, rows=[], mounted=false, busy=false, lastManager='', lastType='ALL', lastPeriod='90';
var RUBRIC=[
 ['structure','Управление встречей',10],
 ['diagnostics','Диагностика',15],
 ['pain_priority','Боль / влияние / приоритет',20],
 ['decision_process','Процесс принятия решения',10],
 ['personalization','Персонализация / ценность',15],
 ['objections','Возражения',10],
 ['next_step','Следующий шаг',15],
 ['communication','Коммуникация',5]
];
var TYPES={ALL:'Все типы',DISCOVERY:'Выявление потребностей',DEMO:'Демонстрация',NEGOTIATION:'Переговоры',FOLLOW_UP:'Повторная встреча',OTHER:'Другой тип'};
var OUTCOMES={UNKNOWN:'Пока неизвестно',NEXT_MEETING:'Назначена встреча',PROPOSAL:'Отправлено КП',CONTRACT_SENT:'Договор отправлен',SIGNED:'Договор подписан',LOST:'Клиент потерян'};
var esc=function(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c];});};
var get=function(id){return document.getElementById(id);};
var avg=function(a){return a.length ? a.reduce(function(s,n){return s+n;},0)/a.length : null;};
var number=function(n){return n==null?'—':Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});};
var good=function(r){return r.reliability==='RELIABLE' && Number(r.coverage_pct)>=70;};
var asArray=function(x){return Array.isArray(x)?x:[];};
var validId=function(x){return /^[a-f0-9-]{36}$/i.test(String(x||''));};
function showStatus(msg,err){var e=get('mi-status');if(e){e.textContent=msg;e.className=err?'mi-error':'mi-sub';}}
function setOptions(select, options, current){select.innerHTML=options.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(current)?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');}
function insertMarkup(){
 if(root)return;
 root=document.createElement('section');root.id='meetingInsights';root.className='card mi-root';
 root.innerHTML=
 '<div class="section-head mi-heading"><div class="section-title"><h2>Аналитика встреч · CampBox</h2><p>Качество переговоров → развитие навыков → результат сделки → голос клиента</p></div><span class="mi-sub" id="mi-status">Загрузка истории…</span></div>'+
 '<div class="section-body">'+
 '<div class="mi-filters"><label class="mi-filter">Менеджер<select id="mi-user"></select></label><label class="mi-filter">Тип встречи<select id="mi-type"></select></label><label class="mi-filter">Период<select id="mi-period"></select></label><button id="mi-reload" class="btn">Обновить</button></div>'+
 '<div class="mi-kpis" id="mi-kpis"></div><div class="mi-two"><div class="mi-panel"><h3>Качество сопоставимых встреч</h3><p class="mi-sub" id="mi-comparison"></p><div id="mi-chart"></div></div>'+
 '<div class="mi-panel"><h3>Фокус развития</h3><div id="mi-focus"></div></div></div>'+
 '<div class="mi-two"><div class="mi-panel"><h3>Навыки · последние 3 / предыдущие 3</h3><div id="mi-skills"></div></div>'+
 '<div class="mi-panel"><h3>Голос клиента · темы для маркетинга</h3><div id="mi-marketing"></div></div></div>'+
 '<div class="mi-panel"><h3>История встреч и результаты</h3><div id="mi-history"></div></div>'+
 '<details class="mi-panel mi-import"><summary>Добавить оценку встречи (структурированный JSON)</summary>'+
 '<p class="mi-sub">Вставь блок экспорта от «Продажника». Не вставляй полную транскрибацию, телефоны и персональные сведения. Повторный meeting_key обновляет существующую встречу того же менеджера.</p>'+
 '<textarea id="mi-packet" rows="9" placeholder="{ &quot;schema_version&quot;: &quot;campbox.meeting.v1&quot;, ... }"></textarea>'+
 '<div class="mi-import-actions"><button class="btn primary" id="mi-import">Сохранить оценку</button><span class="mi-sub" id="mi-import-status"></span></div></details>'+
 '<details class="mi-panel mi-import"><summary>Быстро внести прежнюю встречу вручную</summary>'+
 '<p class="mi-sub">Ручная оценка помечается предварительной и не учитывается в тренде, пока не подтверждена исходным разбором.</p>'+
 '<div class="mi-manual"><label>Дата<input type="date" id="mi-manual-date"></label><label>Лагерь / клиент<input id="mi-manual-client" maxlength="200" placeholder="Название организации"></label><label>Тип<select id="mi-manual-type"></select></label><label>Балл / 100<input id="mi-manual-score" type="number" min="0" max="100" step="0.5"></label></div>'+
 '<button class="btn" id="mi-manual-save">Добавить в историю</button><span id="mi-manual-status" class="mi-sub"></span></details>'+
 '</div>';
 var coach=document.querySelector('.coach-card');
 if(coach)coach.insertAdjacentElement('afterend',root);
 else get('mainApp').appendChild(root);
 setOptions(get('mi-type'),Object.keys(TYPES).map(function(k){return [k,TYPES[k]];}),'ALL');
 setOptions(get('mi-manual-type'),Object.keys(TYPES).filter(function(k){return k!=='ALL';}).map(function(k){return [k,TYPES[k]];}),'DEMO');
 setOptions(get('mi-period'),[['30','30 дней'],['90','90 дней'],['365','12 месяцев'],['ALL','Вся история']],'90');
 get('mi-manual-date').value=new Date().toLocaleDateString('sv-SE');
 ['mi-user','mi-type','mi-period'].forEach(function(id){get(id).addEventListener('change',paint);});
 get('mi-reload').addEventListener('click',reload);
 get('mi-import').addEventListener('click',importPacket);
 get('mi-manual-save').addEventListener('click',addManual);
 get('mi-history').addEventListener('change',changeOutcome);
}
function updateUsers(){
 var current=get('mi-user')&&get('mi-user').value||lastManager||'mine';
 var options=[['mine','Мои встречи']];
 if(typeof isManager==='function'&&isManager()){
  options.push(['team','Вся команда']);
  (typeof profiles!=='undefined'?profiles:[]).forEach(function(p){options.push([p.id,p.full_name||p.email||'Менеджер']);});
 }
 if(!options.some(function(o){return o[0]===current;}))current='mine';
 setOptions(get('mi-user'),options,current);lastManager=current;
}
async function reload(){
 if(!root||!currentUser||!sb||busy)return;
 busy=true;showStatus('Обновление истории…');
 try{
  var res=await sb.from('meeting_analyses').select('*').order('meeting_date',{ascending:false}).limit(1000);
  if(res.error)throw res.error;
  rows=res.data||[];updateUsers();paint();
  showStatus(rows.length>=1000?'Показаны первые 1000 записей — требуется постраничная загрузка':'Загружено '+rows.length+' оценок',false);
 }catch(e){
  showStatus('Не удалось загрузить. Проверь, применена ли миграция meeting-insights-v1.sql.',true);
  get('mi-kpis').innerHTML='';get('mi-chart').textContent='Нет доступа к таблице meeting_analyses.';
  console.error('Meeting Insights:',e);
 }finally{busy=false;}
}
function filtered(){
 var u=get('mi-user').value,t=get('mi-type').value,p=get('mi-period').value;
 lastManager=u;lastType=t;lastPeriod=p;
 var start=p==='ALL'?'':new Date(Date.now()-Number(p)*86400000).toISOString().slice(0,10);
 return rows.filter(function(r){
  return (u==='team'||(u==='mine'?r.manager_id===currentUser.id:r.manager_id===u)) &&
   (t==='ALL'||r.meeting_type===t) &&(!start||r.meeting_date>=start);
 }).sort(function(a,b){return String(b.meeting_date).localeCompare(String(a.meeting_date))||String(b.created_at).localeCompare(String(a.created_at));});
}
function comparable(data){
 var valid=data.filter(good);
 if(!valid.length)return [];
 var last=valid[0];
 return valid.filter(function(r){return r.meeting_type===last.meeting_type&&r.assessment_version===last.assessment_version;}).reverse();
}
function bars(comp){
 if(!comp.length)return '<p class="mi-sub">Нет подтверждённых оценок с достаточным покрытием транскрибации.</p>';
 var recent=comp.slice(-12),labels=recent.map(function(r){return r.meeting_date.slice(5);}),values=recent.map(function(r){return Number(r.total_score);});
 if(typeof CampBoxCharts!=='undefined'&&CampBoxCharts.chart){
  return CampBoxCharts.chart({labels:labels,series:[{name:'Оценка',values:values,tone:'primary'}],title:'Динамика качества переговоров',unit:' баллов'});
 }
 var max=100;return '<div class="mi-bars">'+recent.map(function(r){return '<div title="'+esc(r.meeting_date+': '+r.total_score)+'" style="height:'+Number(r.total_score)/max*100+'%"></div>';}).join('')+'</div>';
}
function tableScores(comp){
 var recent=comp.slice(-3),prev=comp.length>=6?comp.slice(-6,-3):[];
 var content=RUBRIC.map(function(item){
  var key=item[0],scores=recent.map(function(r){return r.skill_scores&&Number(r.skill_scores[key]);}).filter(function(x){return Number.isFinite(x);});
  if(!scores.length)return '';
  var current=avg(scores)/item[2]*100;
  var oldScores=prev.map(function(r){return Number(r.skill_scores&&r.skill_scores[key]);}).filter(function(x){return Number.isFinite(x);});
  var delta=oldScores.length===3?' ('+(current-avg(oldScores)/item[2]*100>=0?'+':'')+number(current-avg(oldScores)/item[2]*100)+' п.п.)':'';
  return '<tr><td>'+esc(item[1])+'</td><td>'+number(current)+'%'+esc(delta)+'</td></tr>';
 }).filter(Boolean).join('');
 return content?'<div class="mi-table-wrap"><table><thead><tr><th>Компетенция</th><th>Доля максимума</th></tr></thead><tbody>'+content+'</tbody></table></div>':'<p class="mi-sub">В старых оценках нет разбивки по компетенциям. Импортируй полный протокол.</p>';
}
function focus(comp){
 if(!comp.length)return '<p class="mi-sub">Сначала добавь первую подтверждённую встречу.</p>';
 var last=comp[comp.length-1],lastThree=comp.slice(-3);
 var ranking=RUBRIC.map(function(item){
  var v=avg(lastThree.map(function(r){return Number(r.skill_scores&&r.skill_scores[item[0]]);}).filter(Number.isFinite));
  return {name:item[1],p:v==null?null:v/item[2]*100};
 }).filter(function(x){return x.p!==null;}).sort(function(a,b){return a.p-b.p;}).slice(0,3);
 var errors={};lastThree.forEach(function(r){asArray(r.error_codes).forEach(function(x){if(typeof x==='string')errors[x]=(errors[x]||0)+1;});});
 var errorRank=Object.keys(errors).sort(function(a,b){return errors[b]-errors[a];}).slice(0,3);
 return (ranking.length?'<p><b>Зоны роста:</b> '+ranking.map(function(x){return esc(x.name)+' · '+number(x.p)+'%';}).join('; ')+'</p>':'')+
  (errorRank.length?'<p><b>Повторяющиеся ошибки:</b> '+errorRank.map(function(x){return esc(x)+' ('+errors[x]+')';}).join(', ')+'</p>':'')+
  '<p><b>Фокус следующей встречи:</b> '+esc(last.coaching_focus||'Закрепить одну компетенцию и проверить на следующем разборе.')+'</p>';
}
function marketing(data){
 var themes=new Map();
 data.forEach(function(r){asArray(r.marketing_insights).forEach(function(x){
  if(!x||typeof x!=='object')return;
  var topic=String(x.topic||'Другое').trim().slice(0,120),key=topic.toLowerCase();
  if(!themes.has(key))themes.set(key,{topic:topic,n:0,example:''});
  var item=themes.get(key);item.n++;
  if(!item.example)item.example=String(x.signal||x.use||'').slice(0,250);
 });});
 var items=Array.from(themes.values()).sort(function(a,b){return b.n-a.n;}).slice(0,8);
 if(!items.length)return '<p class="mi-sub">Инсайты появятся из структурированных отчётов «Продажника».</p>';
 return items.map(function(x){return '<div class="mi-theme"><b>'+esc(x.topic)+'</b><span>'+x.n+' встреч</span><small>'+esc(x.example)+'</small></div>';}).join('');
}
function outcomePct(data){
 var concluded=data.filter(function(x){return x.outcome==='SIGNED'||x.outcome==='LOST';});
 return concluded.length?number(100*concluded.filter(function(x){return x.outcome==='SIGNED';}).length/concluded.length)+'%':'—';
}
function history(data){
 if(!data.length)return '<p class="mi-sub">История пуста. Добавь первую оценку ниже.</p>';
 var names=new Map((typeof profiles!=='undefined'?profiles:[]).map(function(p){return [p.id,p.full_name||p.email||'Менеджер'];}));
 var h='<div class="mi-table-wrap"><table><thead><tr><th>Дата</th><th>Клиент</th><th>Тип</th><th>Менеджер</th><th>Балл</th><th>Надёжность</th><th>Результат</th></tr></thead><tbody>';
 data.slice(0,100).forEach(function(r){
  h+='<tr><td>'+esc(r.meeting_date)+'</td><td>'+esc(r.client_label)+'</td><td>'+esc(TYPES[r.meeting_type]||r.meeting_type)+'</td><td>'+esc(names.get(r.manager_id)||'Менеджер')+'</td>'+
  '<td><b>'+number(r.total_score)+'</b>/100</td><td>'+esc(r.reliability)+(r.coverage_pct==null?'':' · '+number(r.coverage_pct)+'%')+'</td>'+
  '<td><select class="mi-outcome" data-id="'+esc(r.id)+'">'+Object.keys(OUTCOMES).map(function(k){return '<option value="'+esc(k)+'"'+(k===r.outcome?' selected':'')+'>'+esc(OUTCOMES[k])+'</option>';}).join('')+'</select></td></tr>';
 });
 return h+'</tbody></table></div>'+(data.length>100?'<p class="mi-sub">Показаны последние 100 встреч. Используй фильтры.</p>':'');
}
function paint(){
 if(!root||!currentUser)return;
 var data=filtered(),comp=comparable(data);
 var latest=comp.slice(-3).map(function(r){return Number(r.total_score);}),previous=comp.length>=6?comp.slice(-6,-3).map(function(r){return Number(r.total_score);}):[];
 var delta=previous.length===3?avg(latest)-avg(previous):null;
 get('mi-kpis').innerHTML=[
 ['Встреч за период',data.length,'все записи'],
 ['Сопоставимые',comp.length,'один тип, одна версия, надёжные'],
 ['Средний балл · последние 3',avg(latest)==null?'—':number(avg(latest)),'из 100'],
 ['Изменение',delta==null?'BASELINE':(delta>=0?'+':'')+number(delta),'к предыдущим 3'],
 ['Подписано',data.filter(function(r){return r.outcome==='SIGNED';}).length,'из '+data.length+' встреч (не конверсия)'],
 ['Конверсия закрытых',outcomePct(data),'подписано / (подписано + потеряно)']
 ].map(function(x){return '<div class="mi-kpi"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b><span>'+esc(x[2])+'</span></div>';}).join('');
 var title=comp.length?(TYPES[comp[comp.length-1].meeting_type]||'')+' · версия '+comp[comp.length-1].assessment_version:'';
 get('mi-comparison').textContent=title+'. Для честной динамики берём только RELIABLE, покрытие от 70%, одинаковые тип и версия шкалы. Δ показывается с 6 встреч.';
 get('mi-chart').innerHTML=bars(comp);
 get('mi-focus').innerHTML=focus(comp);
 get('mi-skills').innerHTML=tableScores(comp);
 get('mi-marketing').innerHTML=marketing(data);
 get('mi-history').innerHTML=history(data);
}
function stringArray(a,max){return asArray(a).slice(0,30).map(function(x){return String(x).slice(0,max);});}
function normalized(packet){
 if(!packet||packet.schema_version!=='campbox.meeting.v1')throw Error('Ожидается schema_version: campbox.meeting.v1');
 var a=packet.assessment||{}, date=packet.date, key=packet.meeting_key;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||Number.isNaN(Date.parse(date)))throw Error('Неверная дата встречи');
 if(typeof key!=='string'||key.length<3||key.length>160)throw Error('Укажи уникальный meeting_key');
 if(!TYPES[packet.meeting_type]||packet.meeting_type==='ALL')throw Error('Неизвестный тип встречи');
 if(!Number.isFinite(Number(a.total))||Number(a.total)<0||Number(a.total)>100)throw Error('Балл должен быть от 0 до 100');
 var reliable=['RELIABLE','PROVISIONAL','INSUFFICIENT_DATA'].includes(a.reliability)?a.reliability:'PROVISIONAL';
 var coverage=a.coverage==null?null:Number(a.coverage);
 if(coverage!==null&&(!Number.isFinite(coverage)||coverage<0||coverage>100))throw Error('Неверное покрытие');
 var skills={};RUBRIC.forEach(function(item){var value=a.skills&&a.skills[item[0]];if(value===undefined||value===null)return;if(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>item[2])throw Error('Неверная оценка '+item[0]);skills[item[0]]=Number(value);});
 var insights=asArray(packet.marketing).slice(0,25).map(function(x){
  return {topic:String(x.topic||'Другое').slice(0,120),signal:String(x.signal||'').slice(0,500),use:String(x.use||'').slice(0,500)};
 });
 var managerId=get('mi-user').value;
 managerId=validId(managerId)?managerId:currentUser.id;
 return {
  manager_id:managerId,meeting_key:key,meeting_date:date,
  client_label:String(packet.client||'').slice(0,200),meeting_type:packet.meeting_type,
  assessment_version:String(a.version||'1.2.0').slice(0,40),
  total_score:Number(a.total),coverage_pct:coverage,reliability:reliable,
  skill_scores:skills,error_codes:stringArray(packet.errors,100),
  strengths:stringArray(packet.strengths,400),growth_areas:stringArray(packet.growth_areas,400),
  coaching_focus:String(packet.coaching_focus||'').slice(0,2000),
  marketing_insights:insights,next_step:String(packet.next_step||'').slice(0,2000),
  outcome:OUTCOMES[packet.outcome]?packet.outcome:'UNKNOWN',
  created_by:currentUser.id
 };
}
async function upsert(record, statusId){
 var status=get(statusId);status.textContent='Сохранение…';
 try{
  var res=await sb.from('meeting_analyses').upsert(record,{onConflict:'manager_id,meeting_key'}).select('id').single();
  if(res.error)throw res.error;
  status.textContent='Сохранено';await reload();
 }catch(e){status.textContent='Ошибка: '+e.message;console.error(e);}
}
function importPacket(){
 try{
  var raw=get('mi-packet').value;
  if(raw.length>50000)throw Error('Слишком большой пакет — не вставляй транскрипцию');
  var packet=JSON.parse(raw);
  upsert(normalized(packet),'mi-import-status');
 }catch(e){get('mi-import-status').textContent='Не сохранено: '+e.message;}
}
function addManual(){
 var date=get('mi-manual-date').value,score=Number(get('mi-manual-score').value);
 if(!date||get('mi-manual-score').value===''||!Number.isFinite(score)||score<0||score>100){get('mi-manual-status').textContent='Укажи дату и оценку 0–100';return;}
 var managerId=get('mi-user').value;managerId=validId(managerId)?managerId:currentUser.id;
 upsert({manager_id:managerId,meeting_key:'manual-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),meeting_date:date,
  client_label:get('mi-manual-client').value.slice(0,200),meeting_type:get('mi-manual-type').value,
  total_score:score,coverage_pct:null,reliability:'PROVISIONAL',assessment_version:'manual-unverified',
  created_by:currentUser.id},'mi-manual-status');
}
async function changeOutcome(e){
 if(!e.target.classList.contains('mi-outcome'))return;
 var el=e.target,id=el.dataset.id,value=el.value,old=rows.find(function(x){return x.id===id;});
 if(!old)return;
 el.disabled=true;
 var res=await sb.from('meeting_analyses').update({outcome:value}).eq('id',id);
 el.disabled=false;
 if(res.error){el.value=old.outcome;showStatus('Результат не сохранён: '+res.error.message,true);}
 else{old.outcome=value;paint();showStatus('Результат встречи сохранён');}
}
async function mount(){
 if(!currentUser||!currentProfile||!currentProfile.active||!sb)return;
 insertMarkup();updateUsers();mounted=true;await reload();
}
window.MeetingInsights={mount:mount,reload:reload};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){if(currentUser&&currentProfile&&currentProfile.active)mount();});
else if(typeof currentUser!=='undefined'&&currentUser&&currentProfile&&currentProfile.active)mount();
})();
