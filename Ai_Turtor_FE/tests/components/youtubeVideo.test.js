import { describe, expect, it } from 'vitest';
import { youtubeEmbedUrl, youtubeVideoId } from '../../src/utils/youtubeVideo';

describe('youtubeVideo', () => {
  it('parses watch, share and embed urls', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', { locked: true, startSeconds: 75 }))
      .toContain('controls=0');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', { locked: true, startSeconds: 75 }))
      .toContain('start=75');
  });

  it('rejects non-youtube urls', () => {
    expect(youtubeVideoId('https://vimeo.com/123')).toBe('');
  });
});
