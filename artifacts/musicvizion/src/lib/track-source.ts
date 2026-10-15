export type TrackSource = { kind: 'direct' | 'youtube' | 'spotify' | 'suno'; url: string; embed: string; videoId: string };
export function parseTrackSource(raw: string): TrackSource {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Use an HTTPS public link or choose a local audio file.');
  const host = url.hostname.toLowerCase();
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(host)) {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('This YouTube link needs a valid video ID.');
    return { kind: 'youtube', url: url.href, embed: '', videoId: id };
  }
  if (['suno.com', 'www.suno.com', 'suno.ai', 'www.suno.ai'].includes(host)) {
    return { kind: 'suno', url: url.href, embed: '', videoId: '' };
  }
  if (['open.spotify.com'].includes(host)) {
    const match = url.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)\/?$/);
    if (!match) throw new Error('Use a public Spotify track, album, or playlist URL.');
    return { kind: 'spotify', url: url.href, embed: `https://open.spotify.com/embed/${match[1]}/${match[2]}`, videoId: '' };
  }
  return { kind: 'direct', url: url.href, embed: '', videoId: '' };
}
