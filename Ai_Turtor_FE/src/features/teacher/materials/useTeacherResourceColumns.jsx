import { useMemo } from 'react';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { Tag } from 'antd';
import StatusLabel from '../../../components/common/StatusLabel';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { getRecordId } from '../shared/teacherUtils';
import { getMaterialDisplayName } from '../../../utils/sourceLabels';

export function useTeacherResourceColumns({
  materialActions,
}) {
  const {
    onDownload: onDownloadMaterial,
    onEdit: onEditMaterial,
    onDelete: onDeleteMaterial,
    canManage: canManageMaterial,
    pendingId: materialActionId,
  } = materialActions;

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
      cell: ({ row }) => {
        const manageable = Boolean(canManageMaterial?.(row.original));
        return (
          <div className="teacher-material-scope-cell">
            <Tag color={row.getValue('classId') ? 'orange' : 'blue'}>
              {row.getValue('classId') ? `Lớp ${row.getValue('classId')}` : 'Tài liệu chính'}
            </Tag>
            <span>{manageable ? 'Bạn tải lên' : 'Chỉ xem'}</span>
          </div>
        );
      },
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
        const manageable = Boolean(canManageMaterial?.(material));
        return (
          <EntityActionMenu
            ariaLabel="Thao tác tài liệu"
            items={[
              { key: 'download', label: isWebsite ? 'Website không có PDF' : 'Tải xuống', icon: <Download size={14} />, disabled: isWebsite || !materialId || !onDownloadMaterial },
              { key: 'edit', label: manageable ? 'Chỉnh sửa' : 'Chỉ được sửa tài liệu bạn tải lên', icon: <Pencil size={14} />, disabled: !materialId || !manageable || !onEditMaterial },
              { type: 'divider' },
              { key: 'delete', label: manageable ? 'Xóa' : 'Không thể xóa tài liệu chính', icon: <Trash2 size={14} />, danger: true, disabled: !materialId || !manageable || !onDeleteMaterial || materialActionId === `delete:${materialId}` },
            ]}
            onAction={(key) => {
              if (key === 'download') onDownloadMaterial?.(materialId, material.title, material);
              if (key === 'edit') onEditMaterial?.(material);
              if (key === 'delete') onDeleteMaterial?.(material);
            }}
          />
        );
      },
    },
  ], [canManageMaterial, materialActionId, onDeleteMaterial, onDownloadMaterial, onEditMaterial]);

  return { materialColumns };
}
