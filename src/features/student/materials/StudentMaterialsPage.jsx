import { useEffect } from 'react';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import { useStudentAssignmentsController } from '../../../hooks/useStudentAssignmentsController';
import MaterialsAssignmentsView from './MaterialsAssignmentsView';
import { useStudentMaterialsController } from './useStudentMaterialsController';
import './StudentMaterialsPage.css';

export default function StudentMaterialsPage({
  currentUser,
  studentId,
  courseId,
  setCourseId,
  classId,
  triggerToast,
  enrollment,
}) {
  const assignments = useStudentAssignmentsController({
    studentId,
    studentName: currentUser?.fullName || currentUser?.name || '',
    studentEmail: currentUser?.email || '',
    courseId,
    triggerToast,
  });
  const materials = useCourseMaterialsController({
    courseId,
    classId,
    teacherId: studentId,
    triggerToast,
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
    materials.loadCourseMaterials();
    // Route page owns assignment and material loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  return (
    <MaterialsAssignmentsView
      assignments={assignments.assignments}
      selectedAssignment={assignments.selectedAssignment}
      setSelectedAssignment={assignments.setSelectedAssignment}
      studentSubmissionFile={form.studentSubmissionFile}
      setStudentSubmissionFile={form.setStudentSubmissionFile}
      studentSubmissionNote={form.studentSubmissionNote}
      setStudentSubmissionNote={form.setStudentSubmissionNote}
      onStudentSubmit={form.onStudentSubmit}
      isSubmitting={form.isSubmitting}
      onDownloadAssignment={form.handleDownloadAssignment}
      onDownloadSubmission={form.handleDownloadSubmission}
      courseMaterials={materials.courseMaterials}
      onDownloadMaterial={materials.handleDownloadMaterial}
      courseId={courseId}
      classId={classId}
      courseOptions={enrollment?.courseOptions || []}
      enrollmentsLoading={enrollment?.isStudentEnrollmentsLoading || false}
      onCourseChange={handleCourseChange}
    />
  );
}
