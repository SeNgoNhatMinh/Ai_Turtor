import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PracticeQuizzesView from './PracticeQuizzesView';
import { buildQuizTopicSuggestions } from './practiceQuizUtils';
import { queryKeys } from '../../../app/queryKeys';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { useStudentLearningController } from '../learning/useStudentLearningController';
import { clearQuizTopicHandoff, readQuizTopicHandoff } from '../studentRouteHandoff';

export default function PracticeQuizzesPage({
  studentId,
  courseId,
  classId,
  triggerToast,
}) {
  const [initialSuggestion] = useState(readQuizTopicHandoff);
  const learning = useStudentLearningController({
    studentId,
    courseId,
    classId,
    triggerToast,
  });
  // Same cached learning guide the chat uses for its curriculum overview.
  const curriculumQuery = useQuery({
    queryKey: queryKeys.studentLearningGuide(courseId),
    queryFn: () => adminAcademicApi.getStudentLearningGuide(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const topicSuggestions = useMemo(
    () => buildQuizTopicSuggestions(learning.studentDashboard?.weakTopics, curriculumQuery.data?.topics),
    [curriculumQuery.data?.topics, learning.studentDashboard?.weakTopics],
  );

  useEffect(() => {
    clearQuizTopicHandoff();
  }, []);

  return (
    <PracticeQuizzesView
      studentId={studentId}
      courseId={courseId}
      classId={classId}
      suggestions={topicSuggestions}
      initialSuggestion={initialSuggestion}
      triggerToast={triggerToast}
      onAfterQuizSubmit={learning.loadStudentDashboard}
    />
  );
}
