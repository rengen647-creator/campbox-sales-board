'use strict';
/** Explicit handoff payload: never invent commitments or turn unverified meeting notes into facts. */
const REQUIRED = ['organizationId','campId','contractId','salesOwnerId','decisionMaker','implementationOwner','nextAction'];
function asNonEmpty(value){ return typeof value==='string' && value.trim().length>0; }
function buildHandoff(source) {
 if (!source || typeof source!=='object') throw new TypeError('handoff source required');
 const missing=REQUIRED.filter(k=>!asNonEmpty(source[k]));
 const training=source.training||{};
 const trainingStatus = !training.date ? 'unscheduled' : !training.confirmedByCustomer ? 'awaiting_confirmation' : !Array.isArray(training.attendees)||training.attendees.length===0 ? 'attendees_missing' : 'confirmed';
 return Object.freeze({
  sourceContractId:asNonEmpty(source.contractId)?source.contractId:null,
  organizationId:asNonEmpty(source.organizationId)?source.organizationId:null,
  campId:asNonEmpty(source.campId)?source.campId:null,
  salesOwnerId:asNonEmpty(source.salesOwnerId)?source.salesOwnerId:null,
  decisionMaker:asNonEmpty(source.decisionMaker)?source.decisionMaker:null,
  implementationOwner:asNonEmpty(source.implementationOwner)?source.implementationOwner:null,
  nextAction:asNonEmpty(source.nextAction)?source.nextAction:null,
  training:{date:training.date||null,confirmedByCustomer:training.confirmedByCustomer===true,attendees:Array.isArray(training.attendees)?training.attendees:[],status:trainingStatus},
  agreedScope:Array.isArray(source.agreedScope)?source.agreedScope:[],
  openQuestions:Array.isArray(source.openQuestions)?source.openQuestions:[],
  customerCommitments:Array.isArray(source.customerCommitments)?source.customerCommitments:[],
  sourceEvidence:Array.isArray(source.sourceEvidence)?source.sourceEvidence:[],
  missingFields:missing,readyForAcceptance:missing.length===0 && trainingStatus==='confirmed'
 });
}
module.exports={buildHandoff,REQUIRED};
