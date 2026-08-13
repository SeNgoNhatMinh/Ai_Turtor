import { useMemo } from 'react';
import { Database, Download, Pencil, Trash2 } from 'lucide-react';
import { Tag } from 'antd';
import StatusLabel from '../../../components/common/StatusLabel';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { getRecordId } from '../shared/teacherUtils';
import { getMaterialDisplayName } from '../../../utils/sourceLabels';

export function useTeacherResourceColumns({
  assignmentActions,
  materialActions,
}) {
  const {
    onDownload: onDownloadAssignment,
    onEdit: onEditAssignment,
    onDelete: onDeleteAssignment,
  } = assignmentActions;
  const {
    onDownload: onDownloadMaterial,
    pendingId: materialActionId,
    onAction: onMaterialAction,
  } = materialActions;

  const assignmentColumns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Tên bài tập',
      cell: ({ row }) => <span className="teacher-resource-title">{row.getValue('title') || 'Bài tập chưa đặt tên'}</span>,
    },
    {
      accessorKey: 'assignmentType',
      header: 'Loại',
      cell: ({ row }) => <Tag>{String(row.getValue('assignmentType') || 'ASSIGNMENT').toUpperCase() === 'EXAM' ? 'Bài kiểm tra' : 'Bài tập'}</Tag>,
    },
    {
      accessorKey: 'maxScore',
      header: 'Điểm tối đa',
      cell: ({ row }) => <span>{row.getValue('maxScore') ?? 10}</span>,
    },
    {
      accessorKey: 'targetType',
      header: 'Đối tượng',
      cell: ({ row }) => (
        <Tag color={row.getValue('targetType') === 'SELECTED_STUDENTS' ? 'orange' : 'green'}>
          {row.getValue('targetType') === 'SELECTED_STUDENTS' ? 'Sinh viên được chọn' : 'Cả lớp'}
        </Tag>
      ),
    },
    {
      accessorKey: 'dueAt',
      header: 'Hạn nộp',
      cell: ({ row }) => {
        const value = row.getValue('dueAt');
        return <span className="teacher-resource-meta">{value ? new Date(value).toLocaleString() : '-'}</span>;
      },
    },
    { accessorKey: 'status', header: 'Trạng thái', cell: ({ row }) => <StatusLabel status={row.getValue('status') || 'PUBLISHED'} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <EntityActionMenu
          ariaLabel="Thao tác bài tập"
          items={[
            { key: 'edit', label: 'Chỉnh sửa', icon: <Pencil size={14} />, disabled: !onEditAssignment },
            { key: 'download', label: 'Tải xuống', icon: <Download size={14} />, disabled: !onDownloadAssignment },
            { type: 'divider' },
            { key: 'delete', label: 'Xóa', icon: <Trash2 size={14} />, danger: true, disabled: !onDeleteAssignment },
          ]}
          onAction={(key) => {
            if (key === 'edit') onEditAssignment?.(row.original);
            if (key === 'download') onDownloadAssignment?.(row.original);
            if (key === 'delete') onDeleteAssignment?.(row.original);
          }}
        />
      ),
    },
  ], [onDeleteAssignment, onDownloadAssignment, onEditAssignment]);

  const materialColumns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Tên tài liệu',
      cell: ({ row }) => <span className="teacher-resource-title">{row.getValue('title') || 'Tài liệu chưa đặt tên'}</span>,
    },
    {
      id: 'fileName',
      header: 'Nguồn tài liệu',
      cell: ({ row }) => {
        const name = getMaterialDisplayName(row.original) || 'Không có thông tin tệp';
        return <span className="teacher-resource-source" title={name}>{name}</span>;
      },
    },
    {
      accessorKey: 'classId',
      header: 'Phạm vi',
      cell: ({ row }) => <Tag color="orange">{row.getValue('classId') ? `Lớp ${row.getValue('classId')}` : 'Toàn môn'}</Tag>,
    },
    {
      id: 'indexingStatus',
      header: 'Trạng thái RAG',
      cell: ({ row }) => {
        const status = row.original.indexingStatus || row.original.status || 'INDEXED';
        const error = row.original.indexingError || row.original.error || '';
        return (
          <div className="teacher-material-status-cell">
            <StatusLabel status={status} />
            {error && <span title={error}>{error}</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngày tải lên',
      cell: ({ row }) => {
        const value = row.getValue('createdAt');
        return <span className="teacher-resource-meta">{value ? new Date(value).toLocaleString() : '-'}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const material = row.original;
        const materialId = getRecordId(material);
        const isWebsite = material.sourceType === 'HTML_URL';
        return (
          <EntityActionMenu
            ariaLabel="Thao tác tài liệu"
            items={[
              { key: 'download', label: isWebsite ? 'Website không có PDF' : 'Tải xuống', icon: <Download size={14} />, disabled: isWebsite || !materialId || !onDownloadMaterial },
              { key: 'reindex', label: 'Lập chỉ mục lại', icon: <Database size={14} />, disabled: !materialId || !onMaterialAction || materialActionId === `reindex:${materialId}` },
              { type: 'divider' },
              { key: 'delete', label: 'Xóa', icon: <Trash2 size={14} />, danger: true, disabled: !materialId || !onMaterialAction || materialActionId === `delete:${materialId}` },
            ]}
            onAction={(key) => {
              if (key === 'download') onDownloadMaterial?.(materialId, material.title, material);
              if (key === 'reindex') onMaterialAction?.('reindex', material);
              if (key === 'delete') onMaterialAction?.('delete', material);
            }}
          />
        );
      },
    },
  ], [materialActionId, onDownloadMaterial, onMaterialAction]);

  return { assignmentColumns, materialColumns };
}
