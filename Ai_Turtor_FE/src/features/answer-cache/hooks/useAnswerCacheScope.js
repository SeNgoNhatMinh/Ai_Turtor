import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, getUserFacingError, request } from '../../../services/apiClient';
import { asArray } from '../../../services/normalizers';
import { normalizeCourseOption } from '../../../services/expertTrainingNormalizers';

export function useAnswerCacheScope({ courseId, setCourseId }) {
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState('');

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setCoursesError('');
    try {
      const items = asArray(
        await request(`${API_BASE_URL}/courses`, { skipUnauthorizedRedirect: true }),
        'courses',
        'content',
      );
      const normalized = items
        .map(normalizeCourseOption)
        .filter((course) => course.id);
      setCourses(normalized);
      if (normalized.length && !String(courseId || '').trim()) {
        setCourseId?.(normalized[0].id);
      }
    } catch (reason) {
      setCourses([]);
      setCoursesError(getUserFacingError(reason, 'Không thể tải danh sách môn học.'));
    } finally {
      setLoadingCourses(false);
    }
  }, [courseId, setCourseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCourses();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

  const courseOptions = useMemo(() => courses.map((course) => ({
    value: course.id,
    label: course.name && course.name !== course.id ? `${course.id} · ${course.name}` : course.id,
  })), [courses]);

  return {
    courseOptions,
    loadingCourses,
    coursesError,
    reloadCourses: loadCourses,
  };
}
