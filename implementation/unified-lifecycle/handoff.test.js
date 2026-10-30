'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildHandoff}=require('./handoff');
const base={organizationId:'org',campId:'camp',contractId:'contract',salesOwnerId:'sales',decisionMaker:'Director',implementationOwner:'Admin',nextAction:'Training'};
test('incomplete handoff does not become accepted',()=>{let h=buildHandoff({contractId:'contract'});assert.equal(h.readyForAcceptance,false);assert.ok(h.missingFields.includes('campId'));});
test('unconfirmed training stays unconfirmed',()=>{let h=buildHandoff({...base,training:{date:'2026-11-07',attendees:['Admin']}});assert.equal(h.training.status,'awaiting_confirmation');});
test('ready requires explicit customer confirmation and participants',()=>{let h=buildHandoff({...base,training:{date:'2026-11-07',confirmedByCustomer:true,attendees:['Admin']}});assert.equal(h.readyForAcceptance,true);});
test('open questions stay distinct from commitments',()=>{let h=buildHandoff({...base,openQuestions:['Navigator integration?'],customerCommitments:[]});assert.equal(h.customerCommitments.length,0);assert.equal(h.openQuestions.length,1);});
