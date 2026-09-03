import { useDeferredValue, useMemo, useState } from 'react';
import { normalizeSearchText } from '../utils/searchText.js';

const EMPTY_SEARCH_KEYS = Object.freeze([]);

function getNestedValue(record, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], record);
}

function collectPrimitiveValues(value, depth = 0) {
  if (value == null || depth > 3) return [];
  if (['string', 'number', 'boolean'].includes(typeof value)) return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectPrimitiveValues(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value).flatMap((item) => collectPrimitiveValues(item, depth + 1));
  }
  return [];
}

export function matchesCollectionQuery(record, query, searchKeys = []) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const values = searchKeys.length
    ? searchKeys.flatMap((key) => collectPrimitiveValues(getNestedValue(record, key)))
    : collectPrimitiveValues(record);
  return normalizeSearchText(values.join(' ')).includes(normalizedQuery);
}

export function useCollectionView(items, {
  initialPageSize = 20,
  pageSizeOptions = [10, 20, 50],
  searchKeys = EMPTY_SEARCH_KEYS,
} = {}) {
  const [query, setQueryState] = useState('');
  const [pageIndex, setPageIndexState] = useState(0);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const deferredQuery = useDeferredValue(query);
  const searchKeySignature = (Array.isArray(searchKeys) ? searchKeys : EMPTY_SEARCH_KEYS).join('\u0000');
  const stableSearchKeys = useMemo(
    () => (searchKeySignature ? searchKeySignature.split('\u0000') : EMPTY_SEARCH_KEYS),
    [searchKeySignature],
  );

  const filteredItems = useMemo(() => (
    deferredQuery
      ? safeItems.filter((record) => matchesCollectionQuery(record, deferredQuery, stableSearchKeys))
      : safeItems
  ), [deferredQuery, safeItems, stableSearchKeys]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / safePageSize));
  const resolvedPageIndex = Math.min(pageIndex, pageCount - 1);
  const startIndex = resolvedPageIndex * safePageSize;
  const visibleItems = filteredItems.slice(startIndex, startIndex + safePageSize);

  const setQuery = (value) => {
    setQueryState(String(value || ''));
    setPageIndexState(0);
  };

  const setPageIndex = (value) => {
    const next = Math.max(0, Math.min(pageCount - 1, Number(value) || 0));
    setPageIndexState(next);
  };

  const setPageSize = (value) => {
    setPageSizeState(Math.max(1, Number(value) || initialPageSize));
    setPageIndexState(0);
  };

  return {
    query,
    setQuery,
    pageIndex: resolvedPageIndex,
    setPageIndex,
    pageSize: safePageSize,
    setPageSize,
    pageSizeOptions,
    pageCount,
    totalCount: safeItems.length,
    filteredCount: filteredItems.length,
    visibleItems,
    rangeStart: filteredItems.length ? startIndex + 1 : 0,
    rangeEnd: Math.min(startIndex + safePageSize, filteredItems.length),
  };
}
