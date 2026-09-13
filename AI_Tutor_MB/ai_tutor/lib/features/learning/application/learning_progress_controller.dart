import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/improve_plan.dart';
import '../../../shared/models/student_dashboard.dart';
import '../../auth/application/auth_controller.dart';
import '../../home/data/home_repository.dart';
import '../../memory/application/course_memory_provider.dart';
import '../../memory/data/improve_plan_repository.dart';

class LearningProgressData {
  const LearningProgressData({
    required this.dashboard,
    required this.memory,
    this.plan,
  });

  final StudentDashboard dashboard;
  final StudentMemory memory;
  final ImprovePlan? plan;
}

final learningProgressProvider = FutureProvider.autoDispose
    .family<LearningProgressData, String>((ref, courseRouteId) async {
      final session = ref.watch(authControllerProvider).valueOrNull;
      if (session == null) {
        throw StateError('Not authenticated');
      }

      final courseId = resolveCourseApiId(ref, courseRouteId);
      final improveRepo = ref.read(improvePlanRepositoryProvider);
      final homeRepo = ref.read(homeRepositoryProvider);

      final results = await Future.wait([
        homeRepo.fetchDashboard(
          studentId: session.userId,
          requesterId: session.userId,
          requesterRole: session.role,
        ),
        improveRepo.fetchMemory(studentId: session.userId, courseId: courseId),
        improveRepo.fetchPlan(studentId: session.userId, courseId: courseId),
      ]);

      return LearningProgressData(
        dashboard: results[0] as StudentDashboard,
        memory: results[1] as StudentMemory,
        plan: results[2] as ImprovePlan?,
      );
    });

List<String> parseTopicList(String raw) {
  return raw
      .split(RegExp(r'[,;\n]+'))
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList();
}

int masteryPercent({
  required List<String> learnedTopics,
  required List<String> weakTopics,
}) {
  final learned = learnedTopics.where((t) => t.trim().isNotEmpty).length;
  final weak = weakTopics.where((t) => t.trim().isNotEmpty).length;
  final total = learned + weak;
  if (total == 0) return 0;
  return ((learned / total) * 100).round().clamp(0, 100);
}
