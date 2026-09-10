import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/queryKeys';
import { adminAcademicApi } from '../services/adminAcademicApi';
import { asArray } from '../services/normalizers';
import { classIdMatches, getClassAliases, getClassCodeValue } from '../utils/academicIds';

const ENROLLMENT_STALE_TIME_MS = 5 * 60_000;
const EMPTY_ENROLLMENT_RESULT = { items: [], resolvedStudentId: '' };

const normalizeCourseCode = (value) => String(value || '').trim().toUpperCase();
const normalizeLookupId = (value) => String(value || '').trim();

const buildEnrollmentCacheKey = (studentId, lookupIds) => (
  [studentId, ...lookupIds]
    .map(normalizeLookupId)
    .filter(Boolean)
    .map((value) => value.toLowerCase())
    .sort()
    .join('|')
);

const getEnrollmentStudentId = (item) => (
  item?.studentId
  || item?.userId
  || item?.student?.studentId
  || item?.student?.id
  || ''
);

const getEnrollmentCourseId = (item) => (
  item?.courseId || item?.courseCode || item?.course?.courseId || item?.course?.id || ''
);

const getEnrollmentClassId = (item) => getClassCodeValue(item);

const expandEnrollmentItems = (data) => {
  const rawItems = asArray(data, 'enrollments', 'content', 'courses', 'students');
  return rawItems.flatMap((item) => {
    const nestedClasses = asArray(item?.classSections || item?.classes || item?.sections);
    if (!nestedClasses.length) return item;
    return nestedClasses.map((classSection) => ({
      ...item,
      ...classSection,
      courseId: classSection.courseId || item.courseId || item.courseCode,
      courseName: item.courseName || item.courseTitle || classSection.courseName,
      classSection,
    }));
  });
};

const findAliasEnrollment = (items, requestedCourseId) => {
  const requested = normalizeCourseCode(requestedCourseId);
  if (!requested) return null;
  const candidates = items.filter((item) => getEnrollmentCourseId(item) && getEnrollmentClassId(item));
  return candidates.find((item) => {
    const canonical = normalizeCourseCode(getEnrollmentCourseId(item));
    return canonical !== requested && canonical.startsWith(requested);
  }) || null;
};

const canTryNextIdentity = (error) => [400, 404].includes(Number(error?.status));

