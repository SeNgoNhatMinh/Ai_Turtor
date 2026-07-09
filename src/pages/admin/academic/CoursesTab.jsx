import { Button, Card, Col, Form, Input, InputNumber, Row, Table, Tag } from 'antd';
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';

const actionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'View details' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
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
          <Table
            scroll={{ x: 700 }}
            dataSource={courses}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Code', dataIndex: 'courseId', key: 'id' },
              { title: 'Name', dataIndex: 'courseName', key: 'name' },
              { title: 'Credits', dataIndex: 'credits', key: 'credits', width: 80 },
              { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value}</Tag> },
              {
                title: '',
                key: 'actions',
                width: 54,
                align: 'center',
                render: (_, record) => (
                  <EntityActionMenu
                    items={actionItems}
                    onAction={(key, meta) => onAction('course', record, key, meta)}
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
