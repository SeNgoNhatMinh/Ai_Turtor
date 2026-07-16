import { useMemo } from 'react';
import { Database, Download, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRecordId } from '../shared/teacherUtils';
import { getMaterialDisplayName } from '../../../utils/sourceLabels';

export function useTeacherResourceColumns({
  handleDownloadAssignmentFile,
  handleEditAssignment,
  handleDeleteAssignment,
  onDownloadMaterial,
  materialActionId,
  handleTeacherMaterialAction,
}) {
  const assignmentColumns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => <span className="font-semibold text-gray-900">{row.getValue('title') || 'Untitled assignment'}</span>,
    },
    {
      accessorKey: 'targetType',
      header: 'Target',
      cell: ({ row }) => (
        <Badge
          variant={row.getValue('targetType') === 'SELECTED_STUDENTS' ? 'secondary' : 'outline'}
          className={row.getValue('targetType') === 'SELECTED_STUDENTS'
            ? 'bg-orange-100 text-orange-600 hover:bg-orange-100 border-none'
            : 'bg-green-50 text-green-600 border-green-200'}
        >
          {row.getValue('targetType') || 'ALL_CLASS'}
        </Badge>
      ),
    },
    {
      accessorKey: 'dueAt',
      header: 'Due',
      cell: ({ row }) => {
        const value = row.getValue('dueAt');
        return <span className="text-gray-500 text-sm">{value ? new Date(value).toLocaleString() : '-'}</span>;
      },
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <span>{row.getValue('status') || 'Published'}</span> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleEditAssignment(row.original)}>
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleDownloadAssignmentFile(row.original)}>
            <Download className="w-3 h-3 mr-1" /> Download
          </Button>
          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeleteAssignment(row.original)}>
            <Trash2 className="w-3 h-3 mr-1" /> Delete
          </Button>
        </div>
      ),
    },
  ], [handleDeleteAssignment, handleDownloadAssignmentFile, handleEditAssignment]);

  const materialColumns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Material Title',
      cell: ({ row }) => <span className="font-semibold text-gray-900">{row.getValue('title') || 'Untitled Material'}</span>,
    },
    {
      id: 'fileName',
      header: 'File Path / Name',
      cell: ({ row }) => {
        const name = getMaterialDisplayName(row.original) || 'Material file unavailable';
        return <span className="font-mono text-xs text-gray-500 truncate max-w-[200px] block" title={name}>{name}</span>;
      },
    },
    {
      accessorKey: 'classId',
      header: 'Class Code',
      cell: ({ row }) => <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">{row.getValue('classId') || 'Course-wide'}</Badge>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Uploaded Date',
      cell: ({ row }) => {
        const value = row.getValue('createdAt');
        return <span className="text-gray-500 text-sm">{value ? new Date(value).toLocaleString() : '-'}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const material = row.original;
        const materialId = getRecordId(material);
        const isWebsite = material.sourceType === 'HTML_URL';
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={isWebsite} onClick={() => onDownloadMaterial?.(materialId, material.title, material)}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-blue-200" disabled={materialActionId === `reindex:${materialId}`} onClick={() => handleTeacherMaterialAction('reindex', material)}>
              <Database className="w-3 h-3 mr-1" /> Reindex
            </Button>
            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={materialActionId === `delete:${materialId}`} onClick={() => handleTeacherMaterialAction('delete', material)}>
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
        );
      },
    },
  ], [handleTeacherMaterialAction, materialActionId, onDownloadMaterial]);

  return { assignmentColumns, materialColumns };
}