export function useStudentEnrollmentOptions({
  studentId,
  lookupIds = [],
  courseId,
  classId,
  setCourseId,
  setClassId,
  skipUnauthorizedRedirect = false,
}) {
  const queryClient = useQueryClient();
  const cacheKey = useMemo(
    () => buildEnrollmentCacheKey(studentId, lookupIds),
    [lookupIds, studentId],
  );
  const candidates = useMemo(() => {
    const baseCandidates = [studentId, ...lookupIds].map(normalizeLookupId).filter(Boolean);
    const quotedCandidates = baseCandidates
      .filter((item) => !item.startsWith('"') && !item.endsWith('"'))
      .map((item) => `"${item}"`);
    return [...new Set([...baseCandidates, ...quotedCandidates])];
  }, [lookupIds, studentId]);
  const queryKey = useMemo(() => queryKeys.studentEnrollments(cacheKey), [cacheKey]);

  const fetchStudentEnrollments = useCallback(async ({ signal }) => {
    if (candidates.length === 0) return EMPTY_ENROLLMENT_RESULT;

    for (const [index, candidateId] of candidates.entries()) {
      try {
        const data = await adminAcademicApi.getStudentEnrollments(candidateId, {
          signal,
          retries: 0,
          skipUnauthorizedRedirect,
        });
        const items = expandEnrollmentItems(data);
        if (items.length > 0) {
          return {
            items,
            resolvedStudentId: candidateId || getEnrollmentStudentId(items[0]) || studentId || '',
          };
        }
      } catch (error) {
        if (signal.aborted) throw error;
        const isLastCandidate = index === candidates.length - 1;
        if (isLastCandidate || !canTryNextIdentity(error)) throw error;
      }
    }

    return { items: [], resolvedStudentId: studentId || '' };
  }, [candidates, skipUnauthorizedRedirect, studentId]);

  const enrollmentQuery = useQuery({
    queryKey,
    queryFn: fetchStudentEnrollments,
    enabled: false,
    staleTime: ENROLLMENT_STALE_TIME_MS,
  });
  const enrollmentResult = enrollmentQuery.data || EMPTY_ENROLLMENT_RESULT;
  const studentEnrollments = enrollmentResult.items;
  const resolvedStudentId = enrollmentResult.resolvedStudentId;
  const hasLoadedStudentEnrollments = enrollmentQuery.data !== undefined || enrollmentQuery.isFetched;

  const applyEnrollmentContext = useCallback((result) => {
    const items = result?.items || [];
    const validEnrollments = items.filter((item) => (
      getEnrollmentCourseId(item) && getEnrollmentClassId(item)
    ));

    if (validEnrollments.length === 0) {
      setCourseId('');
      setClassId('');
      return result;
    }

    const currentEnrollment = validEnrollments.find((item) => (
      normalizeCourseCode(getEnrollmentCourseId(item)) === normalizeCourseCode(courseId)
      && classIdMatches(getEnrollmentClassId(item), classId)
    ));
    if (currentEnrollment) {
      const canonicalClassId = getEnrollmentClassId(currentEnrollment);
      if (canonicalClassId && canonicalClassId !== classId) setClassId(canonicalClassId);
      return result;
    }

    const sameCourseEnrollment = validEnrollments.find((item) => (
      normalizeCourseCode(getEnrollmentCourseId(item)) === normalizeCourseCode(courseId)
    ));
    if (sameCourseEnrollment) {
      setClassId(getEnrollmentClassId(sameCourseEnrollment));
      return result;
    }

    const aliasCourseEnrollment = findAliasEnrollment(validEnrollments, courseId);
    if (aliasCourseEnrollment) {
      setCourseId(getEnrollmentCourseId(aliasCourseEnrollment));
      setClassId(getEnrollmentClassId(aliasCourseEnrollment));
      return result;
    }

    const firstEnrollment = validEnrollments[0];
    setCourseId(getEnrollmentCourseId(firstEnrollment));
    setClassId(getEnrollmentClassId(firstEnrollment));
    return result;
  }, [classId, courseId, setClassId, setCourseId]);

  const loadStudentEnrollments = useCallback(async ({ force = false } = {}) => {
    if (candidates.length === 0) {
      queryClient.setQueryData(queryKey, EMPTY_ENROLLMENT_RESULT);
      return applyEnrollmentContext(EMPTY_ENROLLMENT_RESULT);
    }

    try {
      const result = await queryClient.fetchQuery({
        queryKey,
        queryFn: fetchStudentEnrollments,
        staleTime: force ? 0 : ENROLLMENT_STALE_TIME_MS,
      });
      return applyEnrollmentContext(result);
    } catch (error) {
      console.warn('Failed to load student enrollments:', error);
      return queryClient.getQueryData(queryKey) || EMPTY_ENROLLMENT_RESULT;
    }
  }, [
    applyEnrollmentContext,
    candidates.length,
    fetchStudentEnrollments,
    queryClient,
    queryKey,
  ]);

  const courseOptions = useMemo(() => {
    const byCourse = new Map();
    studentEnrollments.forEach((item) => {
      const nextCourseId = getEnrollmentCourseId(item);
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
      .filter((item) => (
        !courseId || normalizeCourseCode(getEnrollmentCourseId(item)) === normalizeCourseCode(courseId)
      ))
      .map((item) => {
        const nextClassId = getEnrollmentClassId(item);
        return {
          value: nextClassId,
          label: item.className ? `${nextClassId} - ${item.className}` : `Class ${nextClassId}`,
          aliases: getClassAliases(item),
          status: item.status,
        };
      })
      .filter((item) => item.value)
  ), [studentEnrollments, courseId]);

  const selectCourse = useCallback((nextCourseId) => {
    const normalizedCourseId = normalizeCourseCode(nextCourseId);
    const matchingEnrollment = studentEnrollments.find((item) => (
      normalizeCourseCode(getEnrollmentCourseId(item)) === normalizedCourseId
      && getEnrollmentClassId(item)
    ));

    setCourseId(matchingEnrollment ? getEnrollmentCourseId(matchingEnrollment) : normalizedCourseId);
    setClassId(matchingEnrollment ? getEnrollmentClassId(matchingEnrollment) : '');
  }, [setClassId, setCourseId, studentEnrollments]);

  const ensureEnrollmentContext = useCallback(async (preferredCourseId = '') => {
    if (hasLoadedStudentEnrollments && studentEnrollments.length === 0) return null;

    let items = studentEnrollments;
    if (!hasLoadedStudentEnrollments) {
      const loaded = await loadStudentEnrollments();
      items = loaded?.items || items;
    }

    const validEnrollments = items.filter((item) => (
      getEnrollmentCourseId(item) && getEnrollmentClassId(item)
    ));
    if (validEnrollments.length === 0) return null;

    const preferredCourse = normalizeCourseCode(preferredCourseId || courseId);
    const preferredClass = classId;
    const selectedEnrollment = validEnrollments.find((item) => (
      normalizeCourseCode(getEnrollmentCourseId(item)) === preferredCourse
      && (!preferredClass || classIdMatches(getEnrollmentClassId(item), preferredClass))
    )) || validEnrollments.find((item) => (
      normalizeCourseCode(getEnrollmentCourseId(item)) === preferredCourse
    )) || validEnrollments[0];

    const nextCourseId = getEnrollmentCourseId(selectedEnrollment);
    const nextClassId = getEnrollmentClassId(selectedEnrollment);
    setCourseId(nextCourseId);
    setClassId(nextClassId);
    return { courseId: nextCourseId, classId: nextClassId };
  }, [
    classId,
    courseId,
    hasLoadedStudentEnrollments,
    loadStudentEnrollments,
    setClassId,
    setCourseId,
    studentEnrollments,
  ]);

  return {
    studentEnrollments,
    courseOptions,
    classOptions,
    resolvedStudentId,
    isStudentEnrollmentsLoading: enrollmentQuery.isFetching,
    hasLoadedStudentEnrollments,
    hasStudentEnrollments: studentEnrollments.some(
      (item) => getEnrollmentCourseId(item) && getEnrollmentClassId(item),
    ),
    loadStudentEnrollments,
    selectCourse,
    ensureEnrollmentContext,
  };
}
