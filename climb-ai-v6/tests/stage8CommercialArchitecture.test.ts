import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Stage 8 has one canonical Free Plus Pro product story',()=>{
  const subscription=fs.readFileSync('lib/subscription.ts','utf8');
  const pricing=fs.readFileSync('app/pricing/page.tsx','utf8');
  assert.match(subscription,/DNA PLAYER PLAN · YOUR NEXT CLIMB/);
  assert.match(subscription,/TRANSFER TEST BEFORE A SKILL IS RETIRED/);
  assert.match(pricing,/ALWAYS KNOW WHAT TO LEARN NEXT/);
});

test('Stripe billing is webhook-driven and keeps card handling off OP CLIMB',()=>{
  const webhook=fs.readFileSync('app/api/billing/webhook/route.ts','utf8');
  const checkout=fs.readFileSync('app/api/billing/checkout/route.ts','utf8');
  assert.match(webhook,/verifyStripeWebhook/);
  assert.match(webhook,/product_entitlements/);
  assert.match(checkout,/createLeagueCheckout/);
  assert.doesNotMatch(checkout,/card_number|payment_method_data\[card\]/);
});

test('Decision Twin moat requires PRO on the server',()=>{
  const route=fs.readFileSync('app/api/decision-twin/route.ts','utf8');
  assert.match(route,/requireLeagueTier/);
  assert.match(route,/'PRO'/);
  assert.match(route,/upgradeRequired:true/);
});

test('Paid users manage plan changes through Stripe portal',()=>{
  const checkout=fs.readFileSync('app/api/billing/checkout/route.ts','utf8');
  const portal=fs.readFileSync('app/api/billing/portal/route.ts','utf8');
  assert.match(checkout,/createBillingPortal/);
  assert.match(portal,/createBillingPortal/);
});


test('PLUS gets the managed DNA curriculum while the persistent player model remains PRO',()=>{
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  assert.match(draft,/const playerPlan=hasTier\(subscriptionTier,'PLUS'\)/);
  assert.match(draft,/const proModel=hasTier\(subscriptionTier,'PRO'\)/);
  assert.match(draft,/proModel\?coachingContext\.decisionTwin:undefined/);
  assert.match(draft,/coachTwin:proModel\?coachingContext\.coachTwin:null/);
  assert.match(draft,/const climbMission=playerPlan\?buildClimbMatchMission/);
  assert.match(draft,/const decisionTransferPrime=playerPlan\?selectDecisionTransferPrime/);
  assert.match(draft,/autonomousCurriculum:playerPlan\?/);
});
