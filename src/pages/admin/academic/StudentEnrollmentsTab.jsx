import { Button, Card, Col, Form, Input, Row, Select, Tag } from 'antd';
import { Eye, Pencil, Plus, Search, UserMinus } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';
import { getClassCode } from './adminAcademicUtils';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';

const { Option } = Select;

const enrollmentActionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'View details' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Edit' },
  { type: 'divider' },
  { key: 'remove', icon: <UserMinus size={14} />, label: 'Remove from class', danger: true },
];

function StudentEnrollmentsTab({
  form,
  courses,
  classSections,
  studentOptions = [],
  studentsLoading = false,
  enrollmentSearchId,
  setEnrollmentSearchId,
  studentEnrollments,
  enrollmentsLoading,
  onCreate,
  onCourseSelect,
  onStudentSearch,
  onSearch,
  onAction,
}) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Enroll Student in Class" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="studentId" label="Student" rules={[{ required: true, message: 'Choose a student' }]}>
              <Select
                showSearch
                filterOption={false}
                loading={studentsLoading}
                placeholder="Search by student name or email"
                notFoundContent={studentsLoading ? 'Searching students...' : 'Type at least 2 characters to search'}
                onSearch={onStudentSearch}
                options={studentOptions.map((student) => {
                  const id = getPersonId(student);
                  const email = getPersonEmail(student);
                  return {
                    value: id,
                    disabled: !id,
                    searchLabel: `${getPersonDisplayName(student, 'Student')} ${email}`,
                    label: (
                      <div className="admin-mentor-select-option">
                        <strong>{getPersonDisplayName(student, 'Student')}</strong>
                        {email && <span>{email}</span>}
                      </div>
                    ),
                  };
                })}
              />
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
                {classSections.map((classSection) => {
                  const classCode = getClassCode(classSection);
                  return (
                  <Option key={classCode} value={classCode}>
                    {classCode}
                  </Option>
                  );
                })}
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
              placeholder="Search by student name, email, or student code"
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
          <DataTable
            data={studentEnrollments || []}
            loading={enrollmentsLoading}
            emptyText="No enrollment records loaded. Search for a student by name, email, or student code."
            columns={[
              {
                accessorKey: 'studentName',
                header: 'Student',
                cell: ({ row }) => {
                  const record = row.original;
                  const email = getPersonEmail(record);
                  return (
                    <div className="entity-name-cell">
                      <strong>{getPersonDisplayName(record, 'Student')}</strong>
                      {email && <span>{email}</span>}
                    </div>
                  );
                },
              },
              { accessorKey: 'courseId', header: 'Course Code' },
              { accessorKey: 'classId', header: 'Class Code' },
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
                    items={enrollmentActionItems}
                    onAction={(key, meta) => onAction('enrollment', row.original, key, meta)}
                    ariaLabel="Enrollment actions"
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

export default StudentEnrollmentsTab;
