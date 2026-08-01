import { useState } from 'react';
import { Button } from 'antd';
import './DataTable.css';

const DEFAULT_PAGE_SIZE = 8;

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
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const safeData = Array.isArray(data) ? data : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const pageCount = Math.ceil(safeData.length / safePageSize);
  const resolvedPageIndex = Math.min(pageIndex, Math.max(pageCount - 1, 0));
  const visibleRows = safeData.slice(
    resolvedPageIndex * safePageSize,
    (resolvedPageIndex + 1) * safePageSize,
  );

  return (
    <div className="data-table-root">
      <div className="data-table-card">
        <div className="data-table-scroll">
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
                  <tr key={getRowKey(record, resolvedPageIndex * safePageSize + rowIndex)}>
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

      {pageCount > 1 && (
        <nav className="data-table-pagination" aria-label="Phân trang bảng dữ liệu">
          <span>Trang {resolvedPageIndex + 1}/{pageCount}</span>
          <div>
            <Button
              size="small"
              onClick={() => setPageIndex(Math.max(0, resolvedPageIndex - 1))}
              disabled={resolvedPageIndex === 0}
            >
              Trước
            </Button>
            <Button
              size="small"
              onClick={() => setPageIndex(Math.min(pageCount - 1, resolvedPageIndex + 1))}
              disabled={resolvedPageIndex >= pageCount - 1}
            >
              Sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
