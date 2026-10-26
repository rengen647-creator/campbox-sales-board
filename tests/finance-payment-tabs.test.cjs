// Run: node tests/finance-payment-tabs.test.cjs
// Product/category checks use the functions from the live source, not a copy.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','finance-ledger.js'),'utf8');
function extract(prefix){
  const line=source.split('\n').find(s=>s.startsWith(prefix));
  assert.ok(line, 'Missing source line '+prefix);
  return line;
}
const code=[
  extract('var paymentTabs='),
  extract('function paymentGroup('),
  extract('function paymentMatches('),
  extract('function receiptCount(')
].join('\n');
const api=new Function(code+';return {paymentTabs,paymentGroup,paymentMatches,receiptCount};')();
const types=['campbox','order_management','comfort_booking','site','site_support','maps'];
const configured=api.paymentTabs.filter(t=>t.id!=='all').map(t=>t.id);
assert.deepEqual(configured,types,'Every supported product has its own tab');
for(const type of types){
  const payment={product_type:type};
  assert.equal(api.paymentMatches(payment,type),true,type+' should match its own tab');
  assert.equal(api.paymentMatches(payment,'all'),true,type+' should match All');
  for(const other of types.filter(x=>x!==type))assert.equal(api.paymentMatches(payment,other),false,type+' must not match '+other);
}
const payments=[
 {product_type:'campbox',amount:20000},{product_type:'order_management',amount:1200},
 {product_type:'site',amount:2000},{product_type:'site_support',amount:3500},
 {product_type:'maps',amount:6000}
];
const sum=tab=>payments.filter(p=>api.paymentMatches(p,tab)).reduce((n,p)=>n+p.amount,0);
assert.equal(sum('all'),32700);
assert.equal(sum('site'),2000);
assert.equal(sum('site_support'),3500);
assert.equal(sum('maps'),6000);
assert.equal(api.receiptCount(0),'0 поступлений');
assert.equal(api.receiptCount(1),'1 поступление');
assert.equal(api.receiptCount(2),'2 поступления');
assert.equal(api.receiptCount(5),'5 поступлений');
assert.equal(api.receiptCount(11),'11 поступлений');
assert.equal(api.receiptCount(21),'21 поступление');
console.log('PASS finance product tabs / grouping / totals / pluralization');
