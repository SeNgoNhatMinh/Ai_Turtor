/**
 * useCrawler — React hook for the full documentation import workflow.
 *
 * Analyze → Select chapters → Download → Convert → Merge → Upload
 *
 * Exposes granular progress state for the UI.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { discoverDocumentation, getCrawler, WebsiteImportError } from '../services/websiteImport/crawler.js';
import { extractPageMarkdown } from '../services/websiteImport/extractor.js';
import { uploadDocumentationMarkdown } from '../services/websiteImport/upload.js';

// ---------------------------------------------------------------------------
// Progress step constants
// ---------------------------------------------------------------------------

export const IMPORT_STEPS = [
  'Analyzing documentation',
  'Discovering chapters',
  'Downloading pages',
  'Converting to Markdown',
  'Generating PDF',
  'Uploading to backend',
  'Completed',
];

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

const toUserMessage = (error) => {
  if (error instanceof WebsiteImportError) return error.message;
  return error?.message || 'Unable to process this documentation website.';
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCrawler() {
  // Analysis state
  const [sourceUrl, setSourceUrl] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [pages, setPages] = useState([]);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Import progress state
  const [progress, setProgress] = useState({
    step: 0,
    percent: 0,
    message: '',
    isRunning: false,
    currentPage: '',
  });

  // Cancel support
  const cancelledRef = useRef(false);

  // Derived: selected pages
  const selectedPages = useMemo(
    () => pages.filter((page) => checkedKeys.includes(page.key)),
    [pages, checkedKeys],
  );

  // ---------------------------------------------------------------------------
  // Analyze
  // ---------------------------------------------------------------------------

  const analyze = useCallback(async (url) => {
    setIsAnalyzing(true);
    setError('');
    setPages([]);
    setCheckedKeys([]);

    setProgress({
      step: 0,
      percent: 5,
      message: 'Connecting to documentation site via proxy...',
      isRunning: true,
      currentPage: '',
    });

    try {
      const result = await discoverDocumentation(url);

      setSourceUrl(result.sourceUrl);
      setDocumentTitle(result.title);
      setPages(result.pages);
      setCheckedKeys(result.pages.map((p) => p.key));

      setProgress({
        step: 1,
        percent: 100,
        message: `Found ${result.pages.length} documentation pages.`,
        isRunning: false,
        currentPage: '',
      });

      return result;
    } catch (err) {
      const message = toUserMessage(err);
      setError(message);
      setProgress((prev) => ({ ...prev, isRunning: false, message }));
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Full import workflow: download → convert → merge → upload
  // ---------------------------------------------------------------------------

  const importSelected = useCallback(async ({ courseId, title, apiService, currentUser, onSuccess }) => {
    if (!selectedPages.length) {
      setError('Select at least one documentation page.');
      return;
    }

    cancelledRef.current = false;
    setError('');

    const crawler = getCrawler(sourceUrl);
    const totalPages = selectedPages.length;
    const extractedPages = [];

    try {
      // Helper to delay requests and prevent WAF blocks
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Step 2: Download + extract
      for (let i = 0; i < totalPages; i++) {
        if (cancelledRef.current) {
          setProgress((prev) => ({ ...prev, isRunning: false, message: 'Import cancelled.' }));
          return;
        }

        const page = selectedPages[i];
        const downloadPercent = 10 + Math.round((i / totalPages) * 40);

        setProgress({
          step: 2,
          percent: downloadPercent,
          message: `Downloading page ${i + 1} of ${totalPages}...`,
          isRunning: true,
          currentPage: page.title,
        });

        // Add a 1.5s delay between requests to prevent Oracle WAF / Rate Limiting (403/429)
        // If we hit it too fast, only the first page succeeds and the rest return blank errors.
        if (i > 0) {
          await delay(1500);
        }

        const extracted = await extractPageMarkdown(page, { crawler });
        extractedPages.push(extracted);

        setProgress({
          step: 3,
          percent: 10 + Math.round(((i + 1) / totalPages) * 45),
          message: `Converted ${i + 1} of ${totalPages} pages to Markdown.`,
          isRunning: true,
          currentPage: page.title,
        });
      }

      if (cancelledRef.current) {
        setProgress((prev) => ({ ...prev, isRunning: false, message: 'Import cancelled.' }));
        return;
      }

      // Step 4: Generate PDF
      setProgress({
        step: 4,
        percent: 60,
        message: 'Generating PDF from extracted content...',
        isRunning: true,
        currentPage: '',
      });

      if (cancelledRef.current) {
        setProgress((prev) => ({ ...prev, isRunning: false, message: 'Import cancelled.' }));
        return;
      }

      // Step 5: Upload PDF
      setProgress({
        step: 5,
        percent: 80,
        message: 'Uploading PDF to backend for indexing...',
        isRunning: true,
        currentPage: '',
      });

      await uploadDocumentationMarkdown({
        apiService,
        courseId,
        title: title || documentTitle,
        sourceUrl,
        pages: extractedPages,
        currentUser,
      });

      // Step 6: Done
      setProgress({
        step: 6,
        percent: 100,
        message: 'Import complete! Backend is now chunking and embedding the content.',
        isRunning: false,
        currentPage: '',
      });

      await onSuccess?.(title || documentTitle);
    } catch (err) {
      if (cancelledRef.current) return;
      const message = toUserMessage(err);
      setError(message);
      setProgress((prev) => ({
        ...prev,
        isRunning: false,
        message: `Import failed: ${message}`,
      }));
      throw err;
    }
  }, [selectedPages, sourceUrl, documentTitle]);

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------

  const cancelImport = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setSourceUrl('');
    setDocumentTitle('');
    setPages([]);
    setCheckedKeys([]);
    setError('');
    setIsAnalyzing(false);
    setProgress({ step: 0, percent: 0, message: '', isRunning: false, currentPage: '' });
  }, []);

  const selectAll = useCallback(() => {
    setCheckedKeys(pages.map((p) => p.key));
  }, [pages]);

  const clearSelection = useCallback(() => {
    setCheckedKeys([]);
  }, []);

  return {
    // Analysis
    sourceUrl,
    documentTitle,
    setDocumentTitle,
    pages,
    checkedKeys,
    setCheckedKeys,
    selectedPages,
    isAnalyzing,
    error,
    setError,
    analyze,

    // Import
    progress,
    importSelected,
    cancelImport,

    // Controls
    reset,
    selectAll,
    clearSelection,
  };
}
