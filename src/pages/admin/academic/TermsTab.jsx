import { Button, Card, Col, Form, Input, Row } from 'antd';
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';
import StatusLabel from '../../../components/common/StatusLabel';

const actionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'Xem chi tiết' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Chỉnh sửa' },
  { type: 'divider' },
  { key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa', danger: true },
];

function TermsTab({ form, semesters, onCreate, onReload, onAction }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Tạo học kỳ mới" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="semesterCode" label="Mã học kỳ" rules={[{ required: true, message: 'Nhập mã học kỳ' }]}>
              <Input placeholder="Ví dụ: SEM5, SUMMER2026" />
            </Form.Item>
            <Form.Item name="name" label="Tên học kỳ" rules={[{ required: true, message: 'Nhập tên học kỳ' }]}>
              <Input placeholder="Summer 2026" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Thêm học kỳ</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="Danh sách học kỳ" hoverable extra={<Button size="small" onClick={onReload} icon={<RefreshCw size={14} />}>Làm mới</Button>}>
          <DataTable
            data={semesters || []}
            emptyText="Chưa có học kỳ."
            columns={[
              { accessorKey: 'semesterCode', header: 'Mã' },
              { accessorKey: 'name', header: 'Tên học kỳ' },
              { 
                accessorKey: 'status', 
                header: 'Trạng thái',
                cell: ({ row }) => {
                  const value = row.getValue('status');
                  return <StatusLabel status={value || 'ACTIVE'} />;
                }
              },
              {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                  <EntityActionMenu
                    items={actionItems}
                    onAction={(key, meta) => onAction('semester', row.original, key, meta)}
                    ariaLabel="Thao tác học kỳ"
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

export default TermsTab;
