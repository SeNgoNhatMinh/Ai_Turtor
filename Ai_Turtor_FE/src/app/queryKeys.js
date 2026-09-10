export const queryKeys = {
  studentEnrollments: (identityKey) => ['student', 'enrollments', identityKey],
  studentQuestionQuota: (studentId, courseId) => [
    'student',
    'question-quota',
    studentId,
    courseId,
  ],
  studentMentorRequests: (studentId) => ['student', 'mentor-requests', studentId],
};
