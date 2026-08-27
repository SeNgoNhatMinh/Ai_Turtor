import { useEffect, useMemo, useRef } from 'react';
import { AlertCircle, FileText, Globe, Upload, X } from 'lucide-react';
import { Button, Card, Input, Select, Tag } from 'antd';
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
    if (!materialFile && fileInputRef.current) fileInputRef.current.value = '';
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
    <Card
      className="teacher-resource-form-card"
      title={<span className="teacher-card-title"><Upload aria-hidden="true" /> Tải tài liệu theo lớp</span>}
    >
      <p className="teacher-card-description">Tải PDF riêng cho lớp để AI Tutor sử dụng đúng phạm vi.</p>
      <form className="teacher-resource-form" onSubmit={onUpload}>
        <label className="teacher-form-field" htmlFor="materialClass">
          <span>Lớp học phần</span>
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
          />
        </label>

        {!classesLoading && !classOptions.length && (
          <p className="teacher-form-help teacher-form-help--warning" role="alert">
            Tài khoản chưa được phân công lớp. Hãy yêu cầu Admin cập nhật lớp học phần.
          </p>
        )}

        <label className="teacher-form-field" htmlFor="materialTitle">
          <span>Tên tài liệu</span>
          <Input
            id="materialTitle"
            value={materialTitle}
            onChange={(event) => setMaterialTitle(event.target.value)}
            placeholder="Để trống để dùng tên tệp"
            disabled={isUploading}
          />
        </label>

        <label className="teacher-form-field" htmlFor="materialFile">
          <span>Tệp PDF</span>
          <input
            ref={fileInputRef}
            id="materialFile"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => setMaterialFile(event.target.files[0] || null)}
            className="teacher-file-input"
            disabled={isUploading}
          />
        </label>

        {materialFile ? (
          <div className="teacher-material-file" role="status">
            <FileText aria-hidden="true" />
            <span title={materialFile.name}>{materialFile.name}</span>
            <small>{Math.max(1, Math.ceil(materialFile.size / 1024))} KB</small>
          </div>
        ) : (
          <p className="teacher-form-help">{uploadBlockedReason}</p>
        )}

        {courseId && selectedClassOption && (
          <Tag color="orange">Phạm vi: <strong>{courseId} / {selectedClassOption.classId}</strong></Tag>
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
            <Button type="text" size="small" icon={<X size={15} />} onClick={onClearUpload} disabled={isUploading}>
              Chuẩn bị tệp khác
            </Button>
          </div>
        )}

        <Button
          htmlType="submit"
          type="primary"
          block
          loading={isUploading}
          disabled={Boolean(uploadBlockedReason)}
          title={uploadBlockedReason || 'Tải PDF làm tài liệu riêng của lớp'}
          icon={<Upload size={16} />}
        >
          {isUploading ? 'Đang tải lên...' : 'Tải tài liệu'}
        </Button>
        <Button
          block
          disabled={isUploading || !courseId || !selectedClassOption}
          onClick={onOpenWebsiteImport}
          icon={<Globe size={16} />}
        >
          Nhập tài liệu từ URL
        </Button>
      </form>
    </Card>
  );
}
