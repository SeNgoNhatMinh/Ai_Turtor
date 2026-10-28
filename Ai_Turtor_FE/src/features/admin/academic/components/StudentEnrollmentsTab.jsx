import { Button, Card, Col, Form, Row, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { queryKeys } from '../../../../app/queryKeys';
import { adminAcademicApi } from '../../../../services/adminAcademicApi';
import { getClassCode, getCourseSelectOptions } from '../adminAcademicUtils';
import { getPersonDisplayName, getPersonEmail } from '../../../../utils/displayNames';
import EnrollmentLookupCard from './EnrollmentLookupCard';

function StudentEnrollmentsTab({
  form,
  courses,
  studentOptions = [],
  studentsLoading = false,
  onCreate,
  onStudentSearch,
  onAction,
}) {
  const courseOptions = getCourseSelectOptions(courses);
  const courseId = Form.useWatch('courseId', form);
  const classSectionsQuery = useQuery({
    queryKey: queryKeys.adminClassSections(courseId),
    queryFn: ({ signal }) => adminAcademicApi.getClassSections(courseId, { signal }),
    enabled: Boolean(courseId),
    staleTime: 30_000,
  });
  const classSections = classSectionsQuery.data || [];

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
                  // Enrollment records must use the account ID. A student code
                  // is a display identifier and cannot be resolved by the API
                  // to the student's user profile.
                  const id = student.id || student._id || student.userId || '';
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
            <Form.Item name="courseId" label="Môn học" rules={[{ required: true, message: 'Chọn môn học.' }]}>
              <Select
                placeholder="Chọn môn học"
                onChange={() => {
                  form.setFieldValue('classId', undefined);
                }}
                options={courseOptions}
              />
            </Form.Item>
            <Form.Item name="classId" label="Lớp học phần" rules={[{ required: true, message: 'Chọn lớp học phần.' }]}>
              <Select
                placeholder={courseId ? 'Chọn lớp học phần' : 'Chọn môn học trước'}
                disabled={!courseId || classSectionsQuery.isFetching}
                loading={classSectionsQuery.isFetching}
                notFoundContent={classSectionsQuery.isError
                  ? 'Không tải được danh sách lớp học phần.'
                  : 'Môn học này chưa có lớp học phần.'}
                options={classSections
                  .map((classSection) => getClassCode(classSection))
                  .filter(Boolean)
                  .map((classCode) => ({ value: classCode, label: classCode }))}
              />
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
