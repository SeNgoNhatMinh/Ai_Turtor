/**
 * Page content extractor — fetches individual pages and converts to Markdown.
 *
 * Uses the CORS proxy for fetching and the markdown module for conversion.
 */

import { getCrawler, WebsiteImportError } from './crawler.js';
import { convertToMarkdown, mergeMarkdown } from './markdown.js';

/**
 * Download a single page and convert its content to Markdown.
 *
 * @param {{ url: string, title: string }} page — page descriptor
 * @param {object} [options]
 * @returns {Promise<{ url: string, title: string, markdown: string }>}
 */
export const extractPageMarkdown = async (page, options = {}) => {
  // 1. Primary Method: Jina AI Reader
  // Jina executes JS, bypasses Cloudflare/Oracle WAFs, and returns clean Markdown.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const jinaResponse = await fetch(`https://r.jina.ai/${page.url}`, {
      headers: {
        'Accept': 'text/markdown',
        'X-Retain-Images': 'none' // Optimize for text/RAG
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (jinaResponse.ok) {
      const markdown = await jinaResponse.text();
      if (markdown && markdown.length > 50) {
        return {
          ...page,
          markdown,
        };
      }
    }
  } catch (err) {
    console.warn(`Jina AI Reader failed for ${page.url}, falling back to proxy`, err);
  }

  // 2. Fallback Method: Custom Proxy Rotation + Local Turndown Conversion
  const crawler = options.crawler || getCrawler(page.url);
  const html = await crawler.extractPage(page.url);

  const { title, markdown } = convertToMarkdown(html, page.url);

  if (!markdown) {
    throw new WebsiteImportError(
      'EXTRACT_FAILED',
      `Could not extract readable content from "${page.title}".`,
    );
  }

  return {
    ...page,
    title: title || page.title,
    markdown,
  };
};

/**
 * Merge multiple extracted pages into a single Markdown document.
 *
 * @param {{ title: string, sourceUrl: string, pages: Array<{ title: string, url: string, markdown: string }> }} opts
 * @returns {string}
 */
export const mergePagesMarkdown = ({ title, sourceUrl, pages }) => {
  return mergeMarkdown({ title, sourceUrl, pages });
};
