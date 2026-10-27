/* CampBox Product UI v2 — presentation-only architecture.
   Moves existing DOM nodes without replacing their IDs, event handlers or data sources.
   Financial and salary writes remain exclusively in their original modules. */
(function () {
  'use strict';
  var ROOT = 'cb-v2';
  var E = function (tag, className, textValue) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  };
  var $ = function (id) { return document.getElementById(id); };
  var screen = function (id) { return $('v13-' + id); };
  var isLead = function () {
    try { return typeof isManager === 'function' && isManager(); } catch (_) { return false; }
  };
  var busy = false;
  function action(label, page, detail, primary) {
    var b = E('button', 'cb-action'+(primary ? ' primary' : ''), label);
    b.type = 'button';
    b.setAttribute('data-cb-go', page);
    if (detail) b.setAttribute('data-cb-detail', detail);
    return b;
  }
  function intro(title, summary, kicker) {
    var wrap = E('section','cb-page-intro');
    var content = E('div','cb-page-copy');
    content.appendChild(E('div','cb-eyebrow',kicker || 'CAMPBOX · РАБОЧЕЕ ПРОСТРАНСТВО'));
    content.appendChild(E('h2','cb-page-h',title));
    content.appendChild(E('p','cb-page-sub',summary));
    wrap.appendChild(content);
    return wrap;
  }
  function relocate(item, parent, className) {
    if (!item || !parent) return;
    if (className) item.classList.add(className);
    parent.appendChild(item);
  }
  function findCard(scope, title) {
    return Array.from(scope.querySelectorAll('.card')).find(function (c) {
      var h = c.querySelector(':scope > .section-head .section-title h2, :scope > .v13-section-title h2, :scope > .section-head h2');
      return h && h.textContent.trim() === title;
    }) || null;
  }
  function pageLinkHandlers() {
    document.addEventListener('click',function (e) {
      var b = e.target.closest('[data-cb-go]');
      if (!b || !document.body.contains(b)) return;
      var page = b.dataset.cbGo;
      if (!/^(today|month|funnel|contracts|finance|team|salary|analytics|report|summary)$/.test(page)) return;
      if (typeof window.v13Go === 'function') window.v13Go(page);
      var detail = b.dataset.cbDetail;
      if (page === 'finance' && /^(summary|charges|payments)$/.test(detail || '')) {
        jumpWhenReady('#finTab-' + detail, 'v13-finance');
      }
      if (page === 'salary' && /^(mine|payments|clients|retention|team|rules|history)$/.test(detail || '')) {
        jumpWhenReady('[data-salary-tab="' + detail + '"]', 'v13-salary');
      }
    });
  }
  function jumpWhenReady(selector, rootId) {
    var root = $(rootId);
    if (!root) return;
    var click = function () {
      var control = root.querySelector(selector);
      if (control) { control.click(); return true; }
      return false;
    };
    if (click()) return;
    var observer = new MutationObserver(function () {
      if (click()) observer.disconnect();
    });
    observer.observe(root,{childList:true,subtree:true});
    setTimeout(function () { observer.disconnect(); },12000);
  }

  function mountToday() {
    var root=screen('today');if (!root||root.dataset.cbV2) return;
    root.dataset.cbV2='1';
    var overview=intro('Твой рабочий день','План, факт, риск и ближайшие действия — без поиска по десяти экранам.','01 / ОПЕРАЦИОННЫЙ ЦЕНТР');
    overview.classList.add('cb-today-hero');
    var tools=E('div','cb-page-actions');
    tools.append(action('Контрактинг','contracts',null,true));
    tools.append(action('Поступления','finance','payments'));
    tools.append(action('Удержание','salary','retention'));
    overview.appendChild(tools);
    root.insertBefore(overview,root.firstChild);

    var context=root.querySelector(':scope > .context-card');
    var filter=E('div','cb-period-context');
    filter.append(E('div','cb-context-title','Период и параметры отчёта'));
    if(context)relocate(context,filter,'cb-context-original');
    overview.insertAdjacentElement('afterend',filter);

    var kpis=$('v13TodayKpis');
    var summary=E('section','cb-live-summary');
    var heading=E('div','cb-section-bar');
    heading.append(E('div','cb-section-name','Выполнение цели'));
    heading.append(E('div','cb-section-note','Фактические данные Sales Board'));
    summary.appendChild(heading);
    if(kpis)relocate(kpis,summary,'cb-today-kpis');
    filter.insertAdjacentElement('afterend',summary);

    var workspace=E('section','cb-command-layout');
    var colA=E('div','cb-command-main');
    var colB=E('div','cb-command-rail');
    workspace.append(colA,colB);
    summary.insertAdjacentElement('afterend',workspace);

    var day=$('v13TodayPlan')?.closest('.v13-block');
    var focus=findCard(root,'Фокус дня');
    var attention=findCard(root,'Что требует внимания');
    if(day)relocate(day,colA,'cb-primary-task');
    if(attention)relocate(attention,colB,'cb-rail-alerts');
    if(focus)relocate(focus,colB,'cb-rail-focus');
    // Keep every other source node in the original screen, after the new work area.
  }

  function mountMonth() {
    var root=screen('month');if (!root||root.dataset.cbV2)return;
    root.dataset.cbV2='1';
    var lead=intro('План и темп','Решение: насколько отстаём, что исправить и какие действия вернут нас к цели.','02 / УПРАВЛЕНИЕ ПЛАНОМ');
    root.insertBefore(lead,root.firstChild);
    var cols=E('div','cb-month-layout');
    var left=E('div','cb-month-aside');
    var right=E('div','cb-month-chart');
    cols.append(left,right);
    lead.insertAdjacentElement('afterend',cols);
    relocate(findCard(root,'План месяца'),left,'cb-month-targets');
    relocate(root.querySelector('.v13-block:has(#v13Recovery)'),left,'cb-month-recovery');
    relocate(findCard(root,'Темп к цели месяца'),right,'cb-month-pace');
  }

  function mountFunnel() {
    var root=screen('funnel');if (!root||root.dataset.cbV2)return;
    root.dataset.cbV2='1';
    root.insertBefore(intro('Воронка продаж','От объёма звонков до подписанного договора. Сначала видим слабый переход, затем — причину и действие.','03 / КОНВЕРСИЯ'),root.firstChild);
    var drill=root.querySelector('.v13-block:has(#v13StagePanel)');
    if(drill)drill.classList.add('cb-funnel-drill');
    var funnel=findCard(root,'Воронка месяца');
    if(funnel&&drill)drill.insertAdjacentElement('beforebegin',funnel);
  }

  function contractPanel(cards,selected) {
    var detail=$('cbContractDetail');
    if (!detail)return;
    var card=cards[selected];
    if(!card) {
      detail.replaceChildren(E('div','cb-detail-empty','Выбери договор слева. Его текущий статус и следующий шаг появятся здесь.'));
      return;
    }
    var heading=E('div','cb-detail-header');
    heading.append(E('div','cb-eyebrow','ВЫБРАННЫЙ ДОГОВОР'));
    var title=card.querySelector('h3');
    heading.append(E('h3','cb-detail-title',title?title.textContent:'Карточка договора'));
    var body=E('div','cb-detail-content');
    var clone=card.cloneNode(true);
    clone.className='cb-contract-copy';
    clone.removeAttribute('tabindex');
    clone.removeAttribute('role');
    Array.from(clone.querySelectorAll('button')).forEach(function(x){x.remove()});
    body.appendChild(clone);
    var footer=E('div','cb-detail-footer');
    footer.append(action('Ко всем договорам','contracts'));
    var edit=E('button','cb-action primary','Открыть контрактинг');
    edit.type='button';
    var source=card.querySelector('[data-open-contract]');
    edit.disabled=!source;
    edit.addEventListener('click',function () {if(source)source.click();});
    footer.appendChild(edit);
    detail.replaceChildren(heading,body,footer);
  }
  function mountContracts() {
    var root=screen('contracts');if (!root||root.dataset.cbV2)return;
    root.dataset.cbV2='1';
    root.insertBefore(intro('Контрактинг','Контроль сроков и следующего шага. Подписание отражается в результатах, номер договора остаётся обязательным.','04 / СДЕЛКИ'),root.firstChild);
    var grid=$('v13ContractsGrid');
    if(!grid)return;
    var owner=grid.closest('.v13-block');
    if(!owner)return;
    owner.classList.add('cb-contract-workspace');
    var originalBody=grid.parentElement;
    var layout=E('div','cb-contract-layout');
    var left=E('div','cb-contract-list');
    var search=E('label','cb-contract-search');
    search.append(E('span','','Поиск по лагерю, менеджеру или блокеру'));
    var input=E('input','');
    input.type='search';input.id='cbContractsSearch';input.placeholder='Найти договор';input.autocomplete='off';
    search.append(input);
    var count=E('div','cb-list-counter','');
    left.append(search,count,grid);
    var detail=E('aside','cb-contract-detail');detail.id='cbContractDetail';
    detail.setAttribute('aria-label','Подробности выбранного договора');
    layout.append(left,detail);
    originalBody.appendChild(layout);
    var chosen=0, scheduled=false;
    function updateCards() {
      scheduled=false;
      var cards=Array.from(grid.querySelectorAll('.v13-contract'));
      var query=input.value.trim().toLocaleLowerCase('ru');
      cards.forEach(function (c,index) {
        var visible=!query||c.textContent.toLocaleLowerCase('ru').includes(query);
        c.hidden=!visible;
        c.dataset.cbContractIndex=String(index);
        c.setAttribute('role','button');
        c.setAttribute('tabindex',visible?'0':'-1');
        c.setAttribute('aria-label','Посмотреть договор: '+(c.querySelector('h3')?.textContent||'лагерь'));
      });
      var visible=cards.filter(function(c){return !c.hidden});
      count.textContent='Показано: '+visible.length+' из '+cards.length;
      if (!visible.some(function(c){return c===cards[chosen]})) chosen=cards.indexOf(visible[0]);
      cards.forEach(function (c,index) {
        c.classList.toggle('cb-selected',index===chosen&&!c.hidden);
        c.setAttribute('aria-selected',String(index===chosen&&!c.hidden));
      });
      contractPanel(cards,chosen);
    }
    input.addEventListener('input',updateCards);
    grid.addEventListener('click',function (e) {
      if(e.target.closest('button'))return;
      var card=e.target.closest('.v13-contract');
      if(!card)return;
      chosen=Number(card.dataset.cbContractIndex);updateCards();
    });
    grid.addEventListener('keydown',function(e) {
      if(e.key!=='Enter'&&e.key!==' ')return;
      if(e.target.closest('button'))return;
      var card=e.target.closest('.v13-contract');
      if(!card)return;
      e.preventDefault();chosen=Number(card.dataset.cbContractIndex);updateCards();
    });
    var observer=new MutationObserver(function () {
      if (scheduled)return;
      scheduled=true;
      requestAnimationFrame(updateCards);
    });
    observer.observe(grid,{childList:true});
    updateCards();
    var missing=$('v13MissingContractNumbers')?.closest('.v13-block');
    if(missing)missing.classList.add('cb-contract-exceptions');
  }

  function mountTeam() {
    var root=screen('team');if(!root||root.dataset.cbV2)return;
    root.dataset.cbV2='1';
    root.insertBefore(intro('Команда и результат','Сравнение сотрудников, причины отклонений и конкретные управленческие действия.','05 / РУКОВОДИТЕЛЬ'),root.firstChild);
    var grid=$('v13TeamGrid'),details=$('v13ManagerPanel');
    if (!grid||!details)return;
    var body=grid.parentElement;
    var layout=E('div','cb-team-layout');
    var master=E('div','cb-team-master');
    master.append(grid);
    var aside=E('div','cb-team-detail');
    aside.append(details);
    layout.append(master,aside);
    body.appendChild(layout);
    grid.addEventListener('keydown',function(e){
      if(e.key!=='Enter'&&e.key!==' ')return;
      var card=e.target.closest('[data-v13-manager]');if(!card)return;
      e.preventDefault();card.click();
    });
    var observer=new MutationObserver(function () {
      Array.from(grid.querySelectorAll('[data-v13-manager]')).forEach(function(card) {
        card.tabIndex=0;
        card.setAttribute('role','button');
        card.setAttribute('aria-label','Открыть разбор сотрудника '+(card.querySelector('h3')?.textContent||''));
      });
    });
    observer.observe(grid,{childList:true});
    Array.from(grid.querySelectorAll('[data-v13-manager]')).forEach(function(x){x.tabIndex=0;x.setAttribute('role','button');});
  }

  function mountAnalytics() {
    var root=screen('analytics');if(!root||root.dataset.cbV2)return;
    root.dataset.cbV2='1';
    root.insertBefore(intro('Аналитика','Динамика, конверсия, факторы потерь и конкретные следующие действия.','06 / ДИАГНОСТИКА'),root.firstChild);
  }
  function mountReport() {
    var root=screen('report');if(!root||root.dataset.cbV2)return;
    root.dataset.cbV2='1';
    root.insertBefore(intro('Отчёты','Короткий управленческий вывод с возможностью выгрузки — без перегрузки цифрами.','07 / УПРАВЛЕНЧЕСКИЙ ВЫВОД'),root.firstChild);
  }
  function mountSummary() {
    var root=screen('summary');if(!root||root.dataset.cbV2)return;
    root.dataset.cbV2='1';
    root.insertBefore(intro('Итоги и решения','Что получилось сегодня, что мешало и какой следующий шаг зафиксирован.','08 / РЕЗУЛЬТАТ'),root.firstChild);
  }

  function mountFinance() {
    var root=screen('finance');if(!root||root.dataset.cbV2||!$('finTab-summary'))return;
    root.dataset.cbV2='1';
    var header=intro('Финансовый контроль','Начисления — сколько должны. Поступления — сколько действительно оплатили. Эти показатели нельзя смешивать.','09 / ДЕНЬГИ');
    root.insertBefore(header,root.firstChild);
    var tabs=$('finTab-summary')?.parentElement;
    if(tabs)tabs.classList.add('cb-finance-tabs');
    var controls=Array.from(root.children).find(function(x){return x.matches('section.card.pad')&&x.querySelector('#finMonth')});
    if(controls)controls.classList.add('cb-finance-controls');
    var rank=$('finPanel-summary-ranking'),summary=$('finPanel-summary');
    if(rank&&summary)summary.appendChild(rank);
    var receipts=$('finPanel-payments');
    if(receipts)receipts.classList.add('cb-receipts-view');
    var charges=$('finPanel-charges');
    if(charges)charges.classList.add('cb-charges-view');
    var matrix=root.querySelector('.fin-matrix-card');
    if(matrix)matrix.classList.add('cb-matrix-workspace');
  }

  function mountSalary() {
    var root=screen('salary');if(!root||root.dataset.cbV2||!$('salaryTabs'))return;
    root.dataset.cbV2='1';
    root.insertBefore(intro('Зарплата и клиенты','Прозрачный расчёт мотивации: договорные циклы, платежи, удержания и контроль истории изменений.','10 / МОТИВАЦИЯ'),root.firstChild);
    var tabs=$('salaryTabs');
    tabs.classList.add('cb-salary-tabs');
    var ribbon=E('div','cb-salary-ribbon');
    ribbon.append(E('span','','Контракторство — по подписанию'));
    ribbon.append(E('span','','Комиссии — по правилам выплат'));
    ribbon.append(E('span','','Удержание — отдельный шестимесячный период'));
    tabs.insertAdjacentElement('afterend',ribbon);
  }

  function awaitDynamicModules() {
    var finance=screen('finance'),salary=screen('salary');
    if(finance){
      var finObserver=new MutationObserver(function(){
        if ($('finTab-summary')) {mountFinance();finObserver.disconnect();}
      });
      finObserver.observe(finance,{childList:true});
      mountFinance();
    }
    if(salary) {
      var salaryObserver=new MutationObserver(function(){
        if ($('salaryTabs')) {mountSalary();salaryObserver.disconnect();}
      });
      salaryObserver.observe(salary,{childList:true});
      mountSalary();
    }
  }

  function init() {
    if(busy || !$('v13TodayKpis') || !screen('today'))return;
    busy=true;
    document.documentElement.classList.add(ROOT);
    pageLinkHandlers();
    mountToday();mountMonth();mountFunnel();mountContracts();mountTeam();
    mountAnalytics();mountReport();mountSummary();
    awaitDynamicModules();
    // Focus selected section if navigation jumps by buttons or existing workflows.
    var root=$('mainApp');
    if(root) root.setAttribute('data-cb-product-version','2');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
