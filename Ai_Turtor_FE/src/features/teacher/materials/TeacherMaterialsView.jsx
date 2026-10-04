import AssignmentEditModal from './AssignmentEditModal';
import AssignmentPublishCard from './AssignmentPublishCard';
import TeacherResourceTables from './TeacherResourceTables';
import { useTeacherResourceColumns } from './useTeacherResourceColumns';

export default function TeacherMaterialsView({
  scope,
  assignments,
  materials,
  teacherStudents = [],
  courseMaterials = [],
  onReloadCourseMaterials,
  onDownloadMaterial,
}) {
  const { assignmentColumns, materialColumns } = useTeacherResourceColumns({
    assignmentActions: {
      onDownload: assignments.download,
      onEdit: assignments.edit,
      onDelete: assignments.remove,
    },
    materialActions: {
      onDownload: onDownloadMaterial,
      canManage: () => false,
      pendingId: materials.actionId,
    },
  });

  return (
    <div className="teacher-materials-grid">
      <AssignmentPublishCard
        classesList={scope.classesList}
        classesLoading={scope.classesLoading}
        teacherStudents={teacherStudents}
        assignment={assignments.draft}
        onClassChange={scope.onClassChange}
        onCreate={assignments.create}
      />

      <TeacherResourceTables
        classId={scope.classId}
        assignments={assignments.records}
        assignmentColumns={assignmentColumns}
        assignmentsLoading={assignments.loading}
        onReloadAssignments={assignments.load}
        materials={courseMaterials}
        materialColumns={materialColumns}
        onReloadMaterials={onReloadCourseMaterials}
      />

      <AssignmentEditModal
        assignment={assignments.editing}
        open={Boolean(assignments.editing)}
        saving={assignments.updating}
        onCancel={() => assignments.setEditing(null)}
        onSave={assignments.update}
      />

    </div>
  );
}
