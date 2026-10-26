import { Button, Card, Col, Form, Row, Select } from 'antd';
import { Plus } from 'lucide-react';
import { getClassCode, getCourseSelectOptions } from '../adminAcademicUtils';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../../utils/displayNames';
import EnrollmentLookupCard from './EnrollmentLookupCard';

const { Option } = Select;

function StudentEnrollmentsTab({
  form,
  courses,
  classSections,
  studentOptions = [],
  studentsLoading = false,
  onCreate,
  onCourseSelect,
  onStudentSearch,
  onAction,
}) {
  const courseOptions = getCourseSelectOptions(courses);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={10}>
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
              <Select
                placeholder="Chọn môn học"
                onChange={onCourseSelect}
                options={courseOptions}
              />
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
      <Col xs={24} xl={14} style={{ minWidth: 0 }}>
        <EnrollmentLookupCard courses={courses} onAction={onAction} />
      </Col>
    </Row>
  );
}

export default StudentEnrollmentsTab;
