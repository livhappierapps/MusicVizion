import { createHash, randomBytes } from 'node:crypto';

export type PriceOffer = { model: string; maximumUsd: number };
type Ticket = { digest: string; maximumUsd: number; expires: number };
export type ConsentBudget = { totalBudgetUsd: number; perRequestMaximumUsd: number };

function toMicros(value: number, roundUp: boolean): number | null {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 1_000_000) return null;
  const micros = value * 1_000_000;
  const rounded = roundUp ? Math.ceil(micros) : Math.floor(micros);
  return Number.isSafeInteger(rounded) ? rounded : null;
}

export class SpendingConsent {
  private tickets = new Map<string, Ticket>();
  private ownerAuthorized: boolean;
  private now: () => number;
  private readonly totalBudgetMicros: number;
  private readonly perRequestMaximumMicros: number;
  private committedMicros = 0;
  private reservedMicros = 0;
  constructor(
    ownerAuthorized = false,
    now = () => Date.now(),
    budget: ConsentBudget = { totalBudgetUsd: 0, perRequestMaximumUsd: 0 },
  ) {
    this.ownerAuthorized = ownerAuthorized;
    this.now = now;
    // Round configured limits down so precision cannot exceed the owner's cap.
    this.totalBudgetMicros = toMicros(budget.totalBudgetUsd, false) ?? 0;
    this.perRequestMaximumMicros = toMicros(budget.perRequestMaximumUsd, false) ?? 0;
  }
  private digest(request: unknown) { return createHash('sha256').update(JSON.stringify(request)).digest('hex'); }
  issue(request: unknown, offer: PriceOffer | null) {
    for (const [key, ticket] of this.tickets) {
      if (ticket.expires <= this.now()) {
        this.tickets.delete(key);
        this.reservedMicros -= toMicros(ticket.maximumUsd, true) ?? 0;
      }
    }
    const maximumMicros = offer ? toMicros(offer.maximumUsd, true) : null;
    if (
      !this.ownerAuthorized || !offer?.model || maximumMicros == null || maximumMicros <= 0 ||
      this.perRequestMaximumMicros <= 0 || maximumMicros > this.perRequestMaximumMicros ||
      this.committedMicros + this.reservedMicros + maximumMicros > this.totalBudgetMicros ||
      this.tickets.size >= 100
    ) return null;
    const token = randomBytes(32).toString('hex');
    const expires = this.now() + 120_000;
    this.tickets.set(token, { digest: this.digest(request), maximumUsd: offer.maximumUsd, expires });
    this.reservedMicros += maximumMicros;
    return { token, maximumUsd: offer.maximumUsd, expiresAt: new Date(expires).toISOString() };
  }
  consume(token: string, request: unknown, maximumUsd: number, approved: boolean) {
    const ticket = this.tickets.get(token);
    this.tickets.delete(token); // Even a failed attempt consumes its approval. No replay or concurrent reuse.
    if (!ticket) return false;
    const reservedMicros = toMicros(ticket.maximumUsd, true) ?? 0;
    this.reservedMicros -= reservedMicros;
    const valid = Boolean(
      this.ownerAuthorized && approved && ticket.expires > this.now() &&
      ticket.digest === this.digest(request) && ticket.maximumUsd === maximumUsd
    );
    if (valid) this.committedMicros += reservedMicros;
    return valid;
  }
}
