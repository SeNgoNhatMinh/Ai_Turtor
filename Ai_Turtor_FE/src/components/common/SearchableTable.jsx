import { useDeferredValue, useMemo, useState } from 'react';
import { Table } from 'antd';
import { matchesCollectionQuery } from '../../hooks/useCollectionView';
import { CollectionSearch } from './CollectionControls';

const EMPTY_SEARCH_KEYS = [];

export default function SearchableTable({
  dataSource = [],
  searchKeys = EMPTY_SEARCH_KEYS,
  searchPlaceholder = 'Tìm trong bảng',
  searchable = true,
  scroll,
  sticky = true,
  ...tableProps
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const safeData = useMemo(() => (Array.isArray(dataSource) ? dataSource : []), [dataSource]);
  const searchKeySignature = (Array.isArray(searchKeys) ? searchKeys : EMPTY_SEARCH_KEYS).join('\u0000');
  const stableSearchKeys = useMemo(
    () => (searchKeySignature ? searchKeySignature.split('\u0000') : EMPTY_SEARCH_KEYS),
    [searchKeySignature],
  );
  const filteredData = useMemo(() => (
    deferredQuery
      ? safeData.filter((record) => matchesCollectionQuery(record, deferredQuery, stableSearchKeys))
      : safeData
  ), [deferredQuery, safeData, stableSearchKeys]);

  return (
    <div className="searchable-table">
      {searchable && (
        <CollectionSearch
          query={query}
          onQueryChange={setQuery}
          filteredCount={filteredData.length}
          totalCount={safeData.length}
          placeholder={searchPlaceholder}
        />
      )}
      <Table
        {...tableProps}
        dataSource={filteredData}
        sticky={sticky}
        scroll={{ x: 'max-content', y: 520, ...scroll }}
      />
    </div>
  );
}
