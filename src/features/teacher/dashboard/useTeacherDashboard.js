import { useState } from 'react';
import { teacherApi } from '../../../services/teacherApi';
import { asArray, normalizeTeacherDashboard } from '../../../services/normalizers';
import { getPersonDisplayName } from '../../../utils/displayNames';

const mapClassSection = (section, courseId) => ({
  semester: section.semesterId || section.semesterCode || '—',
  course: section.courseId || courseId,
  classCode: section.classId || section.id,
  name: section.name || `Class ${section.courseId}_${section.classId}`,
  details: section.description || `${section.studentCount ?? '—'} students`,
});

const mapStudent = (student) => ({
  id: student.studentId || student.id || student.userId,
  name: getPersonDisplayName(student, 'Student'),
  email: student.email || '—',
  status: student.status || 'ACTIVE',
  weakTopics: student.weakTopics?.length ? student.weakTopics : ['None'],
});

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
      const data = await teacherApi.getDashboard(teacherId, courseId, classId);
      const normalized = normalizeTeacherDashboard(data);
      setTeacherTopicHeatmap(normalized.topicHeatmap);

      if (normalized.classSections.length) {
        setClassesList(normalized.classSections.map((section) => mapClassSection(section, courseId)));
      } else {
        const fallback = await teacherApi.getClassSections(teacherId);
        setClassesList(asArray(fallback, 'content', 'classSections').map((section) => mapClassSection(section, courseId)));
      }

      if (normalized.students.length) {
        setTeacherStudents(normalized.students.map(mapStudent));
      } else if (courseId && classId) {
        try {
          const studentsData = await teacherApi.getClassStudents(courseId, classId);
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
