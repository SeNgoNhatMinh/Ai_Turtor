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
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../../utils/displayNames';

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
    try {
      const data = await adminAcademicApi.getClassSections(courseId);
      setClassSections(Array.isArray(data) ? data : []);
    } catch (error) {
      setClassSections([]);
      triggerToast(getUserFacingError(error, 'Không thể tải danh sách lớp học phần.'));
    } finally {
      setAcademicLoading(false);
    }
  };

  const handleCourseSelect = (courseId) => {
    setSelectedCourseId(courseId);
    loadClassSections(courseId);
  };

  const resolveStudentAccount = async (rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value) return null;
    try {
      const users = await adminUsersApi.getAdminUsers(value, 'STUDENT');
      const normalized = value.toLowerCase();
      return users.find((user) => {
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
      }) || users[0] || null;
    } catch {
      return null;
    }
  };

  const loadStudentEnrollments = async () => {
    const rawSearch = String(enrollmentSearchId || '').trim();
    if (!rawSearch) {
      triggerToast('Nhập mã sinh viên, email hoặc mã tài khoản để tìm kiếm.');
      return;
    }
    setEnrollmentsLoading(true);
    try {
      const student = await resolveStudentAccount(rawSearch);
      const searchId = getPersonId(student) || rawSearch;
      const data = await adminAcademicApi.getStudentEnrollments(searchId);
      const items = normalizeEnrollments(data).map((enrollment) => ({
        ...enrollment,
        studentName: enrollment.studentName || getPersonDisplayName(student, 'Sinh viên'),
        studentEmail: enrollment.studentEmail || getPersonEmail(student),
      }));

      setStudentEnrollments(items);
      if (items.length === 0) {
        triggerToast('Không tìm thấy ghi danh của sinh viên này.');
      }
    } catch (error) {
      setStudentEnrollments([]);
      triggerToast(getUserFacingError(error, 'Không thể tải dữ liệu ghi danh.'));
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  const handleCreateSemester = async (values) => {
    await adminAcademicApi.createSemester({ semesterCode: values.semesterCode, name: values.name, status: 'ACTIVE' });
    triggerToast('Đã tạo học kỳ mới.');
    formSemester.resetFields();
    loadSemesters();
  };

  const handleCreateCourse = async (values) => {
    await adminAcademicApi.createCourse({ courseId: values.courseId, courseName: values.courseName, credits: values.credits, status: 'ACTIVE' });
    triggerToast('Đã tạo môn học mới.');
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
    triggerToast('Đã tạo lớp học phần mới.');
    formClass.resetFields();
    if (selectedCourseId) loadClassSections(selectedCourseId);
  };

  const handleCreateEnrollment = async (values) => {
    try {
      const student = await resolveStudentAccount(values.studentId);
      const resolvedStudentId = getPersonId(student) || values.studentId;
      await adminAcademicApi.createEnrollment({
        studentId: resolvedStudentId,
        courseId: values.courseId,
        classId: values.classId,
        status: 'ACTIVE',
      });
      triggerToast('Đã ghi danh sinh viên vào lớp.');
      formEnroll.resetFields();
      setStudentEnrollments((current) => current.map((enrollment) => ({
        ...enrollment,
        studentName: enrollment.studentName || getPersonDisplayName(student, 'Sinh viên'),
        studentEmail: enrollment.studentEmail || getPersonEmail(student),
      })));
      if (enrollmentSearchId === values.studentId || enrollmentSearchId === resolvedStudentId) loadStudentEnrollments();
    } catch {
      triggerToast('Không thể ghi danh sinh viên.');
    }
  };

  const handleDeleteSemester = (record) => {
    const semesterCode = getSemesterCode(record);
    if (!semesterCode) return triggerToast('Học kỳ này thiếu mã định danh.');
    confirmDanger({
      title: 'Xóa học kỳ?',
      content: `Học kỳ ${semesterCode} sẽ bị xóa khỏi hệ thống.`,
      onOk: async () => {
        try {
          await adminAcademicApi.deleteSemester(semesterCode);
          triggerToast('Đã xóa học kỳ.');
          await loadSemesters();
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể xóa học kỳ.'));
        }
      },
    });
  };

  const handleDeleteCourse = (record) => {
    const courseId = getCourseCode(record);
    if (!courseId) return triggerToast('Môn học này thiếu mã định danh.');
    confirmDanger({
      title: `Xóa toàn bộ môn ${courseId}?`,
      content: 'Tất cả lớp học phần, ghi danh, học liệu, bài tập, quiz và lịch sử học thuộc môn này sẽ bị xóa vĩnh viễn.',
      okText: 'Xóa toàn bộ',
      onOk: async () => {
        try {
          await adminAcademicApi.deleteCourse(courseId, { cascade: true });
          triggerToast('Đã xóa môn học và toàn bộ dữ liệu liên quan.');
          await loadCourses();
          if (selectedCourseId === courseId) {
            setSelectedCourseId('');
            setClassSections([]);
          }
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể xóa môn học.'));
        }
      },
    });
  };

  const handleDeleteClassSection = (record) => {
    const courseId = record.courseId || selectedCourseId;
    const classId = getClassCode(record);
    if (!courseId || !classId) return triggerToast('Lớp học phần thiếu mã môn hoặc mã lớp.');
    confirmDanger({
      title: 'Xóa lớp học phần?',
      content: `Lớp ${classId} của môn ${courseId} sẽ bị xóa.`,
      onOk: async () => {
        try {
          await adminAcademicApi.deleteClassSection(courseId, classId);
          triggerToast('Đã xóa lớp học phần.');
          await loadClassSections(courseId);
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể xóa lớp học phần.'));
        }
      },
    });
  };

  const handleDeleteEnrollment = (record) => {
    const enrollmentId = getEnrollmentId(record);
    const courseId = record.courseId;
    const classId = record.classId;
    const studentId = record.studentId || record.userId;
    if (!enrollmentId && (!courseId || !classId || !studentId)) {
      return triggerToast('Bản ghi thiếu mã cần thiết để xóa ghi danh.');
    }
    confirmDanger({
      title: 'Xóa ghi danh?',
      content: 'Sinh viên sẽ bị xóa khỏi lớp học phần đã chọn.',
      okText: 'Xóa khỏi lớp',
      onOk: async () => {
        try {
          if (enrollmentId) {
            await adminAcademicApi.deleteEnrollment(enrollmentId);
          } else {
            await adminAcademicApi.removeStudentFromClass(courseId, classId, studentId);
          }
          triggerToast('Đã xóa sinh viên khỏi lớp.');
          await loadStudentEnrollments();
        } catch (error) {
          triggerToast(getUserFacingError(error, 'Không thể xóa ghi danh.'));
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
