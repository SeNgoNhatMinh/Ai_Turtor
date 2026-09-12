import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../../app/queryKeys';
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

const EMPTY_LIST = [];

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
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [enrollmentSearchId, setEnrollmentSearchId] = useState('');
  const [submittedEnrollmentSearch, setSubmittedEnrollmentSearch] = useState('');

  const semestersQuery = useQuery({
    queryKey: queryKeys.adminSemesters(),
    queryFn: ({ signal }) => adminAcademicApi.getSemesters({ signal }),
    staleTime: 5 * 60_000,
  });
  const coursesQuery = useQuery({
    queryKey: queryKeys.adminCourses(),
    queryFn: ({ signal }) => adminAcademicApi.getCourses({ signal }),
    staleTime: 60_000,
  });
  const classSectionsQuery = useQuery({
    queryKey: queryKeys.adminClassSections(selectedCourseId),
    queryFn: ({ signal }) => adminAcademicApi.getClassSections(selectedCourseId, { signal }),
    enabled: Boolean(selectedCourseId),
    staleTime: 30_000,
  });
  const enrollmentsQuery = useQuery({
    queryKey: queryKeys.adminStudentEnrollments(submittedEnrollmentSearch),
    queryFn: async ({ signal }) => {
      const users = await adminUsersApi.getAdminUsers(
        submittedEnrollmentSearch,
        'STUDENT',
        '',
        { signal },
      );
      const normalizedSearch = submittedEnrollmentSearch.toLowerCase();
      const student = users.find((user) => {
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
        return candidates.includes(normalizedSearch);
      }) || users[0] || null;
      const searchId = getPersonId(student) || submittedEnrollmentSearch;
      const data = await adminAcademicApi.getStudentEnrollments(searchId, { signal });
      return normalizeEnrollments(data).map((enrollment) => ({
        ...enrollment,
        studentName: enrollment.studentName || getPersonDisplayName(student, 'Sinh viên'),
        studentEmail: enrollment.studentEmail || getPersonEmail(student),
      }));
    },
    enabled: Boolean(submittedEnrollmentSearch),
    staleTime: 15_000,
  });

  useEffect(() => {
    const error = semestersQuery.error || coursesQuery.error || classSectionsQuery.error;
    if (!error) return;
    triggerToast(getUserFacingError(error, 'Không thể tải đầy đủ dữ liệu học vụ.'));
  }, [classSectionsQuery.error, coursesQuery.error, semestersQuery.error, triggerToast]);

  useEffect(() => {
    if (!enrollmentsQuery.error) return;
    triggerToast(getUserFacingError(enrollmentsQuery.error, 'Không thể tải dữ liệu ghi danh.'));
  }, [enrollmentsQuery.error, triggerToast]);

  const loadSemesters = useCallback(() => queryClient.invalidateQueries({
    queryKey: queryKeys.adminSemesters(),
    exact: true,
  }), [queryClient]);

  const loadCourses = useCallback(() => queryClient.invalidateQueries({
    queryKey: queryKeys.adminCourses(),
    exact: true,
  }), [queryClient]);

  const loadClassSections = useCallback(async (courseId = selectedCourseId) => {
    const normalizedCourseId = String(courseId || '').trim();
    if (!normalizedCourseId) return;
    if (normalizedCourseId !== selectedCourseId) setSelectedCourseId(normalizedCourseId);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.adminClassSections(normalizedCourseId),
      exact: true,
    });
  }, [queryClient, selectedCourseId]);

  const handleCourseSelect = useCallback((courseId) => {
    setSelectedCourseId(courseId || '');
  }, []);

  const loadStudentEnrollments = useCallback(async () => {
    const rawSearch = String(enrollmentSearchId || '').trim();
    if (!rawSearch) {
      triggerToast('Nhập mã sinh viên, email hoặc mã tài khoản để tìm kiếm.');
      return;
    }
    if (rawSearch === submittedEnrollmentSearch) {
      const result = await enrollmentsQuery.refetch();
      if (!result.error && result.data?.length === 0) {
        triggerToast('Không tìm thấy ghi danh của sinh viên này.');
      }
      return;
    }
    setSubmittedEnrollmentSearch(rawSearch);
  }, [enrollmentSearchId, enrollmentsQuery, submittedEnrollmentSearch, triggerToast]);

  const handleCreateSemester = async (values) => {
    await adminAcademicApi.createSemester({ semesterCode: values.semesterCode, name: values.name, status: 'ACTIVE' });
    triggerToast('Đã tạo học kỳ mới.');
    formSemester.resetFields();
    await loadSemesters();
  };

  const handleCreateCourse = async (values) => {
    await adminAcademicApi.createCourse({
      courseId: values.courseId,
      courseName: values.courseName,
      description: values.description,
      credits: values.credits,
      status: 'ACTIVE',
    });
    triggerToast('Đã tạo môn học mới.');
    formCourse.resetFields();
    await loadCourses();
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
    if (selectedCourseId) await loadClassSections(selectedCourseId);
  };

  const handleCreateEnrollment = async (values) => {
    try {
      const users = await adminUsersApi.getAdminUsers(values.studentId, 'STUDENT');
      const normalized = String(values.studentId || '').trim().toLowerCase();
      const student = users.find((user) => [
        user.id,
        user._id,
        user.userId,
        user.studentId,
        user.studentCode,
        user.email,
      ].filter(Boolean).some((item) => String(item).toLowerCase() === normalized)) || users[0] || null;
      const resolvedStudentId = getPersonId(student) || values.studentId;
      await adminAcademicApi.createEnrollment({
        studentId: resolvedStudentId,
        studentName: student ? getPersonDisplayName(student, '') : undefined,
        studentEmail: getPersonEmail(student) || undefined,
        courseId: values.courseId,
        classId: values.classId,
        status: 'ACTIVE',
      });
      triggerToast('Đã ghi danh sinh viên vào lớp.');
      formEnroll.resetFields();
      if (enrollmentSearchId === values.studentId || enrollmentSearchId === resolvedStudentId) {
        await loadStudentEnrollments();
      }
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
          queryClient.removeQueries({ queryKey: queryKeys.adminClassSections(courseId), exact: true });
          if (selectedCourseId === courseId) setSelectedCourseId('');
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
    semesters: semestersQuery.data || EMPTY_LIST,
    courses: coursesQuery.data || EMPTY_LIST,
    classSections: selectedCourseId ? classSectionsQuery.data || EMPTY_LIST : EMPTY_LIST,
    selectedCourseId,
    academicLoading: Boolean(selectedCourseId)
      && (classSectionsQuery.isPending || classSectionsQuery.isFetching),
    referenceDataLoading: semestersQuery.isPending || coursesQuery.isPending,
    enrollmentSearchId,
    studentEnrollments: enrollmentsQuery.data || EMPTY_LIST,
    enrollmentsLoading: Boolean(submittedEnrollmentSearch)
      && (enrollmentsQuery.isPending || enrollmentsQuery.isFetching),
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
