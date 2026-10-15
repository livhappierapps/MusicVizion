import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

type Player = { playVideo(): void; pauseVideo(): void; getCurrentTime(): number; getDuration(): number; destroy(): void };
type YoutubeApi = { Player: new (element: HTMLElement, config: Record<string, unknown>) => Player };
declare global { interface Window { YT?: YoutubeApi; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<YoutubeApi> | undefined;
function loadApi(): Promise<YoutubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { apiPromise = undefined; reject(new Error('YouTube did not load. Check your connection or open the original link.')); }, 15000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); window.clearTimeout(timer); if (window.YT) resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { window.clearTimeout(timer); apiPromise = undefined; script.remove(); reject(new Error('YouTube is unavailable.')); };
    document.head.append(script);
  });
  return apiPromise;
}
export type YoutubeControls = { play(): void; pause(): void };
export const YoutubePlayer = forwardRef<YoutubeControls, { videoId: string; onProgress: (time: number, duration: number) => void; onPlaying: (playing: boolean) => void }>(
  function YoutubePlayer({ videoId, onProgress, onPlaying }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const player = useRef<Player | null>(null);
    const callbacks = useRef({ onProgress, onPlaying });
    callbacks.current = { onProgress, onPlaying };
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false);
    useImperativeHandle(ref, () => ({ play: () => player.current?.playVideo(), pause: () => player.current?.pauseVideo() }), []);
    useEffect(() => {
      let active = true;
      setReady(false); setError('');
      const node = document.createElement('div');
      container.current?.append(node);
      void loadApi().then(api => {
        if (!active) return;
        player.current = new api.Player(node, {
          videoId, host: 'https://www.youtube-nocookie.com',
          playerVars: { controls: 1, playsinline: 1, origin: window.location.origin },
          events: {
            onReady: () => { if (active) setReady(true); },
            onStateChange: (event: { data: number }) => callbacks.current.onPlaying(event.data === 1),
            onError: () => { if (active) { setError('This video cannot play here. It may be private, restricted, or embedding may be disabled.'); callbacks.current.onPlaying(false); } },
          },
        });
      }).catch(cause => { if (active) setError(String(cause.message)); });
      const interval = window.setInterval(() => { const p = player.current; if (p?.getCurrentTime) callbacks.current.onProgress(p.getCurrentTime() || 0, p.getDuration() || 0); }, 500);
      return () => { active = false; window.clearInterval(interval); player.current?.destroy(); player.current = null; node.remove(); };
    }, [videoId]);
    return <div className="youtube-player" data-testid="youtube-player"><div ref={container} />{!ready && !error && <p>Loading the official YouTube player…</p>}{error && <p role="alert" data-testid="youtube-error">{error}</p>}<small>YouTube controls provide playback; its audio is not readable by this analyzer.</small></div>;
  },
);
