import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/presentation/admin_academic_screen.dart';
import '../../features/admin/presentation/admin_course_materials_screen.dart';
import '../../features/admin/presentation/admin_dashboard_screen.dart';
import '../../features/admin/presentation/admin_import_screen.dart';
import '../../features/admin/presentation/admin_mentor_escalations_screen.dart';
import '../../features/admin/presentation/admin_mentors_screen.dart';
import '../../features/admin/presentation/admin_subscriptions_screen.dart';
import '../../features/admin/presentation/admin_users_screen.dart';
import '../../features/ai_tutor/presentation/ai_tutor_screens.dart';
import '../../features/assignments/presentation/assignments_screens.dart';
import '../../features/assignments/presentation/submit_assignment_screen.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/classes/presentation/teacher_classes_screens.dart';
import '../../features/courses/presentation/teacher_materials_screen.dart';
import '../../features/dashboard/presentation/teacher_dashboard_screen.dart';
import '../../features/escalation/presentation/escalation_offer_screen.dart';
import '../../features/escalation/presentation/escalation_screens.dart';
import '../../features/expert_training/presentation/expert_training_screens.dart';
import '../../shared/models/expert_training.dart';
import '../../features/home/presentation/student_home_screen.dart';
import '../../features/inbox/presentation/escalation_answer_screen.dart';
import '../../features/inbox/presentation/teacher_inbox_screen.dart';
import '../../features/memory/presentation/improve_plan_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/profile/presentation/change_password_screen.dart';
import '../../features/profile/presentation/edit_profile_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/senior/presentation/senior_queue_screens.dart';
import '../../features/teacher_assignments/presentation/teacher_assignments_screens.dart';
import '../../features/quiz/presentation/student_quiz_screens.dart';
import '../../features/quiz/presentation/teacher_quiz_screen.dart';
import '../../shared/models/senior_queue.dart';
import '../../shared/models/teacher_inbox.dart';
import '../utils/status_style.dart';
import 'admin_shell.dart';
import 'routes.dart';
import 'student_shell.dart';
import 'teacher_shell.dart';

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(this._ref) {
    _ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}

