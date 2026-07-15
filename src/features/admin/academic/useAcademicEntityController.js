import { useState } from 'react';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { getUserFacingError } from '../../../services/apiClient';
import { materialsApi } from '../../../services/materialsApi';
import { confirmAction } from '../../../components/common/confirmDialog';
import {
  getClassCode,
  getCourseCode,
  getEnrollmentId,
  getRecordId,
  getSemesterCode,
} from '../../../pages/admin/academic/adminAcademicUtils';

const EMPTY_MODAL = { open: false, type: '', mode: 'view', record: null };

export function useAcademicEntityController({
  triggerToast,
  form,
  selectedCourseId,
  materialCourseId,
  loadSemesters,
  loadCourses,
  loadClassSections,
  loadStudentEnrollments,
  loadCourseMaterials,
  deleteHandlers,
}) {
  const [entityModal, setEntityModal] = useState(EMPTY_MODAL);
  const [entitySaving, setEntitySaving] = useState(false);

  const openEntityModal = (type, mode, record) => {
    const nextRecord = record || {};
    setEntityModal({ open: true, type, mode, record: nextRecord });
    if (type === 'semester') {
      form.setFieldsValue({
        semesterCode: getSemesterCode(nextRecord),
        name: nextRecord.name,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'course') {
      form.setFieldsValue({
        courseId: getCourseCode(nextRecord),
        courseName: nextRecord.courseName || nextRecord.name,
        credits: nextRecord.credits || 3,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'class') {
      form.setFieldsValue({
        courseId: nextRecord.courseId || selectedCourseId,
        classId: getClassCode(nextRecord),
        teacherId: nextRecord.teacherId,
        teacherName: nextRecord.teacherName || nextRecord.mentorName,
        teacherEmail: nextRecord.teacherEmail || nextRecord.mentorEmail,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'enrollment') {
      form.setFieldsValue({
        studentId: nextRecord.studentId || nextRecord.userId,
        courseId: nextRecord.courseId,
        classId: nextRecord.classId,
        status: nextRecord.status || 'ACTIVE',
      });
    }
    if (type === 'material') {
      form.setFieldsValue({
        title: nextRecord.title || 'Untitled Material',
        category: nextRecord.category || nextRecord.materialCategory || '',
      });
    }
  };

  const closeEntityModal = () => {
    setEntityModal(EMPTY_MODAL);
    form.resetFields();
  };

  const saveEntity = async () => {
    if (entityModal.mode === 'view') {
      closeEntityModal();
      return;
    }
    const values = await form.validateFields();
    const record = entityModal.record || {};
    setEntitySaving(true);
    try {
      if (entityModal.type === 'semester') {
        const semesterCode = getSemesterCode(record);
        await adminAcademicApi.updateSemester(semesterCode, { ...record, semesterCode, name: values.name, status: values.status });
        triggerToast('Term updated.');
        await loadSemesters();
      }
      if (entityModal.type === 'course') {
        const courseId = getCourseCode(record);
        await adminAcademicApi.updateCourse(courseId, { ...record, courseId, courseName: values.courseName, credits: values.credits, status: values.status });
        triggerToast('Course updated.');
        await loadCourses();
      }
      if (entityModal.type === 'class') {
        const courseId = record.courseId || selectedCourseId || values.courseId;
        const classId = getClassCode(record);
        await adminAcademicApi.updateClassSection(courseId, classId, {
          ...record,
          courseId,
          classId,
          teacherId: values.teacherId,
          teacherName: values.teacherName,
          teacherEmail: values.teacherEmail,
          status: values.status,
        });
        triggerToast('Class section updated.');
        await loadClassSections(courseId);
      }
      if (entityModal.type === 'enrollment') {
        const enrollmentId = getEnrollmentId(record);
        await adminAcademicApi.updateEnrollment(enrollmentId, {
          ...record,
          studentId: values.studentId,
          courseId: values.courseId,
          classId: values.classId,
          status: values.status,
        });
        triggerToast('Enrollment updated.');
        await loadStudentEnrollments();
      }
      if (entityModal.type === 'material') {
        const materialId = getRecordId(record);
        const courseId = record.courseId || materialCourseId;
        await materialsApi.updateMaterialMetadata(courseId, materialId, { ...record, title: values.title, category: values.category });
        triggerToast('Material metadata updated.');
        await loadCourseMaterials(courseId);
      }
      closeEntityModal();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to save changes.'));
    } finally {
      setEntitySaving(false);
    }
  };

  const completeCourse = (record, anchorRect) => {
    const courseId = getCourseCode(record);
    if (!courseId) return triggerToast('This course is missing an ID. Please reload and try again.');
    confirmAction({
      title: 'Mark course complete?',
      content: 'This marks the course, its classes, and enrollments as completed for routing and reporting.',
      okText: 'Mark complete',
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.completeCourse(courseId);
          triggerToast('Course marked complete.');
          await loadCourses();
          if (selectedCourseId === courseId) await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to mark course complete.'));
        }
      },
    });
  };

  const completeClass = (record, anchorRect) => {
    const courseId = record?.courseId || selectedCourseId;
    const classId = getClassCode(record);
    if (!courseId || !classId) return triggerToast('This class section is missing course/class ID. Please reload and try again.');
    confirmAction({
      title: 'Mark class complete?',
      content: 'This marks the class section and its enrollments as completed.',
      okText: 'Mark complete',
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.completeClassSection(courseId, classId);
          triggerToast('Class section marked complete.');
          await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to mark class complete.'));
        }
      },
    });
  };

  const handleAcademicAction = (type, record, key, meta) => {
    if (key === 'view' || key === 'edit') return openEntityModal(type, key, record);
    if (type === 'course' && key === 'complete') return completeCourse(record, meta?.anchorRect);
    if (type === 'class' && key === 'complete') return completeClass(record, meta?.anchorRect);
    if (type === 'semester' && key === 'delete') return deleteHandlers.semester(record, meta?.anchorRect);
    if (type === 'course' && key === 'delete') return deleteHandlers.course(record, meta?.anchorRect);
    if (type === 'class' && key === 'delete') return deleteHandlers.classSection(record, meta?.anchorRect);
    if (type === 'enrollment' && (key === 'delete' || key === 'remove')) {
      return deleteHandlers.enrollment(record, meta?.anchorRect);
    }
    return undefined;
  };

  return {
    entityModal,
    entitySaving,
    openEntityModal,
    closeEntityModal,
    saveEntity,
    handleAcademicAction,
  };
}
