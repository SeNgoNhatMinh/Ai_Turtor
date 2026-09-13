import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_controller.dart';
import '../data/ai_tutor_repository.dart';
import '../data/daily_question_quota.dart';

class DailyQuestionQuotaNotifier
    extends AutoDisposeFamilyNotifier<DailyQuestionQuota, String> {
  @override
  DailyQuestionQuota build(String courseId) {
    var disposed = false;
    ref.onDispose(() => disposed = true);
    unawaited(_hydrate(() => disposed));
    return DailyQuestionQuota.defaults(courseId: courseId);
  }

  Future<void> _hydrate(bool Function() isDisposed) async {
    final courseId = arg.trim();
    if (courseId.isEmpty) return;
    try {
      final userId = ref.read(currentUserIdProvider);
      final next = await ref
          .read(aiTutorRepositoryProvider)
          .fetchQuestionQuota(studentId: userId, courseId: courseId);
      if (isDisposed()) return;
      state = next;
    } catch (_) {
      // Quota is optional. A fetch failure must not lock or clear chat.
    }
  }

  void apply(DailyQuestionQuota quota) {
    state = quota;
  }

  void applyPayload(dynamic payload) {
    if (!hasQuotaPayload(payload)) return;
    state = normalizeDailyQuota(payload, courseId: arg);
  }

  void markExhausted() {
    state = state.exhaustedCopy();
  }

  Future<void> refresh() => _hydrate(() => false);
}

final dailyQuestionQuotaProvider =
    AutoDisposeNotifierProvider.family<
      DailyQuestionQuotaNotifier,
      DailyQuestionQuota,
      String
    >(DailyQuestionQuotaNotifier.new);
