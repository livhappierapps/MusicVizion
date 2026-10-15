import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpendingConsent } from './spending-consent.ts';

const request = { userMessage: 'Compare this moment', preferences: ['I like contrast'] };
const offer = { model: 'test-only-fixture', maximumUsd: 0.01 };
test('owner authorization and known valid price are both mandatory', () => {
  assert.equal(new SpendingConsent().issue(request, offer), null);
  const ledger = new SpendingConsent(true);
  assert.equal(ledger.issue(request, null), null);
  assert.equal(ledger.issue(request, {...offer,maximumUsd:NaN}), null);
  assert.equal(ledger.issue(request, {...offer,maximumUsd:-1}), null);
  assert.equal(ledger.issue(request, {...offer,maximumUsd:0}), null);
});
test('one approved, payload-bound consumption; all replays are refused', () => {
  const ledger = new SpendingConsent(true);
  const ticket = ledger.issue(request, offer)!;
  assert.equal(ledger.consume(ticket.token, request, offer.maximumUsd, true), true);
  assert.equal(ledger.consume(ticket.token, request, offer.maximumUsd, true), false);
});
test('changing input, maximum, or declining invalidates the token', () => {
  const ledger = new SpendingConsent(true);
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
  let now = 0; const ledger = new SpendingConsent(true,()=>now);
  const ticket = ledger.issue(request,offer)!;
  now = 120001;
  assert.equal(ledger.consume(ticket.token,request,0.01,true),false);
  assert.equal(new SpendingConsent(true).consume(ticket.token,request,0.01,true),false);
});
