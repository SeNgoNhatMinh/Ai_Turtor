const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (VIDEO_ID.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/\//g, '');
      return VIDEO_ID.test(id) ? id : '';
    }
    if (!host.endsWith('youtube.com') && !host.endsWith('youtube-nocookie.com')) {
      return '';
    }
    const fromQuery = url.searchParams.get('v');
    if (fromQuery && VIDEO_ID.test(fromQuery)) return fromQuery;
    const match = url.pathname.match(/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

export function youtubeEmbedUrl(rawUrl, options = {}) {
  const id = youtubeVideoId(rawUrl);
  if (!id) return '';
  const params = new URLSearchParams();
  if (options.locked) {
    params.set('controls', '0');
    params.set('disablekb', '1');
    params.set('fs', '0');
    params.set('modestbranding', '1');
    params.set('rel', '0');
    params.set('playsinline', '1');
    params.set('autoplay', options.autoplay === false ? '0' : '1');
    params.set('mute', '0');
    const start = Math.max(0, Number(options.startSeconds) || 0);
    if (start > 0) params.set('start', String(Math.floor(start)));
  }
  const query = params.toString();
  return query ? `https://www.youtube.com/embed/${id}?${query}` : `https://www.youtube.com/embed/${id}`;
}

export function youtubeWatchUrl(rawUrl) {
  const id = youtubeVideoId(rawUrl);
  return id ? `https://www.youtube.com/watch?v=${id}` : String(rawUrl || '').trim();
}
