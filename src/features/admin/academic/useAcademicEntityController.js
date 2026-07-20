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
        title: nextRecord.title || 'Học liệu chưa đặt tên',
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
        triggerToast('Đã cập nhật học kỳ.');
        await loadSemesters();
      }
      if (entityModal.type === 'course') {
        const courseId = getCourseCode(record);
        await adminAcademicApi.updateCourse(courseId, { ...record, courseId, courseName: values.courseName, credits: values.credits, status: values.status });
        triggerToast('Đã cập nhật môn học.');
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
        triggerToast('Đã cập nhật lớp học phần.');
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
        triggerToast('Đã cập nhật ghi danh.');
        await loadStudentEnrollments();
      }
      if (entityModal.type === 'material') {
        const materialId = getRecordId(record);
        const courseId = record.courseId || materialCourseId;
        await materialsApi.updateMaterialMetadata(courseId, materialId, { ...record, title: values.title, category: values.category });
        triggerToast('Đã cập nhật thông tin học liệu.');
        await loadCourseMaterials(courseId);
      }
      closeEntityModal();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể lưu thay đổi.'));
    } finally {
      setEntitySaving(false);
    }
  };

  const completeCourse = (record, anchorRect) => {
    const courseId = getCourseCode(record);
    if (!courseId) return triggerToast('Môn học thiếu mã định danh. Hãy tải lại và thử lại.');
    confirmAction({
      title: 'Đánh dấu môn học đã hoàn tất?',
      content: 'Các lớp và ghi danh thuộc môn học cũng sẽ được đánh dấu hoàn tất để phục vụ điều phối và báo cáo.',
      okText: 'Đánh dấu hoàn tất',
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.completeCourse(courseId);
          triggerToast('Đã đánh dấu môn học hoàn tất.');
          await loadCourses();
          if (selectedCourseId === courseId) await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể đánh dấu môn học hoàn tất.'));
        }
      },
    });
  };

  const completeClass = (record, anchorRect) => {
    const courseId = record?.courseId || selectedCourseId;
    const classId = getClassCode(record);
    if (!courseId || !classId) return triggerToast('Lớp học phần thiếu mã môn hoặc mã lớp. Hãy tải lại và thử lại.');
    confirmAction({
      title: 'Đánh dấu lớp đã hoàn tất?',
      content: 'Lớp học phần và các ghi danh liên quan sẽ được đánh dấu hoàn tất.',
      okText: 'Đánh dấu hoàn tất',
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.completeClassSection(courseId, classId);
          triggerToast('Đã đánh dấu lớp học phần hoàn tất.');
          await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể đánh dấu lớp học phần hoàn tất.'));
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
