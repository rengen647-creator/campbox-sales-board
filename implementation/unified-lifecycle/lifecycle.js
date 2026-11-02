'use strict';
/** Pure lifecycle invariants. No database writes or side-effects. */
function assertId(v, field) {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)) throw new TypeError(field + ' must be a stable UUID');
  return v.toLowerCase();
}
function signingKey({dealId, campId}) { return `signed:${assertId(dealId,'dealId')}:${assertId(campId,'campId')}`; }
function classifyCamp({contractSigned, launchConfirmed, realBookings, confirmedRevenue, minimumOnly}) {
 if (!contractSigned) return 'not_contracted';
 if (!launchConfirmed) return 'signed_not_launched';
 if (Number(realBookings || 0) <= 0) return 'launched_no_bookings';
 if (Number(confirmedRevenue || 0) <= 0) return minimumOnly ? 'minimum_only' : 'bookings_no_confirmed_revenue';
 return 'revenue_active';
}
function onboardingState({trainingDate, trainingConfirmedByCustomer, attendees}) {
 if (!trainingDate) return 'training_unscheduled';
 if (!trainingConfirmedByCustomer) return 'awaiting_customer_confirmation';
 if (!Array.isArray(attendees) || attendees.length === 0) return 'attendees_missing';
 return 'training_confirmed';
}
function daysBetween(firstISO, secondISO) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(firstISO) || !/^\d{4}-\d{2}-\d{2}$/.test(secondISO)) return null;
 const a = Date.parse(firstISO + 'T00:00:00Z'), b = Date.parse(secondISO + 'T00:00:00Z');
 if (!Number.isFinite(a)||!Number.isFinite(b)||b<a) return null;
 return Math.round((b-a)/86400000);
}
module.exports = {signingKey,classifyCamp,onboardingState,daysBetween};