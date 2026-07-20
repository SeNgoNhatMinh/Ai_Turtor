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
    if (classesLoading) return 'Loading your assigned classes...';
    if (!classOptions.length) return 'No teaching class is assigned to this account.';
    if (!selectedClassValue || !assignment.courseId) return 'Choose the teaching class for this assignment.';
    if (!assignment.title.trim()) return 'Enter an assignment title.';
    if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) {
      return 'Maximum score must be greater than 0 and at most 1000.';
    }
    if (!assignment.file) return 'Choose an assignment file.';
    if (assignment.targetType === 'SELECTED_STUDENTS' && selectedStudentIds.length === 0) {
      return 'Choose at least one student.';
    }
    return '';
  })();

  useEffect(() => {
    if (!assignment.file && fileInputRef.current) fileInputRef.current.value = '';
  }, [assignment.file]);

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-gray-800"><Send className="w-5 h-5 text-blue-500" /> Publish New Assignment</CardTitle>
        <CardDescription>Create and publish a new assignment for your students.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onCreate}>
          <div className="space-y-2">
            <Label htmlFor="assignmentTitle">Assignment title</Label>
            <Input id="assignmentTitle" value={assignment.title} onChange={(event) => assignment.setTitle(event.target.value)} required className="bg-gray-50/50" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignmentDesc">Assignment requirements</Label>
            <Textarea id="assignmentDesc" value={assignment.description} onChange={(event) => assignment.setDescription(event.target.value)} className="bg-gray-50/50 min-h-[80px]" placeholder="Optional instructions for students" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignmentClass">Teaching class</Label>
              <AntSelect
                id="assignmentClass"
                aria-label="Assignment teaching class"
                showSearch
                value={selectedClassValue}
                placeholder="Choose the class receiving this assignment"
                optionFilterProp="searchLabel"
                options={classOptions}
                loading={classesLoading}
                disabled={assignment.isPublishing || classesLoading || classOptions.length === 0}
                notFoundContent={classesLoading ? 'Loading classes...' : 'No assigned classes found'}
                onChange={(value, option) => onClassChange?.(value, option)}
                style={{ width: '100%' }}
              />
              <p className="text-xs text-gray-500">The selected class also determines the course and student list.</p>
            </div>
            <div className="space-y-2">
              <Label>Submission deadline</Label>
              <Input type="datetime-local" value={assignment.deadline} onChange={(event) => assignment.setDeadline(event.target.value)} className="bg-gray-50/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assignment.type} onValueChange={assignment.setType}>
                <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Assignment type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                  <SelectItem value="EXAM">Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignmentMaxScore">Maximum score</Label>
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
              <Label>Target</Label>
              <Select value={assignment.targetType} onValueChange={assignment.setTargetType}>
                <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Target audience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_CLASS">Entire class</SelectItem>
                  <SelectItem value="SELECTED_STUDENTS">Selected students</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assignment file</Label>
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
              <p className="text-xs text-gray-500">Up to 50 MB. ZIP files are validated by the server and may contain DOCX files only.</p>
            </div>
          </div>
          {assignment.targetType === 'SELECTED_STUDENTS' && (
            <div className="space-y-2">
              <Label>Selected students</Label>
              <AntSelect
                mode="multiple"
                showSearch
                value={selectedStudentIds}
                placeholder="Choose students by name"
                optionFilterProp="searchLabel"
                onChange={(values) => assignment.setTargetStudents(values.join(','))}
                options={teacherStudents.map((student) => {
                  const id = getPersonId(student);
                  const name = getPersonDisplayName(student, 'Student');
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
            {publishBlockedReason || `Ready to publish to ${getClassOptionLabel(teachingClass)}.`}
          </p>
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
            disabled={assignment.isPublishing || Boolean(publishBlockedReason)}
            title={publishBlockedReason || 'Publish this assignment'}
          >
            {assignment.isPublishing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Publishing...</> : <><Send className="w-4 h-4 mr-2" /> Publish Assignment</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
