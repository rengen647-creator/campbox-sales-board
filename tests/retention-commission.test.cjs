// Run: node tests/retention-commission.test.cjs
// Checks functions extracted from the ACTUAL salary-v1.js source,
// without duplicating its date / salary math in this test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname,'..','salary-v1.js'),'utf8');
function functionSource(name){
  const start = src.indexOf('  function '+name+'(');
  assert.ok(start>=0,'Missing production function '+name);
  const end = src.indexOf('\n  function ',start+11);
  assert.ok(end>start,'Cannot extract production function '+name);
  return src.slice(start,end);
}
const functions = [
  'dateObj','addDaysIso','addMonthsIso','addMonthsClampedIso',
  'retentionAt','retentionEnd','diffDaysInclusive','maxDate',
  'contractPauses','pauseEnd','pausedOn','commissionEnd','commissionState'
].map(functionSource).join('\n');
const prepare = new Function('retentions','pauses',
  'const S={retentions,pauses};\n'+functions+
  '\nreturn {commissionState,retentionAt,retentionEnd,addMonthsClampedIso,commissionEnd};');
const contract = {id:'camp1',contractor_id:'manager1',signed_date:'2024-01-01'};
const prod = {first_payment_date:'2024-01-01'};
const saved = {contract_id:'camp1',retained_by:'manager1',status:'successful',resolved_at:'2026-10-26'};
const h = prepare([saved],[]);
let passed = 0;
function check(label,actual,expected){assert.equal(actual,expected,label);passed++}
check('Before successful retention, after 12 months',h.commissionState(prod,contract,'2026-10-25'),'expired');
check('First day included',h.commissionState(prod,contract,'2026-10-26'),'retained');
check('Last day included',h.commissionState(prod,contract,'2027-04-25'),'retained');
check('Six-month deadline excluded',h.commissionState(prod,contract,'2027-04-26'),'expired');
check('Clamps Feb 31 to Feb 28',h.addMonthsClampedIso('2026-08-31',6),'2027-02-28');
check('Standard 12-month payout continues',h.commissionState({first_payment_date:'2026-01-01'},contract,'2026-11-01'),'active');
check('Other manager not eligible',h.commissionState(prod,{...contract,contractor_id:'manager2'},'2026-11-01'),'expired');
check('Unsuccessful case not eligible',prepare([{...saved,status:'unsuccessful'}],[]).commissionState(prod,contract,'2026-11-01'),'expired');
check('Successful retention overlaps original period but creates no second state',
  prepare([{...saved,resolved_at:'2024-10-01'}],[]).commissionState(prod,contract,'2024-11-01'),'active');
check('Successful retention continues after the original period',
  prepare([{...saved,resolved_at:'2024-10-01'}],[]).commissionState(prod,contract,'2025-02-01'),'retained');
check('Pause suppresses commission window',
  prepare([saved],[{contract_id:'camp1',pause_start:'2026-11-01',pause_until:'2026-11-30',resumed_at:null}])
    .commissionState(prod,contract,'2026-11-12'),'paused');
check('Termination suppresses commission window',
  h.commissionState(prod,{...contract,terminated_date:'2026-11-10'},'2026-11-11'),'terminated');
check('Head 1% permitted after retention expires',
  h.commissionState(prod,contract,'2027-04-26')==='expired',true);
check('Head 1% excluded while manager retains 10%',
  h.commissionState(prod,contract,'2026-11-01')==='expired',false);
check('Base term unchanged',h.commissionEnd('2024-01-01','camp1'),'2025-01-01');
console.log('PASS '+passed+' retention commission checks');
