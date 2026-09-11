import { BookOutlined, FormOutlined } from '@ant-design/icons';
import AppTabs from '../../../components/common/AppTabs';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import AssignmentDetailsPanel from './components/AssignmentDetailsPanel';
import AssignmentListPanel from './components/AssignmentListPanel';
import CourseMaterialsPanel from './components/CourseMaterialsPanel';
import MaterialsCourseContext from './components/MaterialsCourseContext';

export default function MaterialsAssignmentsView({
  assignments = [],
  assignmentsLoading = false,
  assignmentsError = '',
  onReloadAssignments,
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
      label: (
        <span className="student-materials-tab-label">
          <BookOutlined aria-hidden="true" />
          <span>Tài liệu giảng viên</span>
          <span className="student-materials-tab-count" aria-hidden="true">{courseMaterials.length}</span>
        </span>
      ),
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
      label: (
        <span className="student-materials-tab-label">
          <FormOutlined aria-hidden="true" />
          <span>Bài tập được giao</span>
          <span className="student-materials-tab-count" aria-hidden="true">{assignments.length}</span>
        </span>
      ),
      children: (
        <div className="materials-layout">
          <AssignmentListPanel
            assignments={assignments}
            loading={assignmentsLoading}
            error={assignmentsError}
            courseId={courseId}
            selectedAssignment={selectedAssignment}
            onSelect={setSelectedAssignment}
            onRetry={onReloadAssignments}
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
      <PageHeader
        className="student-materials-page__header"
        eyebrow="Học liệu & bài tập"
        title={uiCopy.student.materials.title}
        description={uiCopy.student.materials.subtitle}
      />
      <MaterialsCourseContext
        courseId={courseId}
        classId={classId}
        courseOptions={courseOptions}
        loading={enrollmentsLoading}
        onCourseChange={onCourseChange}
      />
      <AppTabs className="student-materials-tabs" defaultActiveKey="materials" items={tabItems} />
    </div>
  );
}
