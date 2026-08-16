abstract final class AppRoutes {
  static const splash = '/splash';
  static const login = '/login';
  static const register = '/register';

  static const studentHome = '/s/home';
  static const studentCourses = '/s/courses';
  static const studentTutor = '/s/tutor';
  static const studentCodeMentor = '/s/tutor/code-mentor';
  static const studentAssignments = '/s/assignments';
  static const studentProfile = '/s/profile';
  static const escalationHistory = '/s/profile/escalations';

  static const teacherHome = '/t/home';
  static const teacherClasses = '/t/classes';
  static const teacherInbox = '/t/inbox';
  static const teacherAssignments = '/t/assignments';
  static const teacherProfile = '/t/profile';

  static String studentTutorChat(String conversationId, {String? messageId}) {
    final uri = Uri(
      path: '/s/tutor/$conversationId',
      queryParameters: messageId != null && messageId.isNotEmpty
          ? {'messageId': messageId}
          : null,
    );
    return uri.toString();
  }

  static String studentAssignmentDetail(String assignmentId) =>
      '/s/assignments/$assignmentId';
  static String studentAssignmentSubmit(String assignmentId) =>
      '/s/assignments/$assignmentId/submit';
  static String studentImprovePlan(String courseId) =>
      '/s/profile/improve/$courseId';
  static String escalationOffer(String escalationId) =>
      '/s/escalation/$escalationId/offer';
  static String liveChat(String chatRoomId) => '/chat/$chatRoomId';

  static String teacherClassRoster(String courseId, String classId) =>
      '/t/classes/$courseId/$classId/students';
  static String teacherClassAssignments(String courseId, String classId) =>
      '/t/classes/$courseId/$classId/assignments';
  static String teacherClassSubmissions(String courseId, String classId) =>
      '/t/classes/$courseId/$classId/assignments/submissions';
  static String teacherEscalationAnswer(String escalationId) =>
      '/t/inbox/escalations/$escalationId/answer';
  static String teacherSubmissions(String assignmentId) =>
      '/t/assignments/$assignmentId/submissions';
  static String teacherGradeSubmission(String submissionId) =>
      '/t/submissions/$submissionId/grade';

  static const seniorReviewQueue = '/t/review/senior-pending';
  static const knowledgeCandidates = '/t/candidates';
  static String knowledgeCandidateDetail(String candidateId) =>
      '/t/candidates/$candidateId';

  static const studentQuiz = '/s/quiz';
  static String studentQuizForCourse(String courseId) => '/s/quiz/$courseId';
  static const teacherQuiz = '/t/quiz';
  static const expertTasks = '/t/expert-tasks';
  static String expertContribute(String taskId) => '/t/expert-tasks/$taskId/contribute';
  static const v2ExpertHub = '/t/v2';
  static const adminV2ExpertHub = '/a/v2';

  // ── Admin shell routes ──────────────────────────────────────────
  static const adminHome = '/a/home';
  static const adminUsers = '/a/users';
  static const adminAcademic = '/a/academic';
  static String adminCourseMaterials(String courseId) =>
      '/a/academic/courses/$courseId/materials';
  static const adminImport = '/a/import';
  static const adminSubscriptions = '/a/subscriptions';
  static const adminProfile = '/a/profile';
  static const adminMentors = '/a/mentors';
  static const adminMentorEscalations = '/a/mentor-escalations';
  static const adminSeniorReviewQueue = '/a/review/senior-pending';
  static const adminKnowledgeCandidates = '/a/candidates';
  static String adminKnowledgeCandidateDetail(String candidateId) =>
      '/a/candidates/$candidateId';
  static String adminMentorDetail(String mentorId) => '/a/mentors/$mentorId';

  static const adminShellRoutes = [
    adminHome,
    adminUsers,
    adminAcademic,
    adminImport,
    adminProfile,
  ];

  static const notifications = '/notifications';
  static const editProfile = '/profile/edit';
  static const changePassword = '/profile/change-password';

  static String teacherClassMaterials(String courseId, String classId) =>
      '/t/classes/$courseId/$classId/materials';

  static const studentShellRoutes = [
    studentHome,
    studentTutor,
    studentProfile,
  ];

  static const teacherShellRoutes = [
    teacherHome,
    teacherClasses,
    teacherInbox,
    teacherAssignments,
    teacherProfile,
  ];
}
