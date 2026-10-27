/* CampBox Sales — native Excel charts added after ExcelJS generation.
   Sources are workbook cells, not screenshots. Charts refresh when source ranges change. */
(function () {
  'use strict';
  const NS = {
    c:'http://schemas.openxmlformats.org/drawingml/2006/chart',
    a:'http://schemas.openxmlformats.org/drawingml/2006/main',
    r:'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    xdr:'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const seriesColor=hex=>'<c:spPr><a:solidFill><a:srgbClr val="'+hex+'"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>';
  const strCache=list=>'<c:strCache><c:ptCount val="'+list.length+'"/>'+list.map((v,i)=>'<c:pt idx="'+i+'"><c:v>'+esc(v)+'</c:v></c:pt>').join('')+'</c:strCache>';
  const numCache=(list,fmt='0')=>'<c:numCache><c:formatCode>'+esc(fmt)+'</c:formatCode><c:ptCount val="'+list.length+'"/>'+list.map((v,i)=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?'<c:pt idx="'+i+'"><c:v>'+Number(v)+'</c:v></c:pt>':'').join('')+'</c:numCache>';
  function categories(ref,vals,numeric=false) {
    const kind=numeric?'numRef':'strRef';
    return '<c:cat><c:'+kind+'><c:f>'+esc(ref)+'</c:f>'+(numeric?numCache(vals,'dd.mm'):strCache(vals))+'</c:'+kind+'></c:cat>';
  }
  const values=(ref,vals)=>'<c:val><c:numRef><c:f>'+esc(ref)+'</c:f>'+numCache(vals)+'</c:numRef></c:val>';
  function aSeries(index,label,catRef,categoriesCache,valRef,valuesCache,color,numericCat=false,showMarkers=null) {
    return '<c:ser><c:idx val="'+index+'"/><c:order val="'+index+'"/><c:tx><c:v>'+esc(label)+'</c:v></c:tx>'+
      seriesColor(color)+
      (showMarkers===null?'':(showMarkers?'<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>':'<c:marker><c:symbol val="none"/></c:marker>'))+categories(catRef,categoriesCache,numericCat)+values(valRef,valuesCache)+'</c:ser>';
  }
  function axes(xId,yId,catAxis='b',valueAxis='l',catFmt='General') {
    return '<c:catAx><c:axId val="'+xId+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="'+catAxis+'"/>'+
      '<c:numFmt formatCode="'+esc(catFmt)+'" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="'+yId+'"/><c:crosses val="autoZero"/></c:catAx>'+
      '<c:valAx><c:axId val="'+yId+'"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:axPos val="'+valueAxis+'"/>'+
      '<c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/>'+
      '<c:crossAx val="'+xId+'"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>';
  }
  function chartDocument(inner,legend) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<c:chartSpace xmlns:c="'+NS.c+'" xmlns:a="'+NS.a+'"><c:lang val="ru-RU"/>'+
      '<c:roundedCorners val="1"/><c:chart><c:plotArea><c:layout/>'+inner+'</c:plotArea>'+
      (legend?'<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>':'')+
      '<c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/></c:chart>'+
      '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:chartSpace>';
  }
  const range=(sheet,col,last)=>"'"+sheet+"'!$"+col+"$6:$"+col+"$"+Math.max(6,last);
  function makeLine(data) {
    const n=data.daily.labels.length,last=5+Math.max(1,n),cat=range('Динамика','A',last);
    const ser1=aSeries(0,'Факт накопительно',cat,data.daily.serials,range('Динамика','H',last),data.daily.fact,'13795B',true,true);
    const ser2=aSeries(1,'Ориентир к дате',cat,data.daily.serials,range('Динамика','I',last),data.daily.plan,'4268D6',true,false);
    const shape='<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>'+ser1+ser2+
      '<c:smooth val="0"/><c:axId val="3711890"/><c:axId val="3711891"/></c:lineChart>';
    return chartDocument(shape+axes(3711890,3711891,'b','l','dd.mm'),true);
  }
  function makeManagers(data) {
    const n=data.managers.names.length,last=5+Math.max(1,n),cat=range('Менеджеры','A',last);
    const ser1=aSeries(0,'Подключено',cat,data.managers.names,range('Менеджеры','M',last),data.managers.fact,'13795B');
    const ser2=aSeries(1,'Ориентир',cat,data.managers.names,range('Менеджеры','N',last),data.managers.plan,'9BAADE');
    const shape='<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>'+
      ser1+ser2+'<c:gapWidth val="90"/><c:overlap val="0"/>'+
      '<c:axId val="4761890"/><c:axId val="4761891"/></c:barChart>';
    return chartDocument(shape+axes(4761890,4761891),true);
  }
  function makeFunnel(data) {
    const names=data.funnel.labels,actual=data.funnel.fact,last=5+Math.max(1,names.length);
    const s=aSeries(0,'Факт по этапам',range('Воронка','A',last),names,range('Воронка','C',last),actual,'4268D6');
    const shape='<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>'+s+
      '<c:gapWidth val="80"/><c:axId val="5811890"/><c:axId val="5811891"/></c:barChart>';
    return chartDocument(shape+axes(5811890,5811891,'l','b'),false);
  }
  function anchor(id,fromCol,fromRow,toCol,toRow) {
    const point=(tag,col,row)=>'<xdr:'+tag+'><xdr:col>'+col+'</xdr:col><xdr:colOff>0</xdr:colOff>'+
      '<xdr:row>'+row+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:'+tag+'>';
    return '<xdr:twoCellAnchor editAs="oneCell">'+point('from',fromCol,fromRow)+point('to',toCol,toRow)+
      '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="'+id+'" name="CampBox dynamic chart '+id+'"/>'+
      '<xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'+
      '<a:graphic><a:graphicData uri="'+NS.c+'"><c:chart r:id="rIdSbChart'+id+'"/></a:graphicData></a:graphic>'+
      '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
  }

  window.CampBoxNativeExcelCharts = async function(buffer, data) {
    if(typeof JSZip==='undefined') throw new Error('JSZip не загрузился: встроенные диаграммы недоступны.');
    const zip=await JSZip.loadAsync(buffer);
    const drawings='xl/drawings/drawing_sb_visual.xml';
    if(zip.file(drawings)) throw new Error('Идентификатор схемы диаграмм уже существует.');
    const charts=[makeLine(data),makeManagers(data),makeFunnel(data)];
    charts.forEach((xml,i)=>zip.file('xl/charts/chart_sb_'+(i+1)+'.xml',xml));
    const drawing='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<xdr:wsDr xmlns:xdr="'+NS.xdr+'" xmlns:a="'+NS.a+'" xmlns:c="'+NS.c+'" xmlns:r="'+NS.r+'">'+
      anchor(1,0,21,8,40)+anchor(2,8,21,15,40)+anchor(3,0,43,15,62)+'</xdr:wsDr>';
    zip.file(drawings,drawing);
    const drRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      charts.map((_,i)=>'<Relationship Id="rIdSbChart'+(i+1)+'" Type="'+NS.r+'/chart" Target="../charts/chart_sb_'+(i+1)+'.xml"/>').join('')+
      '</Relationships>';
    zip.file('xl/drawings/_rels/drawing_sb_visual.xml.rels',drRels);
    const sheetFile='xl/worksheets/sheet1.xml',sh=zip.file(sheetFile);
    if(!sh)throw new Error('Не найден стартовый лист отчёта.');
    let ws=await sh.async('string');
    if(ws.includes('rIdSbVisualDrawing'))throw new Error('Диаграммы уже подключены.');
    const drawingTag='<drawing xmlns:r="'+NS.r+'" r:id="rIdSbVisualDrawing"/>';
    if(!ws.includes('</worksheet>'))throw new Error('Неизвестный формат листа Excel.');
    ws=ws.replace('</worksheet>',drawingTag+'</worksheet>');
    zip.file(sheetFile,ws);
    const relPath='xl/worksheets/_rels/sheet1.xml.rels';
    const rel=zip.file(relPath);
    let relXml=rel?await rel.async('string'):
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    const relation='<Relationship Id="rIdSbVisualDrawing" Type="'+NS.r+'/drawing" Target="../drawings/drawing_sb_visual.xml"/>';
    if(!relXml.includes('</Relationships>'))throw new Error('Некорректные связи листа.');
    relXml=relXml.replace('</Relationships>',relation+'</Relationships>');
    zip.file(relPath,relXml);
    const typePath='[Content_Types].xml',contentTypes=zip.file(typePath);
    if(!contentTypes)throw new Error('Не найден реестр формата Excel.');
    let types=await contentTypes.async('string');
    const entries='<Override PartName="/'+drawings+'" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'+
      charts.map((_,i)=>'<Override PartName="/xl/charts/chart_sb_'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>').join('');
    if(!types.includes('</Types>'))throw new Error('Некорректный реестр формата Excel.');
    types=types.replace('</Types>',entries+'</Types>');
    zip.file(typePath,types);
    return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE',compressionOptions:{level:5}});
  };
})();
