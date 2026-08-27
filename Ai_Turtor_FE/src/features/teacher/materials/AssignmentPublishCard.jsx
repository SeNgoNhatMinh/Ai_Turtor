import { useEffect, useMemo, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button, Card, Input, Select } from 'antd';
import {
  findTeacherClass,
  getClassCourseId,
  getClassOptionLabel,
  getClassOptionValue,
} from '../shared/teacherUtils';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';
import { ASSIGNMENT_FILE_ACCEPT } from '../../../utils/assignmentFiles';

const { TextArea } = Input;

export default function AssignmentPublishCard({
  classesList,
  classesLoading = false,
  teacherStudents = [],
  assignment,
  onClassChange,
  onCreate,
}) {
  const fileInputRef = useRef(null);
  const selectedStudentIds = String(assignment.targetStudents || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const teachingClass = findTeacherClass(classesList, assignment.classId);
  const classOptions = useMemo(() => classesList
    .map((item) => {
      const value = getClassOptionValue(item);
      const optionCourseId = getClassCourseId(item);
      const label = getClassOptionLabel(item);
      return value ? {
        value: String(value),
        label: optionCourseId ? `${label} · ${optionCourseId}` : label,
        searchLabel: `${label} ${item?.classCode || ''} ${value} ${optionCourseId}`,
        classId: String(value),
        courseId: String(optionCourseId || ''),
      } : null;
    })
    .filter(Boolean), [classesList]);
  const selectedClassValue = teachingClass ? String(getClassOptionValue(teachingClass)) : undefined;
  const maxScore = Number(assignment.maxScore);
  const publishBlockedReason = (() => {
    if (classesLoading) return 'Đang tải lớp được phân công...';
    if (!classOptions.length) return 'Tài khoản chưa được phân công lớp học phần.';
    if (!selectedClassValue || !assignment.courseId) return 'Chọn lớp nhận bài tập này.';
    if (!assignment.title.trim()) return 'Nhập tên bài tập.';
    if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) {
      return 'Điểm tối đa phải lớn hơn 0 và không vượt quá 1000.';
    }
    if (!assignment.file) return 'Chọn tệp bài tập.';
    if (assignment.targetType === 'SELECTED_STUDENTS' && selectedStudentIds.length === 0) {
      return 'Chọn ít nhất một sinh viên.';
    }
    return '';
  })();

  useEffect(() => {
    if (!assignment.file && fileInputRef.current) fileInputRef.current.value = '';
  }, [assignment.file]);

  return (
    <Card
      className="teacher-resource-form-card"
      title={<span className="teacher-card-title"><Send aria-hidden="true" /> Giao bài tập mới</span>}
    >
      <p className="teacher-card-description">Gửi tệp bài tập cho cả lớp hoặc một nhóm sinh viên.</p>
      <form className="teacher-resource-form" onSubmit={onCreate}>
        <label className="teacher-form-field" htmlFor="assignmentTitle">
          <span>Tên bài tập</span>
          <Input
            id="assignmentTitle"
            value={assignment.title}
            onChange={(event) => assignment.setTitle(event.target.value)}
            required
          />
        </label>

        <label className="teacher-form-field" htmlFor="assignmentDesc">
          <span>Yêu cầu bài tập</span>
          <TextArea
            id="assignmentDesc"
            value={assignment.description}
            onChange={(event) => assignment.setDescription(event.target.value)}
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder="Hướng dẫn thêm cho sinh viên (không bắt buộc)"
          />
        </label>

        <div className="teacher-form-grid">
          <label className="teacher-form-field" htmlFor="assignmentClass">
            <span>Lớp học phần</span>
            <Select
              id="assignmentClass"
              aria-label="Lớp nhận bài tập"
              showSearch
              value={selectedClassValue}
              placeholder="Chọn lớp nhận bài tập"
              optionFilterProp="searchLabel"
              options={classOptions}
              loading={classesLoading}
              disabled={assignment.isPublishing || classesLoading || classOptions.length === 0}
              notFoundContent={classesLoading ? 'Đang tải lớp...' : 'Không có lớp được phân công'}
              onChange={(value, option) => onClassChange?.(value, option)}
            />
            <small>Lớp đã chọn quyết định mã môn và danh sách sinh viên.</small>
          </label>

          <label className="teacher-form-field" htmlFor="assignmentDeadline">
            <span>Hạn nộp</span>
            <Input
              id="assignmentDeadline"
              type="datetime-local"
              value={assignment.deadline}
              onChange={(event) => assignment.setDeadline(event.target.value)}
            />
          </label>
        </div>

        <div className="teacher-form-grid">
          <label className="teacher-form-field" htmlFor="assignmentType">
            <span>Loại</span>
            <Select
              id="assignmentType"
              value={assignment.type}
              onChange={assignment.setType}
              options={[
                { value: 'ASSIGNMENT', label: 'Bài tập' },
                { value: 'EXAM', label: 'Bài kiểm tra' },
              ]}
            />
          </label>

          <label className="teacher-form-field" htmlFor="assignmentMaxScore">
            <span>Điểm tối đa</span>
            <Input
              id="assignmentMaxScore"
              type="number"
              min="0.1"
              max="1000"
              step="0.1"
              value={assignment.maxScore}
              onChange={(event) => assignment.setMaxScore(event.target.value)}
              required
            />
          </label>
        </div>

        <div className="teacher-form-grid">
          <label className="teacher-form-field" htmlFor="assignmentTargetType">
            <span>Đối tượng nhận</span>
            <Select
              id="assignmentTargetType"
              value={assignment.targetType}
              onChange={assignment.setTargetType}
              options={[
                { value: 'ALL_CLASS', label: 'Cả lớp' },
                { value: 'SELECTED_STUDENTS', label: 'Sinh viên được chọn' },
              ]}
            />
          </label>

          <label className="teacher-form-field" htmlFor="assignmentFile">
            <span>Tệp bài tập</span>
            <input
              ref={fileInputRef}
              id="assignmentFile"
              type="file"
              accept={ASSIGNMENT_FILE_ACCEPT}
              onChange={(event) => {
                const accepted = assignment.setFile(event.target.files[0] || null);
                if (accepted === false) event.target.value = '';
              }}
              className="teacher-file-input"
              required
            />
            <small>Tối đa 50 MB. Backend sẽ kiểm tra nội dung và đường dẫn bên trong tệp ZIP.</small>
          </label>
        </div>

        {assignment.targetType === 'SELECTED_STUDENTS' && (
          <label className="teacher-form-field" htmlFor="assignmentStudents">
            <span>Sinh viên được chọn</span>
            <Select
              id="assignmentStudents"
              mode="multiple"
              showSearch
              value={selectedStudentIds}
              placeholder="Tìm và chọn theo tên hoặc email"
              optionFilterProp="searchLabel"
              onChange={(values) => assignment.setTargetStudents(values.join(','))}
              options={teacherStudents.map((student) => {
                const id = getPersonId(student);
                const name = getPersonDisplayName(student, 'Sinh viên');
                const email = getPersonEmail(student);
                return {
                  value: id,
                  disabled: !id,
                  searchLabel: `${name} ${email}`,
                  label: [name, email].filter(Boolean).join(' · '),
                };
              })}
            />
          </label>
        )}

        <p className={`teacher-form-status ${publishBlockedReason ? 'is-warning' : 'is-ready'}`} role="status">
          {publishBlockedReason || `Sẵn sàng giao cho ${getClassOptionLabel(teachingClass)}.`}
        </p>
        <Button
          htmlType="submit"
          type="primary"
          block
          loading={assignment.isPublishing}
          disabled={Boolean(publishBlockedReason)}
          title={publishBlockedReason || 'Giao bài tập này'}
          icon={<Send size={16} />}
        >
          {assignment.isPublishing ? 'Đang giao bài...' : 'Giao bài tập'}
        </Button>
      </form>
    </Card>
  );
}
