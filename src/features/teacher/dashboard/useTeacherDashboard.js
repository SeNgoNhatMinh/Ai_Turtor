import { useState } from 'react';
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
    name: section.name || section.className || `Class ${resolvedClassId || 'section'}`,
    details: section.description || `${section.studentCount ?? '—'} students`,
  };
};

const mapStudent = (student) => ({
  ...student,
  id: getPersonId(student),
  name: getPersonDisplayName(student, 'Student'),
  email: getPersonEmail(student) || '—',
  status: student.status || 'ACTIVE',
  weakTopics: student.weakTopics?.length ? student.weakTopics : ['None'],
});

const belongsToScope = (record, courseId, classId) => {
  const recordCourseId = String(record?.courseId || record?.courseCode || '').trim();
  const courseMatches = !courseId || recordCourseId.toUpperCase() === String(courseId).trim().toUpperCase();
  const classMatches = !classId || classIdMatches(record?.classId || record?.classCode, classId);
  return courseMatches && classMatches;
};

export function useTeacherDashboard({ teacherId, courseId, classId }) {
  const [classesList, setClassesList] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [teacherTopicHeatmap, setTeacherTopicHeatmap] = useState([]);
  const [teacherDashboardLoading, setTeacherDashboardLoading] = useState(false);

  const loadTeacherDashboard = async () => {
    if (!teacherId) {
      setClassesList([]);
      setTeacherStudents([]);
      setTeacherTopicHeatmap([]);
      return;
    }
    setTeacherDashboardLoading(true);
    try {
      // Always load the complete teacher scope first. A course/class left in
      // session storage must not hide a class that Admin has just assigned.
      const data = await teacherApi.getDashboard(teacherId);
      const normalized = normalizeTeacherDashboard(data);
      setTeacherTopicHeatmap(normalized.topicHeatmap);

      let assignedClasses = normalized.classSections;
      if (!assignedClasses.length) {
        const fallback = await teacherApi.getClassSections(teacherId);
        assignedClasses = asArray(fallback, 'content', 'classSections', 'classes');
      }
      setClassesList(assignedClasses.map((section) => mapClassSection(section, '')));

      const scopedStudents = normalized.students.filter((student) => belongsToScope(student, courseId, classId));
      if (scopedStudents.length || (!courseId && !classId)) {
        setTeacherStudents(scopedStudents.map(mapStudent));
      } else if (courseId && classId && assignedClasses.some((section) => belongsToScope(section, courseId, classId))) {
        try {
          const studentsData = await teacherApi.getClassStudents(courseId, classId, teacherId);
          setTeacherStudents(asArray(studentsData, 'students', 'content').map(mapStudent));
        } catch {
          setTeacherStudents([]);
        }
      } else {
        setTeacherStudents([]);
      }
    } catch {
      setTeacherStudents([]);
      setTeacherTopicHeatmap([]);
      try {
        const fallback = await teacherApi.getClassSections(teacherId);
        setClassesList(asArray(fallback, 'content', 'classSections', 'classes').map((section) => mapClassSection(section, '')));
      } catch {
        setClassesList([]);
      }
    } finally {
      setTeacherDashboardLoading(false);
    }
  };

  return {
    classesList,
    teacherStudents,
    teacherTopicHeatmap,
    teacherDashboardLoading,
    loadTeacherDashboard,
  };
}
