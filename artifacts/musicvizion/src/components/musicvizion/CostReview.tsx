import { useEffect, useRef } from 'react';
import { useQuoteCompanionRequest } from '@workspace/api-client-react';
import type { CompanionInput } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export interface CostReviewProps {
  input: CompanionInput | null;
  onClose: () => void;
}

function fmt(v: number | null | undefined): string {
  return v == null ? 'Not measured' : String(v);
}

export function CostReview({ input, onClose }: CostReviewProps) {
  const quote = useQuoteCompanionRequest({ mutation: { retry: false } });
  const mutateRef = useRef(quote.mutate);
  mutateRef.current = quote.mutate;
  const resetRef = useRef(quote.reset);
  resetRef.current = quote.reset;
  const quotedFor = useRef<CompanionInput | null>(null);

  useEffect(() => {
    if (!input) {
      quotedFor.current = null;
      resetRef.current();
      return;
    }
    if (quotedFor.current === input) return;
    quotedFor.current = input;
    mutateRef.current({ data: input });
  }, [input]);

  const q = quote.data;

  return (
    <Dialog open={input !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="mvc-dialog" data-testid="dialog-cost-review">
        <DialogTitle>Review before anything is shared</DialogTitle>
        <DialogDescription>
          This is a local review only. Nothing has been sent to a paid service.
        </DialogDescription>

        {quote.isPending && <div className="mvc-skel" data-testid="status-quote-loading" aria-label="Checking quote" />}

        {quote.isError && (
          <div className="mvc-status err" role="alert" data-testid="status-quote-error">
            The local server could not review this request. No paid call was made. Close this and try again later.
          </div>
        )}

        {q && (
          <div className="mvc-status" role="status" data-testid="status-quote-result">
            <strong>Blocked: {q.available ? 'maximum price unknown' : 'unavailable'}.</strong>{' '}
            {q.estimatedMaximumUsd == null
              ? 'The maximum price is unknown, and the owner has not authorized any spending, so this request cannot be approved.'
              : `Estimated maximum: $${q.estimatedMaximumUsd.toFixed(2)}, but the owner has not authorized spending.`}
            {q.reason ? <div data-testid="text-quote-reason" style={{ marginTop: 6 }}>Server note: {q.reason}</div> : null}
          </div>
        )}

        {input && (
          <dl className="mvc-data" data-testid="list-shared-data">
            <div><dt>TRACK</dt><dd data-testid="text-share-title">{input.title}</dd></div>
            <div><dt>ARTIST</dt><dd data-testid="text-share-artist">{input.artist}</dd></div>
            <div><dt>PLAYHEAD</dt><dd data-testid="text-share-position">{input.positionSeconds} seconds</dd></div>
            <div><dt>ANALYSIS</dt><dd data-testid="text-share-analysis">
              Approximate BPM {fmt(input.analysis.bpm)} · Energy {fmt(input.analysis.energy)} · Brightness {fmt(input.analysis.brightness)} · Dynamics {fmt(input.analysis.pulse)}{'\n'}Source: {input.analysis.source}
            </dd></div>
            <div><dt>YOUR MESSAGE</dt><dd data-testid="text-share-message">{input.userMessage}</dd></div>
            <div><dt>LISTENING NOTES ({input.preferences.length})</dt><dd data-testid="text-share-notes">
              {input.preferences.length ? input.preferences.map(p => `• ${p}`).join('\n') : 'None'}
            </dd></div>
          </dl>
        )}

        <p className="mvc-notice" data-testid="text-zero-paid-notice">ZERO PAID CALLS: this review never contacts a paid provider.</p>

        <div className="mvc-actions">
          <button type="button" className="mvp-btn" onClick={onClose} data-testid="button-cancel-review">Cancel</button>
          <button type="button" className="mvp-btn primary" onClick={onClose} data-testid="button-close-review">Close</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CostReview;
