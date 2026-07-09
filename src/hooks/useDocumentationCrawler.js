/**
 * Compatibility hook for the removed browser crawler.
 *
 * Website imports now use the backend Jsoup flow:
 * 1. POST /courses/{courseId}/materials/url-toc
 * 2. POST /courses/{courseId}/materials/import-url
 */
export function useDocumentationCrawler() {
  const disabledMessage = 'Frontend documentation crawling was removed. Use backend URL TOC/import endpoints instead.';

  return {
    pages: [],
    selectedPages: [],
    checkedKeys: [],
    progress: { step: 0, percent: 0, message: disabledMessage },
    isAnalyzing: false,
    error: null,
    documentTitle: '',
    setCheckedKeys: () => {},
    reset: () => {},
    cancelImport: () => {},
    analyze: async () => {
      throw new Error(disabledMessage);
    },
    importSelected: async () => {
      throw new Error(disabledMessage);
    },
  };
}
