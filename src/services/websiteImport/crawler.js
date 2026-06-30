/**
 * Domain-specific documentation crawlers.
 *
 * Architecture:
 *   WebsiteCrawler (base)
 *     ├── OracleCrawler           docs.oracle.com
 *     ├── MDNCrawler              developer.mozilla.org
 *     ├── MicrosoftLearnCrawler   learn.microsoft.com
 *     ├── SpringCrawler           spring.io / docs.spring.io
 *     ├── PythonDocsCrawler       docs.python.org
 *     ├── KubernetesCrawler       kubernetes.io
 *     ├── GitBookCrawler          GitBook-based sites
 *     └── GenericCrawler          fallback
 *
 * getCrawler(url) returns the correct crawler instance.
 * discoverDocumentation(url) is the public entry point (backward-compatible).
 */

import { fetchViaProxy } from './proxyApi.js';

// ---------------------------------------------------------------------------
// Error class (kept for backward compatibility)
// ---------------------------------------------------------------------------

export class WebsiteImportError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'WebsiteImportError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DEFAULT_MAX_PAGES = 120;

export const normalizeDocumentationUrl = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    throw new WebsiteImportError('INVALID_URL', 'Enter a documentation URL first.');
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new WebsiteImportError('INVALID_URL', 'This is not a valid URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new WebsiteImportError('INVALID_URL', 'Only http and https URLs are supported.');
  }

  url.hash = '';
  return url;
};

const isIgnoredHref = (href) => {
  const v = String(href || '').trim().toLowerCase();
  return (
    !v ||
    v.startsWith('#') ||
    v.startsWith('mailto:') ||
    v.startsWith('tel:') ||
    v.startsWith('javascript:') ||
    /\.(pdf|png|jpe?g|gif|webp|svg|css|js|zip|tar|gz|mp4|mp3|avi|mov|woff2?|ttf|eot)$/i.test(v) ||
    /(?:login|signin|sign-in|signup|sign-up|search|feedback|download|print|license|copyright|privacy|terms|contact|about|blog|careers|press)/i.test(v)
  );
};

const resolveUrl = (base, href) => {
  if (isIgnoredHref(href)) return null;
  try {
    const url = new URL(href, base);
    url.hash = '';
    return url;
  } catch {
    return null;
  }
};

const getDocTitle = (doc, fallbackUrl) => {
  const heading = doc.querySelector('main h1, article h1, h1, title')?.textContent;
  const fallback = fallbackUrl.pathname.split('/').filter(Boolean).pop() || fallbackUrl.hostname;
  return String(heading || fallback).replace(/\s+/g, ' ').trim();
};

const getLinkTitle = (anchor, url) => {
  const label =
    anchor?.textContent ||
    anchor?.getAttribute?.('aria-label') ||
    anchor?.getAttribute?.('title') ||
    '';
  const cleaned = String(label).replace(/\s+/g, ' ').trim();
  if (cleaned) return cleaned;
  return url.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || url.href;
};

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

export class WebsiteCrawler {
  constructor() {
    this.parser = new DOMParser();
    this.maxPages = DEFAULT_MAX_PAGES;
  }

  /**
   * Fetch HTML through the CORS proxy.
   * @param {string} url
   * @returns {Promise<string>}
   */
  async fetchHtml(url) {
    try {
      return await fetchViaProxy(url);
    } catch (err) {
      if (err?.code === 'DOMAIN_NOT_ALLOWED') {
        throw new WebsiteImportError('DOMAIN_NOT_ALLOWED', err.message, err);
      }
      throw new WebsiteImportError(
        'FETCH_FAILED',
        `Could not fetch: ${url}. ${err.message || ''}`,
        err,
      );
    }
  }

  /**
   * Parse HTML string into a DOM Document.
   */
  parseHtml(html) {
    return this.parser.parseFromString(html, 'text/html');
  }

  /**
   * Get the scope prefix for limiting crawl to related pages.
   */
  getScopePrefix(url) {
    const path = url.pathname.endsWith('/')
      ? url.pathname
      : url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    return `${url.origin}${path}`;
  }

  /**
   * Check if a candidate URL is within the documentation scope.
   */
  isInScope(candidate, startUrl, scopePrefix) {
    return candidate.origin === startUrl.origin && candidate.href.startsWith(scopePrefix);
  }

  /**
   * Extract navigation/TOC containers from a document.
   * Subclasses should override for domain-specific selectors.
   */
  getTocContainers(doc) {
    const selectors = [
      'nav', '[role="navigation"]',
      '.toc', '#toc', '.table-of-contents',
      '.sidebar', '#sidebar', '.sidenav',
      '.contents', 'main', 'article',
    ];
    const containers = selectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }

