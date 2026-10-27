/* One immutable report model feeds preview, print and workbook. No writes. */
(function(root){
'use strict';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
function build(o){
 const end=o.month+'-'+String(new Date(Number(o.month.slice(0,4)),Number(o.month.slice(5)),0).getDate()).padStart(2,'0');
 const periodEnd=o.period==='month'?end:o.date;
 const cutoff=[periodEnd,o.today,end].sort()[0],start=o.month+'-01';
 const scope=o.manager?o.scope:o.self;
 const map=new Map();[...o.rows,...o.dayRows].forEach(r=>map.set(r.report_date+'|'+r.user_id,r));
 const rows=[...map.values()].filter(r=>r.report_date>=start&&r.report_date<=cutoff&&(scope==='team'||r.user_id===scope));
 const days=Number(end.slice(8)),labels=[],fact=[],plan=[];
 const work=d=>{let c=0;for(let i=1;i<=d;i++){const w=new Date(o.month+'-'+String(i).padStart(2,'0')+'T12:00:00').getDay();if(w!==0&&w!==6)c++;}return c;};
 const wdTotal=work(days),wdDone=cutoff<start?0:work(Number(cutoff.slice(8)));
 const target=scope==='team'?n(o.target):n(o.personalTarget);
 let cumulative=0;
 for(let d=1;d<=days;d++){const iso=o.month+'-'+String(d).padStart(2,'0'),rs=rows.filter(r=>r.report_date===iso);cumulative+=rs.reduce((s,r)=>s+n(r.connected_fact),0);labels.push(String(d));fact.push(rs.length&&iso<=cutoff?cumulative:null);plan.push(target*work(d)/(wdTotal||1));}
 const actual=rows.reduce((s,r)=>s+n(r.connected_fact),0),forecast=wdDone?Math.round(actual/wdDone*wdTotal):null;
 const metrics=['calls','booked','meetings','offers','follow','connected'].map(key=>({key,fact:rows.reduce((s,r)=>s+n(r[key+'_fact']),0),plan:rows.reduce((s,r)=>s+n(r[key+'_plan']),0)}));
 const members=o.members.filter(p=>scope==='team'||p.id===scope).map(p=>{const f=rows.filter(r=>r.user_id===p.id).reduce((s,r)=>s+n(r.connected_fact),0);return {name:p.full_name||p.email||'Сотрудник',fact:f,target:n(o.personalTarget),forecast:wdDone?Math.round(f/wdDone*wdTotal):null};});
 return {month:o.month,period:o.period,type:o.type,scope,start,periodEnd,cutoff,target,fact:actual,forecast,risk:forecast===null?null:Math.max(0,target-forecast),wdTotal,wdDone,metrics,members,labels,series:[{name:'Факт накопительно',values:fact,tone:'positive'},{name:'Целевой план',values:plan,tone:'primary'}],method:'Прогноз = факт / прошедшие рабочие дни × рабочие дни месяца (пн–пт). Будущие даты исключены; пропуск не равен нулю.'};
}
const h=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={calls:'Звонки',booked:'Назначено встреч',meetings:'Проведено встреч',offers:'КП',follow:'Повторные контакты',connected:'Подключения'};
function table(c){const rows=[['Период',c.start+' — '+c.periodEnd],['Данные по',c.cutoff],['Область',c.scope==='team'?'Команда':c.members[0]?.name],['Формат',c.type==='team'?'По команде':'Краткий'],['Метод',c.method],['Цель месяца',c.target],['Факт',c.fact],['Прогноз',c.forecast],['Риск',c.risk],[],['Показатель','Факт','План за период'],...c.metrics.map(m=>[names[m.key],m.fact,m.plan])];if(c.type==='team')rows.push([],['Менеджер','Факт','Цель месяца','Прогноз'],...c.members.map(m=>[m.name,m.fact,m.target,m.forecast]));rows.push([],['День','Факт накопительно','Целевой план'],...c.labels.map((d,i)=>[d,c.series[0].values[i],c.series[1].values[i]]));return rows;}
function current(){return build({month:selectedMonth,date:selectedDate,today:todayISO(),period:document.getElementById('v13ReportPeriod').value,type:document.getElementById('v13ReportType').value,scope:document.getElementById('os3ReportScope')?.value||'team',manager:isManager(),self:currentUser?.id,rows:monthRows,dayRows:dayRows.map(r=>({...r,report_date:selectedDate})),members:profiles,target:document.getElementById('monthTarget').value,personalTarget:PERSONAL_MONTH_TARGET});}
function render(){const box=document.getElementById('v13ReportPreview');if(!box||!selectedMonth||!currentUser)return;const select=document.getElementById('os3ReportScope');if(select){const old=select.value,items=(isManager()?[{id:'team',full_name:'Команда'}]:[]).concat(profiles.filter(p=>isManager()||p.id===currentUser.id));if(select.dataset.members!==JSON.stringify(items)){select.replaceChildren();items.forEach(p=>select.add(new Option(p.full_name||p.email,p.id)));if(items.some(p=>p.id===old))select.value=old;select.dataset.members=JSON.stringify(items);}}const c=current();root.CampBoxReport.snapshot=c;box.innerHTML='<h2>Отчёт по продажам CampBox</h2><p>'+h(c.start)+' — '+h(c.periodEnd)+' · данные по '+h(c.cutoff)+'</p><p>'+h(c.scope==='team'?'Команда':c.members[0]?.name||'Сотрудник')+' · '+h(c.type==='team'?'По команде':'Краткий управленческий')+'</p><p>'+h(c.method)+'</p><div class="v13-report-kpis">'+[['Цель',c.target],['Факт',c.fact],['Прогноз',c.forecast],['Риск',c.risk]].map(([k,v])=>root.CampBoxComponents.metric(k,v)).join('')+'</div><p class="v13-report-callout">'+(c.forecast===null?'Недостаточно рабочих дней для прогноза.':c.risk?'До цели по текущему темпу не хватает '+c.risk+'. Проверьте активные договоры и следующий контакт.':'Текущий темп соответствует цели.')+'</p>'+CampBoxCharts.chart({labels:c.labels,series:c.series,title:'Результат выбранного отчёта'})+'<div class="os3-table-scroll"><table class="v13-report-table"><tbody>'+table(c).slice(9).map(r=>'<tr>'+r.map(v=>'<td>'+h(typeof v==='number'?Math.round(v*100)/100:v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
async function excel(){
 render();
 if(typeof ExcelJS==='undefined'||typeof JSZip==='undefined'||typeof root.CampBoxNativeExcelCharts!=='function'){alert('Excel-модуль не загружен. Обновите страницу.');return;}
 const c=root.CampBoxReport.snapshot,b=new ExcelJS.Workbook(),home=b.addWorksheet('Обзор'),s=b.addWorksheet('Отчёт');
 for(let i=1;i<=15;i++)home.getColumn(i).width=12;
 home.mergeCells('A1:O2');home.getCell('A1').value='CampBox · '+c.month+' · '+(c.scope==='team'?'Команда':c.members[0]?.name||'Сотрудник');home.getCell('A1').font={size:20,bold:true,color:{argb:'FF14233B'}};
 home.mergeCells('A4:O5');home.getCell('A4').value=c.start+' — '+c.periodEnd+' · данные по '+c.cutoff+' · '+(c.type==='team'?'По команде':'Краткий');
 home.mergeCells('A7:O9');home.getCell('A7').value=c.method;home.getCell('A7').alignment={wrapText:true};
 [['A11:C11','Цель',c.target],['E11:G11','Факт',c.fact],['I11:K11','Прогноз',c.forecast],['M11:O11','Риск',c.risk]].forEach(([range,label,value])=>{home.mergeCells(range);const cell=home.getCell(range.split(':')[0]);cell.value=label+': '+(value??'—');cell.font={size:16,bold:true};});
 home.getCell('A20').value='Темп результата';home.getCell('I20').value='Подключения по менеджерам';home.getCell('A43').value='Факты по этапам';home.getCell('A65').value='Все диаграммы построены из того же контекста, что экран и лист «Отчёт».';
 table(c).forEach(r=>s.addRow(r));s.columns=[{width:48},{width:60},{width:25},{width:25}];s.eachRow(r=>r.eachCell(cell=>{if(typeof cell.value==='number')cell.numFmt='0.##';cell.alignment={wrapText:true,vertical:'top'};}));
 const memberData=c.type==='team'?c.members:[{name:c.scope==='team'?'Команда':c.members[0]?.name||'Сотрудник',fact:c.fact,target:c.target}];
 const daily=b.addWorksheet('Динамика'),members=b.addWorksheet('Менеджеры'),funnel=b.addWorksheet('Воронка');
 daily.getCell('A5').value='Дата';daily.getCell('H5').value='Факт накопительно';daily.getCell('I5').value='Целевой план';
 const serials=c.labels.map((d,i)=>Math.round((Date.UTC(Number(c.month.slice(0,4)),Number(c.month.slice(5))-1,i+1)-Date.UTC(1899,11,30))/86400000));
 c.labels.forEach((d,i)=>{daily.getCell(i+6,1).value=serials[i];daily.getCell(i+6,1).numFmt='dd.mm.yyyy';daily.getCell(i+6,8).value=c.series[0].values[i];daily.getCell(i+6,9).value=c.series[1].values[i];});
 members.getCell('A5').value='Менеджер';members.getCell('M5').value='Факт';members.getCell('N5').value='Цель месяца';memberData.forEach((m,i)=>{members.getCell(i+6,1).value=m.name;members.getCell(i+6,13).value=m.fact;members.getCell(i+6,14).value=m.target;});
 funnel.getCell('A5').value='Этап';funnel.getCell('C5').value='Факт';c.metrics.forEach((m,i)=>{funnel.getCell(i+6,1).value=names[m.key];funnel.getCell(i+6,3).value=m.fact;});
 for(const ws of [daily,members,funnel]){ws.getColumn(1).width=40;ws.views=[{state:'frozen',ySplit:5}];}
 home.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:2};
 const data={daily:{labels:c.labels,serials,fact:c.series[0].values,plan:c.series[1].values},managers:{names:memberData.map(m=>m.name),fact:memberData.map(m=>m.fact),plan:memberData.map(m=>m.target)},funnel:{labels:c.metrics.map(m=>names[m.key]),fact:c.metrics.map(m=>m.fact)}};
 const buffer=await root.CampBoxNativeExcelCharts(await b.xlsx.writeBuffer(),data);
 const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='CampBox_'+c.month+'_'+c.period+'_'+c.type+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}

root.CampBoxReport={build,table,render,excel};if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{root.exportExcelV2=excel;});if(typeof module!=='undefined')module.exports={build,table};
})(typeof window==='undefined'?globalThis:window);
