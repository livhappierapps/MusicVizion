# MusicVizion: costs and release recommendation

Reviewed October 15, 2026.
Audio-input research updated October 19, 2026.

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

Initial nonbillable metadata checks on October 16, 2026 returned HTTP 400 `invalid-argument` from `/v1/models`, `/v1/language-models`, and `/v1/language-models/grok-4.7`. Both the installed application SDK and the connection-scoped proxy reproduced the failure. Inspecting the error body identified the credential problem: **“Incorrect API key provided.”** The integration's authorization metadata confirms API-key authentication, not OAuth. The owner subsequently chose the direct server-side Replit Secrets path; this now succeeds as described below. The connector's separately saved credential was not changed or retested.

No inference was attempted. The prior transport remains removed. The installed connector SDK retries HTTP 401 automatically, including POST requests; it is not suitable for an at-most-once paid transport without a separately verified no-retry path. A timeout or ambiguous provider failure must retain the entire reserved maximum as potentially spent, not release it for another call.

The owner authorized using Replit Secrets and supplied `XAI_API_KEY`. The first supplied secret was rejected. After the owner replaced it securely, direct server-side HTTPS GETs to `https://api.x.ai/v1/models` and `/v1/language-models` both returned **HTTP 200**. No secret values were logged and no inference was performed. The saved connector credential and the project secret are separate configuration surfaces; changing one does not establish that the other was updated.

The successful language-model catalog lists text/image input and text output for every returned model, including `grok-4.7`. The returned general model catalog contains no voice model identifiers. This verifies the listed chat-model modalities and metadata access, **not** access to the separate Voice API. Numeric catalog prices have provider-specific units; do not interpret them directly as USD or treat them as an approved maximum.

### Public documentation verified October 19, 2026

These are documentation observations, **not an activated pricing configuration or a verified request maximum**:

| Model / API | Published capability | Published base price |
| --- | --- | --- |
| `grok-4.7` | Text and image input; text output. Audio input is not listed. | Below 200k prompt tokens: $2 input / $6 output per million tokens. At or above 200k: $4 input / $12 output per million. |
| `grok-voice-3.0` / Speech to Speech | Official model page lists text and audio input/output; realtime voice conversations use a separate WebSocket API | $0.08/minute plus $0.004/text input event |
| `grok-voice-transcribe-2.0` / Speech to Text | Speech transcription, not verified general music analysis | REST $0.10/hour; streaming $0.20/hour |

The current MusicVizion payload contains track metadata, a message, notes, and approximate browser-computed features. **It contains no audio. Text-model commentary on those features is not Grok hearing or analyzing the recording.** The Grok Voice model page and realtime guide describe speech agents and bidirectional speech conversations; they do not establish reliable song, instrument, or harmony analysis. Voice/transcription availability does not prove that the model meets MusicVizion's music-listening goals. No provider replacement or audio upload is approved.

Additional published charges matter: reasoning tokens are billable; US regional requests carry a 1.1x token premium; priority processing carries a 2x premium; tools have separate charges; and Responses API requests rejected before generation for guideline violations can incur $0.05/request. Cached-input discounts are not a safe worst-case assumption. Do not derive a maximum from advertised token rates alone.

Official sources:
- https://docs.x.ai/developers/models
- https://docs.x.ai/developers/models/grok-4.7
- https://docs.x.ai/developers/pricing (page reports updated October 10, 2026)
- https://docs.x.ai/developers/model-capabilities/audio/voice

### Actual-audio research outcome

The owner selected **research actual audio input**, not substitution with feature-only text commentary, and subsequently approved using the project secret for metadata checks. The replacement secret now passes both catalog checks. In response to a request for spending authorization, the owner authorized **$0 total, $0 per request, and $0 for live tests** for the seven-day period after activation, and confirmed that they are the payer/authorized person. This is affirmative authorization for zero spending only; it permits no paid inference, uploads, microphone capture, or live test. There is no automatic renewal.

**Candidate, not activated:** Current official model documentation identifies `grok-voice-3.0` as a text/audio model. The speech-to-speech guide documents `wss://api.x.ai/v1/realtime?model=grok-voice-3.0`, bidirectional WebSocket audio/text events, PCM input at 8–48 kHz including 44.1 kHz, and direct API-key authentication for server-side use. These facts establish a speech/audio interface, not music-analysis suitability: no reviewed source guarantees instrument recognition, chord transcription, or reliable analysis of a complete song.