  /**
   * Extract links from the page that are within scope.
   */
  extractLinks(doc, pageUrl, startUrl, scopePrefix) {
    const links = [];
    const seen = new Set();
    const containers = this.getTocContainers(doc);

    for (const container of containers) {
      for (const anchor of container.querySelectorAll('a[href]')) {
        const nextUrl = resolveUrl(pageUrl, anchor.getAttribute('href'));
        if (!nextUrl || !this.isInScope(nextUrl, startUrl, scopePrefix)) continue;
        if (seen.has(nextUrl.href)) continue;
        seen.add(nextUrl.href);

        links.push({
          id: nextUrl.href,
          key: nextUrl.href,
          title: getLinkTitle(anchor, nextUrl),
          url: nextUrl.href,
          selected: true,
          children: [],
        });
      }
    }

    return links;
  }

  /**
   * Analyze a documentation URL: fetch index, discover pages.
   * @param {string} rawUrl
   * @returns {Promise<{ sourceUrl: string, title: string, pages: Array }>}
   */
  async analyze(rawUrl) {
    const startUrl = normalizeDocumentationUrl(rawUrl);
    const scopePrefix = this.getScopePrefix(startUrl);
    const visited = new Set();
    const discovered = new Map();

    // Fetch the entry page
    const html = await this.fetchHtml(startUrl.href);
    const doc = this.parseHtml(html);
    visited.add(startUrl.href);

    // Get the pages from TOC
    const tocPages = this.getPages(doc, startUrl, scopePrefix);

    // Add entry page itself if it has content
    if (!discovered.has(startUrl.href)) {
      discovered.set(startUrl.href, {
        id: startUrl.href,
        key: startUrl.href,
        title: getDocTitle(doc, startUrl),
        url: startUrl.href,
        selected: true,
        children: [],
      });
    }

    // Add all TOC pages
    for (const page of tocPages) {
      if (discovered.size >= this.maxPages) break;
      if (!discovered.has(page.url)) {
        discovered.set(page.url, page);
      }
    }

    const pages = Array.from(discovered.values());
    if (!pages.length) {
      throw new WebsiteImportError('NO_PAGES', 'No documentation pages were found for this URL.');
    }

    return {
      sourceUrl: startUrl.href,
      title: pages[0]?.title || startUrl.hostname,
      pages,
    };
  }

  /**
   * Extract page list from the index document.
   * Subclasses should override for domain-specific TOC parsing.
   */
  getPages(doc, startUrl, scopePrefix) {
    return this.extractLinks(doc, startUrl.href, startUrl, scopePrefix);
  }

  /**
   * Fetch a single page's HTML for content extraction.
   * @param {string} url
   * @returns {Promise<string>}
   */
  async extractPage(url) {
    return this.fetchHtml(url);
  }
}

// ---------------------------------------------------------------------------
// Oracle Crawler — docs.oracle.com
// ---------------------------------------------------------------------------

export class OracleCrawler extends WebsiteCrawler {
  getTocContainers(doc) {
    // Oracle JVM/JLS specs use a specific structure
    const oracleSelectors = [
      '.toc', '#toc',
      'div.toc', 'ul.toc',
      '.table-of-contents',
      'nav', '[role="navigation"]',
      'body', // Oracle spec pages often have links in body directly
    ];
    const containers = oracleSelectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }

  getPages(doc, startUrl, scopePrefix) {
    // Oracle specs typically list chapters as simple anchor links
    const pages = this.extractLinks(doc, startUrl.href, startUrl, scopePrefix);

    // Sort by natural chapter order (ch1, ch2, ...) if filenames follow pattern
    return pages.sort((a, b) => {
      const numA = a.url.match(/jvms-(\d+)/)?.[1] || a.url.match(/ch(\d+)/)?.[1] || '0';
      const numB = b.url.match(/jvms-(\d+)/)?.[1] || b.url.match(/ch(\d+)/)?.[1] || '0';
      return parseInt(numA, 10) - parseInt(numB, 10);
    });
  }
}

// ---------------------------------------------------------------------------
// MDN Crawler — developer.mozilla.org
// ---------------------------------------------------------------------------

export class MDNCrawler extends WebsiteCrawler {
  getTocContainers(doc) {
    const mdnSelectors = [
      '.sidebar-body', '.sidebar',
      'nav.sidebar', 'aside.sidebar',
      '.document-toc', '.toc',
      'nav', '[role="navigation"]',
    ];
    const containers = mdnSelectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }

  isInScope(candidate, startUrl) {
    // MDN: same locale and path prefix
    return (
      candidate.origin === startUrl.origin &&
      candidate.pathname.startsWith(startUrl.pathname.split('/').slice(0, 4).join('/'))
    );
  }
}

// ---------------------------------------------------------------------------
// Microsoft Learn Crawler — learn.microsoft.com
// ---------------------------------------------------------------------------

export class MicrosoftLearnCrawler extends WebsiteCrawler {
  getTocContainers(doc) {
    const msSelectors = [
      '#affixed-left-container',
      '.doc-outline', '.doc-outline-panel',
      'nav#side-doc-outline',
      'nav.doc-outline',
      '#left-container',
      'nav', '[role="navigation"]',
      '.toc', '#toc',
    ];
    const containers = msSelectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }

