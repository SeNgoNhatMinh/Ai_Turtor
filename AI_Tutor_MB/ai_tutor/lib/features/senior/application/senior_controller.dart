import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_providers.dart';
import '../../../shared/models/senior_queue.dart';
import '../../auth/application/auth_controller.dart';
import '../data/senior_repository.dart';

class SeniorQueueData {
  const SeniorQueueData({required this.reviews, required this.candidates});

  final List<SeniorPendingReview> reviews;
  final List<KnowledgeCandidateItem> candidates;

  int get totalPending => reviews.length + candidates.length;
}

class SeniorQueueController extends AutoDisposeAsyncNotifier<SeniorQueueData> {
  @override
  Future<SeniorQueueData> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final repo = ref.read(seniorRepositoryProvider);
    final results = await Future.wait([
      repo.fetchSeniorPendingReviews(),
      repo.fetchSeniorPendingCandidates(),
    ]);
    return SeniorQueueData(
      reviews: results[0] as List<SeniorPendingReview>,
      candidates: results[1] as List<KnowledgeCandidateItem>,
    );
  }

  Future<void> resolveReview({
    required String reviewId,
    required String decision,
    String? notes,
    bool createKnowledgeCandidate = false,
    String? candidateType,
    String? correctedAnswer,
  }) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) throw StateError('Not authenticated');

    await ref
        .read(seniorRepositoryProvider)
        .resolveReview(
          reviewId: reviewId,
          seniorReviewerId: session.userId,
          seniorReviewerName: session.fullName,
          reviewerRole: session.role,
          decision: decision,
          notes: notes,
          createKnowledgeCandidate: createKnowledgeCandidate,
          candidateType: candidateType,
          correctedAnswer: correctedAnswer,
          authToken: session.token ?? '',
        );
    ref.invalidateSelf();
  }

  Future<void> approveCandidate({
    required String candidateId,
    String? reviewNote,
    String? contentOverride,
  }) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) throw StateError('Not authenticated');

    await ref
        .read(seniorRepositoryProvider)
        .approveCandidate(
          candidateId: candidateId,
          reviewerId: session.userId,
          reviewerRole: session.role,
          reviewerName: session.fullName,
          reviewNote: reviewNote,
          contentOverride: contentOverride,
          authToken: session.token ?? '',
        );
    ref.invalidateSelf();
  }

  Future<void> rejectCandidate({
    required String candidateId,
    required String rejectionReason,
  }) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) throw StateError('Not authenticated');

    await ref
        .read(seniorRepositoryProvider)
        .rejectCandidate(
          candidateId: candidateId,
          reviewerId: session.userId,
          reviewerRole: session.role,
          reviewerName: session.fullName,
          rejectionReason: rejectionReason,
          authToken: session.token ?? '',
        );
    ref.invalidateSelf();
  }
}

final seniorQueueControllerProvider =
    AutoDisposeAsyncNotifierProvider<SeniorQueueController, SeniorQueueData>(
      SeniorQueueController.new,
    );

/// Dùng khi mở màn chi tiết candidate mà không có `extra` (vd. deep link) —
/// backend không có GET theo id nên phải tải lại danh sách rồi lọc.
final candidateByIdProvider = AutoDisposeFutureProviderFamily<
    KnowledgeCandidateItem, String>((ref, candidateId) {
  return ref.read(seniorRepositoryProvider).fetchCandidateById(candidateId);
});
