import { useEffect, useState } from 'react';
import PracticeQuizzesView from './PracticeQuizzesView';
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

  useEffect(() => {
    clearQuizTopicHandoff();
  }, []);

  return (
    <PracticeQuizzesView
      studentId={studentId}
      courseId={courseId}
      classId={classId}
      suggestions={learning.suggestions}
      initialSuggestion={initialSuggestion}
      triggerToast={triggerToast}
      onAfterQuizSubmit={learning.loadStudentDashboard}
    />
  );
}
