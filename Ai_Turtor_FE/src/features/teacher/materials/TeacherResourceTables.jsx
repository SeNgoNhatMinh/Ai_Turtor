import { Database, RefreshCw } from 'lucide-react';
import { Button, Card } from 'antd';
import { DataTable } from '../../../components/common/DataTable';

export default function TeacherResourceTables({
  materials,
  materialColumns,
  onReloadMaterials,
}) {
  return (
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
  );
}
