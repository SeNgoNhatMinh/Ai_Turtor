import { Tabs } from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import AssignmentDetailsPanel from './components/AssignmentDetailsPanel';
import AssignmentListPanel from './components/AssignmentListPanel';
import CourseMaterialsPanel from './components/CourseMaterialsPanel';
import MaterialsCourseContext from './components/MaterialsCourseContext';

export default function MaterialsAssignmentsView({
  assignments,
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
  onDownloadMaterial,
  courseId = '',
  classId = '',
  courseOptions = [],
  enrollmentsLoading = false,
  onCourseChange,
}) {
  const tabItems = [
    {
      key: 'assignments',
      label: 'Assignments & Tasks',
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
    {
      key: 'materials',
      label: 'Course Learning Materials',
      children: (
        <CourseMaterialsPanel materials={courseMaterials} onDownload={onDownloadMaterial} />
      ),
    },
  ];

  return (
    <div className="portal-section student-materials-page">
      <PageHeader title={uiCopy.student.materials.title} description={uiCopy.student.materials.subtitle} />
      <MaterialsCourseContext
        courseId={courseId}
        classId={classId}
        courseOptions={courseOptions}
        loading={enrollmentsLoading}
        onCourseChange={onCourseChange}
      />
      <Tabs defaultActiveKey="assignments" type="card" items={tabItems} style={{ width: '100%' }} />
    </div>
  );
}
