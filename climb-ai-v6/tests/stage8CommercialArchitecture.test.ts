import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Stage 8 has one canonical Free Plus Pro product story',()=>{
  const subscription=fs.readFileSync('lib/subscription.ts','utf8');
  const pricing=fs.readFileSync('app/pricing/page.tsx','utf8');
  assert.match(subscription,/AUTONOMOUS CURRICULUM/);
  assert.match(subscription,/DECISION TWIN/);
  assert.match(pricing,/MODEL HOW YOU LEARN/);
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


test('PLUS draft intelligence does not consume or expose the PRO player model',()=>{
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  assert.match(draft,/const proModel=hasTier\(subscriptionTier,'PRO'\)/);
  assert.match(draft,/proModel\?context\.decisionTwin:undefined/);
  assert.match(draft,/coachTwin:proModel\?context\.coachTwin:null/);
  assert.match(draft,/autonomousCurriculum:proModel\?/);
});
