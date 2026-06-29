import { useCallback, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { asArray } from '../services/normalizers';

const normalizeCourseCode = (value) => String(value || '').trim().toUpperCase();

const findAliasEnrollment = (items, requestedCourseId) => {
  const requested = normalizeCourseCode(requestedCourseId);
  if (!requested) return null;
  const candidates = items.filter((item) => item.courseId && item.classId);
  return candidates.find((item) => {
    const canonical = normalizeCourseCode(item.courseId);
    return canonical !== requested && canonical.startsWith(requested);
  }) || null;
};

export function useStudentEnrollmentOptions({
  studentId,
  courseId,
  classId,
  setCourseId,
  setClassId,
}) {
  const [studentEnrollments, setStudentEnrollments] = useState([]);

  const loadStudentEnrollments = useCallback(async () => {
    if (!studentId) {
      setStudentEnrollments([]);
      return;
    }

    try {
      const data = await apiService.getStudentEnrollments(studentId);
      const items = asArray(data, 'enrollments', 'content', 'courses');
      setStudentEnrollments(items);

      const hasCurrentSelection = items.some(
        (item) => item.courseId === courseId && item.classId === classId
      );
      if (hasCurrentSelection) return;

      const sameCourseEnrollment = items.find((item) => item.courseId === courseId && item.classId);
      if (sameCourseEnrollment) {
        setClassId(sameCourseEnrollment.classId);
        return;
      }

      const aliasCourseEnrollment = findAliasEnrollment(items, courseId);
      if (aliasCourseEnrollment) {
        setCourseId(aliasCourseEnrollment.courseId);
        setClassId(aliasCourseEnrollment.classId);
        return;
      }

      const firstEnrollment = items.find((item) => item.courseId && item.classId);
      if (firstEnrollment) {
        setCourseId(firstEnrollment.courseId);
        setClassId(firstEnrollment.classId);
      }
    } catch (error) {
      console.warn('Failed to load student enrollments:', error);
      setStudentEnrollments([]);
    }
  }, [classId, courseId, setClassId, setCourseId, studentId]);

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

  const classOptions = useMemo(() => (
    studentEnrollments
      .filter((item) => !courseId || item.courseId === courseId)
      .map((item) => {
        const nextClassId = item.classId || item.classCode || item.id;
        return {
          value: nextClassId,
          label: item.className ? `${nextClassId} - ${item.className}` : `Class ${nextClassId}`,
          status: item.status,
        };
      })
      .filter((item) => item.value)
  ), [studentEnrollments, courseId]);

  return {
    studentEnrollments,
    courseOptions,
    classOptions,
    loadStudentEnrollments,
  };
}
