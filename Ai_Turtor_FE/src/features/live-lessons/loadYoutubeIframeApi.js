let loading;

export function loadYoutubeIframeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API requires a browser'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } catch {
        // Ignore a previous page hook that throws.
      }
      resolve(window.YT);
    };
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('Không tải được YouTube player'));
      document.head.appendChild(script);
    }
  });
  return loading;
}
