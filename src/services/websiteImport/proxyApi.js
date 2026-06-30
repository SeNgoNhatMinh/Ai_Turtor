/**
 * Proxy API — calls the Cloudflare Worker CORS proxy to fetch HTML
 * from documentation websites that block browser CORS requests.
 */

const PROXY_TIMEOUT_MS = 20_000;

const getProxyBaseUrl = () => {
  const url = import.meta.env.VITE_CORS_PROXY_URL || '';
  return url.replace(/\/+$/, '');
};

export class ProxyError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Fetch an HTML page through the CORS proxy worker.
 *
 * @param {string} targetUrl — the full URL of the documentation page
 * @returns {Promise<string>} — raw HTML string
 */
export async function fetchViaProxy(targetUrl) {
  const proxyBase = getProxyBaseUrl();
  const endpoints = [];

  // 1. Primary: Custom Cloudflare worker (if configured)
  if (proxyBase) {
    endpoints.push(`${proxyBase}/proxy?url=${encodeURIComponent(targetUrl)}`);
  }

  // 2. Fallback: allorigins.win (Extremely reliable for bypassing WAF)
  endpoints.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
  
  // 3. Fallback: corsproxy.io
  endpoints.push(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
  
  // 4. Fallback: codetabs proxy
  endpoints.push(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);

  let lastError = null;

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'omit',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Proxy returned HTTP ${response.status}`);
      }

      const text = await response.text();

      // Check for WAF blocks disguised as HTTP 200 (Akamai/Cloudflare Captcha pages)
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes('access denied') ||
        lowerText.includes('403 forbidden') ||
        lowerText.includes('please enable cookies') ||
        lowerText.includes('captcha')
      ) {
        // Only consider it a block if the page is suspiciously small, or clearly a block page
        if (text.length < 50000) {
          throw new Error('Blocked by WAF Captcha/Access Denied');
        }
      }

      // Success! Found a proxy that wasn't blocked.
      return text;
    } catch (err) {
      lastError = err;
      // Silently swallow error and try the next proxy in the list
      console.warn(`Proxy failed: ${endpoint}`, err.message);
    } finally {
      clearTimeout(timer);
    }
  }

  // If all proxies failed
  throw new ProxyError(
    'NETWORK_ERROR',
    'All proxy crawl methods were blocked by the documentation website. The site has extremely strict anti-bot protections.',
    lastError
  );
}
