import { Button, Card, Col, Form, Input, InputNumber, Row } from 'antd';
import { CheckCircle2, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';
import StatusLabel from '../../../components/common/StatusLabel';

const actionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'Xem chi tiết' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Chỉnh sửa' },
  { key: 'complete', icon: <CheckCircle2 size={14} />, label: 'Đánh dấu hoàn tất' },
  { type: 'divider' },
  { key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa', danger: true },
];

function CoursesTab({ form, courses, onCreate, onReload, onAction }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Tạo môn học mới" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="courseId" label="Mã môn học" rules={[{ required: true }]}>
              <Input placeholder="PRJ301" />
            </Form.Item>
            <Form.Item name="courseName" label="Tên môn học" rules={[{ required: true }]}>
              <Input placeholder="Java Web Application" />
            </Form.Item>
            <Form.Item name="credits" label="Số tín chỉ" initialValue={3}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Thêm môn học</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="Danh sách môn học" hoverable extra={<Button size="small" onClick={onReload} icon={<RefreshCw size={14} />}>Làm mới</Button>}>
          <DataTable
            data={courses || []}
            emptyText="Chưa có môn học."
            columns={[
              { accessorKey: 'courseId', header: 'Mã môn' },
              { accessorKey: 'courseName', header: 'Tên môn học' },
              { accessorKey: 'credits', header: 'Tín chỉ' },
              {
                accessorKey: 'status',
                header: 'Trạng thái',
                cell: ({ row }) => {
                  const value = row.getValue('status');
                  return <StatusLabel status={value || 'ACTIVE'} />;
                },
              },
              {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                  <EntityActionMenu
                    items={actionItems}
                    onAction={(key, meta) => onAction('course', row.original, key, meta)}
                    ariaLabel="Thao tác môn học"
                  />
                ),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

export default CoursesTab;
