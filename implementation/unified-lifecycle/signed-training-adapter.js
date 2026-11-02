'use strict';
/**
 * Safe adapter from the existing daily_sales.comment signed contract representation.
 * This module does not modify data and must not make a second signing record.
 */
function extractSignedTraining(comment) {
 let parsed;
 try { parsed=typeof comment==='string'?JSON.parse(comment):comment; } catch { return []; }
 if (!parsed || parsed.__type!=='daily_reflection' || !Array.isArray(parsed.contracts)) return [];
 return parsed.contracts.filter(c=>c && c.status==='signed' && typeof c.id==='string').map(c=>({
  contractKey:c.id,
  contractNumber:String(c.contract_number||''),
  campLabel:String(c.client||''),
  signedDate:c.signed_date||null,
  trainingDate:c.training_date||null,
  trainingAttendee:String(c.training_attendee||''),
  confirmedByCustomer:c.training_customer_confirmed===true,
  readiness:!c.training_date?'training_unscheduled':!c.training_attendee?'attendee_missing':c.training_customer_confirmed===true?'confirmed':'awaiting_customer_confirmation'
 }));
}
function reconcileHandoff(signings,handoffStatuses) {
 const byKey=new Map((handoffStatuses||[]).map(x=>[x.contract_key,x]));
 return signings.map(s=>({...s,handoffState:byKey.get(s.contractKey)?.state||'not_linked',assigned:byKey.get(s.contractKey)?.assigned===true}));
}
module.exports={extractSignedTraining,reconcileHandoff};
