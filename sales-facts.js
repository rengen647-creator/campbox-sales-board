/* The sole signed-sales model. Client launches (connected_fact) remain separate. */
(function(root){'use strict';
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const workdays=(month,day)=>{let n=0;for(let d=1;d<=day;d++){const w=new Date(month+'-'+String(d).padStart(2,'0')+'T12:00:00Z').getUTCDay();if(w!==0&&w!==6)n++;}return n;};
function aggregate({events=[],month,cutoff,scope='team',target=0,min=0,max=0,available=true,reconciled=false,syncedAt=null}){
 const end=month+'-'+new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).getUTCDate();
 cutoff=[cutoff,end].sort()[0];const map=new Map();
 for(const e of events){const key=e.sales_user_id+'|'+e.contract_key;const prev=map.get(key);if(!prev||Number(e.revision||0)>Number(prev.revision||0))map.set(key,e);}
 const selected=[...map.values()].filter(e=>e.state==='confirmed'&&e.plan_eligible!==false&&validDate(e.signed_date)&&e.signed_date.slice(0,7)===month&&e.signed_date<=cutoff&&(scope==='team'||e.sales_user_id===scope));
 const labels=[],fact=[],plans={min:[],target:[],max:[]};let count=0;const totalDays=+end.slice(8),wd=workdays(month,totalDays),elapsed=cutoff<month+'-01'?0:workdays(month,+cutoff.slice(8));
 for(let d=1;d<=totalDays;d++){const date=month+'-'+String(d).padStart(2,'0');labels.push(String(d));count+=selected.filter(e=>e.signed_date===date).length;fact.push(!available||!reconciled||date>cutoff?null:count);for(const [k,v] of Object.entries({min,target,max}))plans[k].push(Number(v)*workdays(month,d)/(wd||1));}
 const value=available&&reconciled?selected.length:null,forecast=value===null||!elapsed?null:Math.round(value/elapsed*wd);
 return {events:selected,month,cutoff,scope,labels,fact,plans,value,forecast,remaining:value===null?null:Math.max(0,target-value),pace:value===null||!elapsed?null:value/elapsed,available,reconciled,syncedAt,source:'sales_signed_events',status:!available?'error':!reconciled?'incomplete':'confirmed'};
}
function pipeline(deals,{start,end,asOf,events=[]}){
 const latest=new Map();for(const d of deals){if(d.source_report_date>asOf)continue;const k=d.sales_user_id+'|'+d.contract_key;const p=latest.get(k);if(!p||+d.revision>+p.revision)latest.set(k,d);}
 const eventMap=new Map();for(const e of events){const k=e.sales_user_id+'|'+e.contract_key,p=eventMap.get(k);if(!p||Number(e.revision||0)>Number(p.revision||0))eventMap.set(k,e);}
 const all=[...latest.values()],open=all.filter(d=>d.status==='signing'),started=all.filter(d=>d.sent_date>=start&&d.sent_date<=end),keys=new Set(started.map(d=>d.sales_user_id+'|'+d.contract_key)),signed=[...eventMap.values()].filter(e=>e.state==='confirmed'&&e.plan_eligible!==false&&validDate(e.signed_date)&&e.signed_date>=start&&e.signed_date<=end&&e.signed_date<=asOf),cohortSigned=signed.filter(e=>keys.has(e.sales_user_id+'|'+e.contract_key));
 return {open,started,signed,cohortSigned,conversion:started.length?100*cohortSigned.length/started.length:null,formula:'Подписанные из начатых в периоде / все начатые в периоде',start,end,asOf};
}
root.CampBoxSalesFacts={aggregate,pipeline,validDate,workdays};if(typeof module!=='undefined')module.exports=root.CampBoxSalesFacts;
})(typeof window==='undefined'?globalThis:window);
