import { useEffect, useMemo, useRef } from 'react';
import { AlertCircle, FileText, Globe, RefreshCw, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from 'antd';
import StatusLabel from '../../../components/common/StatusLabel';
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
  pendingUpload,
  onClearUpload,
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
  const pendingStatus = String(pendingUpload?.indexingStatus || pendingUpload?.status || '').toUpperCase();
  const pendingForSelectedFile = Boolean(
    pendingUpload
    && materialFile
    && String(pendingUpload.fileName || pendingUpload.sourceFileName) === String(materialFile.name),
  );
  const pendingIsProcessing = ['PENDING', 'QUEUED', 'PROCESSING', 'INDEXING'].includes(pendingStatus);

  useEffect(() => {
    if (!materialFile && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [materialFile]);

  const uploadBlockedReason = (() => {
    if (classesLoading) return 'Đang tải lớp được phân công...';
    if (!classOptions.length) return 'Tài khoản chưa được phân công lớp học phần.';
    if (!selectedClassOption || !courseId) return 'Chọn lớp học phần ở trường phía trên.';
    if (!materialFile) return 'Chọn tệp PDF để tải lên.';
    if (pendingForSelectedFile && pendingIsProcessing) return 'Tệp này đang được backend lập chỉ mục.';
    return '';
  })();

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-gray-800"><Upload className="w-5 h-5 text-orange-500" /> Tải tài liệu theo lớp</CardTitle>
        <CardDescription>Tải PDF riêng cho lớp để AI Tutor sử dụng đúng phạm vi.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onUpload}>
          <div className="space-y-2">
            <Label htmlFor="materialClass">Lớp học phần</Label>
            <Select
              id="materialClass"
              aria-label="Lớp học phần"
              showSearch
              value={selectedClassOption?.value}
              placeholder="Chọn lớp được phép sử dụng tài liệu"
              optionFilterProp="searchLabel"
              options={classOptions}
              loading={classesLoading}
              disabled={isUploading || classesLoading || classOptions.length === 0}
              notFoundContent={classesLoading ? 'Đang tải lớp...' : 'Không có lớp được phân công'}
              onChange={onClassChange}
              style={{ width: '100%' }}
            />
            {!classesLoading && !classOptions.length && (
              <p className="teacher-material-upload-hint" role="alert">
                Tài khoản chưa được phân công lớp. Hãy yêu cầu Admin cập nhật lớp học phần.
              </p>
            )}
            {!classesLoading && classOptions.length > 1 && !selectedClassOption && (
              <p className="teacher-material-upload-hint">
                Chọn lớp được phép sử dụng tài liệu này.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="materialTitle">Tên tài liệu</Label>
            <Input id="materialTitle" value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} placeholder="Để trống để dùng tên tệp" className="bg-gray-50/50" disabled={isUploading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="materialFile">Tệp PDF</Label>
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
                Phạm vi: <strong>{courseId} / {selectedClassOption.classId}</strong>
              </Badge>
            </div>
          )}
          {pendingUpload && (
            <div className={`teacher-material-processing-card ${pendingStatus.includes('FAIL') ? 'teacher-material-processing-card--failed' : ''}`} role="status">
              <div className="teacher-material-processing-card__header">
                <div>
                  <strong>{pendingUpload.title || pendingUpload.fileName || 'Học liệu vừa tải lên'}</strong>
                  <span>Mã học liệu: {pendingUpload.id || pendingUpload.materialId}</span>
                </div>
                <StatusLabel status={pendingStatus || 'PROCESSING'} />
              </div>
              {pendingUpload.indexingError && (
                <p><AlertCircle size={14} aria-hidden="true" /> {pendingUpload.indexingError}</p>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={onClearUpload} disabled={isUploading}>
                <X className="w-4 h-4 mr-2" /> Chuẩn bị tệp khác
              </Button>
            </div>
          )}
          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 mt-2"
            disabled={isUploading || Boolean(uploadBlockedReason)}
            title={uploadBlockedReason || 'Tải PDF làm tài liệu riêng của lớp'}
          >
            {isUploading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Đang tải lên...</> : <><Upload className="w-4 h-4 mr-2" /> Tải tài liệu</>}
          </Button>
          <Button type="button" variant="outline" className="w-full mt-2 border-orange-200 text-orange-600 hover:bg-orange-50" disabled={isUploading || !courseId || !selectedClassOption} onClick={onOpenWebsiteImport}>
            <Globe className="w-4 h-4 mr-2" /> Nhập tài liệu từ URL
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
