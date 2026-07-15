import { useState } from 'react';
import { adminAcademicApi } from '../../../../services/adminAcademicApi';
import { adminUsersApi } from '../../../../services/adminUsersApi';
import { getUserFacingError } from '../../../../services/apiClient';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import {
  getClassCode,
  getCourseCode,
  getEnrollmentId,
  getSemesterCode,
} from '../adminAcademicUtils';

const normalizeEnrollments = (data) => (
  Array.isArray(data)
    ? data
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data?.enrollments)
        ? data.enrollments
        : []
);

export function useAcademicRecords({
  triggerToast,
  formSemester,
  formCourse,
  formClass,
  formEnroll,
}) {
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [academicLoading, setAcademicLoading] = useState(false);
  const [enrollmentSearchId, setEnrollmentSearchId] = useState('');
  const [studentEnrollments, setStudentEnrollments] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

  const loadSemesters = async () => {
    const data = await adminAcademicApi.getSemesters();
    setSemesters(Array.isArray(data) ? data : []);
  };

  const loadCourses = async () => {
    const data = await adminAcademicApi.getCourses();
    setCourses(Array.isArray(data) ? data : []);
  };

  const loadClassSections = async (courseId) => {
    setAcademicLoading(true);
    const data = await adminAcademicApi.getClassSections(courseId);
    setClassSections(Array.isArray(data) ? data : []);
    setAcademicLoading(false);
  };

  const handleCourseSelect = (courseId) => {
    setSelectedCourseId(courseId);
    loadClassSections(courseId);
  };

  const resolveStudentSearchId = async (rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value) return '';
    const users = await adminUsersApi.getAdminUsers(value, 'STUDENT');
    const normalized = String(value).toLowerCase();
    const matchedUser = users.find((user) => {
      const candidates = [
        user.id,
        user._id,
        user.userId,
        user.studentId,
        user.studentCode,
        user.email,
        user.fullName,
        user.name,
      ].filter(Boolean).map((item) => String(item).toLowerCase());
      return candidates.includes(normalized);
    }) || users[0];
    return matchedUser?.studentId || matchedUser?.studentCode || matchedUser?.userId || matchedUser?.id || matchedUser?._id || value;
  };

  const loadStudentEnrollments = async () => {
    const rawSearch = String(enrollmentSearchId || '').trim();
    if (!rawSearch) {
      triggerToast('Please enter a student ID, email, or student code.');
      return;
    }
    setEnrollmentsLoading(true);
    try {
      let searchId = rawSearch;
      let data = await adminAcademicApi.getStudentEnrollments(searchId);
      let items = normalizeEnrollments(data);

      if (items.length === 0) {
        searchId = await resolveStudentSearchId(rawSearch);
        if (searchId && searchId !== rawSearch) {
          data = await adminAcademicApi.getStudentEnrollments(searchId);
          items = normalizeEnrollments(data);
        }
      }

      setStudentEnrollments(items);
      if (items.length === 0) {
        triggerToast('No enrollment records found for this student.');
      }
    } catch (error) {
      setStudentEnrollments([]);
      triggerToast(getUserFacingError(error, 'Failed to load student enrollments.'));
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  const handleCreateSemester = async (values) => {
    await adminAcademicApi.createSemester({ semesterCode: values.semesterCode, name: values.name, status: 'ACTIVE' });
    triggerToast('New term created.');
    formSemester.resetFields();
    loadSemesters();
  };

  const handleCreateCourse = async (values) => {
    await adminAcademicApi.createCourse({ courseId: values.courseId, courseName: values.courseName, credits: values.credits, status: 'ACTIVE' });
    triggerToast('New course created.');
    formCourse.resetFields();
    loadCourses();
  };

  const handleCreateClass = async (values) => {
    await adminAcademicApi.createClassSection({
      courseId: values.courseId,
      classId: values.classCode,
      teacherId: values.teacherId,
      teacherName: values.teacherName,
      teacherEmail: values.teacherEmail,
      status: 'ACTIVE',
    });
    triggerToast('New class section created.');
    formClass.resetFields();
    if (selectedCourseId) loadClassSections(selectedCourseId);
  };

  const handleCreateEnrollment = async (values) => {
    try {
      const resolvedStudentId = await resolveStudentSearchId(values.studentId);
      await adminAcademicApi.createEnrollment({
        studentId: resolvedStudentId,
        courseId: values.courseId,
        classId: values.classId,
        status: 'ACTIVE',
      });
      triggerToast('Student enrolled successfully.');
      formEnroll.resetFields();
      if (enrollmentSearchId === values.studentId || enrollmentSearchId === resolvedStudentId) loadStudentEnrollments();
    } catch {
      triggerToast('Failed to enroll student.');
    }
  };

  const handleDeleteSemester = (record, anchorRect) => {
    const semesterCode = getSemesterCode(record);
    if (!semesterCode) return triggerToast('This term is missing a code.');
    confirmDanger({
      title: 'Delete term?',
      content: `This removes term ${semesterCode}.`,
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.deleteSemester(semesterCode);
          triggerToast('Term deleted.');
          await loadSemesters();
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete term.'));
        }
      },
    });
  };

  const handleDeleteCourse = (record, anchorRect) => {
    const courseId = getCourseCode(record);
    if (!courseId) return triggerToast('This course is missing an ID.');
    confirmDanger({
      title: 'Delete course?',
      content: `This removes course ${courseId} and may affect class sections/enrollments.`,
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.deleteCourse(courseId);
          triggerToast('Course deleted.');
          await loadCourses();
          if (selectedCourseId === courseId) {
            setSelectedCourseId('');
            setClassSections([]);
          }
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete course.'));
        }
      },
    });
  };

  const handleDeleteClassSection = (record, anchorRect) => {
    const courseId = record.courseId || selectedCourseId;
    const classId = getClassCode(record);
    if (!courseId || !classId) return triggerToast('This class section is missing course or class ID.');
    confirmDanger({
      title: 'Delete class section?',
      content: `This removes ${courseId}/${classId}.`,
      anchorRect,
      onOk: async () => {
        try {
          await adminAcademicApi.deleteClassSection(courseId, classId);
          triggerToast('Class section deleted.');
          await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to delete class section.'));
        }
      },
    });
  };

  const handleDeleteEnrollment = (record, anchorRect) => {
    const enrollmentId = getEnrollmentId(record);
    const courseId = record.courseId;
    const classId = record.classId;
    const studentId = record.studentId || record.userId;
    if (!enrollmentId && (!courseId || !classId || !studentId)) {
      return triggerToast('This enrollment is missing enough IDs to remove.');
    }
    confirmDanger({
      title: 'Remove enrollment?',
      content: 'This removes the student from the selected class section.',
      okText: 'Remove',
      anchorRect,
      onOk: async () => {
        try {
          if (enrollmentId) {
            await adminAcademicApi.deleteEnrollment(enrollmentId);
          } else {
            await adminAcademicApi.removeStudentFromClass(courseId, classId, studentId);
          }
          triggerToast('Enrollment removed.');
          await loadStudentEnrollments();
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Unable to remove enrollment.'));
        }
      },
    });
  };

  return {
    semesters,
    courses,
    classSections,
    selectedCourseId,
    academicLoading,
    enrollmentSearchId,
    studentEnrollments,
    enrollmentsLoading,
    setEnrollmentSearchId,
    loadSemesters,
    loadCourses,
    loadClassSections,
    loadStudentEnrollments,
    handleCourseSelect,
    handleCreateSemester,
    handleCreateCourse,
    handleCreateClass,
    handleCreateEnrollment,
    handleDeleteSemester,
    handleDeleteCourse,
    handleDeleteClassSection,
    handleDeleteEnrollment,
  };
}
