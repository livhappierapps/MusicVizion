const references = [
  { title: 'Before Beethoven · Bach & counterpoint', detail: 'Follow two independent melodic lines. Can you hear each one remain distinct while they fit together? Beethoven was a composer, not the oldest genre; musical traditions predate both composers.', href: 'https://www.britannica.com/art/counterpoint-music' },
  { title: 'Beethoven · motif & transformation', detail: 'Pick a short rhythmic or melodic idea. Listen for its return, changed register, development, and a contrast in intensity.', href: 'https://www.britannica.com/biography/Ludwig-van-Beethoven' },
  { title: 'Blues & jazz · response & improvisation', detail: 'Notice a phrase that sounds like a question and one that answers. In an improvised passage, follow variation around a recurring harmonic or rhythmic setting.', href: 'https://www.britannica.com/art/blues-music' },
  { title: 'Hip-hop & electronic music · loops & contrast', detail: 'Listen for recurring layers, a break in the texture, or a build and release. A resemblance is not proof of sampling, borrowing, or influence.', href: 'https://www.britannica.com/art/hip-hop' },
];
export function ListeningContext() {
  return <section className="listening-context" data-testid="panel-listening-context">
    <details open>
      <summary data-testid="toggle-history-guide">Free listening lenses · across eras</summary>
      <p>No song is being matched against a hit database. These educational prompts help you compare what you hear without inventing a historical relationship.</p>
      <div className="history-lenses">{references.map((item, index) => <article key={item.title}><h4>{item.title}</h4><p>{item.detail}</p><a href={item.href} target="_blank" rel="noopener noreferrer" data-testid={`link-history-source-${index}`}>Background reference</a></article>)}</div>
    </details>
    <details>
      <summary data-testid="toggle-popularity">Popularity · no fabricated statistics</summary>
      <p data-testid="text-popularity-unavailable">No licensed popularity data source is connected. Views, streams, chart rankings, cross-era comparisons, and future-hit probabilities are unavailable—not zero. Browser audio meters are not popularity scores.</p>
      <p>For current source-published information, visit <a href="https://www.billboard.com/charts/" target="_blank" rel="noopener noreferrer" data-testid="link-billboard">Billboard charts</a> or <a href="https://www.officialcharts.com/charts/" target="_blank" rel="noopener noreferrer" data-testid="link-official-charts">Official Charts</a>. Their rankings have different markets, dates, and methods; they are not a universal measure across history.</p>
    </details>
    <details>
      <summary data-testid="toggle-cost-release">Cost & release plan · reviewed October 15, 2026</summary>
      <p><strong>Current testing: no app purchase required.</strong> Local files, rough signal meters, themes, companion notes, and the fixed local guide do not invoke paid AI. Hosting, internet/mobile data, and third-party platform terms still apply; total operation is not guaranteed free.</p>
      <p><strong>Proposed core license: $4.99 one time</strong> (not active; no checkout). Optional Grok usage is excluded. Unlimited provider-paid AI cannot responsibly be promised for a small one-time purchase.</p>
      <p>Adjacent tools already exist, so we do not claim to be first: <a href="https://www.sonicvisualiser.org/" target="_blank" rel="noopener noreferrer" data-testid="link-price-sonic">Sonic Visualiser is free and open source</a>; <a href="https://www.seventhstring.com/xscribe/buy.html" target="_blank" rel="noopener noreferrer" data-testid="link-price-transcribe">Transcribe! lists $39 for one copy, plus local taxes</a>. They are analysis/practice alternatives, not identical AI-companion products. $4.99 is lower than that paid reference, not lower than free.</p>
      <p>Before enabling Grok: resolve provider access, verify model-specific price units and a defensible maximum charge, obtain the owner’s separate spending approval, then require a fresh request-specific approval. Unknown price means blocked; no automatic retries.</p>
      <p>Native APK/IPA packaging, signing, store submission, hosting, payment processing, and any paid build services require a separate cost review and approval. Existing developer memberships do not remove all possible build or transaction charges. No subscription, payment provider, deployment, or native build was activated here.</p>
      <p>Suno share pages are not direct audio files. <a href="https://help.suno.com/en/articles/2409921" target="_blank" rel="noopener noreferrer" data-testid="link-suno-download-help">Suno’s official download instructions</a> describe downloading your songs through its menu; available formats and download limits depend on its terms/plan. This app does not initiate downloads or purchases.</p>
      <small>Pricing references checked October 15, 2026. Prices may change. Historical links are background reading, not evidence about your selected track.</small>
    </details>
  </section>;
}
