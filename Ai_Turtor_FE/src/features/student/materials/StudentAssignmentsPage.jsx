import { useEffect } from 'react';
import { FormOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import { useStudentAssignmentsController } from '../../../hooks/useStudentAssignmentsController';
import AssignmentDetailsPanel from './components/AssignmentDetailsPanel';
import AssignmentListPanel from './components/AssignmentListPanel';
import MaterialsCourseContext from './components/MaterialsCourseContext';
import { useStudentMaterialsController } from './useStudentMaterialsController';
import './StudentMaterialsPage.css';

export default function StudentAssignmentsPage({
  currentUser,
  studentId,
  courseId,
  setCourseId,
  classId,
  triggerToast,
  enrollment,
  onLogout,
}) {
  const assignments = useStudentAssignmentsController({
    studentId,
    studentName: currentUser?.fullName || currentUser?.name || '',
    studentEmail: currentUser?.email || '',
    courseId,
    triggerToast,
    skipUnauthorizedRedirect: true,
  });
  const form = useStudentMaterialsController({
    selectedAssignment: assignments.selectedAssignment,
    handleStudentSubmit: assignments.handleStudentSubmit,
    onDownloadAssignment: assignments.handleDownloadAssignment,
    onDownloadSubmission: assignments.handleDownloadSubmission,
  });

  const handleCourseChange = (nextCourseId) => {
    if (enrollment?.selectCourse) {
      enrollment.selectCourse(nextCourseId);
      return;
    }
    setCourseId?.(nextCourseId);
  };

  useEffect(() => {
    assignments.loadStudentAssignments();
    // Route page owns assignment loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  return (
    <div className="portal-section student-materials-page student-assignments-page">
      <PageHeader
        className="student-materials-page__header"
        eyebrow="Bài tập"
        title={uiCopy.student.assignments.title}
        description={uiCopy.student.assignments.subtitle}
      />
      <MaterialsCourseContext
        courseId={courseId}
        classId={classId}
        courseOptions={enrollment?.courseOptions || []}
        loading={enrollment?.isStudentEnrollmentsLoading || false}
        onCourseChange={handleCourseChange}
        scopeTitle="Phạm vi bài tập"
        scopeDescription="Chọn môn học để xem bài được giao cho đúng lớp."
        hint="Chỉ hiển thị bài tập của lớp học phần đang chọn."
        selectAriaLabel="Môn học của bài tập"
        icon={<FormOutlined />}
      />
      <div className="materials-layout">
        <AssignmentListPanel
          assignments={assignments.assignments}
          loading={assignments.isAssignmentsLoading}
          error={assignments.assignmentsError}
          courseId={courseId}
          selectedAssignment={assignments.selectedAssignment}
          onSelect={assignments.setSelectedAssignment}
          onRetry={assignments.loadStudentAssignments}
          onLoginAgain={onLogout}
        />
        <AssignmentDetailsPanel
          assignment={assignments.selectedAssignment}
          submissionFile={form.studentSubmissionFile}
          setSubmissionFile={form.setStudentSubmissionFile}
          submissionNote={form.studentSubmissionNote}
          setSubmissionNote={form.setStudentSubmissionNote}
          isSubmitting={form.isSubmitting}
          onSubmit={form.onStudentSubmit}
          onDownloadAssignment={form.handleDownloadAssignment}
          onDownloadSubmission={form.handleDownloadSubmission}
        />
      </div>
    </div>
  );
}
