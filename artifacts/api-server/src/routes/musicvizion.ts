import { Router, type IRouter } from 'express';
import { CreateCompanionReplyBody, QuoteCompanionRequestBody, QuoteCompanionRequestResponse } from '@workspace/api-zod';
import { SpendingConsent } from '../lib/spending-consent';

const router: IRouter = Router();
// Plan approval is not spending approval. No owner-approved budget or verified maximum exists.
// Deliberately do NOT import an AI client: no request to these routes can invoke a paid provider.
const consent = new SpendingConsent(false);
const reason = 'Paid Grok is off. A reliable maximum price and separate owner spending authorization have not been established. No audio, message, or notes were sent to xAI. Local listening tools remain available.';

router.post('/musicvizion/quote', (req, res): void => {
  const parsed = QuoteCompanionRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid or oversized listening context.' }); return; }
  // A null trusted price can never issue an approval token. No external catalog or inference call.
  const ticket = consent.issue(parsed.data, null);
  res.json(QuoteCompanionRequestResponse.parse({provider:'xAI / Grok',available:false,estimatedMaximumUsd:null,approvalToken:ticket?.token ?? null,expiresAt:ticket?.expiresAt ?? null,reason}));
});

router.post('/musicvizion/companion', (req, res): void => {
  const parsed = CreateCompanionReplyBody.safeParse(req.body);
  if (!parsed.success) { res.status(403).json({error:'A fresh, request-specific spending approval is required. Paid AI is disabled.'}); return; }
  const { request, approvalToken, approvedMaximumUsd, approved } = parsed.data;
  consent.consume(approvalToken, request, approvedMaximumUsd, approved);
  // Fail closed even with fabricated or formerly valid approval data. Paid transport is disconnected.
  res.status(403).json({error:reason});
});
export default router;
