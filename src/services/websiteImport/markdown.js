/**
 * Markdown conversion and merging utilities.
 *
 * Uses @mozilla/readability for content extraction and
 * turndown for HTML-to-Markdown conversion.
 */

import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

// ---------------------------------------------------------------------------
// Selectors to strip before extraction
// ---------------------------------------------------------------------------

const REMOVE_SELECTORS = [
  'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
  'header', 'footer', 'nav', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.breadcrumb', '.breadcrumbs',
  '.search', '.search-box', '.search-container',
  '.advertisement', '.ads', '.ad',
  '.sidebar', '#sidebar',
  '.toc', '#toc', '.table-of-contents',
  '.feedback', '.page-actions', '.edit-page',
  '.cookie-banner', '.cookie-consent',
];

// ---------------------------------------------------------------------------
// Turndown setup
// ---------------------------------------------------------------------------

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function createTurndown() {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });

  // Fenced code blocks
  service.addRule('preCode', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_content, node) => {
      const codeEl = node.querySelector('code');
      const code = codeEl?.textContent || node.textContent || '';
      const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
      return `\n\n\`\`\`${lang}\n${code.replace(/\n+$/g, '')}\n\`\`\`\n\n`;
    },
  });

  // Tables → Markdown tables
  service.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const rows = Array.from(node.querySelectorAll('tr'))
        .map((row) =>
          Array.from(row.querySelectorAll('th,td')).map((cell) =>
            normalizeText(cell.textContent),
          ),
        )
        .filter((cells) => cells.length);

      if (!rows.length) return '';
      const columnCount = Math.max(...rows.map((r) => r.length));

      const pad = (row) => {
        const copy = [...row];
        while (copy.length < columnCount) copy.push('');
        return copy.map((cell) => cell.replace(/\|/g, '\\|'));
      };

      const header = pad(rows[0]);
      const body = rows.slice(1).map(pad);
      return [
        '',
        `| ${header.join(' | ')} |`,
        `| ${Array(columnCount).fill('---').join(' | ')} |`,
        ...body.map((row) => `| ${row.join(' | ')} |`),
        '',
      ].join('\n');
    },
  });

  // Links → text with URL in parentheses (no external linking in imported docs)
  service.addRule('linksAsText', {
    filter: 'a',
    replacement: (content, node) => {
      const label = normalizeText(content);
      const href = node.getAttribute('href');
      if (!href || !label) return label;
      return `${label} (${href})`;
    },
  });

  // Remove images to keep markdown clean
  service.addRule('removeImages', {
    filter: 'img',
    replacement: () => '',
  });

  return service;
}

// Singleton
let _turndown = null;
const getTurndown = () => {
  if (!_turndown) _turndown = createTurndown();
  return _turndown;
};

// ---------------------------------------------------------------------------
// Clean document before extraction
// ---------------------------------------------------------------------------

function cleanDocument(doc) {
  REMOVE_SELECTORS.forEach((selector) => {
    try {
      doc.querySelectorAll(selector).forEach((node) => node.remove());
    } catch {
      // Some selectors may be invalid in certain contexts
    }
  });
}

// ---------------------------------------------------------------------------
// Content extraction fallback
// ---------------------------------------------------------------------------

function getFallbackArticle(doc) {
  const candidate =
    doc.querySelector(
      'main, article, .content, #content, .documentation, .doc-content, .markdown-body',
    ) || doc.body;

  return {
    title:
      normalizeText(doc.querySelector('h1, title')?.textContent) ||
      'Documentation Page',
    content: candidate?.innerHTML || '',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an HTML string into clean Markdown.
 *
 * @param {string} html — raw HTML content
 * @param {string} [pageUrl] — optional base URL for resolving relative links
 * @returns {{ title: string, markdown: string }}
 */
export function convertToMarkdown(html, pageUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Set base URL for relative link resolution
  if (pageUrl) {
    const base = doc.createElement('base');
    base.href = pageUrl;
    doc.head.prepend(base);
  }

  cleanDocument(doc);

  // Try Readability first
  const readabilityDoc = doc.cloneNode(true);
  let article = null;
  try {
    article = new Readability(readabilityDoc).parse();
  } catch (err) {
    console.warn('Readability failed, using fallback extraction:', err);
  }

  const extracted = article?.content ? article : getFallbackArticle(doc);

  if (!extracted?.content || !normalizeText(extracted.content)) {
    return { title: 'Untitled', markdown: '' };
  }

  const turndown = getTurndown();
  const markdown = turndown
    .turndown(extracted.content)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    title: normalizeText(extracted.title) || 'Documentation Page',
    markdown,
  };
}

/**
 * Merge multiple page markdowns into one document.
 *
 * @param {{ title: string, sourceUrl: string, pages: Array<{ title: string, url: string, markdown: string }> }} opts
 * @returns {string}
 */
export function mergeMarkdown({ title, sourceUrl, pages }) {
  const header = [
    `# ${title || 'Imported Documentation'}`,
    '',
    `> Source: ${sourceUrl}`,
    '',
    '---',
    '',
  ].join('\n');

  const body = pages
    .map(
      (page, index) =>
        [
          `## ${index + 1}. ${page.title}`,
          '',
          `> Source: ${page.url}`,
          '',
          page.markdown,
        ].join('\n'),
    )
    .join('\n\n---\n\n');

  return `${header}${body}`;
}
