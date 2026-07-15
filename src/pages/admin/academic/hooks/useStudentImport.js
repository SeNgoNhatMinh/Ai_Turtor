import { useState } from 'react';
import { adminAcademicApi } from '../../../../services/adminAcademicApi';
import { getUserFacingError } from '../../../../services/apiClient';

export function useStudentImport({
  triggerToast,
  courses,
  formStudentImport,
  enrollmentSearchId,
  loadStudentEnrollments,
}) {
  const [studentImportCourseId, setStudentImportCourseId] = useState('');
  const [studentImportClassId, setStudentImportClassId] = useState('');
  const [studentImportClasses, setStudentImportClasses] = useState([]);
  const [studentImportFile, setStudentImportFile] = useState(null);
  const [studentImportLoading, setStudentImportLoading] = useState(false);
  const [studentImportResult, setStudentImportResult] = useState(null);

  const loadStudentImportClasses = async (courseId) => {
    setStudentImportCourseId(courseId);
    setStudentImportClassId('');
    formStudentImport.setFieldsValue({ classId: undefined });
    setStudentImportResult(null);
    if (!courseId) {
      setStudentImportClasses([]);
      return;
    }
    try {
      const data = await adminAcademicApi.getClassSections(courseId);
      setStudentImportClasses(Array.isArray(data) ? data : []);
    } catch (error) {
      setStudentImportClasses([]);
      triggerToast(getUserFacingError(error, 'Unable to load class sections.'));
    }
  };

  const handleDownloadStudentTemplate = async () => {
    try {
      const blob = await adminAcademicApi.downloadStudentImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student-enrollment-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to download student import template.'));
    }
  };

  const handleStudentImport = async (dryRun) => {
    const values = await formStudentImport.validateFields();
    if (!studentImportFile) {
      triggerToast('Please choose an Excel file first.');
      return;
    }
    const selectedCourse = courses.find(c => c.courseId === values.courseId);
    const formData = new FormData();
    formData.append('file', studentImportFile);
    setStudentImportLoading(true);
    try {
      const result = await adminAcademicApi.importClassStudents(values.courseId, values.classId, formData, {
        semesterId: values.semesterId,
        courseName: values.courseName || selectedCourse?.courseName,
        status: values.status || 'ACTIVE',
        dryRun,
      });
      setStudentImportResult(result);
      triggerToast(dryRun ? 'Student import validation finished.' : 'Students imported successfully.');
      if (!dryRun && enrollmentSearchId) loadStudentEnrollments();
    } catch (error) {
      setStudentImportResult(error?.details || null);
      triggerToast(getUserFacingError(error, 'Student import failed.'));
    } finally {
      setStudentImportLoading(false);
    }
  };

  const handleFileChange = (file) => {
    setStudentImportFile(file);
    setStudentImportResult(null);
  };

  const handleFileRemove = () => {
    setStudentImportFile(null);
    setStudentImportResult(null);
  };

  return {
    studentImportCourseId,
    studentImportClassId,
    studentImportClasses,
    studentImportFile,
    studentImportLoading,
    studentImportResult,
    setStudentImportClassId,
    loadStudentImportClasses,
    handleDownloadStudentTemplate,
    handleStudentImport,
    handleFileChange,
    handleFileRemove,
  };
}
