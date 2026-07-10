import { Button, Card, Col, Form, Input, Row, Select, Tag } from 'antd';
import { CheckCircle2, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';

const { Option } = Select;

const actionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'View details' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
  { key: 'complete', icon: <CheckCircle2 size={14} />, label: 'Mark class complete' },
  { type: 'divider' },
  { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', danger: true },
];

function ClassSectionsTab({
  form,
  courses,
  classSections,
  selectedCourseId,
  academicLoading,
  onCreate,
  onCourseSelect,
  onAction,
}) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Create Class Section" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="courseId" label="Course" rules={[{ required: true }]}>
              <Select placeholder="Choose a course">
                {courses.map((course) => (
                  <Option key={course.courseId || course.id} value={course.courseId}>
                    {course.courseId} - {course.courseName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="classCode" label="Class Code" rules={[{ required: true }]}>
              <Input placeholder="SE1840" />
            </Form.Item>
            <Form.Item name="teacherId" label="Mentor ID" rules={[{ required: true }]}>
              <Input placeholder="mentor-1" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Create Class</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="View Classes by Course" hoverable>
          <Select
            placeholder="Choose a course to view classes"
            style={{ width: '100%', marginBottom: 16 }}
            onChange={onCourseSelect}
          >
            {courses.map((course) => (
              <Option key={course.courseId || course.id} value={course.courseId}>
                {course.courseId} - {course.courseName}
              </Option>
            ))}
          </Select>
          <DataTable
            data={classSections || []}
            loading={academicLoading}
            emptyText={selectedCourseId ? 'No classes yet.' : 'Choose a course to view classes.'}
            columns={[
              { accessorKey: 'classId', header: 'Class Code' },
              { accessorKey: 'teacherId', header: 'Mentor' },
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
                    onAction={(key, meta) => onAction('class', row.original, key, meta)}
                    ariaLabel="Class section actions"
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

export default ClassSectionsTab;
