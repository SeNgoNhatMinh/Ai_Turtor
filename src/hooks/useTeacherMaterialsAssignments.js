import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { getRecordId } from '../pages/teacher/teacherPortalUtils';

export function useTeacherMaterialsAssignments({
  courseId,
  classId,
  teacherUserId,
  onReloadCourseMaterials,
  triggerToast,
}) {
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentDesc, setNewAssignmentDesc] = useState('');
  const [newAssignmentClass, setNewAssignmentClass] = useState(classId || '');
  const [newAssignmentDeadline, setNewAssignmentDeadline] = useState('');
  const [newAssignmentFile, setNewAssignmentFile] = useState(null);
  const [newAssignmentTargetType, setNewAssignmentTargetType] = useState('ALL_CLASS');
  const [newAssignmentTargetStudents, setNewAssignmentTargetStudents] = useState('');
  const [isPublishingAssignment, setIsPublishingAssignment] = useState(false);
  const [classAssignments, setClassAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [materialFile, setMaterialFile] = useState(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [materialActionId, setMaterialActionId] = useState('');

  useEffect(() => {
    if (classId) {
      setNewAssignmentClass(classId);
    }
  }, [classId]);

  const loadClassAssignments = async () => {
    if (!courseId || !classId || !teacherUserId) {
      setClassAssignments([]);
      return;
    }
    setAssignmentsLoading(true);
    try {
      const data = await apiService.getClassAssignments(courseId, classId, teacherUserId);
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.assignments)
          ? data.assignments
          : Array.isArray(data?.content)
            ? data.content
            : [];
      setClassAssignments(items);
    } catch (error) {
      setClassAssignments([]);
      triggerToast(getUserFacingError(error, 'Unable to load class assignments.'));
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const onCreateAssignment = async (event) => {
    event.preventDefault();
    if (!courseId || !newAssignmentClass || !teacherUserId) {
      triggerToast('Please choose a course and class before publishing.');
      return;
    }
    if (!newAssignmentFile) {
      triggerToast('Please choose an assignment file.');
      return;
    }
    if (newAssignmentTargetType === 'SELECTED_STUDENTS' && !newAssignmentTargetStudents.trim()) {
      triggerToast('Enter selected student IDs, separated by commas.');
      return;
    }

    const formData = new FormData();
    formData.append('file', newAssignmentFile);
    formData.append('teacherId', teacherUserId);
    formData.append('title', newAssignmentTitle.trim());
    formData.append('description', newAssignmentDesc.trim());
    formData.append('targetType', newAssignmentTargetType);
    if (newAssignmentTargetType === 'SELECTED_STUDENTS') {
      formData.append('targetStudentIds', newAssignmentTargetStudents.trim());
    }
    if (newAssignmentDeadline) {
      formData.append('dueAt', new Date(newAssignmentDeadline).toISOString());
    }

    setIsPublishingAssignment(true);
    try {
      await apiService.uploadAssignment(courseId, newAssignmentClass, formData);
      triggerToast('Assignment published.');
      setNewAssignmentTitle('');
      setNewAssignmentDesc('');
      setNewAssignmentDeadline('');
      setNewAssignmentFile(null);
      setNewAssignmentTargetType('ALL_CLASS');
      setNewAssignmentTargetStudents('');
      await loadClassAssignments();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to publish assignment.'));
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  const handleTeacherUploadMaterial = async (event) => {
    event.preventDefault();
    if (!materialFile || !courseId || !classId || !teacherUserId) {
      triggerToast('Please choose a course, class, and PDF file first.');
      return;
    }
    const fileName = materialFile.name || '';
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      triggerToast('Only PDF course materials are supported.');
      return;
    }
    setIsUploadingMaterial(true);
    const formData = new FormData();
    formData.append('file', materialFile);
    formData.append('title', materialTitle || materialFile.name);
    formData.append('uploaderRole', 'TEACHER');
    formData.append('teacherId', teacherUserId);
    formData.append('classId', classId);
    try {
      await apiService.uploadMaterial(courseId, formData);
      setMaterialFile(null);
      setMaterialTitle('');
      triggerToast('Class material upload accepted. Indexing is running in the background.');
      await onReloadCourseMaterials?.();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to upload class material.'));
    } finally {
      window.setTimeout(() => setIsUploadingMaterial(false), 2500);
    }
  };

  const handleTeacherMaterialAction = async (action, material) => {
    const materialId = getRecordId(material);
    if (!materialId) {
      triggerToast('This material is missing an ID.');
      return;
    }
    setMaterialActionId(`${action}:${materialId}`);
    try {
      if (action === 'reindex') {
        await apiService.reindexMaterial(courseId, materialId, teacherUserId);
        triggerToast('Material reindexing triggered.');
      }
      if (action === 'delete') {
        await apiService.deleteMaterial(courseId, materialId, teacherUserId);
        triggerToast('Material deleted.');
      }
      await onReloadCourseMaterials?.();
    } catch (error) {
      triggerToast(getUserFacingError(error, action === 'delete' ? 'Unable to delete material.' : 'Unable to reindex material.'));
    } finally {
      setMaterialActionId('');
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    const assignmentId = getRecordId(assignment);
    if (!assignmentId) {
      triggerToast('This assignment is missing an ID.');
      return;
    }
    try {
      await apiService.deleteAssignment(assignmentId, teacherUserId);
      triggerToast('Assignment deleted.');
      await loadClassAssignments();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to delete assignment. Delete is only allowed before submissions exist.'));
    }
  };

  const handleDownloadAssignmentFile = async (assignment) => {
    const assignmentId = getRecordId(assignment);
    if (!assignmentId) {
      triggerToast('This assignment is missing an ID.');
      return;
    }
    try {
      const blob = await apiService.downloadAssignmentFile(assignmentId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = assignment.attachmentFileName || `assignment-${assignmentId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to download assignment file.'));
    }
  };

  return {
    materialFile,
    setMaterialFile,
    materialTitle,
    setMaterialTitle,
    isUploadingMaterial,
    materialActionId,
    handleTeacherUploadMaterial,
    handleTeacherMaterialAction,
    newAssignmentTitle,
    setNewAssignmentTitle,
    newAssignmentDesc,
    setNewAssignmentDesc,
    newAssignmentClass,
    setNewAssignmentClass,
    newAssignmentDeadline,
    setNewAssignmentDeadline,
    newAssignmentFile,
    setNewAssignmentFile,
    newAssignmentTargetType,
    setNewAssignmentTargetType,
    newAssignmentTargetStudents,
    setNewAssignmentTargetStudents,
    isPublishingAssignment,
    classAssignments,
    assignmentsLoading,
    loadClassAssignments,
    onCreateAssignment,
    handleDeleteAssignment,
    handleDownloadAssignmentFile,
  };
}
