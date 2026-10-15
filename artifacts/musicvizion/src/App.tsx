import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { useCreateCompanionReply, useHealthCheck } from '@workspace/api-client-react';
import type { CompanionAnalysis, CompanionInput } from '@workspace/api-client-react';
import {
  Activity, AudioLines, AudioWaveform, Check, ChevronDown, CircleHelp, Disc3,
  Headphones, Heart, LoaderCircle, Mic2, Music2, Pause, Play, Send, Settings2,
  Sparkles, Upload, Volume2, X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const health = useHealthCheck();
  const companion = useCreateCompanionReply();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const energyHistoryRef = useRef<{ time: number; value: number }[]>([]);
  const lastSampleRef = useRef(0);
  const [track, setTrack] = useState({ title: '', artist: '', source: '' });
  const [sourceUrl, setSourceUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [sourceKind, setSourceKind] = useState<'none' | 'direct' | 'embedded'>('none');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [analysis, setAnalysis] = useState<CompanionAnalysis>({
    bpm: null, energy: null, brightness: null, pulse: null, source: 'Not measured',
  });
  const [analysisState, setAnalysisState] = useState<'idle' | 'measuring' | 'ready' | 'blocked' | 'error'>('idle');
  const [sourceError, setSourceError] = useState('');
  const [message, setMessage] = useState('');
  const [preferences, setPreferences] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('musicvizion.preferences') || '[]'); }
    catch { return []; }
  });
  const [conversation, setConversation] = useState<{ role: 'you' | 'grok'; text: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => {
      setPosition(audio.currentTime || 0);
      const analyser = analyserRef.current;
      if (analyser && !audio.paused && !audio.ended) {
        const bins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(bins);
        const mean = bins.reduce((sum, value) => sum + value, 0) / Math.max(1, bins.length);
        const highStart = Math.floor(bins.length * 0.65);
        const highMean = bins.slice(highStart).reduce((sum, value) => sum + value, 0) / Math.max(1, bins.length - highStart);
        const wave = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(wave);
        const rms = Math.sqrt(wave.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / wave.length);
        const now = performance.now();
        if (now - lastSampleRef.current > 100) {
          lastSampleRef.current = now;
          const history = energyHistoryRef.current;
          history.push({ time: now, value: mean });
          while (history.length && now - history[0].time > 9000) history.shift();
        }
        let bpm: number | null = null;
        const samples = energyHistoryRef.current;
        if (samples.length > 45) {
          const values = samples.map(sample => sample.value);
          const average = values.reduce((sum, value) => sum + value, 0) / values.length;
          let bestLag = 0;
          let bestScore = -1;
          for (let lag = 5; lag <= 15; lag++) {
            let score = 0;
            let count = 0;
            for (let i = lag; i < values.length; i++) {
              score += (values[i] - average) * (values[i - lag] - average);
              count++;
            }
            score /= Math.max(1, count);
            if (score > bestScore) { bestScore = score; bestLag = lag; }
          }
          if (bestLag) bpm = Math.round(60000 / (bestLag * 100));
        }
        setAnalysis(prev => ({
          ...prev,
          bpm: bpm ?? prev.bpm,
          energy: Math.min(100, Math.round(rms * 260)),
          brightness: Math.min(100, Math.round(highMean * 1.45)),
          pulse: Math.min(100, Math.round(mean / 2.55)),
          source: 'Live browser measurement',
        }));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function trackMetadataFromUrl(url: string) {
    const clean = url.split('?')[0].split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled audio';
    return { title: clean, artist: 'Unknown artist' };
  }

  function detectEmbed(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtube.com') || parsed.hostname === 'youtu.be') {
        const video = parsed.hostname === 'youtu.be' ? parsed.pathname.slice(1) : parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
        return video ? `https://www.youtube-nocookie.com/embed/${video}` : '';
      }
      if (parsed.hostname.includes('spotify.com')) {
        const match = parsed.pathname.match(/\/(track|album|playlist|episode|show)\/([^/?]+)/);
        return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}` : '';
      }
    } catch { return ''; }
    return '';
  }

  function loadUrl() {
    if (!sourceUrl.trim()) return;
    setSourceError('');
    setAnalysisState('idle');
    setAnalysis({ bpm: null, energy: null, brightness: null, pulse: null, source: 'Not measured' });
    const detected = detectEmbed(sourceUrl.trim());
    const meta = trackMetadataFromUrl(sourceUrl.trim());
    setTrack({ ...meta, source: detected ? 'Embedded platform player' : 'Direct audio URL' });
    if (detected) {
      setEmbedUrl(detected);
      setAudioUrl('');
      setSourceKind('embedded');
      setAnalysisState('blocked');
    } else {
      setAudioUrl(sourceUrl.trim());
      setEmbedUrl('');
      setSourceKind('direct');
      setAnalysisState('measuring');
    }
    setPosition(0);
    setPlaying(false);
  }

  function chooseFile(file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setEmbedUrl('');
    setSourceKind('direct');
    setTrack({ title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '), artist: 'Local file', source: 'Local audio file' });
    setAnalysisState('measuring');
    setAnalysis({ bpm: null, energy: null, brightness: null, pulse: null, source: 'Measuring local audio' });
    setPosition(0);
    setSourceError('');
  }

  async function attachAnalyser() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!contextRef.current) contextRef.current = new AudioContext();
      if (!analyserRef.current) {
        const analyser = contextRef.current.createAnalyser();
        analyser.fftSize = 2048;
        const source = contextRef.current.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(contextRef.current.destination);
        analyserRef.current = analyser;
      }
      await contextRef.current.resume();
      setAnalysisState('measuring');
      setAnalysis(prev => ({ ...prev, source: 'Live browser measurement' }));
      await audio.play();
      setPlaying(true);
    } catch {
      setAnalysisState('blocked');
      setSourceError('This audio source can play, but its stream is not available to the browser analyzer. Try a local file or a direct audio URL that permits browser access.');
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || sourceKind !== 'direct') return;
    if (audio.paused) void attachAnalyser();
    else { audio.pause(); setPlaying(false); }
  }

  function seek(value: number) {
    if (audioRef.current && duration > 0) {
      audioRef.current.currentTime = value;
      setPosition(value);
    }
  }

  function formatTime(seconds: number) {
    if (!Number.isFinite(seconds)) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  function sendMessage(text = message) {
    const trimmed = text.trim();
    if (!trimmed || companion.isPending) return;
    const input: CompanionInput = {
      title: track.title || 'No track selected',
      artist: track.artist || 'Unknown artist',
      userMessage: trimmed,
      positionSeconds: Math.floor(position),
      analysis: { ...analysis, source: analysisState === 'ready' || analysisState === 'measuring' ? analysis.source : 'Unavailable for this source' },
      preferences,
    };
    setConversation(prev => [...prev, { role: 'you', text: trimmed }]);
    setMessage('');
    companion.mutate({ data: input }, {
      onSuccess: reply => {
        setConversation(prev => [...prev, { role: 'grok', text: reply.reply }]);
        if (reply.preferenceSignal) {
          setPreferences(prev => {
            const next = [...new Set([...prev, reply.preferenceSignal as string])].slice(-24);
            localStorage.setItem('musicvizion.preferences', JSON.stringify(next));
            return next;
          });
        }
      },
    });
  }

  const metrics = [
    { label: 'BPM', value: analysis.bpm == null ? '—' : `${analysis.bpm}`, unit: 'tempo', color: 'cyan' },
    { label: 'ENERGY', value: analysis.energy == null ? '—' : `${analysis.energy}`, unit: 'live level', color: 'pink' },
    { label: 'BRIGHTNESS', value: analysis.brightness == null ? '—' : `${analysis.brightness}`, unit: 'high freq.', color: 'gold' },
    { label: 'PULSE', value: analysis.pulse == null ? '—' : `${analysis.pulse}`, unit: 'signal', color: 'violet' },
  ];
  const quickPrompts = ['What should I listen for?', 'Compare this with Beethoven', 'Describe the feeling'];

  return (
    <main className="room-shell">
      <header className="topbar">
        <div className="brand" data-testid="brand-musicvizion">
          <div className="brand-mark"><AudioWaveform size={19} strokeWidth={1.7} /></div>
          <span>MUSIC<span>VIZION</span></span>
          <i>LISTEN DEEPER</i>
        </div>
        <div className="topbar-right">
          <div className={`service-state ${health.isError ? 'offline' : ''}`} data-testid="status-service">
            <span className="state-dot" /> {health.isLoading ? 'CONNECTING' : health.isError ? 'COMPANION OFFLINE' : 'ROOM ONLINE'}
          </div>
          <button className="icon-button" aria-label="Session settings" data-testid="button-settings" onClick={() => document.getElementById('preferences-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Settings2 size={17} /></button>
          <div className="avatar" data-testid="avatar-listener">L</div>
        </div>
      </header>

      <div className="workspace">
        <section className="listening-column">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR PRIVATE LISTENING ROOM <span className="eyebrow-index">01 / 03</span></div>
          <div className="heading-row">
            <div>
              <h1>Hear the <em>in-between.</em></h1>
              <p className="lede">A track, a moment, a conversation that goes somewhere.</p>
            </div>
            <div className="session-tag"><Disc3 size={15} /> SESSION 001</div>
          </div>

          <section className="source-panel" aria-label="Choose a track">
            <div className="section-label"><span>01</span> BRING A SOUND INTO THE ROOM</div>
            <div className="source-entry">
              <div className="source-icon"><Music2 size={18} /></div>
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadUrl()} placeholder="Paste a direct audio URL or YouTube / Spotify link" aria-label="Track URL" data-testid="input-track-url" />
              <button className="load-button" onClick={loadUrl} data-testid="button-load-track">Load track <ChevronDown size={14} /></button>
              <span className="or-divider">OR</span>
              <button className="file-button" onClick={() => fileRef.current?.click()} data-testid="button-upload-track"><Upload size={15} /> Local file</button>
              <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => chooseFile(e.target.files?.[0])} data-testid="input-audio-file" />
            </div>
            <p className="source-note" data-testid="text-source-capability"><CircleHelp size={13} /> Local files and readable direct audio URLs can be analyzed. Embedded players may play without exposing audio for analysis.</p>
            {sourceError && <p className="inline-error" role="alert" data-testid="status-source-error">{sourceError}</p>}
          </section>

          <section className="now-playing" data-testid="panel-now-playing">
            <div className="artwork-wrap">
              <div className="artwork">
                <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-core"><AudioLines size={35} strokeWidth={1.2} /></div>
                <span className="art-coordinate">MV—01</span>
              </div>
              <span className={`playing-pill ${playing ? 'is-playing' : ''}`}><span /> {playing ? 'IN MOTION' : sourceKind === 'none' ? 'AWAITING SOUND' : sourceKind === 'embedded' ? 'EMBEDDED SOURCE' : 'READY TO PLAY'}</span>
            </div>
            <div className="track-info">
              <div className="track-overline">NOW IN THE ROOM <span>·</span> {track.source || 'NO SOURCE'}</div>
              <h2 data-testid="text-track-title">{track.title || 'Your next listen'}</h2>
              <p className="track-artist" data-testid="text-track-artist">{track.artist || 'Bring a track to begin'}</p>
              {sourceKind === 'embedded' ? (
                <div className="embedded-player"><iframe title="Embedded music player" src={embedUrl} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" data-testid="frame-embedded-player" /><p>Use the player’s own controls. Embedded audio is not exposed to session analysis.</p></div>
              ) : (
                <>
                  <div className="progress-row">
                    <span>{formatTime(position)}</span>
                    <input type="range" min="0" max={duration || 100} value={duration ? position : 0} onChange={e => seek(Number(e.target.value))} aria-label="Track position" data-testid="input-track-seek" />
                    <span>{duration ? formatTime(duration) : '0:00'}</span>
                  </div>
                  <div className="player-controls">
                    <button className="play-button" aria-label={playing ? 'Pause track' : 'Play track'} onClick={togglePlayback} disabled={sourceKind !== 'direct'} data-testid="button-play-pause">{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
                    <span className="control-caption">{sourceKind === 'none' ? 'A quiet room, ready for sound' : playing ? 'Listening live' : 'Press play when you’re ready'}</span>
                    <Volume2 size={16} className="volume-icon" />
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} aria-label="Volume" data-testid="input-volume" />
                  </div>
                  <audio ref={audioRef} src={audioUrl || undefined} onLoadedMetadata={e => setDuration(e.currentTarget.duration)} onTimeUpdate={e => setPosition(e.currentTarget.currentTime)} onEnded={() => setPlaying(false)} onError={() => { if (audioUrl) { setAnalysisState('error'); setSourceError('This URL could not be loaded as browser-readable audio. It may require a platform player, or the host may block playback.'); } }} data-testid="audio-track" />
                </>
              )}
            </div>
            <button className={`save-track ${saved ? 'saved' : ''}`} aria-label={saved ? 'Remove from saved listens' : 'Save this listen'} onClick={() => setSaved(!saved)} data-testid="button-save-track">{saved ? <Check size={17} /> : <Heart size={17} />}</button>
          </section>

          <section className="analysis-section" data-testid="panel-analysis">
            <div className="analysis-heading">
              <div>
                <div className="section-label"><span>02</span> THE SOUND, IN THIS MOMENT</div>
                <p className="analysis-caption">Session measurements, not platform-wide stats.</p>
              </div>
              <div className={`measure-status ${analysisState}`} data-testid="status-analysis">
                <span className="state-dot" />
                {analysisState === 'measuring' ? 'MEASURING' : analysisState === 'ready' ? 'LIVE SIGNAL' : analysisState === 'blocked' ? 'ANALYSIS UNAVAILABLE' : analysisState === 'error' ? 'SOURCE ERROR' : 'NO MEASUREMENTS'}
              </div>
            </div>
            <div className="metrics-grid">
              {metrics.map((metric, index) => <div className={`metric metric-${metric.color}`} key={metric.label} data-testid={`metric-${metric.label.toLowerCase()}`}>
                <div className="metric-top"><span>{metric.label}</span><span className="metric-marker">0{index + 1}</span></div>
                <div className="metric-value">{metric.value}<small>{metric.value !== '—' && metric.label !== 'BPM' ? '%' : ''}</small></div>
                <div className="metric-foot"><span className="metric-bar"><i style={{ width: metric.value === '—' ? '10%' : `${metric.label === 'BPM' ? Math.min(100, Number(metric.value) / 2.2) : Number(metric.value)}%` }} /></span>{metric.unit}</div>
              </div>)}
            </div>
            <div className="analysis-footnote"><Activity size={14} /><span>{analysis.source === 'Not measured' ? 'Load a local file or readable direct audio URL to begin live measurement.' : analysis.source}</span><span className="not-fact">ANALYSIS, NOT INFLUENCE DATA</span></div>
          </section>

          <section className="history-card" data-testid="panel-history">
            <div className="history-art"><div className="history-lines" /><span>PAST / PRESENT</span></div>
            <div className="history-copy">
              <div className="section-label"><span>03</span> LISTEN ACROSS TIME</div>
              <h3>History is a lens,<br /><em>not a leaderboard.</em></h3>
              <p>Ask Grok to place a sound beside Beethoven, a movement, or a musical idea. We’ll explore similarities as interpretation—not claim a line of influence.</p>
              <button className="text-action" onClick={() => sendMessage('Compare this moment with Beethoven, as a listening exercise—not a claim of influence.')} data-testid="button-compare-beethoven">Open a historical comparison <span>↗</span></button>
            </div>
            <div className="history-seal"><span>LISTEN</span><span>≠</span><span>PROOF</span></div>
          </section>
        </section>

        <aside className="companion-column" data-testid="panel-companion">
          <div className="companion-head">
            <div className="companion-mark"><Sparkles size={17} /></div>
            <div><div className="companion-kicker">YOUR LISTENING COMPANION</div><h2>Grok <span>·</span> in the room</h2></div>
            <div className="online-indicator"><i /> HERE</div>
          </div>
          <div className="companion-intro">
            <div className="grok-avatar"><AudioWaveform size={21} /></div>
            <div><strong>Let’s listen closely.</strong><p>Ask about the details, the feeling, or where this sound might sit in musical history.</p></div>
          </div>
          <div className="conversation" data-testid="list-conversation">
            {conversation.length === 0 ? (
              <div className="conversation-empty">
                <span className="empty-rule" />
                <p>One track can open a lot of doors.</p>
                <span>Start wherever your ear goes.</span>
              </div>
            ) : conversation.map((item, index) => <div className={`message message-${item.role}`} key={`${item.role}-${index}`} data-testid={`message-${item.role}-${index}`}>
              <span className="message-label">{item.role === 'you' ? 'YOU' : 'GROK'}</span><p>{item.text}</p>
            </div>)}
            {companion.isPending && <div className="message message-grok loading-message" data-testid="status-companion-loading"><span className="message-label">GROK</span><p><LoaderCircle size={15} className="spin" /> Finding the thread…</p></div>}
            {companion.isError && <div className="companion-error" role="alert" data-testid="status-companion-error"><span>That thought didn’t reach Grok.</span><button onClick={() => setConversation(prev => prev.slice(0, -1))} data-testid="button-dismiss-error"><X size={13} /> dismiss</button><small>Check the connection and try sending your message again.</small></div>}
          </div>
          {conversation.length === 0 && <div className="prompt-stack">
            <div className="prompt-caption">A FEW PLACES TO BEGIN</div>
            {quickPrompts.map((prompt, i) => <button key={prompt} className="prompt-chip" onClick={() => sendMessage(prompt)} data-testid={`button-prompt-${i}`}><span>{['01', '02', '03'][i]}</span>{prompt}<span className="prompt-arrow">↗</span></button>)}
          </div>}
          <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What are you hearing?" rows={2} maxLength={1200} aria-label="Message Grok" data-testid="input-companion-message" />
            <div className="composer-bottom"><span>TRACK + MOMENT + YOUR EAR</span><button type="submit" disabled={!message.trim() || companion.isPending} aria-label="Send message" data-testid="button-send-message"><Send size={15} /></button></div>
          </form>
          <div className="companion-note"><Mic2 size={13} /> Grok gets the current track, playhead, measured analysis, and your message.</div>

          <section className="preferences" id="preferences-panel" data-testid="preferences-panel">
            <div className="preferences-header"><div><span className="pref-kicker">LEARNING, LOCALLY</span><h3>Your listening notes</h3></div><span className="local-badge"><span /> ON THIS DEVICE</span></div>
            {preferences.length ? <div className="preference-list">{preferences.map((pref, i) => <div className="preference-item" key={`${pref}-${i}`} data-testid={`preference-${i}`}><span>{pref}</span><button aria-label={`Remove preference ${pref}`} onClick={() => setPreferences(prev => { const next = prev.filter((_, index) => index !== i); localStorage.setItem('musicvizion.preferences', JSON.stringify(next)); return next; })} data-testid={`button-remove-preference-${i}`}><X size={13} /></button></div>)}</div> : <p className="no-preferences" data-testid="text-empty-preferences">Your taste stays yours. Preference notes appear here when Grok learns a signal from your conversation.</p>}
            <div className="local-storage-line"><Check size={12} /> Never sent except with a message to Grok</div>
          </section>
          <div className="privacy-footer"><Headphones size={14} /><span>THIS ROOM IS YOURS.<br /><b>KEEP LISTENING.</b></span><AudioWaveform size={20} /></div>
        </aside>
      </div>
      <footer className="page-footer"><span>MV / MUSICVIZION</span><span>LISTENING IS A WAY OF NOTICING.</span><span>SESSION MEASUREMENTS · NOT GLOBAL STATISTICS</span></footer>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
