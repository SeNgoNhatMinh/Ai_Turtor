import { useEffect, useState } from 'react';
import PracticeQuizzes from '../../../pages/student/PracticeQuizzes';
import { useStudentLearningController } from '../learning/useStudentLearningController';
import { clearQuizTopicHandoff, readQuizTopicHandoff } from '../studentRouteHandoff';

export default function PracticeQuizzesPage({
  studentId,
  courseId,
  classId,
  switchTab,
  triggerToast,
}) {
  const [initialSuggestion] = useState(readQuizTopicHandoff);
  const learning = useStudentLearningController({
    studentId,
    courseId,
    classId,
    switchTab,
    triggerToast,
  });

  useEffect(() => {
    clearQuizTopicHandoff();
    learning.loadStudentDashboard();
    // Suggestions are scoped to the selected course.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId]);

  return (
    <PracticeQuizzes
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
