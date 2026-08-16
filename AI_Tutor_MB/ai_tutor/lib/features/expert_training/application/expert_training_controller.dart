import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_providers.dart';
import '../../../shared/models/expert_training.dart';
import '../../auth/application/auth_controller.dart';
import '../data/expert_training_repository.dart';

class ExpertTasksController extends AutoDisposeAsyncNotifier<List<ExpertTask>> {
  @override
  Future<List<ExpertTask>> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final courseId = ref.watch(selectedExpertCourseProvider);
    if (courseId == null || courseId.isEmpty) return [];
    return ref.read(expertTrainingRepositoryProvider).fetchTasks(courseId: courseId);
  }

  Future<void> assignToMe(String taskId) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) throw StateError('Not authenticated');
    await ref.read(expertTrainingRepositoryProvider).assignTask(taskId, session.userId);
    ref.invalidateSelf();
  }
}

class V2ReviewController extends AutoDisposeAsyncNotifier<V2ReviewData> {
  @override
  Future<V2ReviewData> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final courseId = ref.watch(selectedExpertCourseProvider);
    if (courseId == null || courseId.isEmpty) {
      return const V2ReviewData(goldQa: [], rubrics: []);
    }
    final repo = ref.read(expertTrainingRepositoryProvider);
    final results = await Future.wait([
      repo.fetchGoldQa(courseId: courseId, status: 'PENDING_REVIEW'),
      repo.fetchRubrics(courseId),
    ]);
    final rubrics = (results[1] as List<ExpertRubricItem>)
        .where((r) => r.status == 'PENDING_REVIEW')
        .toList();
    return V2ReviewData(
      goldQa: results[0] as List<GoldQaItem>,
      rubrics: rubrics,
    );
  }

  Future<void> approveGoldQa(String id, String note) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) throw StateError('Not authenticated');
    await ref.read(expertTrainingRepositoryProvider).approveGoldQa(
          goldQaId: id,
          reviewerId: session.userId,
          reviewerRole: session.role,
          reviewNote: note,
        );
    ref.invalidateSelf();
  }

  Future<void> approveRubric(String id, String note) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) throw StateError('Not authenticated');
    await ref.read(expertTrainingRepositoryProvider).approveRubric(
          rubricId: id,
          reviewerId: session.userId,
          reviewerRole: session.role,
          reviewNote: note,
        );
    ref.invalidateSelf();
  }
}

class V2EvalController extends AutoDisposeAsyncNotifier<List<EvalRunItem>> {
  @override
  Future<List<EvalRunItem>> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final courseId = ref.watch(selectedExpertCourseProvider);
    if (courseId == null || courseId.isEmpty) return [];
    return ref.read(expertTrainingRepositoryProvider).fetchEvalRuns(courseId);
  }

  Future<EvalRunItem> runEval(String chapter) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    final courseId = ref.read(selectedExpertCourseProvider);
    if (session == null || courseId == null) throw StateError('Missing session/course');
    final result = await ref.read(expertTrainingRepositoryProvider).runEvaluation(
          courseId: courseId,
          chapter: chapter,
          triggeredBy: session.userId,
        );
    ref.invalidateSelf();
    return result;
  }
}

class V2CoverageController extends AutoDisposeAsyncNotifier<List<CoverageGap>> {
  @override
  Future<List<CoverageGap>> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final courseId = ref.watch(selectedExpertCourseProvider);
    if (courseId == null || courseId.isEmpty) return [];
    return ref.read(expertTrainingRepositoryProvider).fetchGaps(courseId);
  }

  Future<List<CoverageGap>> analyze({List<String>? confirmedChapterTitles}) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    final courseId = ref.read(selectedExpertCourseProvider);
    if (session == null || courseId == null) throw StateError('Missing session/course');
    final gaps = await ref.read(expertTrainingRepositoryProvider).analyzeCoverage(
          courseId: courseId,
          chapters: confirmedChapterTitles ?? const [],
          requestedBy: session.userId,
          smartTaskPolicy: true,
          useSuggestedOrConfirmedChapters: confirmedChapterTitles == null || confirmedChapterTitles.isEmpty,
        );
    ref.invalidateSelf();
    return gaps;
  }

  Future<List<ExpertTask>> createTasksForChapter(String chapter) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    final courseId = ref.read(selectedExpertCourseProvider);
    if (session == null || courseId == null) throw StateError('Missing session/course');
    final tasks = await ref.read(expertTrainingRepositoryProvider).createChapterTasks(
          courseId: courseId,
          chapter: chapter,
          createdBy: session.userId,
        );
    ref.invalidateSelf();
    return tasks;
  }
}

