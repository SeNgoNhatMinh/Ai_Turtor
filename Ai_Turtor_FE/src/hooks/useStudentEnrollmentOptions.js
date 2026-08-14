import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminAcademicApi } from '../services/adminAcademicApi';
import { asArray } from '../services/normalizers';
import { classIdMatches, getClassAliases, getClassCodeValue } from '../utils/academicIds';

const normalizeCourseCode = (value) => String(value || '').trim().toUpperCase();
const normalizeLookupId = (value) => String(value || '').trim();
const enrollmentCache = new Map();

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

const getEnrollmentCourseId = (item) => item?.courseId || item?.courseCode || item?.course?.courseId || item?.course?.id || '';
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

export function useStudentEnrollmentOptions({
  studentId,
  lookupIds = [],
  courseId,
  classId,
  setCourseId,
  setClassId,
}) {
  const cacheKey = useMemo(
    () => buildEnrollmentCacheKey(studentId, lookupIds),
    [lookupIds, studentId],
  );
  const cachedEnrollment = enrollmentCache.get(cacheKey);
  const [studentEnrollments, setStudentEnrollments] = useState(() => cachedEnrollment?.items || []);
  const [resolvedStudentId, setResolvedStudentId] = useState(() => cachedEnrollment?.resolvedStudentId || '');
  const [isStudentEnrollmentsLoading, setIsStudentEnrollmentsLoading] = useState(false);
  const [hasLoadedStudentEnrollments, setHasLoadedStudentEnrollments] = useState(() => Boolean(cachedEnrollment));
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const loadStudentEnrollments = useCallback(async () => {
    const baseCandidates = [studentId, ...lookupIds].map(normalizeLookupId).filter(Boolean);
    const quotedCandidates = baseCandidates
      .filter((item) => !item.startsWith('"') && !item.endsWith('"'))
      .map((item) => `"${item}"`);
    const candidates = [...new Set([...baseCandidates, ...quotedCandidates])];
    if (candidates.length === 0) {
      enrollmentCache.delete(cacheKey);
      setStudentEnrollments([]);
      setResolvedStudentId('');
      setHasLoadedStudentEnrollments(true);
      return { items: [], resolvedStudentId: '' };
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsStudentEnrollmentsLoading(true);
    try {
      let items = [];
      let matchedStudentId = '';
      for (const candidateId of candidates) {
        try {
          const data = await adminAcademicApi.getStudentEnrollments(candidateId, {
            signal: controller.signal,
            force: true,
          });
          items = expandEnrollmentItems(data);
          if (items.length > 0) {
            matchedStudentId = candidateId;
            break;
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          if (candidateId === candidates[candidates.length - 1]) throw error;
        }
      }
      const nextResolvedStudentId = matchedStudentId || getEnrollmentStudentId(items[0]) || studentId || '';
      enrollmentCache.set(cacheKey, { items, resolvedStudentId: nextResolvedStudentId });
      setStudentEnrollments(items);
      setResolvedStudentId(nextResolvedStudentId);
      setHasLoadedStudentEnrollments(true);

      const validEnrollments = items.filter((item) => getEnrollmentCourseId(item) && getEnrollmentClassId(item));
      if (validEnrollments.length === 0) {
        setCourseId('');
        setClassId('');
        return { items, resolvedStudentId: nextResolvedStudentId };
      }

      const currentEnrollment = validEnrollments.find(
        (item) => normalizeCourseCode(getEnrollmentCourseId(item)) === normalizeCourseCode(courseId)
          && classIdMatches(getEnrollmentClassId(item), classId)
      );
      if (currentEnrollment) {
        const canonicalClassId = getEnrollmentClassId(currentEnrollment);
        if (canonicalClassId && canonicalClassId !== classId) {
          setClassId(canonicalClassId);
        }
        return { items, resolvedStudentId: nextResolvedStudentId };
      }

      const sameCourseEnrollment = validEnrollments.find((item) => (
        normalizeCourseCode(getEnrollmentCourseId(item)) === normalizeCourseCode(courseId)
      ));
      if (sameCourseEnrollment) {
        setClassId(getEnrollmentClassId(sameCourseEnrollment));
        return { items, resolvedStudentId: nextResolvedStudentId };
      }

      const aliasCourseEnrollment = findAliasEnrollment(validEnrollments, courseId);
      if (aliasCourseEnrollment) {
        setCourseId(getEnrollmentCourseId(aliasCourseEnrollment));
        setClassId(getEnrollmentClassId(aliasCourseEnrollment));
        return { items, resolvedStudentId: nextResolvedStudentId };
      }

      const firstEnrollment = validEnrollments[0];
      if (firstEnrollment) {
        setCourseId(getEnrollmentCourseId(firstEnrollment));
        setClassId(getEnrollmentClassId(firstEnrollment));
      }
      return { items, resolvedStudentId: nextResolvedStudentId };
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn('Failed to load student enrollments:', error);
      const cached = enrollmentCache.get(cacheKey);
      setStudentEnrollments(cached?.items || []);
      setResolvedStudentId(cached?.resolvedStudentId || '');
      setHasLoadedStudentEnrollments(true);
      return cached || { items: [], resolvedStudentId: '' };
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsStudentEnrollmentsLoading(false);
      }
    }
  }, [cacheKey, classId, courseId, lookupIds, setClassId, setCourseId, studentId]);

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
      .filter((item) => !courseId || normalizeCourseCode(getEnrollmentCourseId(item)) === normalizeCourseCode(courseId))
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
      normalizeCourseCode(getEnrollmentCourseId(item)) === normalizedCourseId && getEnrollmentClassId(item)
    ));

    setCourseId(matchingEnrollment ? getEnrollmentCourseId(matchingEnrollment) : normalizedCourseId);
    setClassId(matchingEnrollment ? getEnrollmentClassId(matchingEnrollment) : '');
  }, [setClassId, setCourseId, studentEnrollments]);

  const ensureEnrollmentContext = useCallback(async (preferredCourseId = '') => {
    let items = studentEnrollments;
    if (!hasLoadedStudentEnrollments || items.length === 0) {
      const loaded = await loadStudentEnrollments();
      items = loaded?.items || items;
    }

    const validEnrollments = items.filter((item) => getEnrollmentCourseId(item) && getEnrollmentClassId(item));
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
  }, [classId, courseId, hasLoadedStudentEnrollments, loadStudentEnrollments, setClassId, setCourseId, studentEnrollments]);

  return {
    studentEnrollments,
    courseOptions,
    classOptions,
    resolvedStudentId,
    isStudentEnrollmentsLoading,
    hasLoadedStudentEnrollments,
    hasStudentEnrollments: courseOptions.length > 0 && classOptions.length > 0,
    loadStudentEnrollments,
    selectCourse,
    ensureEnrollmentContext,
  };
}
