import { describe, expect, it } from 'vitest';
import {
  htmlToPlainText,
  isRichTextEmpty,
  looksLikeRichHtml,
  sanitizeRichHtml,
} from '../../src/utils/richText';

describe('richText', () => {
  it('treats empty editor markup as empty', () => {
    expect(isRichTextEmpty('')).toBe(true);
    expect(isRichTextEmpty('<p><br></p>')).toBe(true);
    expect(isRichTextEmpty('<p>   </p>')).toBe(true);
    expect(isRichTextEmpty('<p>Xin chào</p>')).toBe(false);
  });

  it('keeps readable text from formatted html', () => {
    expect(htmlToPlainText('<p>Bước 1</p><p>Bước 2</p>')).toContain('Bước 1');
    expect(htmlToPlainText('<p>Bước 1</p><p>Bước 2</p>')).toContain('Bước 2');
  });

  it('recognizes teacher rich-text markup only', () => {
    expect(looksLikeRichHtml('<p><strong>Đáp án</strong></p>')).toBe(true);
    expect(looksLikeRichHtml('Dùng toán tử < 3 trong vòng lặp')).toBe(false);
  });

  it('strips scripts and unsafe links', () => {
    const clean = sanitizeRichHtml(
      '<p>An toàn</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://example.com">ok</a>',
    );
    expect(clean).toContain('An toàn');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('https://example.com');
  });
});
