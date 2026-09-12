import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { teacherApi } from '../../../services/teacherApi';
import { asArray, normalizeTeacherDashboard } from '../../../services/normalizers';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';
import { classIdMatches, getClassCodeValue } from '../../../utils/academicIds';

const EMPTY_LIST = [];

const mapClassSection = (section, courseId) => {
  const nestedCourseId = section.course?.courseId || section.course?.id || '';
  const stringCourseId = typeof section.course === 'string' ? section.course : '';
  const resolvedCourseId = section.courseId
    || section.courseCode
    || nestedCourseId
    || stringCourseId
    || courseId
    || '';
  const resolvedClassId = section.classId
    || section.classSection?.classId
    || section.sectionId
    || getClassCodeValue(section);
  const resolvedClassCode = section.classCode
    || section.classSection?.classCode
    || section.classSectionCode
    || resolvedClassId;
  return {
    ...section,
    semester: section.semesterId || section.semesterCode || '—',
    course: resolvedCourseId,
    courseId: resolvedCourseId,
    classCode: resolvedClassCode,
    classId: resolvedClassId,
    name: section.name || section.className || `Lớp ${resolvedClassCode || 'chưa đặt mã'}`,
    studentCount: section.studentCount,
    details: section.description
      || (section.studentCount != null ? `${section.studentCount} sinh viên` : 'Chưa tải sĩ số'),
  };
};

const mapStudent = (student) => ({
  ...student,
  id: getPersonId(student),
  name: getPersonDisplayName(student, 'Sinh viên'),
  fullName: getPersonDisplayName(student, 'Sinh viên'),
  email: getPersonEmail(student) || '—',
  status: student.status || 'ACTIVE',
  weakTopics: student.weakTopics?.length ? student.weakTopics : [],
});

const belongsToScope = (record, courseId, classId) => {
  const recordCourseId = String(record?.courseId || record?.courseCode || '').trim();
  const courseMatches = !courseId || recordCourseId.toUpperCase() === String(courseId).trim().toUpperCase();
  const classMatches = !classId || classIdMatches(getClassCodeValue(record), classId);
  return courseMatches && classMatches;
};

const attachStudentCounts = (sections, students) => {
  const hasScopedStudents = students.some((student) => (
    student?.classId || student?.classCode || student?.classSectionId || student?.classSectionCode
  ));

  return sections.map((section) => {
    const mapped = mapClassSection(section, '');
    if (!hasScopedStudents) return mapped;
    const count = students.filter((student) => (
      belongsToScope(student, mapped.courseId, mapped.classCode || mapped.classId)
    )).length;
    return {
      ...mapped,
      studentCount: count,
      details: `${count} sinh viên`,
    };
  });
};

const heatmapFromWeakTopicCounts = (counts) => {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return [];
  return Object.entries(counts).map(([label, count]) => {
    const total = Number(count) || 0;
    return {
      label,
      level: total >= 3 ? 'high' : total >= 2 ? 'medium' : 'low',
    };
  });
};

const resolveHeatmap = (data, normalized) => (
  normalized.topicHeatmap.length
    ? normalized.topicHeatmap
    : heatmapFromWeakTopicCounts(data?.weakTopicCounts)
);

export function useTeacherDashboard({ teacherId, courseId, classId }) {
  const queryClient = useQueryClient();
  const classesKey = queryKeys.teacherClasses(teacherId);
  const rosterKey = queryKeys.teacherClassRoster(teacherId, courseId, classId);
  const dashboardKey = queryKeys.teacherDashboard(teacherId, courseId, classId);

  const classesQuery = useQuery({
    queryKey: classesKey,
    queryFn: async ({ signal }) => asArray(
      await teacherApi.getClassSections(teacherId, { signal }),
      'content',
      'classSections',
      'classes',
    ).map((section) => mapClassSection(section, '')),
    enabled: Boolean(teacherId),
    staleTime: 60_000,
    retry: 1,
  });

  const rosterQuery = useQuery({
    queryKey: rosterKey,
    queryFn: async ({ signal }) => {
      try {
        const data = await teacherApi.getClassStudents(courseId, classId, '', { signal });
        return asArray(data, 'students', 'content').map(mapStudent);
      } catch (error) {
        if (signal.aborted) throw error;
        const data = await teacherApi.getClassStudents(courseId, classId, teacherId, { signal });
        return asArray(data, 'students', 'content').map(mapStudent);
      }
    },
    enabled: Boolean(teacherId && courseId && classId),
    staleTime: 30_000,
    retry: 1,
  });

  const dashboardQuery = useQuery({
    queryKey: dashboardKey,
    queryFn: ({ signal }) => teacherApi.getDashboard(teacherId, courseId, classId, { signal }),
    enabled: Boolean(teacherId),
    staleTime: 30_000,
    retry: 1,
  });

  const normalizedDashboard = useMemo(
    () => normalizeTeacherDashboard(dashboardQuery.data || {}),
    [dashboardQuery.data],
  );

  const teacherStudents = rosterQuery.data || EMPTY_LIST;
  const classesList = useMemo(() => {
    const assignedClasses = classesQuery.data?.length
      ? classesQuery.data
      : attachStudentCounts(normalizedDashboard.classSections, normalizedDashboard.students);

    if (!courseId || !classId || !rosterQuery.data) return assignedClasses;
    return assignedClasses.map((item) => {
      if (!belongsToScope(item, courseId, classId)) return item;
      return {
        ...item,
        studentCount: rosterQuery.data.length,
        details: `${rosterQuery.data.length} sinh viên`,
        students: rosterQuery.data,
      };
    });
  }, [classId, classesQuery.data, courseId, normalizedDashboard, rosterQuery.data]);

  const teacherTopicHeatmap = useMemo(
    () => resolveHeatmap(dashboardQuery.data, normalizedDashboard),
    [dashboardQuery.data, normalizedDashboard],
  );

  const loadTeacherDashboard = useCallback(async ({ forceClasses = false } = {}) => {
    const tasks = [
      queryClient.invalidateQueries({ queryKey: dashboardKey, exact: true }),
    ];
    if (courseId && classId) {
      tasks.push(queryClient.invalidateQueries({ queryKey: rosterKey, exact: true }));
    }
    if (forceClasses) {
      tasks.push(queryClient.invalidateQueries({ queryKey: classesKey, exact: true }));
    }
    await Promise.all(tasks);
  }, [classId, classesKey, courseId, dashboardKey, queryClient, rosterKey]);

  return {
    classesList,
    teacherStudents,
    teacherTopicHeatmap,
    classesLoading: Boolean(teacherId) && (classesQuery.isPending || classesQuery.isFetching),
    studentsLoading: Boolean(teacherId && courseId && classId)
      && (rosterQuery.isPending || rosterQuery.isFetching),
    teacherDashboardLoading: Boolean(teacherId)
      && (classesQuery.isPending || classesQuery.isFetching),
    error: classesQuery.error || rosterQuery.error || dashboardQuery.error,
    loadTeacherDashboard,
  };
}
