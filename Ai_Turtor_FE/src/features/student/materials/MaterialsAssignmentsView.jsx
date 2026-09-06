import AppTabs from '../../../components/common/AppTabs';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import AssignmentDetailsPanel from './components/AssignmentDetailsPanel';
import AssignmentListPanel from './components/AssignmentListPanel';
import CourseMaterialsPanel from './components/CourseMaterialsPanel';
import MaterialsCourseContext from './components/MaterialsCourseContext';

export default function MaterialsAssignmentsView({
  assignments = [],
  selectedAssignment,
  setSelectedAssignment,
  studentSubmissionFile,
  setStudentSubmissionFile,
  studentSubmissionNote,
  setStudentSubmissionNote,
  onStudentSubmit,
  isSubmitting = false,
  onDownloadAssignment,
  onDownloadSubmission,
  courseMaterials = [],
  materialsLoading = false,
  materialsError = '',
  onReloadMaterials,
  onDownloadMaterial,
  courseId = '',
  classId = '',
  courseOptions = [],
  enrollmentsLoading = false,
  onCourseChange,
}) {
  const tabItems = [
    {
      key: 'materials',
      label: `Tài liệu giảng viên (${courseMaterials.length})`,
      children: (
        <CourseMaterialsPanel
          materials={courseMaterials}
          loading={materialsLoading}
          error={materialsError}
          courseId={courseId}
          classId={classId}
          onRetry={onReloadMaterials}
          onDownload={onDownloadMaterial}
        />
      ),
    },
    {
      key: 'assignments',
      label: `Bài tập được giao (${assignments.length})`,
      children: (
        <div className="materials-layout">
          <AssignmentListPanel
            assignments={assignments}
            courseId={courseId}
            selectedAssignment={selectedAssignment}
            onSelect={setSelectedAssignment}
          />
          <AssignmentDetailsPanel
            assignment={selectedAssignment}
            submissionFile={studentSubmissionFile}
            setSubmissionFile={setStudentSubmissionFile}
            submissionNote={studentSubmissionNote}
            setSubmissionNote={setStudentSubmissionNote}
            isSubmitting={isSubmitting}
            onSubmit={onStudentSubmit}
            onDownloadAssignment={onDownloadAssignment}
            onDownloadSubmission={onDownloadSubmission}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="portal-section student-materials-page">
      <PageHeader eyebrow="Học liệu & bài tập" title={uiCopy.student.materials.title} description={uiCopy.student.materials.subtitle} />
      <MaterialsCourseContext
        courseId={courseId}
        classId={classId}
        courseOptions={courseOptions}
        loading={enrollmentsLoading}
        onCourseChange={onCourseChange}
      />
      <AppTabs defaultActiveKey="materials" items={tabItems} />
    </div>
  );
}
