import { Suspense, lazy, useState } from 'react';
import AssignmentPublishCard from '../../features/teacher/materials/AssignmentPublishCard';
import TeacherMaterialUploadCard from '../../features/teacher/materials/TeacherMaterialUploadCard';
import TeacherResourceTables from '../../features/teacher/materials/TeacherResourceTables';
import { useTeacherResourceColumns } from '../../features/teacher/materials/useTeacherResourceColumns';
import AssignmentEditModal from '../../features/teacher/materials/AssignmentEditModal';

const ImportWebsiteModal = lazy(() => import('../../components/importWebsite/ImportWebsiteModal'));

function TeacherMaterialsAssignmentsTab(props) {
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const { assignmentColumns, materialColumns } = useTeacherResourceColumns(props);
  const assignment = {
    title: props.newAssignmentTitle,
    setTitle: props.setNewAssignmentTitle,
    description: props.newAssignmentDesc,
    setDescription: props.setNewAssignmentDesc,
    classId: props.newAssignmentClass,
    setClassId: props.setNewAssignmentClass,
    deadline: props.newAssignmentDeadline,
    setDeadline: props.setNewAssignmentDeadline,
    file: props.newAssignmentFile,
    setFile: props.setNewAssignmentFile,
    targetType: props.newAssignmentTargetType,
    setTargetType: props.setNewAssignmentTargetType,
    targetStudents: props.newAssignmentTargetStudents,
    setTargetStudents: props.setNewAssignmentTargetStudents,
    isPublishing: props.isPublishingAssignment,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1">
      <TeacherMaterialUploadCard
        classId={props.classId}
        materialTitle={props.materialTitle}
        setMaterialTitle={props.setMaterialTitle}
        materialFile={props.materialFile}
        setMaterialFile={props.setMaterialFile}
        isUploading={props.isUploadingMaterial}
        onUpload={props.handleTeacherUploadMaterial}
        onOpenWebsiteImport={() => setWebsiteImportOpen(true)}
      />
      <AssignmentPublishCard
        classesList={props.classesList || []}
        teacherStudents={props.teacherStudents || []}
        assignment={assignment}
        onCreate={props.onCreateAssignment}
      />
      <TeacherResourceTables
        classId={props.classId}
        assignments={props.classAssignments || []}
        assignmentColumns={assignmentColumns}
        assignmentsLoading={props.assignmentsLoading}
        onReloadAssignments={props.loadClassAssignments}
        materials={props.courseMaterials || []}
        materialColumns={materialColumns}
        onReloadMaterials={() => props.onReloadCourseMaterials?.()}
      />
      <AssignmentEditModal
        assignment={props.editingAssignment}
        open={Boolean(props.editingAssignment)}
        saving={props.isUpdatingAssignment}
        onCancel={() => props.setEditingAssignment?.(null)}
        onSave={props.handleUpdateAssignment}
      />
      {websiteImportOpen && (
        <Suspense fallback={null}>
          <ImportWebsiteModal
            open={websiteImportOpen}
            onClose={() => setWebsiteImportOpen(false)}
            courseId={props.courseId}
            classId={props.classId}
            currentUser={props.currentUser}
            materialApi={props.materialApi}
            triggerToast={props.triggerToast}
            onUploaded={props.onReloadCourseMaterials}
            isAdmin={false}
          />
        </Suspense>
      )}
    </div>
  );
}

export default TeacherMaterialsAssignmentsTab;
