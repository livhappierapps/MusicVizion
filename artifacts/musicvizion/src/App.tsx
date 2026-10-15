import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { useHealthCheck } from '@workspace/api-client-react';
import type { CompanionAnalysis, CompanionInput } from '@workspace/api-client-react';
import { ProfilePanel, type Profile } from '@/components/musicvizion/ProfilePanel';
import { CostReview } from '@/components/musicvizion/CostReview';
import { ThemeToggle } from '@/components/musicvizion/ThemeToggle';
import '@/components/musicvizion/cost-panels.css';
import { YoutubePlayer, type YoutubeControls } from '@/components/youtube-player';
import { parseTrackSource } from '@/lib/track-source';
import { localGuide } from '@/lib/local-guide';
import { profileStorageKey, readProfiles, validateProfiles } from '@/lib/profiles';
import { ListeningContext } from '@/components/listening-context';
import {
  Activity, AudioLines, AudioWaveform, Check, ChevronDown, CircleHelp, Disc3,
  Headphones, Heart, Mic2, Music2, Pause, Play, Send, Settings2,
  Sparkles, Upload, Volume2,
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
  const [profileState, setProfileState] = useState(readProfiles);
  const [storageError, setStorageError] = useState('');
  const preferences = profileState.profiles.find(p => p.id === profileState.activeId)?.notes ?? [];
  const [pendingInput, setPendingInput] = useState<CompanionInput | null>(null);
  const [mode, setMode] = useState<'local' | 'grok'>('local');
  const [theme, setTheme] = useState<'neon' | 'metal'>(() => {
    try { return localStorage.getItem('musicvizion.theme') === 'metal' ? 'metal' : 'neon'; } catch { return 'neon'; }
  });
  const youtubeRef = useRef<YoutubeControls>(null);
  const objectUrlRef = useRef('');
  const [videoId, setVideoId] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const energyHistoryRef = useRef<{ time: number; value: number }[]>([]);
  const lastSampleRef = useRef(0);
  const lastTickRef = useRef(0);
  const [track, setTrack] = useState({ title: '', artist: '', source: '' });
  const [sourceUrl, setSourceUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [sourceKind, setSourceKind] = useState<'none' | 'direct' | 'embedded' | 'youtube' | 'suno'>('none');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [analysis, setAnalysis] = useState<CompanionAnalysis>({
    bpm: null, energy: null, brightness: null, pulse: null, source: 'Not measured',
  });
  const [analysisState, setAnalysisState] = useState<'idle' | 'measuring' | 'ready' | 'blocked' | 'error'>('idle');
  const [sourceError, setSourceError] = useState('');
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<{ role: 'you' | 'local'; text: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [volume, setVolume] = useState(0.8);

  function changeProfiles(profiles: Profile[], activeId: string) {
    const next = validateProfiles({ profiles, activeId });
    setProfileState(next);
    try { localStorage.setItem(profileStorageKey, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('Storage is unavailable or full. Changes are only held in this tab; they may be lost when you leave.'); }
  }
  useEffect(() => {
    setConversation([]); setPendingInput(null); setSaved(false);
  }, [profileState.activeId]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === profileStorageKey) setProfileState(readProfiles()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    void contextRef.current?.close();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || sourceKind !== 'direct') return;
    const tick = () => {
      if (performance.now() - lastTickRef.current < 110) { rafRef.current = requestAnimationFrame(tick); return; }
      lastTickRef.current = performance.now();
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
        if (samples.length > 45 && mean > 1) {
          const values = samples.map(sample => sample.value);
          const average = values.reduce((sum, value) => sum + value, 0) / values.length;
          let bestLag = 0;
          let bestScore = -1;
          for (let lag = 3; lag <= 13; lag++) {
            let score = 0;
            let count = 0;
            for (let i = lag; i < values.length; i++) {
              score += (values[i] - average) * (values[i - lag] - average);
              count++;
            }
            score /= Math.max(1, count);
            if (score > bestScore) { bestScore = score; bestLag = lag; }
          }
          const variance = values.reduce((sum, v) => sum + (v - average) ** 2, 0) / values.length;
          const sampleMs = (samples[samples.length - 1].time - samples[0].time) / (samples.length - 1);
          if (bestLag && variance > 4 && bestScore / variance > 0.55) bpm = Math.round(60000 / (bestLag * sampleMs));
        }
        setAnalysis(prev => ({
          ...prev,
          bpm,
          energy: Math.min(100, Math.round(rms * 260)),
          brightness: Math.min(100, Math.round(highMean * 1.45)),
          pulse: Math.min(100, Math.round(Math.sqrt(samples.reduce((sum, s) => sum + (s.value - mean) ** 2, 0) / Math.max(1, samples.length)) * 2)),
          source: 'Live browser measurement',
        }));
        setAnalysisState('ready');
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [audioUrl, sourceKind]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function trackMetadataFromUrl(url: string) {
    const clean = url.split('?')[0].split('/').pop()?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Untitled audio';
    return { title: clean, artist: 'Unknown artist' };
  }

  function loadUrl() {
    if (!sourceUrl.trim()) return;
    let parsed;
    try { parsed = parseTrackSource(sourceUrl.trim()); } catch (error) { setSourceError((error as Error).message); return; }
    audioRef.current?.pause();
    youtubeRef.current?.pause();
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = ''; }
    setSourceError('');
    setAnalysisState('idle');
    setAnalysis({ bpm: null, energy: null, brightness: null, pulse: null, source: 'Not measured' });
    const meta = trackMetadataFromUrl(sourceUrl.trim());
    setTrack({ ...meta, source: parsed.kind === 'direct' ? 'Direct audio URL' : `${parsed.kind} public link` });
    if (parsed.kind !== 'direct') {
      setEmbedUrl(parsed.embed);
      setVideoId(parsed.videoId);
      setAudioUrl('');
      setSourceKind(parsed.kind === 'spotify' ? 'embedded' : parsed.kind);
      setAnalysisState('blocked');
      if (parsed.kind === 'suno') setSourceError('Suno share pages are not direct audio streams. Open the original page; if you own or have permission to use the audio, download it through Suno and choose Local file here. We do not scrape or extract platform audio.');
    } else {
      setAudioUrl(sourceUrl.trim());
      setEmbedUrl('');
      setSourceKind('direct');
      setAnalysisState('measuring');
    }
    setPosition(0);
    setDuration(0);
    setSaved(false);
    energyHistoryRef.current = [];
    setPlaying(false);
  }

  function chooseFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|flac|aac|webm)$/i.test(file.name)) { setSourceError('Choose a supported audio file.'); return; }
    audioRef.current?.pause(); youtubeRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setAudioUrl(url);
    setEmbedUrl('');
    setSourceKind('direct');
    setTrack({ title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '), artist: 'Local file', source: 'Local audio file' });
    setAnalysisState('measuring');
    setAnalysis({ bpm: null, energy: null, brightness: null, pulse: null, source: 'Measuring local audio' });
    setPosition(0);
    setDuration(0); setSaved(false); setPlaying(false); energyHistoryRef.current = [];
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
    if (sourceKind === 'youtube') { if (playing) youtubeRef.current?.pause(); else youtubeRef.current?.play(); return; }
    const audio = audioRef.current;
    if (!audio || sourceKind !== 'direct') return;
    if (audio.paused) void attachAnalyser();
    else { audio.pause(); setPlaying(false); }
  }

  function seek(value: number) {
    if (sourceKind === 'direct' && audioRef.current && duration > 0) {
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
    if (!trimmed) return;
    audioRef.current?.pause(); youtubeRef.current?.pause(); setPlaying(false);
    const input: CompanionInput = {
      title: (track.title || 'No track selected').slice(0, 160),
      artist: (track.artist || 'Unknown artist').slice(0, 160),
      userMessage: trimmed.slice(0, 1200),
      positionSeconds: Math.floor(position),
      analysis: { ...analysis, source: analysisState === 'ready' || analysisState === 'measuring' ? analysis.source : 'Unavailable for this source' },
      preferences,
    };
    if (mode === 'grok') { setPendingInput(input); return; }
    setConversation(prev => [...prev, { role: 'you', text: trimmed } as const, { role: 'local', text: localGuide(input) } as const].slice(-40));
    setMessage('');
  }

  const metrics = [
    { label: 'BPM', value: analysis.bpm == null ? '—' : `~${analysis.bpm}`, unit: 'rough estimate', color: 'cyan' },
    { label: 'ENERGY', value: analysis.energy == null ? '—' : `${analysis.energy}`, unit: 'live level', color: 'pink' },
    { label: 'BRIGHTNESS', value: analysis.brightness == null ? '—' : `${analysis.brightness}`, unit: 'high freq.', color: 'gold' },
    { label: 'DYNAMICS', value: analysis.pulse == null ? '—' : `${analysis.pulse}`, unit: 'level variation', color: 'violet' },
  ];
  const quickPrompts = ['What should I listen for?', 'Compare this with Beethoven', 'Describe the feeling'];

  return (
    <main className={`room-shell ${theme === 'metal' ? 'metal-theme' : ''}`}>
      <header className="topbar">
        <div className="brand" data-testid="brand-musicvizion">
          <div className="brand-mark"><AudioWaveform size={19} strokeWidth={1.7} /></div>
          <span>MUSIC<span>VIZION</span></span>
          <i>LISTEN DEEPER</i>
        </div>
        <div className="topbar-right">
          <ThemeToggle theme={theme} onChange={value => {
            setTheme(value);
            try { localStorage.setItem('musicvizion.theme', value); }
            catch { setStorageError('Theme changes cannot be saved on this device.'); }
          }} />
          <div className={`service-state ${health.isError ? 'offline' : ''}`} data-testid="status-service">
            <span className="state-dot" /> {health.isLoading ? 'CHECKING SERVER' : health.isError ? 'LOCAL MODE' : 'LOCAL TOOLS READY'}
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
              <p className="zero-cost-banner" data-testid="text-spending-policy">Local-first · No paid AI calls · Grok spending blocked until separately approved</p>
            </div>
            <div className="session-tag"><Disc3 size={15} /> SESSION 001</div>
          </div>

          <section className="source-panel" aria-label="Choose a track">
            <div className="section-label"><span>01</span> BRING A SOUND INTO THE ROOM</div>
            <div className="source-entry">
              <div className="source-icon"><Music2 size={18} /></div>
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadUrl()} placeholder="Public YouTube / Suno link or direct audio URL" aria-label="Track URL" data-testid="input-track-url" />
              <button className="load-button" onClick={loadUrl} data-testid="button-load-track">Load track <ChevronDown size={14} /></button>
              <span className="or-divider">OR</span>
              <button className="file-button" onClick={() => fileRef.current?.click()} data-testid="button-upload-track"><Upload size={15} /> Local file</button>
              <input ref={fileRef} type="file" accept="audio/*" hidden onChange={e => { chooseFile(e.target.files?.[0]); e.currentTarget.value = ''; }} data-testid="input-audio-file" />
            </div>
            <p className="source-note" data-testid="text-source-capability"><CircleHelp size={13} /> Local audio stays on your device. Loading an external link contacts its host; embedded audio is not readable by this analyzer. Suno pages need a permitted local download.</p>
            {sourceKind !== 'none' && <div className="metadata-editor">
              <label>Title<input data-testid="input-track-title" maxLength={160} value={track.title} onChange={e => setTrack(prev => ({...prev,title:e.target.value}))} /></label>
              <label>Artist<input data-testid="input-track-artist" maxLength={160} value={track.artist} onChange={e => setTrack(prev => ({...prev,artist:e.target.value}))} /></label>
            </div>}
            {sourceError && <p className="inline-error" role="alert" data-testid="status-source-error">{sourceError}</p>}
          </section>

          <section className={`now-playing ${['youtube','embedded','suno'].includes(sourceKind) ? 'has-platform' : ''}`} data-testid="panel-now-playing">
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
              {sourceKind === 'suno' ? (
                <p className="source-note"><a href={sourceUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-suno">Open original Suno page</a> · Choose Local file for permitted audio analysis.</p>
              ) : sourceKind === 'youtube' ? (
                <><YoutubePlayer videoId={videoId} ref={youtubeRef} onPlaying={setPlaying} onProgress={(time, length) => { setPosition(time); setDuration(length); }} />
                <div className="player-controls"><button className="play-button" data-testid="button-youtube-play-pause" aria-label={playing ? 'Pause YouTube' : 'Play YouTube'} onClick={togglePlayback}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button><span className="control-caption">{formatTime(position)} / {formatTime(duration)} · Pause to discuss</span></div>
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-youtube">Open original YouTube video</a></>
              ) : sourceKind === 'embedded' ? (
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
                </>
              )}
            </div>
            <button className={`save-track ${saved ? 'saved' : ''}`} disabled={sourceKind === 'none' || preferences.length >= 24} aria-label="Save moment to companion notes" onClick={() => {
              const note = `${formatTime(position)} · ${track.title || 'Untitled'}: listening moment`.slice(0,120);
              changeProfiles(profileState.profiles.map(p => p.id === profileState.activeId ? {...p,notes:[...new Set([...p.notes,note])].slice(-24)} : p),profileState.activeId); setSaved(true);
            }} data-testid="button-save-track">{saved ? <Check size={17} /> : <Heart size={17} />}</button>
          </section>
          <audio ref={audioRef} crossOrigin="anonymous" src={audioUrl || undefined} onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { if (audioUrl) { setAnalysisState('error'); setPlaying(false); setSourceError('This source could not load as browser-readable audio. The host may block cross-origin access, the codec may be unsupported, or the link may not be an audio file. Try a local file.'); } }} data-testid="audio-track" />

          <section className="analysis-section" data-testid="panel-analysis">
            <div className="analysis-heading">
              <div>
                <div className="section-label"><span>02</span> THE SOUND, IN THIS MOMENT</div>
                <p className="analysis-caption">Rough normalized 0–100 signal meters, not dB, mood, quality, or popularity. Experimental BPM needs several seconds of a clear pulse and may estimate half or double tempo.</p>
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
                <div className="metric-foot"><span className="metric-bar"><i style={{ width: metric.value === '—' ? '0%' : `${metric.label === 'BPM' ? Math.min(100, Number(metric.value.replace('~','')) / 2.2) : Number(metric.value)}%` }} /></span>{metric.unit}</div>
              </div>)}
            </div>
            <div className="analysis-footnote"><Activity size={14} /><span>{analysis.source === 'Not measured' ? 'Load a local file or readable direct audio URL to begin live measurement.' : analysis.source}</span><span className="not-fact">ANALYSIS, NOT INFLUENCE DATA</span></div>
          </section>

          <section className="history-card" data-testid="panel-history">
            <div className="history-art"><div className="history-lines" /><span>PAST / PRESENT</span></div>
            <div className="history-copy">
              <div className="section-label"><span>03</span> LISTEN ACROSS TIME</div>
              <h3>History is a lens,<br /><em>not a leaderboard.</em></h3>
              <p>Use the free listening guide to compare motifs and texture across eras. These are listening prompts, not measured similarity, verified influence, or a hit prediction.</p>
              <button className="text-action" onClick={() => sendMessage('Compare this moment with Beethoven, as a listening exercise—not a claim of influence.')} data-testid="button-compare-beethoven">Open a historical comparison <span>↗</span></button>
            </div>
            <div className="history-seal"><span>LISTEN</span><span>≠</span><span>PROOF</span></div>
          </section>
          <ListeningContext />
        </section>

        <aside className="companion-column" data-testid="panel-companion">
          <div className="companion-head">
            <div className="companion-mark"><Sparkles size={17} /></div>
            <div><div className="companion-kicker">YOUR LISTENING COMPANION</div><h2>{mode === 'local' ? 'Local listening guide' : 'Grok cost review'}</h2></div>
            <div className="online-indicator">PAID AI OFF</div>
          </div>
          <div className="companion-intro">
            <div className="grok-avatar"><AudioWaveform size={21} /></div>
            <div><strong>Let’s listen closely.</strong><p>The free guide uses fixed listening prompts, not AI. Grok requests are blocked until reliable pricing and owner spending approval exist.</p></div>
          </div>
          <label className="mode-picker">Discussion mode<select value={mode} onChange={e => setMode(e.target.value as 'local'|'grok')} data-testid="select-discussion-mode"><option value="local">Free local guide · no external AI</option><option value="grok">Grok · review costs (currently blocked)</option></select></label>
          <div className="conversation" data-testid="list-conversation">
            {conversation.length === 0 ? (
              <div className="conversation-empty">
                <span className="empty-rule" />
                <p>One track can open a lot of doors.</p>
                <span>Start wherever your ear goes.</span>
              </div>
            ) : conversation.map((item, index) => <div className={`message message-${item.role}`} key={`${item.role}-${index}`} data-testid={`message-${item.role}-${index}`}>
              <span className="message-label">{item.role === 'you' ? 'YOU' : 'LOCAL GUIDE · NOT GROK'}</span><p>{item.text}</p>
            </div>)}
          </div>
          {conversation.length === 0 && <div className="prompt-stack">
            <div className="prompt-caption">A FEW PLACES TO BEGIN</div>
            {quickPrompts.map((prompt, i) => <button key={prompt} className="prompt-chip" onClick={() => sendMessage(prompt)} data-testid={`button-prompt-${i}`}><span>{['01', '02', '03'][i]}</span>{prompt}<span className="prompt-arrow">↗</span></button>)}
          </div>}
          <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What are you hearing?" rows={2} maxLength={1200} aria-label="Listening discussion message" data-testid="input-companion-message" />
            <div className="composer-bottom"><span>{mode === 'local' ? 'LOCAL GUIDE · $0 PAID API CALLS' : 'REVIEW ONLY · GROK BLOCKED'}</span><button type="submit" disabled={!message.trim()} aria-label={mode === 'local' ? 'Ask local guide' : 'Review Grok cost'} data-testid="button-send-message"><Send size={15} /></button></div>
          </form>
          <div className="companion-note"><Mic2 size={13} /> Local guide text stays in this tab. Cost review sends text and feature summaries to this app’s server only, never raw audio or a paid provider.</div>

          <section className="preferences" id="preferences-panel" data-testid="preferences-panel">
            <ProfilePanel key={profileState.activeId} profiles={profileState.profiles} activeId={profileState.activeId} onChange={changeProfiles} />
            {storageError && <p role="alert" data-testid="error-local-storage">{storageError}</p>}
          </section>
          <div className="privacy-footer"><Headphones size={14} /><span>THIS ROOM IS YOURS.<br /><b>KEEP LISTENING.</b></span><AudioWaveform size={20} /></div>
        </aside>
      </div>
      <footer className="page-footer"><span>MV / MUSICVIZION</span><span>LISTENING IS A WAY OF NOTICING.</span><span>SESSION MEASUREMENTS · NOT GLOBAL STATISTICS</span></footer>
      <CostReview input={pendingInput} onClose={() => setPendingInput(null)} />
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
