/* Runs ONLY against disposable localhost Supabase in CI. Never linked production. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {Client}=require('pg'),{createClient}=require('@supabase/supabase-js'),{chromium}=require('playwright');
const api=process.env.API_URL,dburl=process.env.DB_URL,anon=process.env.ANON_KEY,secret=process.env.SERVICE_ROLE_KEY;
for(const u of [api,dburl])assert.ok(u&&['127.0.0.1','localhost'].includes(new URL(u).hostname),'Only loopback test endpoints allowed');
assert.ok(anon&&secret);const root=process.cwd(),out='qa/integration-evidence';fs.mkdirSync(out,{recursive:true});
const checks=[],db=new Client({connectionString:dburl});let browser,server;
async function poll(fn){for(let n=0;n<50;n++){if(await fn())return;await new Promise(r=>setTimeout(r,200));}throw Error('Persistence timeout');}
(async()=>{await db.connect();
 for(const file of ['supabase_setup.sql','finance-ledger.sql','salary_retention_v1_migration.sql'])await db.query(fs.readFileSync(file,'utf8'));
 await db.query(`create schema campbox_internal;
 create table public.csm_camps(id uuid primary key default gen_random_uuid(),name text not null,sales_client_id uuid unique references salary_clients(id),responsible_id uuid references profiles(id),active boolean default true,updated_at timestamptz default now());
 alter table public.csm_camps enable row level security;
 revoke all on public.csm_camps from anon,authenticated;
 create table campbox_internal.csm_sales_sync_conflicts(sales_client_id uuid primary key,client_name text,reason text,detected_at timestamptz);
 revoke all on schema campbox_internal from public,anon,authenticated;`);
 await db.query(fs.readFileSync('tests/integration/csm-function.sql','utf8')+';');
 await db.query(fs.readFileSync('migration_2026-10-14_sales_signed_to_csm.sql','utf8'));
 const admin=createClient(api,secret,{auth:{persistSession:false,autoRefreshToken:false}}),password='Disposable-Local-QA-2026!';const users={};
 for(const role of ['employee','manager']){const email=role+'@example.invalid';const r=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'QA '+role}});if(r.error)throw r.error;users[role]={id:r.data.user.id,email};await db.query('update profiles set active=true,role=$1 where id=$2',[role,r.data.user.id]);}
 const date=new Date().toISOString().slice(0,10),month=date.slice(0,7)+'-01';
 await db.query('insert into month_settings(month,min_plan,target_plan,max_plan) values($1,5,10,15)',[month]);
 // Positive own and foreign records make role visibility assertions meaningful.
 for(const role of ['employee','manager']){const c=await db.query('insert into salary_clients(client_name,contractor_id) values($1,$2) returning id',['QA '+role,users[role].id]);await db.query('insert into salary_contracts(client_id,contractor_id,signed_date) values($1,$2,$3)',[c.rows[0].id,users[role].id,date]);}
 await db.query("notify pgrst, 'reload schema'");
 // Bundle the pinned client; leave production init/login/save functions intact.
 const bundled=await require('esbuild').build({stdin:{contents:"import * as supabase from '@supabase/supabase-js';window.supabase=supabase;",resolveDir:__dirname},bundle:true,write:false,platform:'browser',format:'iife'});
 let html=fs.readFileSync('index.html','utf8').replace(/<script[^>]+src="https:[^"]+"[^>]*><\/script>/g,'').replace(/const SUPABASE_URL\s*=.*?;/,'const SUPABASE_URL='+JSON.stringify(api)+';').replace(/const SUPABASE_ANON_KEY\s*=.*?;/,'const SUPABASE_ANON_KEY='+JSON.stringify(anon)+';').replace('initPWA();','/* isolated test: no service worker */').replace('<head>','<head><script src="/qa-client.js"></script>');
 server=http.createServer((req,res)=>{const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(file==='/'){res.setHeader('content-type','text/html');return res.end(html);}if(file==='/qa-client.js'){res.setHeader('content-type','application/javascript');return res.end(bundled.outputFiles[0].text);}const full=path.resolve(root,'.'+file);if(!full.startsWith(root+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile()){res.statusCode=404;return res.end();}res.setHeader('content-type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'application/octet-stream');res.end(fs.readFileSync(full));});
 await new Promise(r=>server.listen(4179,'127.0.0.1',r));browser=await chromium.launch();
 for(const role of ['employee','manager']){
 const context=await browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push(d.message());d.dismiss();});
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 await page.goto('http://127.0.0.1:4179');await page.fill('#loginEmail',users[role].email);await page.fill('#loginPassword',password);await page.locator('#loginForm button.primary').click();
 await page.waitForFunction(()=>typeof currentProfile!=='undefined'&&currentProfile?.active&&!isLoading);await page.evaluate(()=>window.v13Go('today'));
 const input=page.locator('[data-v13-fact="calls"]');await input.waitFor();const value=role==='employee'?17:23;await input.fill(String(value));await input.press('Tab');
 await poll(async()=>{const r=await db.query('select calls_fact from daily_sales where user_id=$1 and report_date=$2',[users[role].id,date]);return r.rows[0]?.calls_fact===value;});
 await page.reload();await page.waitForFunction(()=>typeof currentProfile!=='undefined'&&currentProfile?.active&&!isLoading);await page.evaluate(()=>window.v13Go('today'));assert.equal(await page.locator('[data-v13-fact="calls"]').inputValue(),String(value));checks.push(role+': real login → autosave → PostgreSQL → reload');
 // The original contract editor and save button execute the actual database trigger.
 await page.evaluate(()=>openContracts(currentUser.id));await page.click('#contractAddBtn');
 await page.locator('#contractList input[oninput*="client"]').fill('Isolated QA '+role);
 await page.locator('#contractList select[onchange*="status"]').selectOption('signed');
 await page.locator('#contractList input[oninput*="contract_number"]').fill('QA-'+role);
 await page.click('#contractSaveBtn');
 await poll(async()=>{const r=await db.query('select state from sales_handoff_statuses where sales_user_id=$1',[users[role].id]);return r.rows.some(x=>x.state==='linked');});
 await page.click('#contractSaveBtn');await page.waitForTimeout(1000);
 const count=await db.query('select count(*)::int as n from csm_camps where name=$1',['Isolated QA '+role]);assert.equal(count.rows[0].n,1);
 const contractCount=await db.query('select count(*)::int as n from salary_contracts');assert.equal(contractCount.rows[0].n,2,'Handoff must not create salary cycles');
 await page.reload();await page.waitForFunction(()=>typeof currentProfile!=='undefined'&&currentProfile?.active&&!isLoading);await page.evaluate(()=>openContracts(currentUser.id));assert.equal(await page.locator('#contractList input[oninput*="client"]').inputValue(),'Isolated QA '+role);
 checks.push(role+': signed contract persisted; repeated handoff creates exactly one CSM record; no salary cycle');
 const visibility=await page.evaluate(async()=>{const r=await sb.from('salary_contracts').select('contractor_id');if(r.error)throw r.error;return r.data;});assert.equal(visibility.length,role==='employee'?1:2);if(role==='employee')assert.equal(visibility[0].contractor_id,users.employee.id);
 if(role==='employee'){
 const denied=await page.evaluate(async({other,date,month})=>{
 const a=await sb.from('daily_sales').upsert({user_id:other,report_date:date,calls_fact:999},{onConflict:'report_date,user_id'});
 const b=await sb.from('month_settings').update({min_plan:999}).eq('month',month).select();
 const c=await sb.from('profiles').update({role:'manager'}).eq('id',currentUser.id).select();
 return {foreignDenied:!!a.error,settings:b.data||[],profile:c.data||[]};},{other:users.manager.id,date,month});assert.ok(denied.foreignDenied);assert.deepEqual(denied.settings,[]);assert.deepEqual(denied.profile,[]);
 assert.equal((await db.query('select min_plan from month_settings where month=$1',[month])).rows[0].min_plan,5);
 assert.equal((await db.query('select role from profiles where id=$1',[users.employee.id])).rows[0].role,'employee');checks.push('employee: foreign save, plan mutation and role escalation denied; database unchanged');
 }
 await page.screenshot({path:out+'/'+role+'-persisted.png',fullPage:true});assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS authenticated persistence:',checks);fs.writeFileSync(out+'/results.json',JSON.stringify({checks,scope:'Local Auth/PostgREST/Postgres; production Sales migrations and CSM function; minimal CSM table fixture; no production writes'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await db.end();});
