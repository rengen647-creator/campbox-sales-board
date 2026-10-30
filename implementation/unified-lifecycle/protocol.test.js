'use strict';
/** Synthetic end-to-end protocol checks. No Supabase network requests and no customer data. */
const test=require('node:test'),assert=require('node:assert/strict');
const {extractSignedTraining}=require('./signed-training-adapter');
const {transferEvent}=require('./transfer-contract');
const {buildHandoff}=require('./handoff');
const salesUserId='11111111-1111-4111-8111-111111111111';
const campId='22222222-2222-4222-8222-222222222222';
const source={__type:'daily_reflection',contracts:[{id:'contract-1',status:'signed',client:'Test camp',contract_number:'2026-42',signed_date:'2026-10-30',training_date:'2026-11-05',training_attendee:'Camp admin',training_customer_confirmed:true}]};
test('signed training produces a revisioned transport event',()=>{
 const rows=extractSignedTraining(source);assert.equal(rows.length,1);
 const event=transferEvent({...rows[0],salesUserId,campId,contractKey:rows[0].contractKey,revision:1});
 assert.equal(event.confirmedByCustomer,true);
 assert.equal(event.trainingDate,'2026-11-05');
 assert.ok(event.eventKey.includes('contract-1'));
});
test('unconfirmed source may not assert accepted training',()=>{
 const row=extractSignedTraining({...source,contracts:[{...source.contracts[0],training_customer_confirmed:false}]})[0];
 const event=transferEvent({...row,salesUserId,campId,contractKey:row.contractKey,revision:1});
 assert.equal(event.confirmedByCustomer,false);
 assert.equal(event.requiresReview,true);
});
test('handoff acceptance requires explicit context',()=>{
 const h=buildHandoff({organizationId:'org',campId,contractId:'contract-1',salesOwnerId:salesUserId,decisionMaker:'Director',implementationOwner:'Admin',nextAction:'Training',training:{date:'2026-11-05',attendees:['Admin'],confirmedByCustomer:true}});
 assert.equal(h.readyForAcceptance,true);
});
