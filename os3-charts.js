/* Pure presentation: consumes prepared values, never reads or writes business state. */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const fmt=v=>valid(v)?Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1}):'Нет данных';
function chart({labels=[],series=[],title='Динамика',unit='',kind='line',band,cutoff=-1}={}){
 const values=series.flatMap(s=>s.values.filter(valid)).concat(band?band.flat().filter(valid):[]);
 if(!labels.length||!values.length)return root.CampBoxComponents?root.CampBoxComponents.state('empty','Недостаточно данных','График появится после внесения фактов за выбранный период.'):'<div class="os3-empty" role="status"><b>Недостаточно данных</b><p>График появится после внесения фактов за выбранный период.</p></div>';
 const W=760,H=280,L=54,R=20,T=26,B=40,max=Math.max(1,...values)*1.12,min=Math.min(0,...values),range=max-min;
 const x=i=>L+(W-L-R)*(i+.5)/labels.length,y=v=>T+(H-T-B)*(max-v)/range;
 let body='';
 for(let i=0;i<=4;i++){let v=min+range*i/4;body+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" class="os3-gridline"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${esc(fmt(v))}</text>`;}
 if(band&&band[0].every(valid)&&band[1].every(valid))body+=`<polygon class="os3-band" points="${band[1].map((v,i)=>`${x(i)},${y(v)}`).concat(band[0].map((v,i)=>`${x(i)},${y(v)}`).reverse()).join(' ')}"/>`;
 if(cutoff>=0&&cutoff<labels.length)body+=`<line x1="${x(cutoff)}" y1="${T}" x2="${x(cutoff)}" y2="${H-B}" class="os3-cutoff"/><text x="${x(cutoff)}" y="16" text-anchor="middle">Выбранная дата</text>`;
 series.forEach((s,si)=>{
  let d='',open=false;const color=s.tone||['positive','primary'][si%2];
  s.values.forEach((v,i)=>{if(!valid(v)){open=false;return;}d+=open?(s.step?' H'+x(i)+' V'+y(v):' L'+x(i)+' '+y(v)):' M'+x(i)+' '+y(v);open=true;});
  if(kind==='line')body+=`<path d="${d}" class="os3-series os3-${esc(color)}" ${s.dash?'stroke-dasharray="5 5"':''}/>`;
  s.values.forEach((v,i)=>{if(!valid(v))return;const tip=`${labels[i]} · ${s.name}: ${fmt(v)}${unit}${s.bases?' · '+s.bases[i][0]+' из '+s.bases[i][1]:''}`;
   const width=Math.min(24,(W-L-R)/labels.length*.6);
   let shape=kind==='bars'?(s.mark?`<line x1="${x(i)-width/2-3}" x2="${x(i)+width/2+3}" y1="${y(v)}" y2="${y(v)}" stroke-width="3"/>`:`<rect x="${x(i)-width/2}" y="${Math.min(y(v),y(0))}" width="${width}" height="${Math.max(1,Math.abs(y(0)-y(v)))}" rx="3"/>`):`<circle cx="${x(i)}" cy="${y(v)}" r="4"/>`;
   body+=`<g tabindex="0" role="img" aria-label="${esc(tip)}" class="os3-point os3-${esc(color)}">${shape}<title>${esc(tip)}</title></g>`;
  });
 });
 [...new Set(Array.from({length:Math.min(7,labels.length)},(_,i)=>Math.round((labels.length-1)*i/Math.max(1,Math.min(7,labels.length)-1))))].forEach(i=>body+=`<text x="${x(i)}" y="${H-14}" text-anchor="middle">${esc(labels[i])}</text>`);
 const legend=series.map(s=>`<span><i class="os3-${esc(s.tone||'primary')}"></i>${esc(s.name)}</span>`).join('')+(band?'<span>Зона: минимум–максимум</span>':'');
 return `<div class="os3-chart-scroll" tabindex="0" aria-label="${esc(title)}. График с горизонтальной прокруткой"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${body}</svg></div><div class="os3-chart-legend">${legend}</div><p class="os3-chart-readout" aria-live="polite">Выбери точку для значения. Все значения доступны в таблице.</p><details class="os3-source"><summary>Исходные значения и методика</summary><p>Пустая ячейка — нет данных. Линия прерывается на пропусках. ${esc(unit==='%'?'Конверсия накопительно к дате; база указана в карточке перехода.':'План и факт показаны отдельными рядами.')}</p><div class="os3-table-scroll"><table><thead><tr><th>Дата</th>${series.map(s=>`<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${labels.map((l,i)=>`<tr><th>${esc(l)}</th>${series.map(s=>`<td>${esc(fmt(s.values[i]))}${valid(s.values[i])?esc(unit):''}${s.bases?' · '+s.bases[i][0]+' из '+s.bases[i][1]:''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
function spark(values){const max=Math.max(1,...values.filter(valid)),min=Math.min(0,...values.filter(valid));let d='',open=false;values.forEach((v,i)=>{if(!valid(v)){open=false;return;}d+=(open?' L':' M')+(4+112*i/Math.max(1,values.length-1))+' '+(36-32*(v-min)/(max-min));open=true;});return '<svg class="os3-spark" viewBox="0 0 120 40" aria-hidden="true"><path d="'+d+'" fill="none" stroke="currentColor" stroke-width="2"/></svg>';}
root.CampBoxCharts={chart,esc,valid,fmt,spark};
if(typeof module!=='undefined')module.exports=root.CampBoxCharts;
if(typeof document!=='undefined'){
 const show=e=>{const point=e.target.closest?.('.os3-point');if(!point)return;const box=point.closest('.os3-chart-scroll')?.parentElement,read=box?.querySelector('.os3-chart-readout');if(read)read.textContent=point.getAttribute('aria-label');};
 document.addEventListener('focusin',show);document.addEventListener('pointerover',show);document.addEventListener('click',show);
}
})(typeof window==='undefined'?globalThis:window);
