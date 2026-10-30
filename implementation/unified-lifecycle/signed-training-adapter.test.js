'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const adapter=require('./signed-training-adapter');
const source={__type:'daily_reflection',contracts:[
{id:'contract-a',status:'signed',client:'Camp A',contract_number:'N1',training_date:'2026-11-07',training_attendee:'Manager',training_customer_confirmed:true},
{id:'contract-b',status:'signed',client:'Camp B',contract_number:'N1'},
{id:'contract-c',status:'signing',client:'Camp C'}]};
test('only signed contracts extracted',()=>{assert.equal(adapter.extractSignedTraining(source).length,2)});
test('duplicate document number can represent distinct camps',()=>{const data=adapter.extractSignedTraining(source);assert.notEqual(data[0].contractKey,data[1].contractKey)});
test('missing training remains unconfirmed',()=>{assert.equal(adapter.extractSignedTraining(source)[1].readiness,'training_unscheduled')});
test('valid training remains confirmed',()=>{assert.equal(adapter.extractSignedTraining(source)[0].readiness,'confirmed')});
test('matches existing handoff source key',()=>{const data=adapter.reconcileHandoff(adapter.extractSignedTraining(source),[{contract_key:'contract-a',state:'linked',assigned:true}]);assert.equal(data[0].assigned,true);assert.equal(data[1].assigned,false)});
test('invalid comment is safely ignored',()=>{assert.deepEqual(adapter.extractSignedTraining('invalid'),[])});
