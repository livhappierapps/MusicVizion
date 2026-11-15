// Owner-authorized limits for the current deployment. Zero explicitly means off.
// Never derive or widen these values from browser input, provider metadata, or a quote.
export const MUSICVIZION_SPENDING_POLICY = Object.freeze({
  totalBudgetUsd: 0,
  perRequestMaximumUsd: 0,
  liveTestBudgetUsd: 0,
  status: 'disabled_zero_budget' as const,
  requestContent: 'text_features_only' as const,
  audioListeningAvailable: false as const,
});

export const MUSICVIZION_SPENDING_REASON =
  'Paid Grok is disabled: the owner-authorized total and per-request budgets are both $0. Live tests are not authorized. This review shares text and computed listening features only, not audio; Grok has not listened to the track.';
