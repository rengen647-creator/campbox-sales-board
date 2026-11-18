// Tests the actual salary-v1.js website commission function (not a duplicate implementation).
// Run: node tests/site-motivation.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'salary-v1.js'), 'utf8');
const begin = source.indexOf('  function paymentAccrual(');
const end = source.indexOf('\n  function salaryFor(', begin);
assert.ok(begin >= 0 && end > begin, 'Production paymentAccrual function must exist');
const paymentAccrual = new Function(
  "const PRODUCTS={site:{short:'Сайт'},site_support:{short:'Сопровождение'}};" +
  "function contractClient(c){return c&&c.client;}" +
  "function product(){return {};}" +
  "function contractValidOn(){return true;}" +
  "function round2(x){return Math.round((Number(x||0)+Number.EPSILON)*100)/100;}" +
  "function money(x){return Number(x||0).toFixed(2)+' ₽';}" +
  source.slice(begin, end) + '\nreturn paymentAccrual;'
)();
const contract = {id:'contract1',contractor_id:'manager1',signed_date:'2026-11-01',client:{client_name:'Детский лагерь'}};
const base = {id:'payment1',payment_date:'2026-11-18',contract_id:'contract1',product_type:'site',event_type:'payment',amount:100000,status:'confirmed'};
let passed = 0;
function check(label, actual, expected) {assert.equal(actual, expected, label); passed++;}
check('11% first site invoice',paymentAccrual({...base,payment_number:1},contract,'manager1').amount,11000);
check('Legacy first invoice with null number retains 11%',paymentAccrual({...base,payment_number:null},contract,'manager1').amount,11000);
check('8.05% later site invoice',paymentAccrual({...base,payment_number:2},contract,'manager1').amount,8050);
check('4025 RUB independent website launch bonus',paymentAccrual({...base,event_type:'site_live',amount:0,payment_number:null},contract,'manager1').amount,4025);
check('Website launch ignores payment amount',paymentAccrual({...base,event_type:'site_live',amount:100000},contract,'manager1').amount,4025);
check('Excluded event does not pay',paymentAccrual({...base,status:'excluded'},contract,'manager1'),null);
check('Other sales manager does not receive bonus',paymentAccrual(base,contract,'manager2'),null);
check('Missing client does not receive bonus',paymentAccrual(base,{...contract,client:null},'manager1'),null);
check('Unrecognized site event does not pay',paymentAccrual({...base,event_type:'anything_else'},contract,'manager1'),null);
check('First invoice listed in motivation rules',source.includes("rule('Оплата первого счёта за сайт'"),true);
check('Live launch listed separately in motivation rules',source.includes("rule('Запуск сайта в живой режим'"),true);
check('Cross-month duplicate prevention exists',source.includes("Проверяем события сайта по всей истории") || source.includes("События сайта проверяем по всей истории"),true);
console.log('PASS '+passed+' website motivation checks');
