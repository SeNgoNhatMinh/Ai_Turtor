import { Suspense, lazy, useState } from 'react';
import AssignmentEditModal from './AssignmentEditModal';
import AssignmentPublishCard from './AssignmentPublishCard';
import TeacherMaterialUploadCard from './TeacherMaterialUploadCard';
import TeacherResourceTables from './TeacherResourceTables';
import { useTeacherResourceColumns } from './useTeacherResourceColumns';

const ImportWebsiteModal = lazy(() => import('../../../components/importWebsite/ImportWebsiteModal'));

export default function TeacherMaterialsView({
  scope,
  assignments,
  materials,
  teacherStudents = [],
  courseMaterials = [],
  onReloadCourseMaterials,
  onDownloadMaterial,
  materialApi,
  triggerToast,
  currentUser,
}) {
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const { assignmentColumns, materialColumns } = useTeacherResourceColumns({
    assignmentActions: {
      onDownload: assignments.download,
      onEdit: assignments.edit,
      onDelete: assignments.remove,
    },
    materialActions: {
      onDownload: onDownloadMaterial,
      pendingId: materials.actionId,
      onAction: materials.runAction,
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1">
      <TeacherMaterialUploadCard
        courseId={scope.courseId}
        classId={scope.classId}
        classesList={scope.classesList}
        classesLoading={scope.classesLoading}
        onClassChange={scope.onClassChange}
        materialTitle={materials.title}
        setMaterialTitle={materials.setTitle}
        materialFile={materials.file}
        setMaterialFile={materials.setFile}
        isUploading={materials.uploading}
        onUpload={materials.upload}
        onOpenWebsiteImport={() => setWebsiteImportOpen(true)}
      />

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

      {websiteImportOpen && (
        <Suspense fallback={null}>
          <ImportWebsiteModal
            open={websiteImportOpen}
            onClose={() => setWebsiteImportOpen(false)}
            courseId={scope.courseId}
            classId={scope.classId}
            currentUser={currentUser}
            materialApi={materialApi}
            triggerToast={triggerToast}
            onUploaded={onReloadCourseMaterials}
            isAdmin={false}
          />
        </Suspense>
      )}
    </div>
  );
}