  isInScope(candidate, startUrl) {
    // Microsoft Learn: same locale and product path
    const startParts = startUrl.pathname.split('/').filter(Boolean);
    const candidateParts = candidate.pathname.split('/').filter(Boolean);
    // Match at least the first 2 path segments (locale + product area)
    return (
      candidate.origin === startUrl.origin &&
      candidateParts.length >= 2 &&
      candidateParts[0] === startParts[0] &&
      candidateParts[1] === startParts[1]
    );
  }
}

// ---------------------------------------------------------------------------
// Spring Crawler — spring.io / docs.spring.io
// ---------------------------------------------------------------------------

export class SpringCrawler extends WebsiteCrawler {
  getTocContainers(doc) {
    const springSelectors = [
      '.book-toc', '.toc',
      'nav.toc', '#toc',
      '.nav-container', '.doc-nav',
      'nav', '[role="navigation"]',
    ];
    const containers = springSelectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }
}

// ---------------------------------------------------------------------------
// Python Docs Crawler — docs.python.org
// ---------------------------------------------------------------------------

export class PythonDocsCrawler extends WebsiteCrawler {
  getTocContainers(doc) {
    const pySelectors = [
      '.sphinxsidebarwrapper',
      '.sphinxsidebar',
      'div.toctree-wrapper',
      '.toc', '#toc',
      'nav', '[role="navigation"]',
    ];
    const containers = pySelectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }

  isInScope(candidate, startUrl) {
    // Python docs: same version path
    const startSegments = startUrl.pathname.split('/').filter(Boolean);
    const candSegments = candidate.pathname.split('/').filter(Boolean);
    // Match version (e.g., /3/ or /3.12/)
    return (
      candidate.origin === startUrl.origin &&
      candSegments.length >= 1 &&
      candSegments[0] === startSegments[0]
    );
  }
}

// ---------------------------------------------------------------------------
// Kubernetes Crawler — kubernetes.io
// ---------------------------------------------------------------------------

export class KubernetesCrawler extends WebsiteCrawler {
  getTocContainers(doc) {
    const k8sSelectors = [
      '.td-sidebar-nav', '.td-sidebar',
      '#docsToc', '.docs-toc',
      'nav', '[role="navigation"]',
    ];
    const containers = k8sSelectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }

  isInScope(candidate, startUrl) {
    // Kubernetes: match /docs/ prefix
    return (
      candidate.origin === startUrl.origin &&
      candidate.pathname.startsWith('/docs/')
    );
  }
}

// ---------------------------------------------------------------------------
// GitBook Crawler — generic GitBook-based documentation
// ---------------------------------------------------------------------------

export class GitBookCrawler extends WebsiteCrawler {
  getTocContainers(doc) {
    const gitbookSelectors = [
      'nav.gitbook-root',
      '[data-testid="table-of-contents"]',
      '.sidebar', '.page-inner',
      'nav', '[role="navigation"]',
    ];
    const containers = gitbookSelectors.flatMap((s) => {
      try { return Array.from(doc.querySelectorAll(s)); } catch { return []; }
    });
    return containers.length ? containers : [doc.body].filter(Boolean);
  }
}

// ---------------------------------------------------------------------------
// Generic Crawler — fallback for unknown domains
// ---------------------------------------------------------------------------

export class GenericCrawler extends WebsiteCrawler {
  // Uses all base class defaults
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const CRAWLER_MAP = [
  { test: (h) => h === 'docs.oracle.com', Crawler: OracleCrawler },
  { test: (h) => h === 'developer.mozilla.org', Crawler: MDNCrawler },
  { test: (h) => h === 'learn.microsoft.com', Crawler: MicrosoftLearnCrawler },
  { test: (h) => h === 'spring.io' || h.endsWith('.spring.io'), Crawler: SpringCrawler },
  { test: (h) => h === 'docs.python.org', Crawler: PythonDocsCrawler },
  { test: (h) => h === 'kubernetes.io' || h.endsWith('.kubernetes.io'), Crawler: KubernetesCrawler },
  { test: (h) => h.includes('gitbook'), Crawler: GitBookCrawler },
];

/**
 * Return the correct crawler for a given URL.
 * @param {string} rawUrl
 * @returns {WebsiteCrawler}
 */
export function getCrawler(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const match = CRAWLER_MAP.find((entry) => entry.test(url.hostname));
    return match ? new match.Crawler() : new GenericCrawler();
  } catch {
    return new GenericCrawler();
  }
}

/**
 * Public entry point — backward-compatible with existing hook.
 *
 * @param {string} rawUrl
 * @param {object} [options]
 * @returns {Promise<{ sourceUrl: string, title: string, pages: Array }>}
 */
export async function discoverDocumentation(rawUrl, options = {}) {
  const crawler = getCrawler(rawUrl);
  if (options.maxPages) crawler.maxPages = options.maxPages;
  return crawler.analyze(rawUrl);
}
