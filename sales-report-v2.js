/* CampBox Sales — отчет руководителя Excel v2. Не меняет БД и расчеты доски. */
(function () {
  'use strict';

  const C = {
    navy: 'FF14233B', navy2: 'FF213655', blue: 'FF4268D6', pale: 'FFEFF4FC',
    ink: 'FF1B2940', muted: 'FF61738A', white: 'FFFFFFFF', line: 'FFDDE5F0',
    green: 'FF13795B', greenBg: 'FFE6F5ED', amber: 'FF995A05',
    amberBg: 'FFFFF1D8', red: 'FFB43644', redBg: 'FFFFE9ED',
    cyan: 'FFDCF4FF', neutral: 'FFF6F8FC'
  };
  const STAGES = [
    ['calls', 'Звонки'], ['booked', 'Назначено встреч'],
    ['meetings', 'Проведено встреч'], ['offers', 'КП / расчёты'],
    ['follow', 'Повторные контакты']
  ];
  const integer = '#,##0;[Red](#,##0);"-"';
  const percent = '0%;[Red](0%);"-"';
  const dateFormat = 'dd.mm.yyyy';
  const asNum = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const shortDate = v => {
    const parts = String(v || '').split('-').map(Number);
    return parts.length === 3 && parts[0] > 1900 && parts[1] >= 1 &&
      parts[1] <= 12 && parts[2] >= 1 && parts[2] <= 31
      ? new Date(parts[0], parts[1] - 1, parts[2], 12) : null;
  };
  const filled = v => String(v || '').trim() !== '';
  const paleFill = argb => ({type:'pattern', pattern:'solid', fgColor:{argb}});
  const formatNumber = (cell, fmt = integer) => {cell.numFmt = fmt; cell.alignment = {horizontal:'center', vertical:'middle'};};
  const setFormula = (cell, formula, result = 0, fmt = integer) => {
    cell.value = {formula, result};
    formatNumber(cell, fmt);
  };
  const sheetLink = name => ({text:'Открыть: ' + name + '  →', hyperlink:"#'" + name + "'!A1"});

  function section(book, name, heading, caption, headers, data, widths, options = {}) {
    const ws = book.addWorksheet(name, {
      views:[{state:'frozen', xSplit:1, ySplit:5, showGridLines:false}],
      properties:{tabColor:{argb:options.tab || C.blue}}
    });
    const n = headers.length;
    for (let col = 1; col <= n; col++) ws.getColumn(col).width = widths[col-1] || 15;
    ws.mergeCells(1,1,1,n);
    const title = ws.getCell(1,1);
    title.value = heading; title.font = {name:'Aptos Display',size:17,bold:true,color:{argb:C.white}};
    title.fill = paleFill(C.navy); title.alignment = {vertical:'middle',indent:1};
    ws.getRow(1).height = 43;
    ws.mergeCells(2,1,2,n);
    const subtitle=ws.getCell(2,1);
    subtitle.value=caption; subtitle.font={name:'Aptos',size:10,color:{argb:C.muted}};
    subtitle.alignment={vertical:'middle',wrapText:true,indent:1};
    ws.getRow(2).height=34;
    ws.getRow(3).height=9; ws.getRow(4).height=9;
    headers.forEach((header,i) => {
      const cell=ws.getCell(5,i+1);
      cell.value=header;
      cell.fill=paleFill(C.navy2);
      cell.font={name:'Aptos',bold:true,size:10,color:{argb:C.white}};
      cell.alignment={vertical:'middle',wrapText:true,horizontal:i===0?'left':'center'};
      cell.border={bottom:{style:'medium',color:{argb:C.blue}}};
    });
    ws.getRow(5).height=38;
    data.forEach((values,r) => {
      const rowNum=r+6;
      const row=ws.getRow(rowNum);
      row.height=options.tall?58:27;
      values.forEach((value,colIndex) => {
        const cell=row.getCell(colIndex+1);
        cell.value=value===undefined?null:value;
        cell.font={name:'Aptos',size:10,color:{argb:C.ink},bold:false};
        cell.alignment={vertical:'middle',wrapText:Boolean(options.wrap) || typeof value==='string' && value.length>64};
        cell.fill=paleFill(r%2===0?C.white:C.neutral);
        cell.border={bottom:{style:'hair',color:{argb:C.line}}};
        if (options.dateCols && options.dateCols.includes(colIndex+1) && value instanceof Date) {
          cell.numFmt=dateFormat;cell.alignment={vertical:'middle',horizontal:'center'};
        }
        if (options.numCols && options.numCols.includes(colIndex+1)) formatNumber(cell);
        if (options.percentCols && options.percentCols.includes(colIndex+1)) formatNumber(cell,percent);
      });
    });
    if (!data.length) {
      ws.mergeCells(6,1,6,n);
      ws.getCell(6,1).value='За выбранный период записей нет';
      ws.getCell(6,1).font={name:'Aptos',italic:true,color:{argb:C.muted}};
      ws.getRow(6).height=30;
    }
    if (data.length) ws.autoFilter={from:{row:5,column:1},to:{row:Math.max(6,data.length+5),column:n}};
    ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
    return ws;
  }

  function colorize(ws,col,rows,mode='positive') {
    if (!rows) return;
    const range=col+'6:'+col+(5+rows);
    ws.addConditionalFormatting({ref:range,rules:[
      {type:'cellIs',operator:'lessThan',formulae:['0'],style:{font:{color:{argb:mode==='positive'?C.red:C.green}},fill:paleFill(mode==='positive'?C.redBg:C.greenBg)}},
      {type:'cellIs',operator:'greaterThanOrEqual',formulae:['1'],style:{font:{color:{argb:mode==='positive'?C.green:C.red}},fill:paleFill(mode==='positive'?C.greenBg:C.redBg)}}
    ]});
  }


  // Первый лист: визуал, а не набор строк. Все числа ссылаются на детальные таблицы.
  function visualOverview(ws, ctx) {
    const {month,target,connected,inProgress,expected,lateContacts,lateSignatures,oldContracts,
      stageData,memberData,dailyData,nowDay,prevRows} = ctx;
    const navy=C.navy, blue=C.blue;
    const values=(key)=>prevRows.reduce((s,r)=>s+asNum(r[key+'_fact']),0);
    const prevVals=['calls','booked','meetings','offers'].map(values);
    const prevRates=prevVals.map((v,i)=>i===0?null:prevVals[i-1]>0?v/prevVals[i-1]:null);
    const colWidths=[22,15,15,15,42,17,16,17,17,17,17,16,16,16,17];
    colWidths.forEach((w,i)=>ws.getColumn(i+1).width=w);
    ws.views=[{state:'frozen',ySplit:3,showGridLines:false,zoomScale:75}];
    ws.properties.tabColor={argb:C.green};
    const band=(area,value,fill,color=C.white,height)=>{
      ws.mergeCells(area);
      const cell=ws.getCell(area.split(':')[0]);
      cell.value=value;
      cell.fill=paleFill(fill);
      cell.font={name:'Aptos',color:{argb:color},bold:true,size:12};
      cell.alignment={vertical:'middle',horizontal:'left',indent:1};
      if(height)ws.getRow(cell.row).height=height;
      return cell;
    };
    const subtle=(addr,value)=>{
      const c=ws.getCell(addr); c.value=value;c.font={name:'Aptos',size:10,color:{argb:C.muted}};
      c.alignment={vertical:'middle',wrapText:true};return c;
    };
    band('A1:O2','CAMPBOX  /  ПУЛЬТ РУКОВОДИТЕЛЯ',navy,C.white,40);
    ws.getCell('A1').font={name:'Aptos Display',size:24,bold:true,color:{argb:C.white}};
    band('A3:O3','Динамический Excel · '+month+'   |   фактические показатели и графики связаны с детализацией',C.pale,C.muted,33);
    const kpis=[
      {title:'ЦЕЛЬ',cols:['A5:C5','A6:C8'],formula:"'Главная'!B8",result:target,color:C.navy},
      {title:'ПОДКЛЮЧЕНО',cols:['D5:F5','D6:F8'],formula:"'Главная'!E8",result:connected,color:C.green},
      {title:'ВЫПОЛНЕНИЕ',cols:['G5:I5','G6:I8'],formula:"'Главная'!H8",result:target?connected/target:0,color:C.blue,percent:true},
      {title:'ОТСТАВАНИЕ ОТ ТЕМПА',cols:['J5:L5','J6:L8'],formula:"'Главная'!H16",result:Math.max(expected-connected,0),color:C.red},
      {title:'НА ПОДПИСАНИИ',cols:['M5:O5','M6:O8'],formula:"'Главная'!H12",result:inProgress,color:C.amber}
    ];
    kpis.forEach(k=>{
      const head=band(k.cols[0],k.title,C.pale,C.muted,28);
      head.font={name:'Aptos',size:10,bold:true,color:{argb:C.muted}};
      const val=band(k.cols[1],null,C.neutral,k.color);
      val.value={formula:k.formula,result:k.result};
      val.font={name:'Aptos Display',size:28,bold:true,color:{argb:k.color}};
      val.alignment={horizontal:'center',vertical:'middle'};
      val.numFmt=k.percent?percent:integer;
    });
    ws.getRow(6).height=24;ws.getRow(7).height=22;ws.getRow(8).height=24;
    band('A10:O10','01  /  ВОРОНКА ПРОДАЖ · где теряем движение',navy,C.white,34);
    band('A11:C11','ЭТАП',C.navy2);
    const labels=[['D11','ФАКТ'],['E11','ОБЪЁМ'],['F11','К ПРЕДЫДУЩЕМУ'],
      ['G11','ПЛАН'],['H11','ВЫПОЛНЕНИЕ'],['I11','ПРЕД. МЕСЯЦ'],
      ['J11','РАЗНИЦА'],['K11','СТАТУС'],['L11','ЧТО ПОКАЗЫВАЕТ']];
    labels.forEach(([pos,value])=>{
      if(pos==='L11')ws.mergeCells('L11:O11');
      const cell=ws.getCell(pos);cell.value=value;cell.fill=paleFill(C.navy2);
      cell.font={name:'Aptos',size:9,bold:true,color:{argb:C.white}};
      cell.alignment={vertical:'middle',wrapText:true,horizontal:'center'};
    });
    ws.getRow(11).height=38;
    stageData.slice(0,4).forEach((stage,i)=>{
      const row=12+i;
      ws.mergeCells('A'+row+':C'+row);
      const sc=ws.getCell('A'+row);sc.value=stage[0];
      sc.font={name:'Aptos',bold:true,size:12,color:{argb:C.ink}};
      sc.fill=paleFill(i%2===0?C.pale:C.neutral);
      sc.alignment={vertical:'middle',indent:1};
      const fact=asNum(stage[2]),plan=asNum(stage[1]);
      setFormula(ws.getCell('D'+row),"'Воронка'!C"+(6+i),fact);
      setFormula(ws.getCell('E'+row),'D'+row,fact);
      if(i>0)setFormula(ws.getCell('F'+row),'IFERROR(D'+row+'/D'+(row-1)+',0)',stageData[i-1][2]>0?fact/asNum(stageData[i-1][2]):0,percent);
      else ws.getCell('F'+row).value='—';
      setFormula(ws.getCell('G'+row),"'Воронка'!B"+(6+i),plan);
      setFormula(ws.getCell('H'+row),'IFERROR(D'+row+'/G'+row+',0)',plan?fact/plan:0,percent);
      const previous=prevRates[i];
      if(i&&previous!==null){
        ws.getCell('I'+row).value=previous;
        ws.getCell('I'+row).numFmt=percent;
        setFormula(ws.getCell('J'+row),'F'+row+'-I'+row,(stageData[i-1][2]>0?fact/asNum(stageData[i-1][2]):0)-previous,'+0.0%;-0.0%;0.0%');
        ws.getCell('K'+row).value={formula:'IF(J'+row+'<0,"Просадка","Не хуже")',
          result:(stageData[i-1][2]>0?fact/asNum(stageData[i-1][2]):0)<previous?'Просадка':'Не хуже'};
        const cr='J'+row;
        ws.addConditionalFormatting({ref:cr,rules:[
          {type:'cellIs',operator:'lessThan',formulae:['0'],style:{fill:paleFill(C.redBg),font:{color:{argb:C.red},bold:true}}},
          {type:'cellIs',operator:'greaterThanOrEqual',formulae:['0'],style:{fill:paleFill(C.greenBg),font:{color:{argb:C.green},bold:true}}}
        ]});
      }else{
        ws.getCell('I'+row).value='—';ws.getCell('J'+row).value='—';
        ws.getCell('K'+row).value='Нет базы';
      }
      ws.mergeCells('L'+row+':O'+row);
      const note=ws.getCell('L'+row);
      note.value=['Начало цепочки: количество звонков','Как назначаем встречи из контактов',
        'Сколько назначенных встреч состоялось','Сколько КП подготовлено после встреч'][i];
      note.font={name:'Aptos',size:10,color:{argb:C.muted}};
      note.alignment={vertical:'middle',wrapText:true,indent:1};
      ['D','E','F','G','H','I','J','K'].forEach(c=>{
        const cell=ws.getCell(c+row);
        cell.fill=cell.fill||paleFill(i%2===0?C.white:C.neutral);
        cell.alignment={horizontal:'center',vertical:'middle'};
        cell.font=cell.font||{name:'Aptos',size:11,color:{argb:C.ink}};
      });
      ws.getRow(row).height=48;
    });
    // Одна общая шкала от max этапа, бар в Excel меняется при правке источника.
    ws.addConditionalFormatting({ref:'E12:E15',rules:[{
      type:'dataBar',cfvo:[{type:'num',value:0},{type:'max'}],
      color:C.blue,showValue:false,gradient:true
    }]});
    ws.addConditionalFormatting({ref:'H12:H15',rules:[
      {type:'cellIs',operator:'lessThan',formulae:['1'],style:{fill:paleFill(C.redBg),font:{color:{argb:C.red},bold:true}}},
      {type:'cellIs',operator:'greaterThanOrEqual',formulae:['1'],style:{fill:paleFill(C.greenBg),font:{color:{argb:C.green},bold:true}}}
    ]});
    ws.addConditionalFormatting({ref:'K12:K15',rules:[
      {type:'expression',formulae:['K12="Просадка"'],style:{fill:paleFill(C.redBg),font:{color:{argb:C.red},bold:true}}},
      {type:'expression',formulae:['K12="Не хуже"'],style:{fill:paleFill(C.greenBg),font:{color:{argb:C.green},bold:true}}}
    ]});
    band('A17:O17','Подсветка «Просадка» сравнивает переход между этапами с прошлым месяцем. Без данных прошлого месяца оценка не строится.',C.pale,C.muted,36);
    band('A20:H20','02  /  ТЕМП ПОДКЛЮЧЕНИЙ · ФАКТ И ОРИЕНТИР',C.navy2,C.white,32);
    band('I20:O20','03  /  СРАВНЕНИЕ МЕНЕДЖЕРОВ',C.navy2,C.white,32);
    band('A42:O42','04  /  ОБЪЁМ ПО ЭТАПАМ · ДИАГРАММА',C.navy2,C.white,32);
    ws.getRow(41).height=15;
    ws.getRow(63).height=13;
    band('A64:O64','05  /  РИСКИ И СЛЕДУЮЩИЕ ДЕЙСТВИЯ',navy,C.white,34);
    const risks=[
      ['A65:C65','A66:C68','ПРОСРОЧЕН КОНТАКТ',"'Главная'!B20",lateContacts,C.red],
      ['D65:F65','D66:F68','ПРОСРОЧЕНА ПОДПИСЬ',"'Главная'!E20",lateSignatures,C.red],
      ['G65:I65','G66:I68','ДОГОВОРЫ > 7 ДНЕЙ',"'Главная'!H20",oldContracts,C.amber],
      ['J65:L65','J66:L68','НУЖНО ПОДКЛЮЧЕНИЙ',"'Главная'!K8",Math.max(target-connected,0),C.blue]
    ];
    risks.forEach(([head,area,label,formula,result,color])=>{
      band(head,label,C.pale,C.muted,29);
      const c=band(area,null,C.neutral,color,29);
      c.value={formula,result};c.numFmt=integer;
      c.font={name:'Aptos Display',size:25,bold:true,color:{argb:color}};
      c.alignment={horizontal:'center',vertical:'middle'};
    });
    band('A70:O70','Отдельные менеджеры и конкретные лагеря → листы «Менеджеры» и «Контрактинг». Это и есть рабочий список для дожима.',C.pale,C.muted,32);
    band('A72:O72','НАВИГАЦИЯ ПО ПОДРОБНОСТЯМ',navy,C.white,29);
    const refs=[['A73','Главная'],['D73','Воронка'],['G73','Динамика'],
      ['J73','Менеджеры'],['M73','Контрактинг'],['A75','Контрольные точки'],['D75','Итоги сотрудников']];
    refs.forEach(([p,name])=>{
      const c=ws.getCell(p);c.value=sheetLink(name);
      c.font={name:'Aptos',size:12,color:{argb:blue},bold:true,underline:true};
      c.fill=paleFill(C.pale);c.alignment={vertical:'middle',indent:1};
      ws.getRow(c.row).height=34;
    });
    band('A77:O77','Графики — встроенные диаграммы Excel: после правки исходных ячеек они обновляются. Это не изображения. Срез договоров не равен прогнозу гарантированных подключений.',C.neutral,C.muted,36);
    ws.getCell('A77').alignment={wrapText:true,vertical:'middle',indent:1};
    ws.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:3};
    ws.printArea='A1:O77';
    return {
      daily:{
        serials:dailyData.slice(0,Math.max(1,nowDay)).map(r=>r[0] instanceof Date?
          Math.round((Date.UTC(r[0].getFullYear(),r[0].getMonth(),r[0].getDate())-Date.UTC(1899,11,30))/86400000):0),
        labels:dailyData.slice(0,Math.max(1,nowDay)).map((_,i)=>String(i+1).padStart(2,'0')),
        fact:dailyData.slice(0,Math.max(1,nowDay)).map((r,i)=>dailyData.slice(0,i+1).reduce((s,x)=>s+asNum(x[6]),0)),
        plan:dailyData.slice(0,Math.max(1,nowDay)).map((_,i)=>nowDay?Math.round(target*(i+1)/dailyData.length):0)
      },
      managers:{
        names:memberData.map(r=>r[0]),
        fact:memberData.map(r=>r[12]),
        plan:memberData.map(r=>r[13])
      },
      funnel:{
        labels:stageData.slice(0,4).map(r=>r[0]),
        fact:stageData.slice(0,4).map(r=>r[2])
      }
    };
  }

  function buildReport(wb, info) {
    const {rows, members, contracts, activeContracts, min, target, max, dates, cutoff, month} = info;
    const overview=wb.addWorksheet('Обзор',{properties:{tabColor:{argb:C.green}}});
    const home=wb.addWorksheet('Главная',{properties:{tabColor:{argb:C.blue}}});
    const totals = key => rows.reduce((n,r)=>n+asNum(r[key]),0);
    const connected=totals('connected_fact');
    const activeIDs=new Set(activeContracts.map(c=>String(c.id||'')));
    const inProgress=activeContracts.length;
    const daysInMonth=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
    const currentMonth=todayISO().slice(0,7);
    const nowDay=month>currentMonth?0:month<currentMonth?daysInMonth:Math.max(0,Math.min(daysInMonth,Number(cutoff.slice(8,10))));
    const remaining=Math.max(daysInMonth-nowDay,0);
    const expected=nowDay?Math.round(target*nowDay/daysInMonth):0;

    const byDay=new Map();
    rows.forEach(r=>{
      const date=String(r.report_date||'');
      if (!byDay.has(date)) byDay.set(date,[]);
      byDay.get(date).push(r);
    });
    const dailyData=[];
    for(let d=1;d<=daysInMonth;d++){
      const iso=month+'-'+String(d).padStart(2,'0'),dayRows=byDay.get(iso)||[];
      dailyData.push([
        shortDate(iso),
        dayRows.reduce((n,r)=>n+asNum(r.calls_fact),0),
        dayRows.reduce((n,r)=>n+asNum(r.booked_fact),0),
        dayRows.reduce((n,r)=>n+asNum(r.meetings_fact),0),
        dayRows.reduce((n,r)=>n+asNum(r.offers_fact),0),
        dayRows.reduce((n,r)=>n+asNum(r.follow_fact),0),
        dayRows.reduce((n,r)=>n+asNum(r.connected_fact),0),
        null,null,null,
        dayRows.length?dayRows.reduce((n,r)=>n+contractRowStats(r).active,0):null
      ]);
    }
    const datesWS=section(wb,'Динамика','ДИНАМИКА · день за днём',
      'Каждый календарный день месяца. Ориентир — равномерный темп по цели, а не утвержденный дневной план.',
      ['Дата','Звонки','Назначено','Проведено','КП','Повторные','Подключено','Всего с начала','Ориентир к дню','Отклонение','Подписание · снимок'],
      dailyData,[16,13,15,15,13,15,16,18,18,16,22],
      {dateCols:[1],numCols:[2,3,4,5,6,7,8,9,10,11],tab:C.blue});
    dailyData.forEach((values,i)=>{
      const r=i+6;
      const running=dailyData.slice(0,i+1).reduce((sum,row)=>sum+asNum(row[6]),0);
      const paced=Math.round(target*(i+1)/daysInMonth);
      setFormula(datesWS.getCell('H'+r),'SUM($G$6:G'+r+')',running);
      setFormula(datesWS.getCell('I'+r),"ROUND('Главная'!$B$8*DAY(A"+r+")/DAY(EOMONTH(A"+r+",0)),0)",paced);
      setFormula(datesWS.getCell('J'+r),'H'+r+'-I'+r,running-paced);
      if(i+1>nowDay){
        datesWS.getCell('I'+r).value=null;
        datesWS.getCell('J'+r).value=null;
      }
    });
    colorize(datesWS,'J',nowDay);

    const memberData=members.map(p=>{
      const own=rows.filter(r=>r.user_id===p.id);
      const get=k=>own.reduce((s,r)=>s+asNum(r[k]),0);
      const active=activeContracts.filter(c=>c.user_id===p.id).length;
      const ownGoal=typeof PERSONAL_MONTH_TARGET==='number'?PERSONAL_MONTH_TARGET:5;
      return [p.full_name||p.email||String(p.id),get('calls_plan'),get('calls_fact'),
        get('booked_plan'),get('booked_fact'),get('meetings_plan'),get('meetings_fact'),
        get('offers_plan'),get('offers_fact'),get('follow_plan'),get('follow_fact'),
        active,get('connected_fact'),ownGoal,null,null];
    });
    const memberWS=section(wb,'Менеджеры','КОМАНДА · выполнение и узкие места',
      'План / факт взяты из ежедневных отчётов. Цель 5 подключений на менеджера — действующий ориентир доски; не замещает командную цель.',
      ['Менеджер','Звонки П','Звонки Ф','Встречи назнач. П','Встречи назнач. Ф','Встречи провед. П','Встречи провед. Ф','КП П','КП Ф','Повторы П','Повторы Ф','На подписании','Подключено','Ориентир','Исполнение','До ориентира'],
      memberData,[24,12,12,15,15,15,15,11,11,13,13,17,15,13,15,16],
      {numCols:[2,3,4,5,6,7,8,9,10,11,12,13,14,16],percentCols:[15],tab:C.green});
    memberData.forEach((values,i)=>{
      const r=i+6,rate=values[13]>0?values[12]/values[13]:0;
      setFormula(memberWS.getCell('O'+r),'IFERROR(M'+r+'/N'+r+',0)',rate,percent);
      setFormula(memberWS.getCell('P'+r),'MAX(N'+r+'-M'+r+',0)',Math.max(values[13]-values[12],0));
    });
    if(memberData.length){
      memberWS.addConditionalFormatting({ref:'O6:O'+(memberData.length+5),rules:[{
        type:'colorScale',cfvo:[{type:'num',value:0},{type:'num',value:0.7},{type:'num',value:1}],
        color:[{argb:C.redBg},{argb:C.amberBg},{argb:C.greenBg}]
      }]});
    }

    const contractRows=contracts.map(c=>{
      const isCurrent=activeIDs.has(String(c.id||'')) && c.status==='signing';
      const age=asNum(contractAge(c));
      const lateContact=isCurrent&&filled(c.next_contact)&&c.next_contact<dates.contract;
      const lateSign=isCurrent&&filled(c.target_date)&&c.target_date<dates.contract;
      return [
        c.manager || (members.find(p=>p.id===c.user_id)||{}).full_name || 'Сотрудник',
        c.client||'',shortDate(c.sent_date),shortDate(c.target_date),
        c.ball==='us'?'У нас':'У клиента',c.blocker||'',c.next_action||'',
        contractStatusLabel(c.status),shortDate(c.next_contact),
        age,isCurrent?'Да':'Нет',lateContact?1:0,lateSign?1:0,isCurrent&&age>7?1:0,
        shortDate(c.first_seen)
      ];
    });
    const cws=section(wb,'Контрактинг','КОНТРАКТИНГ · что мешает подписанию',
      'Только «Актуален = Да» учитывается в текущем портфеле. Просрочки сравниваются с выбранной датой среза договора.',
      ['Менеджер','Лагерь','Отправлен','План подписи','У кого мяч','Блокер','Следующее действие','Статус','След. контакт','Дней','Актуален','Контакт просрочен','Подпись просрочена','Больше 7 дней','Первое появление'],
      contractRows,[23,27,16,17,15,37,42,20,17,11,13,19,19,16,18],
      {dateCols:[3,4,9,15],numCols:[10,12,13,14],tall:true,tab:C.amber,wrap:true});
    for(let i=0;i<contractRows.length;i++){
      const r=i+6,values=contractRows[i];
      [12,13,14].forEach(col=>{
        const formula=col===12
          ?"IF(AND(K"+r+"=\"Да\",I"+r+"<>\"\",I"+r+"<'Главная'!$I$4),1,0)"
          :col===13
          ?"IF(AND(K"+r+"=\"Да\",D"+r+"<>\"\",D"+r+"<'Главная'!$I$4),1,0)"
          :"IF(AND(K"+r+"=\"Да\",J"+r+">7),1,0)";
        setFormula(cws.getCell(r,col),formula,values[col-1]);
        if(values[col-1]){cws.getCell(r,col).fill=paleFill(C.redBg);cws.getCell(r,col).font={bold:true,color:{argb:C.red}};}
      });
      if(values[10]==='Да'){cws.getCell(r,11).fill=paleFill(C.greenBg);cws.getCell(r,11).font={bold:true,color:{argb:C.green}};}
    }

    const stageData=[];
    const steps=['calls','booked','meetings','offers'];
    steps.forEach((key,index)=>{
      const fact=totals(key+'_fact'),plan=totals(key+'_plan');
      stageData.push([metricLabels[key],plan,fact,null,
        index?null:null,index===0?'Входящий объём':'Соотношение с предыдущим этапом (не когортная конверсия)']);
    });
    stageData.push(['Договор на подписании · сейчас',null,inProgress,null,null,'Текущий остаток, не этап месячной конверсии']);
    stageData.push(['Подключено лагерей',target,connected,null,null,'Результат месяца, сравнивается с целью подключений']);
    const funnelWS=section(wb,'Воронка','ВОРОНКА · от звонка до результата',
      'Отношения этапов ориентировочные: события могут относиться к разным клиентам и дням. Остаток договоров не используется как знаменатель.',
      ['Этап','План','Факт','Выполнение','К предыдущему','Примечание'],
      stageData,[37,17,17,19,21,75],{numCols:[2,3],percentCols:[4,5],tab:C.blue,wrap:true});
    stageData.forEach((values,i)=>{
      const r=i+6;
      if(i<4){
        const rate=values[1]?values[2]/values[1]:0;
        setFormula(funnelWS.getCell('D'+r),'IFERROR(C'+r+'/B'+r+',0)',rate,percent);
        if(i>0) {
          const prev=stageData[i-1][2];
          setFormula(funnelWS.getCell('E'+r),'IFERROR(C'+r+'/C'+(r-1)+',0)',prev?values[2]/prev:0,percent);
        }
      }
      if(i===5) setFormula(funnelWS.getCell('D'+r),'IFERROR(C'+r+'/B'+r+',0)',target?connected/target:0,percent);
    });

    const pointData=(checkpoints||[]).map(cp=>[
      shortDate(cp.checkpoint_date),asNum(cp.plan),asNum(cp.fact),null,cp.comment||''
    ]);
    const checkpointWS=section(wb,'Контрольные точки','КОНТРОЛЬНЫЕ ТОЧКИ',
      'План / факт накопительно — именно то, что было зафиксировано в доске руководителя.',
      ['Дата','План накопительно','Факт накопительно','Отклонение','Комментарий'],
      pointData,[18,25,25,18,75],{dateCols:[1],numCols:[2,3,4],tab:C.amber,wrap:true});
    pointData.forEach((values,i)=>{
      const r=i+6;
      setFormula(checkpointWS.getCell('D'+r),'C'+r+'-B'+r,values[2]-values[1]);
    });
    colorize(checkpointWS,'D',pointData.length);

    const noteRows=rows.slice().sort((a,b)=>String(b.report_date).localeCompare(String(a.report_date))).map(r=>{
      const p=profiles.find(x=>x.id===r.user_id)||{};
      const ref=parseReflection(r.comment);
      return [shortDate(r.report_date),p.full_name||p.email||r.user_id,
        ref.result||'',(ref.reasons||[]).join(', '),ref.blockers||'',ref.tomorrow||'',asNum(r.connected_fact)];
    }).filter(r=>filled(r[2])||filled(r[3])||filled(r[4])||filled(r[5]));
    section(wb,'Итоги сотрудников','КОММЕНТАРИИ · управленческий контекст',
      'Что получилось, почему не получилось и что команда делает дальше. Отфильтруй менеджера или дату в заголовках.',
      ['Дата','Менеджер','Что получилось','Причины','Блокеры','План на завтра','Подключено'],
      noteRows,[16,23,48,30,49,48,17],{dateCols:[1],numCols:[7],tall:true,wrap:true,tab:C.navy2});

    const homeWidths=[24,16,14,23,17,14,25,16,15,24,17,15];
    homeWidths.forEach((w,i)=>home.getColumn(i+1).width=w);
    home.views=[{state:'frozen',ySplit:4,showGridLines:false,zoomScale:90}];
    home.mergeCells('A1:L2');
    const banner=home.getCell('A1');
    banner.value='CAMPBOX  /  SALES REPORT';
    banner.font={name:'Aptos Display',size:23,bold:true,color:{argb:C.white}};
    banner.fill=paleFill(C.navy);
    banner.alignment={vertical:'middle',indent:1};
    home.getRow(1).height=32;home.getRow(2).height=30;
    home.mergeCells('A3:L3');
    home.getCell('A3').value='Управленческая сводка — команда, темп подключений, договоры и ближайшие действия';
    home.getCell('A3').font={name:'Aptos',size:12,color:{argb:C.muted}};
    home.getRow(3).height=31;
    home.getCell('A4').value='Расчётный срез:';
    home.getCell('B4').value=shortDate(cutoff);
    home.getCell('B4').numFmt=dateFormat;
    home.getCell('D4').value='Месяц отчёта:';
    home.getCell('E4').value=month;
    home.getCell('H4').value='Дата договоров:';
    home.getCell('I4').value=shortDate(dates.contract);
    home.getCell('I4').numFmt=dateFormat;
    ['A4','D4','H4'].forEach(a=>{home.getCell(a).font={bold:true,color:{argb:C.muted}};});
    ['B4','E4','I4'].forEach(a=>{home.getCell(a).font={bold:true,color:{argb:C.ink}};});
    home.getRow(4).height=26;
    home.mergeCells('A6:L6');
    home.getCell('A6').value='01  /  РЕЗУЛЬТАТ МЕСЯЦА';
    home.getCell('A6').font={name:'Aptos',bold:true,size:12,color:{argb:C.blue}};
    home.getRow(6).height=31;
    const block=(labelAddress,valueAddress,label,value,result,fmt,accent=C.navy)=>{
      const labelCell=home.getCell(labelAddress),valueCell=home.getCell(valueAddress);
      labelCell.value=label;labelCell.font={size:10,bold:true,color:{argb:C.muted}};
      valueCell.value=value;
      if (value && typeof value==='object' && value.formula) valueCell.value={formula:value.formula,result};
      if(fmt)valueCell.numFmt=fmt;
      valueCell.font={name:'Aptos Display',size:22,bold:true,color:{argb:accent}};
      valueCell.fill=paleFill(C.pale);
      valueCell.alignment={horizontal:'center',vertical:'middle'};
      home.getRow(valueCell.row).height=49;
    };
    block('A7','B8','ЦЕЛЬ',target,target,integer);
    block('D7','E8','ПОДКЛЮЧЕНО',{formula:"SUM('Динамика'!G6:G"+(daysInMonth+5)+")"},connected,integer,C.green);
    block('G7','H8','ВЫПОЛНЕНИЕ',{formula:'IFERROR(E8/B8,0)'},target?connected/target:0,percent,C.blue);
    block('J7','K8','ОСТАЛОСЬ',{formula:'MAX(B8-E8,0)'},Math.max(target-connected,0),integer,C.red);
    block('A11','B12','ПЛАН МИНИМУМ',min,min,integer);
    block('D11','E12','ПЛАН МАКСИМУМ',max,max,integer);
    block('G11','H12','НА ПОДПИСАНИИ',{formula:"COUNTIF('Контрактинг'!K6:K"+Math.max(6,contractRows.length+5)+",\"Да\")"},inProgress,integer,C.amber);
    block('J11','K12','ФАКТ + ПОДПИСАНИЕ',{formula:'E8+H12'},connected+inProgress,integer,C.blue);
    home.mergeCells('A14:L14');
    home.getCell('A14').value='02  /  ТЕМП И РИСКИ';
    home.getCell('A14').font={bold:true,size:12,color:{argb:C.blue}};
    home.getRow(14).height=31;
    block('A15','B16','ДНЕЙ ПРОШЛО',nowDay,nowDay,integer);
    block('D15','E16','ОРИЕНТИР НА ДАТУ',{formula:'ROUND(B8*B16/'+daysInMonth+',0)'},expected,integer);
    block('G15','H16','ОТСТАВАНИЕ',{formula:'MAX(E16-E8,0)'},Math.max(expected-connected,0),integer,C.red);
    const perDay=remaining?Math.ceil(Math.max(target-connected,0)/remaining):0;
    block('J15','K16','НУЖНО В ДЕНЬ',{formula:'IF('+remaining+'>0,ROUNDUP(MAX(B8-E8,0)/'+(remaining||1)+',0),0)'},perDay,integer,C.amber);
    home.mergeCells('A18:L18');
    home.getCell('A18').value='03  /  ЧТО ПРОВЕРИТЬ РУКОВОДИТЕЛЮ';
    home.getCell('A18').font={bold:true,size:12,color:{argb:C.blue}};
    home.getRow(18).height=31;
    const activeLateContacts=contractRows.reduce((s,r)=>s+asNum(r[11]),0);
    const activeLateSign=contractRows.reduce((s,r)=>s+asNum(r[12]),0);
    const oldContracts=contractRows.reduce((s,r)=>s+asNum(r[13]),0);
    const blockerCount=noteRows.filter(r=>filled(r[4])).length;
    block('A19','B20','ПРОСРОЧЕН КОНТАКТ',{formula:"SUM('Контрактинг'!L6:L"+(Math.max(6,contractRows.length+5))+")"},activeLateContacts,integer,C.red);
    block('D19','E20','ПРОСРОЧЕНА ПОДПИСЬ',{formula:"SUM('Контрактинг'!M6:M"+(Math.max(6,contractRows.length+5))+")"},activeLateSign,integer,C.red);
    block('G19','H20','СТАРШЕ 7 ДНЕЙ',{formula:"SUM('Контрактинг'!N6:N"+(Math.max(6,contractRows.length+5))+")"},oldContracts,integer,C.amber);
    block('J19','K20','ЗАПИСЕЙ С БЛОКЕРАМИ',blockerCount,blockerCount,integer,C.amber);
    home.mergeCells('A23:L23');
    home.getCell('A23').value='БЫСТРЫЙ ПЕРЕХОД К ДЕТАЛЯМ';
    home.getCell('A23').font={bold:true,size:12,color:{argb:C.blue}};
    home.getRow(23).height=30;
    [['A24','Менеджеры'],['D24','Динамика'],['G24','Воронка'],['J24','Контрактинг'],
      ['A26','Контрольные точки'],['D26','Итоги сотрудников']].forEach(([pos,name])=>{
      const cell=home.getCell(pos);
      cell.value=sheetLink(name);
      cell.font={name:'Aptos',size:11,bold:true,color:{argb:C.blue},underline:true};
      cell.fill=paleFill(C.pale);
      cell.alignment={vertical:'middle',indent:1};
      home.getRow(cell.row).height=33;
    });
    home.mergeCells('A29:L29');
    home.getCell('A29').value='Важно: «на подписании» — остаток активных договоров, не гарантированный результат. Темп рассчитан равномерно по календарным дням.';
    home.getCell('A29').font={name:'Aptos',size:10,italic:true,color:{argb:C.muted}};
    home.getCell('A29').alignment={wrapText:true,indent:1};
    home.getRow(29).height=36;
    home.mergeCells('A30:L30');
    home.getCell('A30').value='Показатели строятся по сохранённым отчётам за выбранный месяц. Формулы пересчитываются при открытии файла в Excel; исходные строки не изменяют данные в доске.';
    home.getCell('A30').font={name:'Aptos',size:10,color:{argb:C.muted}};
    home.getCell('A30').alignment={wrapText:true,indent:1};
    home.getRow(30).height=36;
    home.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1};
    home.printArea='A1:L30';
    return visualOverview(overview,{month,target,connected,inProgress,expected,
      lateContacts:activeLateContacts,lateSignatures:activeLateSign,oldContracts,
      stageData,memberData,dailyData,nowDay,prevRows:info.prevRows||[]});
  }

  window.exportExcelV2 = async function () {
    if (!isManager()) return;
    if (typeof ExcelJS==='undefined'||typeof JSZip==='undefined'||typeof window.CampBoxNativeExcelCharts!=='function') {
      alert('Модуль визуального Excel-отчёта не загрузился. Обнови страницу (Ctrl + F5) и повтори выгрузку. Старый формат автоматически не скачиваем.');
      return;
    }
    const button=document.getElementById('excelBtn');
    if(button && button.disabled)return;
    const before=button?button.textContent:'';
    if(button){button.disabled=true;button.textContent='Собираем отчёт…';}
    try {
      const month=selectedMonth;
      const all=new Map();
      monthRows.forEach(r=>all.set(String(r.report_date)+'|'+String(r.user_id),r));
      dayRows.forEach(r=>all.set(String(r.report_date)+'|'+String(r.user_id),r));
      const rows=[...all.values()].filter(r=>String(r.report_date||'').startsWith(month));
      const entries=monthlyContractEntries();
      const active=activeContractEntries();
      const contractDate=selectedDate || todayISO();
      const curr=todayISO(),cutoff=month<curr.slice(0,7)?month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0'):month>curr.slice(0,7)?month+'-01':curr;
      const workbook=new ExcelJS.Workbook();
      workbook.creator='CampBox Sales Board';
      workbook.lastModifiedBy='CampBox Sales Board';
      workbook.created=new Date();
      workbook.calcProperties.fullCalcOnLoad=true;
      const relevant=profiles.filter(p=>rows.some(r=>r.user_id===p.id)||active.some(c=>c.user_id===p.id));
      const visuals=buildReport(workbook,{
        month,rows,members:relevant,contracts:entries,activeContracts:active,
        min:asNum(document.getElementById('monthMin').value),
        target:asNum(document.getElementById('monthTarget').value),
        max:asNum(document.getElementById('monthMax').value),
        cutoff,dates:{contract:contractDate},prevRows:prevMonthRows
      });
      let buf=await workbook.xlsx.writeBuffer();
      buf=await window.CampBoxNativeExcelCharts(buf,visuals);
      const url=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const a=document.createElement('a');a.href=url;a.download='CampBox_Отчет_руководителя_'+month+'.xlsx';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
    } catch(e) {
      console.error('CampBox Excel v2:',e);
      alert('Не удалось сформировать визуальный Excel-отчёт. Старый файл не скачиваем. Ошибка: '+(e?.message||String(e)));
    } finally {
      if(button){button.disabled=false;button.textContent=before;}
    }
  };
})();
