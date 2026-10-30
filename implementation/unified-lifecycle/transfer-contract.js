'use strict';
/** Transport-neutral, write-free transfer contract. Requires a trusted authenticated server to persist. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function transferEvent({salesUserId,contractKey,campId,trainingDate,trainingAttendee,confirmedByCustomer,revision}) {
 if(!UUID.test(salesUserId)||!UUID.test(campId))throw new TypeError('Verified sales user and camp UUID required');
 if(typeof contractKey!=='string'||!contractKey.trim())throw new TypeError('Source contract key required');
 if(!Number.isSafeInteger(revision)||revision<1)throw new TypeError('Positive source revision required');
 const hasDate=typeof trainingDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(trainingDate);
 const attendee=typeof trainingAttendee==='string'?trainingAttendee.trim():'';
 const confirmed=confirmedByCustomer===true && hasDate && attendee.length>0;
 return Object.freeze({
  source:'sales_daily_reflection',salesUserId,contractKey:contractKey.trim(),campId,
  eventKey:[salesUserId,contractKey.trim(),String(revision)].join(':'),
  revision,trainingDate:hasDate?trainingDate:null,trainingAttendee:attendee,
  confirmedByCustomer:confirmed,requiresReview:!confirmed
 });
}
function canApplyEvent(incoming,stored){
 if(!incoming||!Number.isSafeInteger(incoming.revision))return false;
 if(!stored)return true;
 if(stored.salesUserId!==incoming.salesUserId||stored.contractKey!==incoming.contractKey)return false;
 return incoming.revision>stored.revision;
}
module.exports={transferEvent,canApplyEvent};
