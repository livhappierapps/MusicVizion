import { Router, type IRouter } from 'express';
import { CreateCompanionReplyBody, QuoteCompanionRequestBody, QuoteCompanionRequestResponse } from '@workspace/api-zod';
import { SpendingConsent } from '../lib/spending-consent';
import { MUSICVIZION_SPENDING_POLICY, MUSICVIZION_SPENDING_REASON } from '../lib/musicvizion-spending-policy';

const router: IRouter = Router();
// The payer authorized $0. Keep this separate from credential availability.
// Deliberately do NOT import an AI client: no request to these routes can invoke a paid provider.
const consent = new SpendingConsent(false, () => Date.now(), {
  totalBudgetUsd: MUSICVIZION_SPENDING_POLICY.totalBudgetUsd,
  perRequestMaximumUsd: MUSICVIZION_SPENDING_POLICY.perRequestMaximumUsd,
});

router.post('/musicvizion/quote', (req, res): void => {
  const parsed = QuoteCompanionRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid or oversized listening context.' }); return; }
  // Zero-budget policy and unknown reliable maximum mean no token can be issued.
  const ticket = consent.issue(parsed.data, null);
  res.json(QuoteCompanionRequestResponse.parse({
    provider: 'xAI / Grok',
    available: false,
    estimatedMaximumUsd: null,
    approvalToken: ticket?.token ?? null,
    expiresAt: ticket?.expiresAt ?? null,
    reason: MUSICVIZION_SPENDING_REASON,
    spendingStatus: MUSICVIZION_SPENDING_POLICY.status,
    authorizedTotalBudgetUsd: MUSICVIZION_SPENDING_POLICY.totalBudgetUsd,
    authorizedPerRequestMaximumUsd: MUSICVIZION_SPENDING_POLICY.perRequestMaximumUsd,
    liveTestBudgetUsd: MUSICVIZION_SPENDING_POLICY.liveTestBudgetUsd,
    requestContent: MUSICVIZION_SPENDING_POLICY.requestContent,
    audioListeningAvailable: MUSICVIZION_SPENDING_POLICY.audioListeningAvailable,
  }));
});

router.post('/musicvizion/companion', (req, res): void => {
  const parsed = CreateCompanionReplyBody.safeParse(req.body);
  if (!parsed.success) { res.status(403).json({error:'A fresh, request-specific spending approval is required. Paid AI is disabled.'}); return; }
  const { request, approvalToken, approvedMaximumUsd, approved } = parsed.data;
  consent.consume(approvalToken, request, approvedMaximumUsd, approved);
  // Fail closed even with fabricated or formerly valid approval data. Paid transport is disconnected.
  res.status(403).json({error: MUSICVIZION_SPENDING_REASON});
});
export default router;
