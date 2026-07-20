import { useEffect, useMemo, useRef } from 'react';
import { FileText, Globe, RefreshCw, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from 'antd';
import { findTeacherClass, getClassOptionLabel, getClassOptionValue } from '../shared/teacherUtils';

export default function TeacherMaterialUploadCard({
  courseId,
  classId,
  classesList = [],
  classesLoading = false,
  onClassChange,
  materialTitle,
  setMaterialTitle,
  materialFile,
  setMaterialFile,
  isUploading,
  onUpload,
  onOpenWebsiteImport,
}) {
  const fileInputRef = useRef(null);
  const classOptions = useMemo(() => classesList
    .map((item) => {
      const value = getClassOptionValue(item);
      const classLabel = getClassOptionLabel(item);
      const optionCourseId = item?.courseId
        || item?.courseCode
        || item?.course?.courseId
        || item?.course?.id
        || (typeof item?.course === 'string' ? item.course : '')
        || '';
      return value ? {
        value: String(value),
        label: optionCourseId ? `${classLabel} · ${optionCourseId}` : classLabel,
        searchLabel: `${classLabel} ${value} ${optionCourseId}`,
        classId: String(value),
        courseId: String(optionCourseId),
      } : null;
    })
    .filter(Boolean), [classesList]);
  const selectedClass = findTeacherClass(classesList, classId);
  const selectedClassValue = getClassOptionValue(selectedClass);
  const selectedClassOption = classOptions.find((option) => option.value === String(selectedClassValue || ''));

  useEffect(() => {
    if (!materialFile && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [materialFile]);

  const uploadBlockedReason = (() => {
    if (classesLoading) return 'Loading your assigned classes...';
    if (!classOptions.length) return 'No teaching class is assigned to this account.';
    if (!selectedClassOption || !courseId) return 'Select a teaching class in the field above.';
    if (!materialFile) return 'Choose a PDF file to enable upload.';
    return '';
  })();

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-gray-800"><Upload className="w-5 h-5 text-orange-500" /> Upload Class Material</CardTitle>
        <CardDescription>Upload PDF materials to the AI Tutor&apos;s knowledge base.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onUpload}>
          <div className="space-y-2">
            <Label htmlFor="materialClass">Teaching class</Label>
            <Select
              id="materialClass"
              aria-label="Teaching class"
              showSearch
              value={selectedClassOption?.value}
              placeholder="Choose the class for this material"
              optionFilterProp="searchLabel"
              options={classOptions}
              loading={classesLoading}
              disabled={isUploading || classesLoading || classOptions.length === 0}
              notFoundContent={classesLoading ? 'Loading classes...' : 'No assigned classes found'}
              onChange={onClassChange}
              style={{ width: '100%' }}
            />
            {!classesLoading && !classOptions.length && (
              <p className="teacher-material-upload-hint" role="alert">
                No teaching class is assigned to this account. Ask an admin to assign one first.
              </p>
            )}
            {!classesLoading && classOptions.length > 1 && !selectedClassOption && (
              <p className="teacher-material-upload-hint">
                Select the class that should be allowed to use this material.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="materialTitle">Material Title</Label>
            <Input id="materialTitle" value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} placeholder="Leave empty to use file name" className="bg-gray-50/50" disabled={isUploading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="materialFile">File (PDF only)</Label>
            <Input
              ref={fileInputRef}
              id="materialFile"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setMaterialFile(event.target.files[0] || null)}
              className="bg-gray-50/50 file:text-orange-600 file:bg-orange-50 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-full file:text-xs file:font-semibold hover:file:bg-orange-100 transition-colors cursor-pointer"
              disabled={isUploading}
            />
            {materialFile ? (
              <div className="teacher-material-file" role="status">
                <FileText aria-hidden="true" />
                <span title={materialFile.name}>{materialFile.name}</span>
                <small>{Math.max(1, Math.ceil(materialFile.size / 1024))} KB</small>
              </div>
            ) : (
              <p className="teacher-material-upload-hint">{uploadBlockedReason}</p>
            )}
          </div>
          {courseId && selectedClassOption && (
            <div className="pt-2">
              <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-normal">
                Scope: <strong>{courseId} / {selectedClassOption.classId}</strong>
              </Badge>
            </div>
          )}
          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 mt-2"
            disabled={isUploading}
            title={uploadBlockedReason || 'Upload this PDF as class material'}
          >
            {isUploading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-2" /> Upload Material</>}
          </Button>
          <Button type="button" variant="outline" className="w-full mt-2 border-orange-200 text-orange-600 hover:bg-orange-50" disabled={isUploading || !courseId || !selectedClassOption} onClick={onOpenWebsiteImport}>
            <Globe className="w-4 h-4 mr-2" /> Import Website URL
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
