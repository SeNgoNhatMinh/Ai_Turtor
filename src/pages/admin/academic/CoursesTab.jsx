import { Button, Card, Col, Form, Input, InputNumber, Row, Tag } from 'antd';
import { CheckCircle2, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';

const actionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'View details' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
  { key: 'complete', icon: <CheckCircle2 size={14} />, label: 'Mark course complete' },
  { type: 'divider' },
  { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', danger: true },
];

function CoursesTab({ form, courses, onCreate, onReload, onAction }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Create New Course" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="courseId" label="Course ID" rules={[{ required: true }]}>
              <Input placeholder="PRJ301" />
            </Form.Item>
            <Form.Item name="courseName" label="Course Name" rules={[{ required: true }]}>
              <Input placeholder="Java Web Application" />
            </Form.Item>
            <Form.Item name="credits" label="Credits" initialValue={3}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Add Course</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="Course List" hoverable extra={<Button size="small" onClick={onReload} icon={<RefreshCw size={14} />}>Reload</Button>}>
          <DataTable
            data={courses || []}
            emptyText="No courses yet."
            columns={[
              { accessorKey: 'courseId', header: 'Code' },
              { accessorKey: 'courseName', header: 'Name' },
              { accessorKey: 'credits', header: 'Credits' },
              {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => {
                  const value = row.getValue('status');
                  return <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value || 'ACTIVE'}</Tag>;
                },
              },
              {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                  <EntityActionMenu
                    items={actionItems}
                    onAction={(key, meta) => onAction('course', row.original, key, meta)}
                    ariaLabel="Course actions"
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
