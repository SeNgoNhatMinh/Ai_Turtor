import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminAcademicApi } from '../services/adminAcademicApi';
import { asArray } from '../services/normalizers';
import { classIdMatches, getClassAliases, getClassCodeValue } from '../utils/academicIds';

const normalizeCourseCode = (value) => String(value || '').trim().toUpperCase();
const normalizeLookupId = (value) => String(value || '').trim();

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
  const [studentEnrollments, setStudentEnrollments] = useState([]);
  const [resolvedStudentId, setResolvedStudentId] = useState('');
  const [isStudentEnrollmentsLoading, setIsStudentEnrollmentsLoading] = useState(false);
  const [hasLoadedStudentEnrollments, setHasLoadedStudentEnrollments] = useState(false);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const loadStudentEnrollments = useCallback(async () => {
    const baseCandidates = [studentId, ...lookupIds].map(normalizeLookupId).filter(Boolean);
    const quotedCandidates = baseCandidates
      .filter((item) => !item.startsWith('"') && !item.endsWith('"'))
      .map((item) => `"${item}"`);
    const candidates = [...new Set([...baseCandidates, ...quotedCandidates])];
    if (candidates.length === 0) {
      setStudentEnrollments([]);
      setResolvedStudentId('');
      setHasLoadedStudentEnrollments(true);
      return;
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
      setStudentEnrollments(items);
      setResolvedStudentId(matchedStudentId || getEnrollmentStudentId(items[0]) || studentId || '');
      setHasLoadedStudentEnrollments(true);

      const validEnrollments = items.filter((item) => getEnrollmentCourseId(item) && getEnrollmentClassId(item));
      if (validEnrollments.length === 0) {
        setCourseId('');
        setClassId('');
        return;
      }

      const currentEnrollment = validEnrollments.find(
        (item) => getEnrollmentCourseId(item) === courseId && classIdMatches(getEnrollmentClassId(item), classId)
      );
      if (currentEnrollment) {
        const canonicalClassId = getEnrollmentClassId(currentEnrollment);
        if (canonicalClassId && canonicalClassId !== classId) {
          setClassId(canonicalClassId);
        }
        return;
      }

      const sameCourseEnrollment = validEnrollments.find((item) => getEnrollmentCourseId(item) === courseId);
      if (sameCourseEnrollment) {
        setClassId(getEnrollmentClassId(sameCourseEnrollment));
        return;
      }

      const aliasCourseEnrollment = findAliasEnrollment(validEnrollments, courseId);
      if (aliasCourseEnrollment) {
        setCourseId(getEnrollmentCourseId(aliasCourseEnrollment));
        setClassId(getEnrollmentClassId(aliasCourseEnrollment));
        return;
      }

      const firstEnrollment = validEnrollments[0];
      if (firstEnrollment) {
        setCourseId(getEnrollmentCourseId(firstEnrollment));
        setClassId(getEnrollmentClassId(firstEnrollment));
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn('Failed to load student enrollments:', error);
      setStudentEnrollments([]);
      setResolvedStudentId('');
      setHasLoadedStudentEnrollments(true);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsStudentEnrollmentsLoading(false);
      }
    }
  }, [classId, courseId, lookupIds, setClassId, setCourseId, studentId]);

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
      .filter((item) => !courseId || getEnrollmentCourseId(item) === courseId)
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

  return {
    studentEnrollments,
    courseOptions,
    classOptions,
    resolvedStudentId,
    isStudentEnrollmentsLoading,
    hasLoadedStudentEnrollments,
    hasStudentEnrollments: courseOptions.length > 0 && classOptions.length > 0,
    loadStudentEnrollments,
  };
}
