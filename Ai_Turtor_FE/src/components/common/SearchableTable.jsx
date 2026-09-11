import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Table } from 'antd';
import { matchesCollectionQuery } from '../../hooks/useCollectionView';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { CollectionSearch } from './CollectionControls';

const EMPTY_SEARCH_KEYS = [];

function SearchableTable({
  dataSource = [],
  searchKeys = EMPTY_SEARCH_KEYS,
  searchPlaceholder = 'Tìm trong bảng',
  searchable = true,
  scroll,
  sticky = true,
  serverPagination,
  onServerSearch,
  ...tableProps
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const debouncedServerQuery = useDebouncedValue(query, 300);
  const lastServerQueryRef = useRef('');

  const safeData = useMemo(() => (Array.isArray(dataSource) ? dataSource : []), [dataSource]);
  const searchKeySignature = (Array.isArray(searchKeys) ? searchKeys : EMPTY_SEARCH_KEYS).join('\u0000');
  const stableSearchKeys = useMemo(
    () => (searchKeySignature ? searchKeySignature.split('\u0000') : EMPTY_SEARCH_KEYS),
    [searchKeySignature],
  );
  const usesServerPagination = Boolean(serverPagination);
  const filteredData = useMemo(() => (
    !usesServerPagination && deferredQuery
      ? safeData.filter((record) => matchesCollectionQuery(record, deferredQuery, stableSearchKeys))
      : safeData
  ), [deferredQuery, safeData, stableSearchKeys, usesServerPagination]);

  useEffect(() => {
    if (!usesServerPagination || lastServerQueryRef.current === debouncedServerQuery) return;
    lastServerQueryRef.current = debouncedServerQuery;
    onServerSearch?.(debouncedServerQuery);
  }, [debouncedServerQuery, onServerSearch, usesServerPagination]);

  const resolvedPagination = usesServerPagination
    ? {
        current: Number(serverPagination.page || 0) + 1,
        pageSize: Number(serverPagination.pageSize || 20),
        total: Number(serverPagination.totalElements || 0),
        showSizeChanger: true,
        pageSizeOptions: serverPagination.pageSizeOptions || ['8', '20', '50'],
        hideOnSinglePage: false,
        showTotal: (total, range) => `${range[0]}–${range[1]} / ${total}`,
        onChange: (page, pageSize) => serverPagination.onChange?.(page - 1, pageSize),
      }
    : tableProps.pagination;

  return (
    <div className="searchable-table">
      {searchable && (
        <CollectionSearch
          query={query}
          onQueryChange={setQuery}
          filteredCount={usesServerPagination ? Number(serverPagination.totalElements || 0) : filteredData.length}
          totalCount={usesServerPagination ? Number(serverPagination.totalElements || 0) : safeData.length}
          placeholder={searchPlaceholder}
        />
      )}
      <Table
        {...tableProps}
        dataSource={filteredData}
        pagination={resolvedPagination}
        sticky={sticky}
        scroll={{ x: 'max-content', y: 520, ...scroll }}
      />
    </div>
  );
}

export default memo(SearchableTable);
