import { sanitizeLinkUrl } from './markdownSecurity';

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3',
  'i', 'li', 'ol', 'p', 'pre', 's', 'span', 'strike', 'strong', 'u', 'ul',
]);
const REMOVE_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form']);
const ALLOWED_ATTRS = {
  a: new Set(['href', 'rel', 'target']),
};
const RICH_TAG_PATTERN = /<\/?(?:p|br|b|strong|i|em|u|s|strike|ul|ol|li|h[1-3]|blockquote|pre|code|a|div)\b/i;

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

export function htmlToPlainText(html) {
  return decodeBasicEntities(String(html || ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-3]|blockquote|pre|ol|ul)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function isRichTextEmpty(html) {
  return !htmlToPlainText(html);
}

export function looksLikeRichHtml(value) {
  return RICH_TAG_PATTERN.test(String(value || ''));
}

function sanitizeHref(value) {
  const safe = sanitizeLinkUrl(value);
  if (!safe) return '';
  const lower = safe.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '';
  return safe;
}

function sanitizeElement(element) {
  const tag = element.tagName.toLowerCase();
  if (REMOVE_TAGS.has(tag)) {
    element.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const children = [...element.childNodes];
    const parent = element.parentNode;
    children.forEach((child) => parent.insertBefore(child, element));
    element.remove();
    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) sanitizeElement(child);
    });
    return;
  }

  [...element.attributes].forEach((attr) => {
    const name = attr.name.toLowerCase();
    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed || !allowed.has(name)) {
      element.removeAttribute(attr.name);
    }
  });

  if (tag === 'a') {
    const href = sanitizeHref(element.getAttribute('href'));
    if (href) {
      element.setAttribute('href', href);
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    } else {
      element.removeAttribute('href');
      element.removeAttribute('target');
      element.removeAttribute('rel');
    }
  }

  [...element.childNodes].forEach((child) => {
    if (child.nodeType === Node.COMMENT_NODE) child.remove();
    if (child.nodeType === Node.ELEMENT_NODE) sanitizeElement(child);
  });
}

export function sanitizeRichHtml(html) {
  const raw = String(html || '');
  if (!raw.trim() || typeof document === 'undefined') return raw;
  const template = document.createElement('template');
  template.innerHTML = raw;
  [...template.content.childNodes].forEach((child) => {
    if (child.nodeType === Node.COMMENT_NODE) child.remove();
    if (child.nodeType === Node.ELEMENT_NODE) sanitizeElement(child);
  });
  return template.innerHTML;
}
