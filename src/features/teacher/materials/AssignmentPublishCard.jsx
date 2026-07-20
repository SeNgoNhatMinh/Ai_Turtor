import { useEffect, useMemo, useRef } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Select as AntSelect } from 'antd';
import {
  findTeacherClass,
  getClassCourseId,
  getClassOptionLabel,
  getClassOptionValue,
} from '../shared/teacherUtils';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';
import { ASSIGNMENT_FILE_ACCEPT } from '../../../utils/assignmentFiles';

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
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-gray-800"><Send className="w-5 h-5 text-blue-500" /> Giao bài tập mới</CardTitle>
        <CardDescription>Gửi tệp bài tập cho cả lớp hoặc một nhóm sinh viên.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onCreate}>
          <div className="space-y-2">
            <Label htmlFor="assignmentTitle">Tên bài tập</Label>
            <Input id="assignmentTitle" value={assignment.title} onChange={(event) => assignment.setTitle(event.target.value)} required className="bg-gray-50/50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignmentDesc">Yêu cầu bài tập</Label>
            <Textarea id="assignmentDesc" value={assignment.description} onChange={(event) => assignment.setDescription(event.target.value)} className="bg-gray-50/50 min-h-[80px]" placeholder="Hướng dẫn thêm cho sinh viên (không bắt buộc)" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignmentClass">Lớp học phần</Label>
              <AntSelect
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
                style={{ width: '100%' }}
              />
              <p className="text-xs text-gray-500">Lớp đã chọn quyết định mã môn và danh sách sinh viên.</p>
            </div>
            <div className="space-y-2">
              <Label>Hạn nộp</Label>
              <Input type="datetime-local" value={assignment.deadline} onChange={(event) => assignment.setDeadline(event.target.value)} className="bg-gray-50/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loại</Label>
              <Select value={assignment.type} onValueChange={assignment.setType}>
                <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Loại bài tập" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSIGNMENT">Bài tập</SelectItem>
                  <SelectItem value="EXAM">Bài kiểm tra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignmentMaxScore">Điểm tối đa</Label>
              <Input
                id="assignmentMaxScore"
                type="number"
                min="0.1"
                max="1000"
                step="0.1"
                value={assignment.maxScore}
                onChange={(event) => assignment.setMaxScore(event.target.value)}
                className="bg-gray-50/50"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Đối tượng nhận</Label>
              <Select value={assignment.targetType} onValueChange={assignment.setTargetType}>
                <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Chọn đối tượng nhận" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_CLASS">Cả lớp</SelectItem>
                  <SelectItem value="SELECTED_STUDENTS">Sinh viên được chọn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tệp bài tập</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept={ASSIGNMENT_FILE_ACCEPT}
                onChange={(event) => {
                  const accepted = assignment.setFile(event.target.files[0] || null);
                  if (accepted === false) event.target.value = '';
                }}
                className="bg-gray-50/50 file:text-blue-600 file:bg-blue-50 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-full file:text-xs file:font-semibold hover:file:bg-blue-100 transition-colors cursor-pointer"
                required
              />
              <p className="text-xs text-gray-500">Tối đa 50 MB. Backend sẽ kiểm tra nội dung và đường dẫn bên trong tệp ZIP.</p>
            </div>
          </div>
          {assignment.targetType === 'SELECTED_STUDENTS' && (
            <div className="space-y-2">
              <Label>Sinh viên được chọn</Label>
              <AntSelect
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
                style={{ width: '100%' }}
              />
            </div>
          )}
          <p className={`text-xs ${publishBlockedReason ? 'text-amber-700' : 'text-emerald-700'}`} role="status">
            {publishBlockedReason || `Sẵn sàng giao cho ${getClassOptionLabel(teachingClass)}.`}
          </p>
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
            disabled={assignment.isPublishing || Boolean(publishBlockedReason)}
            title={publishBlockedReason || 'Giao bài tập này'}
          >
            {assignment.isPublishing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Đang giao bài...</> : <><Send className="w-4 h-4 mr-2" /> Giao bài tập</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