**Connector transport is not verified.** The installed xAI connector instructions describe authenticated HTTP calls through `connectors.proxy("xai", "/v1/...")` and say voice endpoints are among the available API paths. They return an HTTP `Response`; the instructions do not demonstrate a WebSocket upgrade or a persistent bidirectional audio stream. The xAI realtime guide requires WebSocket transport. A server-held API key is documented by xAI for server-side WebSockets, but no socket handshake was attempted because it could start a billable session. Therefore connector-compatible realtime transport and runtime server-side access remain unverified. Do not mint an ephemeral token, open a socket, or send audio while the gates below remain unmet.

**No true worst-case charge ceiling is established.** The current pricing page lists $0.08 per audio minute and $0.004 for each billable `conversation.item.create` text event. The speech-to-speech page says `server_vad` is billed for session duration, push-to-talk for audio sent and received, and a session may last up to 120 minutes. At the listed rate, $9.60 is only the audio-rate arithmetic for 120 minutes under a single-session assumption; it is not a quote or guaranteed all-in maximum. The reviewed docs do not establish a request-level dollar cap, the maximum text-event count/charge, or billing-rounding and termination behavior adequate to guarantee final charges. Repeated or concurrent sessions and any enabled tools add further exposure. A local disconnect timer alone cannot prove that provider billing stops at that instant.

**Suitability remains unverified.** The model is documented for realtime speech conversations, not as a music understanding model. Do not market transcription, speech-agent behavior, or browser-computed feature commentary as the model listening to music. A live evaluation could help establish practical suitability, but would require separate explicit owner/payer authorization naming the exact total USD budget and number of calls before any paid session.

**Transcription is not an equivalent fallback.** `grok-voice-transcribe-2.0` accepts files via `POST /v1/stt` or streaming audio via WebSocket, but returns recognized speech and timestamps, not musical analysis. Its voice-activity gate can skip non-speech audio; lowering it can produce spurious text for noise. It must not be presented as a verified music-listening companion. No alternative provider has been selected or authorized.

**Recommendation:** retain the disabled transport until Voice API access, a controllable audio transport, and billing details establish a true maximum. A working project secret has resolved direct metadata access, but is not spending authorization. Require a separate owner/payer budget and exact live-test authorization before evaluating musical usefulness. Do not promise that the voice model will satisfy the music-analysis goal before that evaluation.

The official billing guide documents prepaid credits, optional auto top-up, and an invoiced-billing limit. It states that a $0 invoiced-billing limit restricts usage to prepaid credits and rejects requests after credits are depleted. That is an account-level safeguard, not proof of a request-specific bound or how an already running voice session stops. No billing settings were inspected or changed, credits purchased, or payment methods connected. Do not enable auto top-up to make a test succeed.

Additional official sources reviewed:
- https://docs.x.ai/developers/models/grok-voice-3.0
- https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech (page reports updated October 13, 2026)
- https://docs.x.ai/developers/models/speech-to-speech
- https://docs.x.ai/developers/pricing
- https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
- https://docs.x.ai/developers/models/speech-to-text
- https://docs.x.ai/developers/rest-api-reference/inference/voice
- https://docs.x.ai/console/billing

### Remaining activation gates

1. **Direct metadata access verified:** both catalog GETs succeeded using the replacement project secret. The official model page now lists `grok-voice-3.0` and its text/audio modalities, but account access to a billable realtime session was not tested. Do not probe with paid sessions.
2. Grok Voice's suitability for music is unverified. Test suitability before promising musical understanding. Do not substitute feature-only commentary and call it listening.
3. Verify a server-controlled WebSocket transport compatible with the selected credential path. The installed connector's documented HTTP proxy does not demonstrate realtime WebSocket support.
4. Pin an available model/version and endpoint with trusted, fresh, server-owned pricing. Establish a true maximum including all audio, text events, rounding, session termination, fees, region, service tier, and tools. Unknown or unbounded charges keep approval issuance disabled.
5. The owner and payer authorized a **zero** total budget, zero per-call maximum, and zero live-test budget. Any positive amount needs fresh, separate authorization identifying allowed users, total budget and period, per-call maximum, and expiry. Do not infer permission from this zero-budget decision.
6. Before enabling transport, implement authenticated payer access and a durable, atomic budget/reservation ledger across restarts and replicas. Bind each short-lived, single-use approval to the payer, exact payload, model, pricing version, and maximum; enforce the budget before dispatch and prohibit automatic paid retries.
7. Keep tests mocked/local. A live test needs separate explicit authorization naming its exact maximum total USD spend and number of calls. No live-test budget exists.

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
