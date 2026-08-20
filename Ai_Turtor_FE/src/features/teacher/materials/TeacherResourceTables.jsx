import { Database, FileText, RefreshCw } from 'lucide-react';
import { Button, Card, Tag } from 'antd';
import { DataTable } from '../../../components/common/DataTable';

export default function TeacherResourceTables({
  classId,
  assignments,
  assignmentColumns,
  assignmentsLoading,
  onReloadAssignments,
  materials,
  materialColumns,
  onReloadMaterials,
}) {
  return (
    <>
      <Card
        className="teacher-resource-table-card"
        title={(
          <span className="teacher-card-title">
            <FileText aria-hidden="true" /> Bài tập của lớp
            <Tag>{classId || 'Chưa chọn lớp'}</Tag>
          </span>
        )}
        extra={(
          <Button
            size="small"
            icon={<RefreshCw size={15} />}
            onClick={onReloadAssignments}
            disabled={!classId}
            loading={assignmentsLoading}
          >
            Làm mới
          </Button>
        )}
      >
        <DataTable columns={assignmentColumns} data={assignments} loading={assignmentsLoading} />
      </Card>

      <Card
        className="teacher-resource-table-card"
        title={<span className="teacher-card-title"><Database aria-hidden="true" /> Tài liệu học tập đã tải lên</span>}
        extra={<Button size="small" icon={<RefreshCw size={15} />} onClick={onReloadMaterials}>Làm mới</Button>}
      >
        <p className="teacher-card-description">
          Tài liệu chính của môn chỉ được xem. Bạn chỉ có thể chỉnh sửa hoặc xóa tài liệu do chính mình tải lên;
          việc lập chỉ mục được hệ thống xử lý tự động.
        </p>
        <DataTable columns={materialColumns} data={materials} />
      </Card>
    </>
  );
}
