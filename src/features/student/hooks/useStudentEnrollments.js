import { useState, useCallback, useMemo, useEffect } from 'react';
import { apiService } from '../../../services/api';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';

export function useStudentEnrollments() {
  const getStudentUserId = useAuthStore(state => state.getStudentUserId);
  const courseId = useUiStore(state => state.courseId);
  const setCourseId = useUiStore(state => state.setCourseId);
  const classId = useUiStore(state => state.classId);
  const setClassId = useUiStore(state => state.setClassId);
  const activeRole = useAuthStore(state => state.activeRole);

  const [studentEnrollments, setStudentEnrollments] = useState([]);

  const loadStudentEnrollments = useCallback(async () => {
    const studentId = getStudentUserId();
    if (!studentId) return;
    try {
      const data = await apiService.getStudentEnrollments(studentId);
      setStudentEnrollments(Array.isArray(data) ? data : data?.content || []);
    } catch (e) {
      console.warn('Failed to load enrollments:', e);
      setStudentEnrollments([]);
    }
  }, [getStudentUserId]);

  useEffect(() => {
    if (activeRole === 'student') {
      loadStudentEnrollments();
    }
  }, [activeRole, loadStudentEnrollments]);

  useEffect(() => {
    if (activeRole !== 'student' || studentEnrollments.length === 0) return;
    const hasCurrentClass = studentEnrollments.some((item) => item.courseId === courseId && item.classId === classId);
    if (hasCurrentClass) return;

    const sameCourseEnrollment = studentEnrollments.find((item) => item.courseId === courseId && item.classId);
    if (sameCourseEnrollment) {
      setClassId(sameCourseEnrollment.classId);
      return;
    }

    const firstEnrollment = studentEnrollments.find((item) => item.courseId && item.classId);
    if (firstEnrollment) {
      setCourseId(firstEnrollment.courseId);
      setClassId(firstEnrollment.classId);
    }
  }, [activeRole, studentEnrollments, courseId, classId, setCourseId, setClassId]);

  const courseOptions = useMemo(() => {
    const byCourse = new Map();
    studentEnrollments.forEach((item) => {
      const nextCourseId = item.courseId || item.courseCode || item.id;
      if (!nextCourseId || byCourse.has(nextCourseId)) return;
      byCourse.set(nextCourseId, {
        value: nextCourseId,
        label: item.courseName ? `${nextCourseId} - ${item.courseName}` : nextCourseId,
      });
    });
    return Array.from(byCourse.values());
  }, [studentEnrollments]);

  const classOptions = useMemo(() => {
    return studentEnrollments
      .filter((item) => !courseId || item.courseId === courseId)
      .map((item) => {
        const nextClassId = item.classId || item.classCode || item.id;
        return {
          value: nextClassId,
          label: item.className ? `${nextClassId} - ${item.className}` : `Class ${nextClassId}`,
          status: item.status,
        };
      })
      .filter((item) => item.value);
  }, [studentEnrollments, courseId]);

  return {
    studentEnrollments,
    courseOptions,
    classOptions,
    loadStudentEnrollments
  };
}
