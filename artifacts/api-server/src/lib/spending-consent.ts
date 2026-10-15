import { createHash, randomBytes } from 'node:crypto';

export type PriceOffer = { model: string; maximumUsd: number };
type Ticket = { digest: string; maximumUsd: number; expires: number };
export class SpendingConsent {
  private tickets = new Map<string, Ticket>();
  private ownerAuthorized: boolean;
  private now: () => number;
  constructor(ownerAuthorized = false, now = () => Date.now()) {
    this.ownerAuthorized = ownerAuthorized; this.now = now;
  }
  private digest(request: unknown) { return createHash('sha256').update(JSON.stringify(request)).digest('hex'); }
  issue(request: unknown, offer: PriceOffer | null) {
    for (const [key, ticket] of this.tickets) if (ticket.expires <= this.now()) this.tickets.delete(key);
    if (!this.ownerAuthorized || !offer || !offer.model || !Number.isFinite(offer.maximumUsd) || offer.maximumUsd <= 0 || this.tickets.size >= 100) return null;
    const token = randomBytes(32).toString('hex');
    const expires = this.now() + 120_000;
    this.tickets.set(token, { digest: this.digest(request), maximumUsd: offer.maximumUsd, expires });
    return { token, maximumUsd: offer.maximumUsd, expiresAt: new Date(expires).toISOString() };
  }
  consume(token: string, request: unknown, maximumUsd: number, approved: boolean) {
    const ticket = this.tickets.get(token);
    this.tickets.delete(token); // Even a failed attempt consumes its approval. No replay or concurrent reuse.
    return Boolean(this.ownerAuthorized && approved && ticket && ticket.expires > this.now() && ticket.digest === this.digest(request) && ticket.maximumUsd === maximumUsd);
  }
}
