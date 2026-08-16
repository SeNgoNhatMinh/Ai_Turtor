import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/ai_conversation.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/student_dashboard.dart';
import '../../ai_tutor/data/ai_tutor_repository.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/data/courses_repository.dart';
import '../data/home_repository.dart';

class HomeData {
  const HomeData({
    required this.dashboard,
    required this.courses,
    required this.questionsAsked,
  });

  final StudentDashboard dashboard;
  final List<Course> courses;
  final int questionsAsked;
}

class HomeController extends AutoDisposeAsyncNotifier<HomeData> {
  @override
  Future<HomeData> build() async {
    final session = ref.watch(authControllerProvider).valueOrNull;
    if (session == null) {
      throw StateError('Not authenticated');
    }

    final homeRepo = ref.read(homeRepositoryProvider);
    final coursesRepo = ref.read(coursesRepositoryProvider);
    final aiRepo = ref.read(aiTutorRepositoryProvider);

    final results = await Future.wait([
      homeRepo.fetchDashboard(
        studentId: session.userId,
        requesterId: session.userId,
        requesterRole: session.role,
      ),
      coursesRepo.fetchStudentCourses(session.userId),
      aiRepo.fetchConversations(session.userId),
    ]);

    final dashboard = results[0] as StudentDashboard;
    final courses = results[1] as List<Course>;
    final conversations = results[2] as List<AiConversation>;

    return HomeData(
      dashboard: dashboard,
      courses: courses,
      questionsAsked: _resolveQuestionsAsked(dashboard, conversations),
    );
  }

  int _resolveQuestionsAsked(
    StudentDashboard dashboard,
    List<AiConversation> conversations,
  ) {
    if (dashboard.questionsAsked > 0) return dashboard.questionsAsked;
    return conversations.fold<int>(
      0,
      (sum, conversation) => sum + conversation.messageCount,
    );
  }
}

final homeControllerProvider =
    AutoDisposeAsyncNotifierProvider<HomeController, HomeData>(
      HomeController.new,
    );
