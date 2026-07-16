import { useEffect } from 'react';
import MaterialsAssignments from '../../../pages/student/MaterialsAssignments';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import { useStudentAssignmentsController } from '../../../hooks/useStudentAssignmentsController';
import { useStudentMaterialsController } from './useStudentMaterialsController';

export default function StudentMaterialsPage({ studentId, courseId, classId, triggerToast }) {
  const assignments = useStudentAssignmentsController({ studentId, courseId, triggerToast });
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

  useEffect(() => {
    assignments.loadStudentAssignments();
    materials.loadCourseMaterials();
    // Route page owns assignment and material loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  return (
    <MaterialsAssignments
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
    />
  );
}
