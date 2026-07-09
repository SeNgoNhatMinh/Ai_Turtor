import { Button, Card, Col, Form, Input, Row, Select, Table, Tag } from 'antd';
import { Eye, Pencil, Plus, Search, UserMinus } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';

const { Option } = Select;

function StudentEnrollmentsTab({
  form,
  courses,
  classSections,
  enrollmentSearchId,
  setEnrollmentSearchId,
  studentEnrollments,
  enrollmentsLoading,
  onCreate,
  onCourseSelect,
  onSearch,
  onAction,
}) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Enroll Student in Class" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="studentId" label="Student ID" rules={[{ required: true, message: 'Enter student ID' }]}>
              <Input placeholder="Example: student-a1" />
            </Form.Item>
            <Form.Item name="courseId" label="Course" rules={[{ required: true }]}>
              <Select placeholder="Choose a course" onChange={onCourseSelect}>
                {courses.map((course) => (
                  <Option key={course.courseId || course.id} value={course.courseId}>
                    {course.courseId} - {course.courseName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="classId" label="Class Section" rules={[{ required: true }]}>
              <Select placeholder="Choose a class section">
                {classSections.map((classSection) => (
                  <Option key={classSection.classId || classSection.id} value={classSection.classId}>
                    {classSection.classId}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Enroll Student</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="Student Enrollments Search" hoverable>
          <div className="admin-academic-search-row">
            <Input
              placeholder="Enter user ID, email, or student code"
              value={enrollmentSearchId}
              onChange={(event) => setEnrollmentSearchId(event.target.value)}
              onPressEnter={onSearch}
              allowClear
            />
            <Button
              type="primary"
              icon={<Search size={14} />}
              onClick={onSearch}
              loading={enrollmentsLoading}
              disabled={!enrollmentSearchId.trim() || enrollmentsLoading}
            >
              Search
            </Button>
          </div>
          <Table
            scroll={{ x: 600 }}
            dataSource={studentEnrollments}
            rowKey={(record) => record.id || record._id || `${record.studentId}-${record.courseId}-${record.classId}`}
            size="small"
            loading={enrollmentsLoading}
            pagination={false}
            columns={[
              { title: 'Enrollment ID', dataIndex: 'id', key: 'id' },
              { title: 'Course Code', dataIndex: 'courseId', key: 'course' },
              { title: 'Class Code', dataIndex: 'classId', key: 'class' },
              { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>{value || 'ACTIVE'}</Tag> },
              {
                title: '',
                key: 'actions',
                width: 54,
                align: 'center',
                render: (_, record) => (
                  <EntityActionMenu
                    items={[
                      { key: 'view', icon: <Eye size={14} />, label: 'View details' },
                      { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
                      { type: 'divider' },
                      { key: 'remove', icon: <UserMinus size={14} />, label: 'Remove from class', danger: true },
                    ]}
                    onAction={(key, meta) => onAction('enrollment', record, key, meta)}
                    ariaLabel="Enrollment actions"
                  />
                ),
              },
            ]}
            locale={{ emptyText: 'No enrollment records loaded. Enter a user ID, email, or student code and click Search.' }}
          />
        </Card>
      </Col>
    </Row>
  );
}

export default StudentEnrollmentsTab;
