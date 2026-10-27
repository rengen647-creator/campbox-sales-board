/* Synthetic full application fixture. No production credentials, requests, or writes. */
const fs=require('node:fs');
let s=fs.readFileSync('index.html','utf8');
s=s.replace(/<script[^>]+src="https:[^"]+"[^>]*><\/script>/g,'');
s=s.replace(/\ninit\(\);/,'\n/* QA: production init disabled */').replace('initPWA();','/* QA: no service worker */');
s=s.replace(/const SUPABASE_URL\s*=.*?;/,'const SUPABASE_URL="";');
s=s.replace(/const SUPABASE_ANON_KEY\s*=.*?;/,'const SUPABASE_ANON_KEY="";');
s=s.replace('<head>','<head><base href="../"><meta name="robots" content="noindex">');
s=s.replace('</body>',`<script>
window.fetch=()=>Promise.reject(new Error('QA: network disabled'));
window.addEventListener('DOMContentLoaded',()=>{
 currentUser={id:'qa-lead',email:'qa@example.invalid'};currentProfile={id:'qa-lead',full_name:'Тестовый руководитель',role:'manager',active:true};
 profiles=[currentProfile,{id:'qa-sales',full_name:'Тестовый менеджер с длинным именем',role:'employee',active:true}];
 selectedMonth='2026-10';selectedDate='2026-10-27';
 monthSettings={min_plan:5,target_plan:10,max_plan:15};
 $('reportMonth').value=selectedMonth;$('reportDate').value=selectedDate;
 $('monthMin').value=5;$('monthTarget').value=10;$('monthMax').value=15;
 monthRows=[];
 for(let d=1;d<=27;d++){if(d===8||d===17)continue;for(const p of profiles){const row={user_id:p.id,report_date:'2026-10-'+String(d).padStart(2,'0'),comment:'',connected_fact:d%7===0?1:0};activityKeys.forEach((k,i)=>{row[k+'_plan']=[20,4,3,2,6][i];row[k+'_fact']=d%6===0?0:[12+d%7,3,2,1,4][i];});monthRows.push(row);}}
 dayRows=monthRows.filter(r=>r.report_date===selectedDate);
 dayRows[0].comment=packReflection({contracts:[{id:'qa-contract-1',client:'Тестовый лагерь — длинное наименование площадки',sent_date:'2026-10-15',target_date:'2026-10-29',next_contact:'2026-10-28',next_action:'Уточнить решение директора',blocker:'Согласование',ball:'client',status:'signing'},{id:'qa-contract-2',client:'Альфа — синтетический лагерь',sent_date:'2026-10-23',next_contact:'2026-10-27',next_action:'Отправить уточнения',ball:'us',status:'signing'}]});
 monthSignedContracts=[];checkpoints=[];
 showOnly('mainApp');$('currentUserName').textContent='Синтетический тест';$('currentUserRole').textContent='Руководитель';applyRoleUI();
 // Saving only into fixture memory. No network and no production writes.
 saveCurrent=async()=>{setStatus('QA: сохранено только в памяти');};
 renderDayTable();recalc();
 document.querySelector('.v13-brand small').textContent='СИНТЕТИЧЕСКИЕ ДАННЫЕ · НЕ БОЕВАЯ БАЗА';
 window.v13Go('analytics');
});
</script></body>`);
s=s.replace('renderDayTable();','renderTeam();');
fs.writeFileSync('qa/os3-app-fixture.html',s);
