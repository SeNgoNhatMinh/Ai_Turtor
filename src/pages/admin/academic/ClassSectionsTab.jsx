import { Button, Card, Col, Form, Input, Row, Select } from 'antd';
import { CheckCircle2, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';
import { findPersonById, getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';
import StatusLabel from '../../../components/common/StatusLabel';

const { Option } = Select;

const getMentorId = (mentor) => getPersonId(mentor) || mentor.email;
const getMentorName = (mentor) => getPersonDisplayName(mentor, 'Giảng viên');
const getMentorEmail = (mentor) => getPersonEmail(mentor);
const getMentorMeta = (mentor) => [
  getMentorEmail(mentor),
  Array.isArray(mentor.specializations) ? mentor.specializations.join(', ') : mentor.specialization,
  mentor.status || mentor.availability,
].filter(Boolean).join(' | ');

const actionItems = [
  { key: 'view', icon: <Eye size={14} />, label: 'Xem chi tiết' },
  { key: 'edit', icon: <Pencil size={14} />, label: 'Chỉnh sửa' },
  { key: 'complete', icon: <CheckCircle2 size={14} />, label: 'Đánh dấu hoàn tất' },
  { type: 'divider' },
  { key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa', danger: true },
];

function ClassSectionsTab({
  form,
  courses,
  classSections,
  selectedCourseId,
  academicLoading,
  mentors = [],
  onCreate,
  onCourseSelect,
  onAction,
}) {
  const handleMentorChange = (mentorId) => {
    const mentor = mentors.find((item) => getMentorId(item) === mentorId);
    form.setFieldsValue({
      teacherId: mentorId,
      teacherName: mentor ? getMentorName(mentor) : '',
      teacherEmail: mentor ? getMentorEmail(mentor) : '',
    });
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title="Tạo lớp học phần" hoverable>
          <Form form={form} layout="vertical" onFinish={onCreate}>
            <Form.Item name="courseId" label="Môn học" rules={[{ required: true }]}>
              <Select placeholder="Chọn môn học">
                {courses.map((course) => (
                  <Option key={course.courseId || course.id} value={course.courseId}>
                    {course.courseId} - {course.courseName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="classCode" label="Mã lớp" rules={[{ required: true }]}>
              <Input placeholder="SE1840" />
            </Form.Item>
            <Form.Item name="teacherId" label="Giảng viên phụ trách" rules={[{ required: true, message: 'Chọn giảng viên phụ trách lớp' }]}>
              <Select
                showSearch
                placeholder="Chọn giảng viên đang hoạt động"
                optionFilterProp="searchLabel"
                onChange={handleMentorChange}
                options={mentors.map((mentor) => {
                  const id = getMentorId(mentor);
                  const name = getMentorName(mentor);
                  const meta = getMentorMeta(mentor);
                  return {
                    value: id,
                    searchLabel: `${name} ${id} ${meta}`,
                    label: (
                      <div className="admin-mentor-select-option">
                        <strong>{name}</strong>
                        {meta && <span>{meta}</span>}
                      </div>
                    ),
                    disabled: !id || mentor.isActive === false,
                  };
                })}
              />
            </Form.Item>
            <Form.Item name="teacherName" hidden><Input /></Form.Item>
            <Form.Item name="teacherEmail" hidden><Input /></Form.Item>
            <Button type="primary" htmlType="submit" block icon={<Plus size={14} />}>Tạo lớp học phần</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14} style={{ minWidth: 0 }}>
        <Card title="Danh sách lớp theo môn học" hoverable>
          <Select
            placeholder="Chọn môn học để xem lớp"
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
            emptyText={selectedCourseId ? 'Môn học này chưa có lớp.' : 'Chọn môn học để xem danh sách lớp.'}
            columns={[
              { accessorKey: 'classId', header: 'Mã lớp' },
              {
                accessorKey: 'teacherId',
                header: 'Giảng viên phụ trách',
                cell: ({ row }) => {
                  const record = row.original;
                  const mentor = findPersonById(mentors, record.teacherId || record.mentorId);
                  const displayRecord = { ...(mentor || {}), ...record };
                  const email = getPersonEmail(displayRecord);
                  return (
                    <div className="admin-class-mentor-cell">
                      <strong>{getPersonDisplayName(displayRecord, 'Chưa phân công')}</strong>
                      {email && <span>{email}</span>}
                    </div>
                  );
                },
              },
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
                    onAction={(key, meta) => onAction('class', row.original, key, meta)}
                    ariaLabel="Thao tác lớp học phần"
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
