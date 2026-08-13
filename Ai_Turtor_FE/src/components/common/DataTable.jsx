import { CollectionPagination, CollectionSearch } from './CollectionControls';
import { useCollectionView } from '../../hooks/useCollectionView';
import './DataTable.css';

const DEFAULT_PAGE_SIZE = 20;

function getColumnId(column, index) {
  return column.id || column.accessorKey || `column-${index}`;
}

function getRecordValue(record, accessorKey) {
  if (!accessorKey) return undefined;
  return String(accessorKey)
    .split('.')
    .reduce((value, key) => value?.[key], record);
}

function renderHeader(column) {
  return typeof column.header === 'function'
    ? column.header({ column })
    : column.header;
}

function renderCell(column, record) {
  const value = getRecordValue(record, column.accessorKey);
  if (typeof column.cell !== 'function') return value ?? '';

  const row = {
    original: record,
    getValue: (key) => getRecordValue(record, key),
  };

  return column.cell({ row, getValue: () => value });
}

function getRowKey(record, index) {
  return record?.id
    || record?._id
    || record?.materialId
    || record?.assignmentId
    || record?.enrollmentId
    || record?.classId
    || record?.courseId
    || record?.semesterCode
    || `row-${index}`;
}

export function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyText = 'Không có dữ liệu.',
  pageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = [10, 20, 50],
  searchable = false,
  searchKeys = [],
  searchPlaceholder = 'Tìm trong danh sách',
  maxBodyHeight,
}) {
  const safeData = Array.isArray(data) ? data : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  const collection = useCollectionView(safeData, {
    initialPageSize: pageSize,
    pageSizeOptions,
    searchKeys,
  });
  const visibleRows = collection.visibleItems;

  return (
    <div className="data-table-root">
      {searchable && (
        <CollectionSearch
          query={collection.query}
          onQueryChange={collection.setQuery}
          filteredCount={collection.filteredCount}
          totalCount={collection.totalCount}
          placeholder={searchPlaceholder}
        />
      )}
      <div className="data-table-card">
        <div
          className={`data-table-scroll ${maxBodyHeight ? 'data-table-scroll--bounded' : ''}`}
          style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
        >
          <table className="data-table" role="table">
            <thead>
              <tr>
                {safeColumns.map((column, index) => (
                  <th key={getColumnId(column, index)} scope="col">
                    {renderHeader(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Math.max(safeColumns.length, 1)} className="data-table-state">
                    Đang tải...
                  </td>
                </tr>
              ) : visibleRows.length ? (
                visibleRows.map((record, rowIndex) => (
                  <tr key={getRowKey(record, collection.pageIndex * collection.pageSize + rowIndex)}>
                    {safeColumns.map((column, columnIndex) => (
                      <td key={getColumnId(column, columnIndex)}>
                        {renderCell(column, record)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={Math.max(safeColumns.length, 1)} className="data-table-state">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CollectionPagination collection={collection} />
    </div>
  );
}
