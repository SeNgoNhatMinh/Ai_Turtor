import { Button, Card, Col, Form, Input, Row, Select } from 'antd';
import { Eye, Pencil, Plus, Search, UserMinus } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';
import { getClassCode } from './adminAcademicUtils';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';
import StatusLabel from '../../../components/common/StatusLabel';

const { Option } = Select;

const enrollmentActionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'Xem chi tiết' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Chỉnh sửa' },
  { type: 'divider' },
  { key: 'remove', icon: <UserMinus size={14} />, label: 'Xóa khỏi lớp', danger: true },
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
        <Card title="Ghi danh sinh viên vào lớp" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="studentId" label="Sinh viên" rules={[{ required: true, message: 'Chọn sinh viên' }]}>
              <Select
                showSearch
                filterOption={false}
                loading={studentsLoading}
                placeholder="Tìm theo họ tên hoặc email"
                notFoundContent={studentsLoading ? 'Đang tìm sinh viên...' : 'Nhập ít nhất 2 ký tự để tìm'}
                onSearch={onStudentSearch}
                options={studentOptions.map((student) => {
                  const id = getPersonId(student);
                  const email = getPersonEmail(student);
                  return {
                    value: id,
                    disabled: !id,
                    searchLabel: `${getPersonDisplayName(student, 'Sinh viên')} ${email}`,
                    label: (
                      <div className="admin-mentor-select-option">
                        <strong>{getPersonDisplayName(student, 'Sinh viên')}</strong>
                        {email && <span>{email}</span>}
                      </div>
                    ),
                  };
                })}
              />
            </Form.Item>
            <Form.Item name="courseId" label="Môn học" rules={[{ required: true }]}>
              <Select placeholder="Chọn môn học" onChange={onCourseSelect}>
                {courses.map((course) => (
                  <Option key={course.courseId || course.id} value={course.courseId}>
                    {course.courseId} - {course.courseName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="classId" label="Lớp học phần" rules={[{ required: true }]}>
              <Select placeholder="Chọn lớp học phần">
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
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Ghi danh sinh viên</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="Tra cứu ghi danh" hoverable>
          <div className="admin-academic-search-row">
            <Input
              placeholder="Tìm theo họ tên, email hoặc mã sinh viên"
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
              Tìm kiếm
            </Button>
          </div>
          <DataTable
            data={studentEnrollments || []}
            loading={enrollmentsLoading}
            emptyText="Chưa có dữ liệu. Hãy tìm sinh viên theo họ tên, email hoặc mã sinh viên."
            columns={[
              {
                accessorKey: 'studentName',
                header: 'Sinh viên',
                cell: ({ row }) => {
                  const record = row.original;
                  const email = getPersonEmail(record);
                  return (
                    <div className="entity-name-cell">
                      <strong>{getPersonDisplayName(record, 'Sinh viên')}</strong>
                      {email && <span>{email}</span>}
                    </div>
                  );
                },
              },
              { accessorKey: 'courseId', header: 'Mã môn' },
              { accessorKey: 'classId', header: 'Mã lớp' },
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
                    items={enrollmentActionItems}
                    onAction={(key, meta) => onAction('enrollment', row.original, key, meta)}
                    ariaLabel="Thao tác ghi danh"
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
