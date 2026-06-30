const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

function sanitizeUrl(value, allowedProtocols) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('#') || raw.startsWith('/')) {
    return raw;
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(raw, baseUrl);
    return allowedProtocols.has(parsed.protocol) ? raw : '';
  } catch {
    return '';
  }
}

export function sanitizeLinkUrl(value) {
  return sanitizeUrl(value, SAFE_LINK_PROTOCOLS);
}

export function sanitizeImageUrl(value) {
  return sanitizeUrl(value, SAFE_IMAGE_PROTOCOLS);
}
