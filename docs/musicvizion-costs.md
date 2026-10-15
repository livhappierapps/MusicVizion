# MusicVizion: costs and release recommendation

Reviewed October 15, 2026.

## Current operating policy

The user's instruction is to plan first, minimize costs, and request authorization before per-use spending. Approval of this MVP is not a budget or permission to charge any account.

Paid inference is disconnected. The quote endpoint reports an unknown maximum and cannot issue a spending token. The inference endpoint always refuses, including forged approvals, old clients, and direct HTTP callers. There are no background AI calls, paid tests, web-search API integrations, payment services, or native build jobs.

A future trusted pricing adapter would need an owner-approved provider/model, a reliable worst-case input/output cost, a payer identity/budget, and a fresh one-use payload-bound approval. The included consent ledger consumes approvals atomically in one process and expires them after two minutes. A restart invalidates them; multiple replicas would need a shared atomic store before enabling payments. Do not treat the client-supplied maximum as trusted pricing. This MVP intentionally cannot spend at all.

## What does not incur a paid AI request

- Local-file playback and browser signal analysis; files are never uploaded.
- Direct HTTPS audio from hosts allowing browser access (ordinary host/data charges may apply).
- Official YouTube/Spotify embeds, subject to source availability, platform terms, ads, and accounts.
- Neon/metal themes, editable local companion profiles, manual moment notes, and fixed listening prompts.
- Cost review through this app's own server. No data is forwarded to xAI.

These features are not a guarantee of zero total cost: hosting/server traffic, internet/mobile data, developer tooling, store memberships, signing/build infrastructure, and payment-processing fees must be evaluated separately. Nothing was published, purchased, or activated as part of this work. Fonts load from Google; platform embeds load only when the user loads a link. Browser storage is not encrypted cloud backup.

## Grok diagnosis and verification boundary

Nonbillable metadata requests to both `/v1/models` and `/v1/language-models` through the current connector returned HTTP 400 with `invalid-argument`. This establishes a provider/proxy access problem but not its exact cause; it does not establish that audio is supported or that inference is free. No inference was attempted in this task. The prior transport is removed. Model units, reasoning-token billing, all output charges, retry behavior, and current pricing require confirmation before separately approved activation.

Current Grok cost review is intentionally blocked. It shows the payload and cancellation flow, but has no paid confirmation action. It is not a working paid Grok service.

## Source limitations

YouTube uses the official IFrame API with native playback controls and play/pause-to-discuss. Embeds do not expose their audio to this analyzer. Public availability does not grant permission to scrape, download, or redistribute.

Suno share pages are not imported as direct streams. Users may open the original and choose a local file if they own or have permission to use it. Official instructions: https://help.suno.com/en/articles/2409921. Download availability and limits belong to Suno and can depend on plan; MusicVizion does not initiate those downloads or charge for them.

Popularity is explicitly unavailable. No views, streams, rankings, or hit scores are invented. Chart reference links lead to the publishers; musical history prompts are not evidence that a chosen song borrowed from a particular source.

## One-time purchase recommendation

Keep testing access free. Consider **$4.99 one time for the local-first core**, subject to the owner's approval and platform fee review. This is a recommendation, not an active price or checkout. Do not bundle unlimited paid Grok into that price.

Adjacent alternatives checked on public official pages:

| Product | Public price observed | Comparison limit |
| --- | --- | --- |
| Sonic Visualiser | Free, open source | Desktop visualization/analysis; not this companion product |
| Transcribe! | US $39 for one copy, plus local taxes | Music transcription/practice aid; not this companion product |

Sources:
- https://www.sonicvisualiser.org/
- https://www.seventhstring.com/xscribe/buy.html

Music analysis is not a new category. These observations do not prove MusicVizion is first, cheapest, or unique. A low price cannot undercut free; the purchase must justify convenience and its companion interface.

Optional paid AI should be considered separately only after pricing, payer authorization, maximum spend, and unit economics are verified. Options may include user-owned provider billing or explicitly capped usage; neither is implemented or approved.

## Native and commercial release

APK/IPA builds, device testing, signing credentials, store submission, hosting, and payment processing are separate approval decisions. Existing Apple/Google developer memberships do not authorize new per-use charges. No native binaries were produced, signing credentials requested, build services invoked, payment account connected, or checkout activated.

Before release: approve the delivery route and actual fee quotes; verify local-data recovery/backups; test platform embeds on intended devices; assess store rules for digital goods and AI access; and obtain explicit authorization for any billable build or provider test.
