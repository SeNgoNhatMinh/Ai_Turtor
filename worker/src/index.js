/**
 * Cloudflare Worker — Documentation CORS Proxy
 *
 * GET /proxy?url=<encoded-url>
 *
 * - Validates URL (https only)
 * - Whitelists specific documentation domains
 * - Fetches HTML only (rejects non-HTML responses)
 * - Returns raw HTML with CORS headers
 * - Caches successful responses for 1 hour
 * - 15-second fetch timeout
 */

const ALLOWED_HOSTS = new Set([
  'docs.oracle.com',
  'developer.mozilla.org',
  'learn.microsoft.com',
  'spring.io',
  'docs.spring.io',
  'docs.python.org',
  'kubernetes.io',
]);

const FETCH_TIMEOUT_MS = 15_000;
const CACHE_MAX_AGE = 3600; // 1 hour

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function htmlResponse(html, extraHeaders = {}) {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function isAllowedHost(hostname) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  // Allow subdomains of whitelisted domains (e.g. docs.spring.io)
  for (const allowed of ALLOWED_HOSTS) {
    if (hostname.endsWith(`.${allowed}`)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

async function handleProxy(request) {
  const requestUrl = new URL(request.url);
  const targetParam = requestUrl.searchParams.get('url');

  // --- Validate URL parameter ---
  if (!targetParam) {
    return jsonResponse(
      { error: 'Missing required "url" query parameter.' },
      400,
    );
  }

  let targetUrl;
  try {
    targetUrl = new URL(targetParam);
  } catch {
    return jsonResponse({ error: 'Invalid URL format.' }, 400);
  }

  if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
    return jsonResponse(
      { error: 'Only http and https URLs are supported.' },
      400,
    );
  }

  // --- Domain whitelist ---
  if (!isAllowedHost(targetUrl.hostname)) {
    return jsonResponse(
      {
        error: `Domain "${targetUrl.hostname}" is not in the allowed list.`,
        allowed: Array.from(ALLOWED_HOSTS),
      },
      403,
    );
  }

  // --- Check cache first ---
  const cache = caches.default;
  const cacheKey = new Request(targetUrl.href, { method: 'GET' });
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    // Return cached response with CORS headers
    const headers = new Headers(cachedResponse.headers);
    Object.entries(CORS_HEADERS).forEach(([key, value]) =>
      headers.set(key, value),
    );
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      headers,
    });
  }

  // --- Fetch with timeout ---
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(targetUrl.href, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DocsProxy/1.0; +https://github.com/ai-tutor)',
        Accept: 'text/html, application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return jsonResponse(
        { error: 'Upstream request timed out after 15 seconds.' },
        504,
      );
    }
    return jsonResponse(
      { error: 'Failed to fetch the target URL.', details: err.message },
      502,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return jsonResponse(
      {
        error: `Upstream returned HTTP ${response.status}.`,
        status: response.status,
      },
      502,
    );
  }

  // --- Validate content type ---
  const contentType = response.headers.get('content-type') || '';
  if (
    !contentType.includes('text/html') &&
    !contentType.includes('application/xhtml')
  ) {
    return jsonResponse(
      {
        error: 'The target URL did not return HTML content.',
        contentType,
      },
      400,
    );
  }

  // --- Return HTML ---
  const html = await response.text();
  const proxyResponse = htmlResponse(html);

  // Store in cache (non-blocking)
  const cacheableResponse = proxyResponse.clone();
  request.ctx?.waitUntil?.(cache.put(cacheKey, cacheableResponse));

  return proxyResponse;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    // Attach ctx for cache waitUntil
    request.ctx = ctx;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed. Use GET.' }, 405);
    }

    const url = new URL(request.url);

    // Route: /proxy
    if (url.pathname === '/proxy' || url.pathname === '/proxy/') {
      return handleProxy(request);
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'docs-cors-proxy',
        allowedDomains: Array.from(ALLOWED_HOSTS),
      });
    }

    // Suppress browser favicon requests
    if (url.pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    return jsonResponse({ error: 'Not found.' }, 404);
  },
};