class V2SuggestedChaptersController extends AutoDisposeAsyncNotifier<List<ChapterOutlineView>> {
  @override
  Future<List<ChapterOutlineView>> build() async {
    ref.watch(realtimeRefreshTickProvider);
    final courseId = ref.watch(selectedExpertCourseProvider);
    if (courseId == null || courseId.isEmpty) return [];
    return ref.read(expertTrainingRepositoryProvider).fetchSuggestedChapters(courseId);
  }

  Future<List<ChapterOutlineView>> confirm(List<String> chapterKeys) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    final courseId = ref.read(selectedExpertCourseProvider);
    if (session == null || courseId == null) throw StateError('Missing session/course');
    final chapters = await ref.read(expertTrainingRepositoryProvider).confirmChapters(
          courseId: courseId,
          chapterKeys: chapterKeys,
          confirmedBy: session.userId,
        );
    ref.invalidateSelf();
    return chapters;
  }

  Future<ChapterOutlineView> addManual(String title) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    final courseId = ref.read(selectedExpertCourseProvider);
    if (session == null || courseId == null) throw StateError('Missing session/course');
    final chapter = await ref.read(expertTrainingRepositoryProvider).addManualChapter(
          courseId: courseId,
          title: title,
          createdBy: session.userId,
        );
    ref.invalidateSelf();
    return chapter;
  }

  Future<ChapterPreviewView> preview(String chapterKey, {bool expanded = false}) async {
    final courseId = ref.read(selectedExpertCourseProvider);
    if (courseId == null) throw StateError('Missing course');
    return ref.read(expertTrainingRepositoryProvider).fetchChapterPreview(
          courseId: courseId,
          chapterKey: chapterKey,
          expanded: expanded,
        );
  }
}

class V2ReviewData {
  const V2ReviewData({required this.goldQa, required this.rubrics});
  final List<GoldQaItem> goldQa;
  final List<ExpertRubricItem> rubrics;
  int get totalPending => goldQa.length + rubrics.length;
}

final selectedExpertCourseProvider = StateProvider<String?>((ref) => 'PRJ301');

final expertTasksControllerProvider =
    AutoDisposeAsyncNotifierProvider<ExpertTasksController, List<ExpertTask>>(
      ExpertTasksController.new,
    );

final v2ReviewControllerProvider =
    AutoDisposeAsyncNotifierProvider<V2ReviewController, V2ReviewData>(
      V2ReviewController.new,
    );

final v2EvalControllerProvider =
    AutoDisposeAsyncNotifierProvider<V2EvalController, List<EvalRunItem>>(
      V2EvalController.new,
    );

final v2CoverageControllerProvider =
    AutoDisposeAsyncNotifierProvider<V2CoverageController, List<CoverageGap>>(
      V2CoverageController.new,
    );

final v2SuggestedChaptersProvider =
    AutoDisposeAsyncNotifierProvider<V2SuggestedChaptersController, List<ChapterOutlineView>>(
      V2SuggestedChaptersController.new,
    );

final taskChapterMaterialPreviewProvider = FutureProvider.autoDispose
    .family<ChapterPreviewView, (String, String)>((ref, params) {
  final (courseId, chapter) = params;
  return ref.read(expertTrainingRepositoryProvider).fetchChapterPreviewForTask(
        courseId: courseId,
        chapter: chapter,
      );
});
