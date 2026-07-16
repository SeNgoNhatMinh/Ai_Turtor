import { RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Select as AntSelect } from 'antd';
import { getClassOptionLabel, getClassOptionValue } from '../shared/teacherUtils';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';

export default function AssignmentPublishCard({ classesList, teacherStudents = [], assignment, onCreate }) {
  const selectedStudentIds = String(assignment.targetStudents || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

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
            <Textarea id="assignmentDesc" value={assignment.description} onChange={(event) => assignment.setDescription(event.target.value)} required className="bg-gray-50/50 min-h-[80px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Apply to class</Label>
              <Select value={assignment.classId} onValueChange={assignment.setClassId}>
                <SelectTrigger className="bg-gray-50/50"><SelectValue placeholder="Choose class" /></SelectTrigger>
                <SelectContent>
                  {classesList.map((item) => {
                    const value = getClassOptionValue(item);
                    return value ? <SelectItem key={value} value={value}>{getClassOptionLabel(item)}</SelectItem> : null;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Submission deadline</Label>
              <Input type="datetime-local" value={assignment.deadline} onChange={(event) => assignment.setDeadline(event.target.value)} required className="bg-gray-50/50" />
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
              <Input type="file" onChange={(event) => assignment.setFile(event.target.files[0] || null)} className="bg-gray-50/50 file:text-blue-600 file:bg-blue-50 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-full file:text-xs file:font-semibold hover:file:bg-blue-100 transition-colors cursor-pointer" required />
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
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-2" disabled={assignment.isPublishing || !assignment.file || !assignment.classId}>
            {assignment.isPublishing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Publishing...</> : <><Send className="w-4 h-4 mr-2" /> Publish Assignment</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