final _routerRefreshProvider = Provider<_RouterRefresh>((ref) {
  final notifier = _RouterRefresh(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ref.watch(_routerRefreshProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      // Đọc state TRONG redirect (không watch ở ngoài) — nếu watch sẽ tạo lại
      // toàn bộ GoRouter mỗi lần auth đổi và reset về initialLocation (splash).
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;
      final isAuthRoute =
          location == AppRoutes.login ||
          location == AppRoutes.register ||
          location == AppRoutes.splash;

      if (location.startsWith('/chat/')) {
        return null;
      }

      if (auth.isLoading && location == AppRoutes.splash) {
        return null;
      }

      final session = auth.valueOrNull;
      if (session == null) {
        return isAuthRoute ? null : AppRoutes.login;
      }

      final isAdmin = isAdminRole(session.role);
      final isTeacher = isTeacherRole(session.role);

      if (location == AppRoutes.login || location == AppRoutes.register) {
        if (isAdmin) return AppRoutes.adminHome;
        return isTeacher ? AppRoutes.teacherHome : AppRoutes.studentHome;
      }

      if (location == AppRoutes.splash) {
        if (isAdmin) return AppRoutes.adminHome;
        return isTeacher ? AppRoutes.teacherHome : AppRoutes.studentHome;
      }

      // Block admin from student/teacher shells
      if (isAdmin &&
          (location.startsWith('/s/') || location.startsWith('/t/'))) {
        return AppRoutes.adminHome;
      }
      // Block non-admin from admin shell
      if (!isAdmin && location.startsWith('/a/')) {
        return isTeacher ? AppRoutes.teacherHome : AppRoutes.studentHome;
      }

      if (isTeacher && !isAdmin && location.startsWith('/s/')) {
        return AppRoutes.teacherHome;
      }
      if (!isTeacher && location.startsWith('/t/')) {
        return AppRoutes.studentHome;
      }

      if (!isTeacher && location.startsWith(AppRoutes.studentCourses)) {
        return AppRoutes.studentHome;
      }

      if ((location.startsWith('/t/review') ||
              location.startsWith('/t/candidates') ||
              location.startsWith('/t/v2')) &&
          !isSeniorRole(session.role)) {
        return isTeacher ? AppRoutes.teacherHome : AppRoutes.studentHome;
      }

      return null;
    },
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: AppRoutes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: AppRoutes.register,
        builder: (_, __) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/chat/:chatRoomId',
        builder: (_, state) =>
            LiveChatScreen(chatRoomId: state.pathParameters['chatRoomId']!),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(
        path: AppRoutes.editProfile,
        builder: (_, __) => const EditProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.changePassword,
        builder: (_, __) => const ChangePasswordScreen(),
      ),
      ShellRoute(
        builder: (_, __, child) => StudentShell(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.studentHome,
            builder: (_, __) => const StudentHomeScreen(),
          ),
          GoRoute(
            path: AppRoutes.studentTutor,
            builder: (_, __) => const TutorEntryScreen(),
          ),
          GoRoute(
            path: AppRoutes.studentAssignments,
            builder: (_, __) => const StudentAssignmentsScreen(),
          ),
          GoRoute(
            path: '/s/assignments/:assignmentId',
            builder: (_, state) => AssignmentDetailScreen(
              assignmentId: state.pathParameters['assignmentId']!,
            ),
          ),
          GoRoute(
            path: '/s/assignments/:assignmentId/submit',
            builder: (_, state) => SubmitAssignmentScreen(
              assignmentId: state.pathParameters['assignmentId']!,
            ),
          ),
          GoRoute(
            path: '/s/tutor/code-mentor',
            builder: (_, __) => const CodeMentorScreen(),
          ),
          GoRoute(
            path: '/s/tutor/:conversationId',
            builder: (_, state) => ChatScreen(
              conversationId: state.pathParameters['conversationId']!,
              scrollToMessageId: state.uri.queryParameters['messageId'],
            ),
          ),
          GoRoute(
            path: '/s/escalation/:escalationId/offer',
            builder: (_, state) => EscalationOfferScreen(
              escalationId: state.pathParameters['escalationId']!,
            ),
          ),
          GoRoute(
            path: AppRoutes.studentProfile,
            builder: (_, __) => const ProfileScreen(),
          ),
          GoRoute(
            path: '/s/profile/improve/:courseId',
            builder: (_, state) =>
                ImprovePlanScreen(courseId: state.pathParameters['courseId']!),
          ),
          GoRoute(
            path: AppRoutes.escalationHistory,
            builder: (_, __) => const EscalationHistoryScreen(),
          ),
          GoRoute(
            path: '/s/quiz/:courseId',
            builder: (_, state) =>
                StudentQuizScreen(courseId: state.pathParameters['courseId']!),
          ),
        ],
      ),
      ShellRoute(
        builder: (_, __, child) => TeacherShell(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.teacherHome,
            builder: (_, __) => const TeacherDashboardScreen(),
          ),
          GoRoute(
            path: AppRoutes.teacherClasses,
            builder: (_, __) => const TeacherClassesScreen(),
          ),
          GoRoute(
            path: '/t/classes/:courseId/:classId/students',
            builder: (_, state) => TeacherRosterScreen(
              courseId: state.pathParameters['courseId']!,
              classId: state.pathParameters['classId']!,
            ),
          ),
          GoRoute(
            path: '/t/classes/:courseId/:classId/assignments',
            builder: (_, state) => TeacherClassAssignmentsScreen(
              courseId: state.pathParameters['courseId']!,
              classId: state.pathParameters['classId']!,
            ),
          ),
          GoRoute(
            path: '/t/classes/:courseId/:classId/assignments/submissions',
            builder: (_, state) => ClassSubmissionsScreen(
              courseId: state.pathParameters['courseId']!,
              classId: state.pathParameters['classId']!,
            ),
          ),
          GoRoute(
            path: '/t/classes/:courseId/:classId/materials',
            builder: (_, state) => TeacherMaterialsScreen(
              courseId: state.pathParameters['courseId']!,
              classId: state.pathParameters['classId']!,
            ),
          ),
          GoRoute(
            path: AppRoutes.teacherInbox,
            builder: (_, __) => const TeacherInboxScreen(),
          ),
          GoRoute(
            path: '/t/inbox/escalations/:escalationId/answer',
            builder: (_, state) => EscalationAnswerScreen(
              escalationId: state.pathParameters['escalationId']!,
              item: state.extra as TeacherEscalationItem?,
            ),
          ),
          GoRoute(
            path: AppRoutes.teacherAssignments,
            builder: (_, __) => const TeacherAssignmentsScreen(),
          ),
          GoRoute(
            path: '/t/assignments/:assignmentId/submissions',
            builder: (_, state) => TeacherSubmissionsScreen(
              assignmentId: state.pathParameters['assignmentId']!,
            ),
          ),
          GoRoute(
            path: '/t/submissions/:submissionId/grade',
            builder: (_, state) => GradeSubmissionScreen(
              submissionId: state.pathParameters['submissionId']!,
              item: state.extra as SubmissionItem?,
            ),
          ),
          GoRoute(
            path: AppRoutes.seniorReviewQueue,
            builder: (_, __) => const SeniorReviewQueueScreen(),
          ),
          GoRoute(
            path: AppRoutes.knowledgeCandidates,
            builder: (_, __) => const KnowledgeCandidatesScreen(),
          ),
          GoRoute(
            path: '/t/candidates/:candidateId',
            builder: (_, state) => KnowledgeCandidateDetailScreen(
              candidateId: state.pathParameters['candidateId']!,
              candidate: state.extra as KnowledgeCandidateItem?,
            ),
          ),
          GoRoute(
            path: AppRoutes.teacherProfile,
            builder: (_, __) => const ProfileScreen(),
          ),
          GoRoute(
            path: AppRoutes.teacherQuiz,
            builder: (_, __) => const TeacherQuizScreen(),
          ),
          GoRoute(
            path: AppRoutes.expertTasks,
            builder: (_, __) => const ExpertTaskBoardScreen(),
          ),
          GoRoute(
            path: '/t/expert-tasks/:taskId/contribute',
            builder: (_, state) => ExpertContributeScreen(
              task: state.extra as ExpertTask,
            ),
          ),
          GoRoute(
            path: AppRoutes.v2ExpertHub,
            builder: (_, __) => const V2ExpertHubScreen(),
          ),
        ],
      ),
      // ── Admin shell ───────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => AdminShell(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.adminHome,
            builder: (_, __) => const AdminDashboardScreen(),
          ),
          GoRoute(
            path: AppRoutes.adminUsers,
            builder: (_, __) => const AdminUsersScreen(),
          ),
          GoRoute(
            path: AppRoutes.adminAcademic,
            builder: (_, __) => const AdminAcademicScreen(),
          ),
          GoRoute(
            path: '/a/academic/courses/:courseId/materials',
            builder: (_, state) => AdminCourseMaterialsScreen(
              courseId: state.pathParameters['courseId']!,
              courseLabel: state.uri.queryParameters['label'],
            ),
          ),
          GoRoute(
            path: AppRoutes.adminImport,
            builder: (_, __) => const AdminImportScreen(),
          ),
          GoRoute(
            path: AppRoutes.adminSubscriptions,
            builder: (_, __) => const AdminSubscriptionsScreen(),
          ),
          GoRoute(
            path: AppRoutes.adminMentors,
            builder: (_, __) => const AdminMentorsScreen(),
          ),
          GoRoute(
            path: AppRoutes.adminMentorEscalations,
            builder: (_, __) => const AdminMentorEscalationsScreen(),
          ),
          GoRoute(
            path: AppRoutes.adminProfile,
            builder: (_, __) => const ProfileScreen(),
          ),
          // Admin can also access senior features
          GoRoute(
            path: '/a/review/senior-pending',
            builder: (_, __) => const SeniorReviewQueueScreen(),
          ),
          GoRoute(
            path: '/a/candidates',
            builder: (_, __) => const KnowledgeCandidatesScreen(),
          ),
          GoRoute(
            path: '/a/candidates/:candidateId',
            builder: (_, state) => KnowledgeCandidateDetailScreen(
              candidateId: state.pathParameters['candidateId']!,
              candidate: state.extra as KnowledgeCandidateItem?,
            ),
          ),
          GoRoute(
            path: AppRoutes.adminV2ExpertHub,
            builder: (_, __) => const V2ExpertHubScreen(),
          ),
        ],
      ),
    ],
  );
});
