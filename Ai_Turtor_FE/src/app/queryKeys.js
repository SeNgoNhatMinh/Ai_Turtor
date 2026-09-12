export const queryKeys = {
  profile: (userId) => ['account', 'profile', userId],
  studentEnrollments: (identityKey) => ['student', 'enrollments', identityKey],
  studentQuestionQuota: (studentId, courseId) => [
    'student',
    'question-quota',
    studentId,
    courseId,
  ],
  studentMentorRequests: (studentId) => ['student', 'mentor-requests', studentId],
  studentMentorRequestDetail: (escalationId) => [
    'student',
    'mentor-request-detail',
    escalationId,
  ],
  supportChatRoom: (chatRoomId) => ['support', 'chat-room', chatRoomId],
  answerCache: (courseId, filters = {}) => [
    'admin',
    'answer-cache',
    courseId,
    filters.classId || '',
    filters.mode || '',
    filters.reviewStatus || '',
  ],
};
