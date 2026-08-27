import { Search } from 'lucide-react';
import './CollectionControls.css';

export function CollectionSearch({
  query,
  onQueryChange,
  filteredCount,
  totalCount,
  placeholder = 'Tìm trong danh sách',
  onSubmit,
}) {
  return (
    <div className="collection-search-bar">
      <label className="collection-search-field">
        <Search size={19} strokeWidth={2.2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit?.(query);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      <span>{query ? `${filteredCount}/${totalCount} kết quả` : `${totalCount} bản ghi`}</span>
    </div>
  );
}

export function CollectionToolbar({ children, ...searchProps }) {
  return (
    <div className="collection-toolbar">
      <CollectionSearch {...searchProps} />
      {children && <div className="collection-toolbar__actions">{children}</div>}
    </div>
  );
}

export function CollectionPagination({ collection }) {
  if (!collection || collection.filteredCount === 0) return null;
  const {
    pageIndex,
    pageCount,
    pageSize,
    pageSizeOptions,
    filteredCount,
    rangeStart,
    rangeEnd,
    setPageIndex,
    setPageSize,
  } = collection;

  return (
    <nav className="collection-pagination" aria-label="Phân trang danh sách">
      <span className="collection-pagination__summary">{rangeStart}–{rangeEnd} / {filteredCount}</span>
      <label className="collection-pagination__size">
        <span>Hiển thị</span>
        <select value={pageSize} onChange={(event) => setPageSize(event.target.value)} aria-label="Số bản ghi mỗi trang">
          {pageSizeOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <div className="collection-pagination__navigation">
        <button type="button" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} aria-label="Trang đầu">«</button>
        <button type="button" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} aria-label="Trang trước">‹</button>
        <label>
          <span className="sr-only">Trang hiện tại</span>
          <input
            type="number"
            min="1"
            max={pageCount}
            value={pageIndex + 1}
            onChange={(event) => setPageIndex(Number(event.target.value) - 1)}
            aria-label="Trang hiện tại"
          />
          <span>/ {pageCount}</span>
        </label>
        <button type="button" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} aria-label="Trang sau">›</button>
        <button type="button" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} aria-label="Trang cuối">»</button>
      </div>
    </nav>
  );
}
