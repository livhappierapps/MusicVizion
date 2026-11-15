import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpendingConsent } from './spending-consent.ts';

const request = { userMessage: 'Compare this moment', preferences: ['I like contrast'] };
const offer = { model: 'test-only-fixture', maximumUsd: 0.01 };
const testBudget = { totalBudgetUsd: 0.02, perRequestMaximumUsd: 0.01 };
test('owner authorization and known valid price are both mandatory', () => {
  assert.equal(new SpendingConsent().issue(request, offer), null);
  const ledger = new SpendingConsent(true, undefined, testBudget);
  assert.equal(ledger.issue(request, null), null);
  assert.equal(ledger.issue(request, {...offer,maximumUsd:NaN}), null);
  assert.equal(ledger.issue(request, {...offer,maximumUsd:-1}), null);
  assert.equal(ledger.issue(request, {...offer,maximumUsd:0}), null);
  assert.equal(ledger.issue(request, {...offer,maximumUsd:0.010001}), null);
});
test('one approved, payload-bound consumption; all replays are refused', () => {
  const ledger = new SpendingConsent(true, undefined, testBudget);
  const ticket = ledger.issue(request, offer)!;
  assert.equal(ledger.consume(ticket.token, request, offer.maximumUsd, true), true);
  assert.equal(ledger.consume(ticket.token, request, offer.maximumUsd, true), false);
});
test('changing input, maximum, or declining invalidates the token', () => {
  const ledger = new SpendingConsent(true, undefined, testBudget);
  for (const variant of [
    { input: {...request,userMessage:'A different request'}, max:0.01, yes:true },
    { input:request, max:100, yes:true },
    { input:request, max:0.01, yes:false },
  ]) {
    const ticket = ledger.issue(request,offer)!;
    assert.equal(ledger.consume(ticket.token,variant.input,variant.max,variant.yes),false);
    assert.equal(ledger.consume(ticket.token,request,offer.maximumUsd,true),false);
  }
  assert.equal(ledger.consume('forged',request,0.01,true),false);
});
test('expired approvals and cross-process approvals fail closed', () => {
  let now = 0; const ledger = new SpendingConsent(true,()=>now,testBudget);
  const ticket = ledger.issue(request,offer)!;
  now = 120001;
  assert.equal(ledger.consume(ticket.token,request,0.01,true),false);
  assert.equal(new SpendingConsent(true).consume(ticket.token,request,0.01,true),false);
});
test('zero budgets cannot issue tickets even when owner authorization is true', () => {
  const zeroBudget = new SpendingConsent(true);
  assert.equal(zeroBudget.issue(request, offer), null);
  assert.equal(zeroBudget.consume('forged', request, offer.maximumUsd, true), false);
});
test('budget reservations prevent concurrent approvals from exceeding total limit', () => {
  const ledger = new SpendingConsent(true, undefined, { totalBudgetUsd: 0.015, perRequestMaximumUsd: 0.01 });
  const first = ledger.issue(request, offer)!;
  assert.ok(first);
  assert.equal(ledger.issue({ ...request, userMessage: 'Second' }, offer), null);
  assert.equal(ledger.consume(first.token, request, offer.maximumUsd, true), true);
  assert.equal(ledger.issue({ ...request, userMessage: 'Second' }, offer), null);
});
test('expired reservations are released without exceeding the total limit', () => {
  let now = 0;
  const ledger = new SpendingConsent(true, () => now, { totalBudgetUsd: 0.015, perRequestMaximumUsd: 0.01 });
  assert.ok(ledger.issue(request, offer));
  now = 120_001;
  assert.ok(ledger.issue({ ...request, userMessage: 'After expiry' }, offer));
});
