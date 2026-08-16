import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/improve_plan.dart';
import '../../../shared/models/improve_suggestion.dart';
import '../../auth/application/auth_controller.dart';
import '../data/improve_plan_repository.dart';
import 'course_memory_provider.dart';

class ImprovePlanData {
  const ImprovePlanData({required this.plan, required this.memory});

  final ImprovePlan? plan;
  final StudentMemory memory;
}

class ImprovePlanController
    extends AutoDisposeFamilyAsyncNotifier<ImprovePlanData, String> {
  @override
  Future<ImprovePlanData> build(String courseRouteId) async {
    final studentId = ref.watch(currentUserIdProvider);
    final courseId = resolveCourseApiId(ref, courseRouteId);
    final repo = ref.read(improvePlanRepositoryProvider);

    ImprovePlan? plan;
    StudentMemory memory;
    try {
      plan = await repo.fetchPlan(studentId: studentId, courseId: courseId);
    } catch (_) {
      plan = null;
    }
    memory = await repo.fetchMemory(studentId: studentId, courseId: courseId);

    return ImprovePlanData(plan: plan, memory: memory);
  }

  Future<void> generateSuggestions(String courseRouteId) async {
    final studentId = ref.read(currentUserIdProvider);
    final courseId = resolveCourseApiId(ref, courseRouteId);
    await ref
        .read(improvePlanRepositoryProvider)
        .createSuggestions(studentId: studentId, courseId: courseId);
    ref.invalidateSelf();
  }

  Future<void> completePlan(String planId) async {
    await ref.read(improvePlanRepositoryProvider).completePlan(planId);
    ref.invalidateSelf();
  }

  Future<void> togglePin(
    String courseRouteId,
    String suggestion, {
    required bool pinned,
  }) async {
    final studentId = ref.read(currentUserIdProvider);
    final courseId = resolveCourseApiId(ref, courseRouteId);
    final repo = ref.read(improvePlanRepositoryProvider);
    final memory = pinned
        ? await repo.unpinSuggestion(
            studentId: studentId,
            courseId: courseId,
            suggestion: suggestion,
          )
        : await repo.pinSuggestion(
            studentId: studentId,
            courseId: courseId,
            suggestion: suggestion,
          );
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(ImprovePlanData(plan: current.plan, memory: memory));
    } else {
      ref.invalidateSelf();
    }
    ref.invalidate(courseMemoryProvider(courseRouteId));
  }

  Future<String?> learnFromSuggestion(String courseRouteId, String topic) async {
    final studentId = ref.read(currentUserIdProvider);
    final courseId = resolveCourseApiId(ref, courseRouteId);
    final course = findCourseByRouteId(ref, courseRouteId);
    final result = await ref
        .read(improvePlanRepositoryProvider)
        .learnFromSuggestion(
          studentId: studentId,
          courseId: courseId,
          classId: course?.classId,
          topic: topic,
          suggestionText: topic,
          suggestionKey: ImproveSuggestionItem.fromLabel(topic).key,
        );
    ref.invalidateSelf();
    ref.invalidate(courseMemoryProvider(courseRouteId));
    return result.conversationId;
  }
}

final improvePlanControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      ImprovePlanController,
      ImprovePlanData,
      String
    >(ImprovePlanController.new);
