import { useRef, useState } from 'react';
import { teacherApi } from '../../../services/teacherApi';
import { asArray, normalizeTeacherDashboard } from '../../../services/normalizers';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';
import { classIdMatches, getClassCodeValue } from '../../../utils/academicIds';

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
      || (section.studentCount != null ? `${section.studentCount} sinh viên` : 'Đang đếm sĩ số...'),
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
  const [classesList, setClassesList] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [teacherTopicHeatmap, setTeacherTopicHeatmap] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const loadedTeacherIdRef = useRef('');

  const applyClassStudentCount = (courseKey, classKey, count) => {
    setClassesList((current) => current.map((item) => {
      if (!belongsToScope(item, courseKey, classKey)) return item;
      return {
        ...item,
        studentCount: count,
        details: `${count} sinh viên`,
      };
    }));
  };

  const fetchAssignedClasses = async () => {
    const payload = await teacherApi.getClassSections(teacherId);
    return asArray(payload, 'content', 'classSections', 'classes').map((section) => mapClassSection(section, ''));
  };

  const fetchClassRoster = async (courseKey, classKey) => {
    if (!courseKey || !classKey) return [];
    try {
      const data = await teacherApi.getClassStudents(courseKey, classKey);
      return asArray(data, 'students', 'content');
    } catch {
      try {
        const data = await teacherApi.getClassStudents(courseKey, classKey, teacherId);
        return asArray(data, 'students', 'content');
      } catch {
        return [];
      }
    }
  };

  const hydrateClassRosters = async (assignedClasses, selectedCourseId, selectedClassId) => {
    const results = await Promise.all(assignedClasses.map(async (section) => {
      const courseKey = section.courseId;
      const classKey = section.classId || section.classCode;
      const students = await fetchClassRoster(courseKey, classKey);
      return { section, students };
    }));

    setClassesList((current) => {
      const base = current.length ? current : assignedClasses;
      return base.map((item) => {
        const match = results.find(({ section }) => (
          belongsToScope(item, section.courseId, section.classId || section.classCode)
        ));
        if (!match) return item;
        return {
          ...item,
          studentCount: match.students.length,
          details: `${match.students.length} sinh viên`,
          students: match.students.map(mapStudent),
        };
      });
    });

    const selected = results.find(({ section }) => (
      belongsToScope(section, selectedCourseId, selectedClassId)
    ));
    if (selected) {
      setTeacherStudents(selected.students.map(mapStudent));
    } else if (selectedCourseId && selectedClassId) {
      const fallback = await fetchClassRoster(selectedCourseId, selectedClassId);
      setTeacherStudents(fallback.map(mapStudent));
    } else {
      setTeacherStudents([]);
    }
  };

  const loadTeacherDashboard = async ({ forceClasses = false } = {}) => {
    if (!teacherId) {
      loadedTeacherIdRef.current = '';
      setClassesList([]);
      setTeacherStudents([]);
      setTeacherTopicHeatmap([]);
      return;
    }

    const shouldReloadClasses = forceClasses || loadedTeacherIdRef.current !== teacherId;
    if (shouldReloadClasses) setClassesLoading(true);
    if (courseId && classId) setStudentsLoading(true);

    try {
      let assignedClasses = classesList;
      if (shouldReloadClasses) {
        try {
          assignedClasses = await fetchAssignedClasses();
          setClassesList(assignedClasses);
          loadedTeacherIdRef.current = teacherId;
        } catch {
          loadedTeacherIdRef.current = '';
          assignedClasses = [];
        } finally {
          setClassesLoading(false);
        }
      }

      const studentPromise = (async () => {
        try {
          await hydrateClassRosters(assignedClasses, courseId, classId);
        } catch {
          if (courseId && classId) {
            const fallback = await fetchClassRoster(courseId, classId);
            setTeacherStudents(fallback.map(mapStudent));
            applyClassStudentCount(courseId, classId, fallback.length);
          } else {
            setTeacherStudents([]);
          }
        } finally {
          setStudentsLoading(false);
        }
      })();

      const heatmapPromise = (async () => {
        try {
          const data = await teacherApi.getDashboard(teacherId, courseId, classId);
          const normalized = normalizeTeacherDashboard(data);
          setTeacherTopicHeatmap(resolveHeatmap(data, normalized));
          if (loadedTeacherIdRef.current !== teacherId && normalized.classSections.length) {
            setClassesList(attachStudentCounts(normalized.classSections, normalized.students));
            loadedTeacherIdRef.current = teacherId;
          }
        } catch {
          if (loadedTeacherIdRef.current !== teacherId) {
            setTeacherTopicHeatmap([]);
          }
        }
      })();

      await Promise.all([studentPromise, heatmapPromise]);
    } finally {
      setClassesLoading(false);
      setStudentsLoading(false);
    }
  };

  return {
    classesList,
    teacherStudents,
    teacherTopicHeatmap,
    classesLoading,
    studentsLoading,
    teacherDashboardLoading: classesLoading,
    loadTeacherDashboard,
  };
}
