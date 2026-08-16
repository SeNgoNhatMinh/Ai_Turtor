import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/json_helpers.dart';
import '../../../shared/models/expert_training.dart';

class ExpertTrainingRepository {
  ExpertTrainingRepository(this._spring, this._n8n);

  final Dio _spring;
  final Dio _n8n;

  Future<List<CoverageGap>> analyzeCoverage({
    required String courseId,
    List<String> chapters = const [],
    required String requestedBy,
    int minimumTraining = 0,
    int minimumEvaluation = 0,
    bool createTasks = true,
    bool smartTaskPolicy = true,
    bool useSuggestedOrConfirmedChapters = true,
    bool includeTrainingGoldTasks = false,
    bool includeBenchmarkTasks = false,
  }) async {
    final payload = <String, dynamic>{
      'courseId': courseId,
      'minimumTrainingGoldPerChapter': minimumTraining,
      'minimumEvaluationGoldPerChapter': minimumEvaluation,
      'requestedBy': requestedBy,
      'createTasks': createTasks,
      'smartTaskPolicy': smartTaskPolicy,
      'useSuggestedOrConfirmedChapters': useSuggestedOrConfirmedChapters,
      'includeTrainingGoldTasks': includeTrainingGoldTasks,
      'includeBenchmarkTasks': includeBenchmarkTasks,
    };
    if (chapters.isNotEmpty) {
      payload['chapters'] = chapters;
    }
    final response = await _n8n.post<Map<String, dynamic>>(
      '/v2-coverage-analyze',
      data: payload,
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    final data = Map<String, dynamic>.from(response.data ?? {});
    return parseList(unwrapList(data, ['gaps']), CoverageGap.fromJson);
  }

  Future<List<ChapterOutlineView>> fetchSuggestedChapters(String courseId) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/chapters/suggested',
      queryParameters: {'courseId': courseId},
    );
    return parseList(
      unwrapList(response.data, ['chapters']),
      ChapterOutlineView.fromJson,
    );
  }

  Future<List<ChapterOutlineView>> confirmChapters({
    required String courseId,
    required List<String> chapterKeys,
    required String confirmedBy,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/v2/expert-training/chapters/confirm',
      data: {
        'courseId': courseId,
        'chapterKeys': chapterKeys,
        'confirmedBy': confirmedBy,
      },
    );
    return parseList(
      unwrapList(response.data, ['chapters']),
      ChapterOutlineView.fromJson,
    );
  }

  Future<ChapterOutlineView> addManualChapter({
    required String courseId,
    required String title,
    required String createdBy,
    bool confirmImmediately = true,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/v2/expert-training/chapters/manual',
      data: {
        'courseId': courseId,
        'title': title,
        'createdBy': createdBy,
        'confirmImmediately': confirmImmediately,
      },
    );
    return ChapterOutlineView.fromJson(unwrapMap(response.data, keys: ['chapter']));
  }

  Future<ChapterPreviewView> fetchChapterPreview({
    required String courseId,
    required String chapterKey,
    bool expanded = false,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/chapters/$chapterKey/preview',
      queryParameters: {
        'courseId': courseId,
        'expanded': expanded,
      },
    );
    return ChapterPreviewView.fromJson(unwrapMap(response.data));
  }

  Future<ChapterPreviewView> fetchChapterPreviewForTask({
    required String courseId,
    required String chapter,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/chapters/preview',
      queryParameters: {
        'courseId': courseId,
        'chapter': chapter,
        'expanded': true,
      },
    );
    return ChapterPreviewView.fromJson(unwrapMap(response.data));
  }

  Future<List<ExpertTask>> createChapterTasks({
    required String courseId,
    required String chapter,
    required String createdBy,
    bool includeTrainingGoldTask = true,
    bool includeEvaluationGoldTask = true,
  }) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/v2/expert-training/chapters/tasks',
      data: {
        'courseId': courseId,
        'chapter': chapter,
        'createdBy': createdBy,
        'includeTrainingGoldTask': includeTrainingGoldTask,
        'includeEvaluationGoldTask': includeEvaluationGoldTask,
      },
    );
    return parseList(unwrapList(response.data, ['tasks']), ExpertTask.fromJson);
  }

  Future<List<CoverageGap>> fetchGaps(String courseId) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/coverage-gaps',
      queryParameters: {'courseId': courseId},
    );
    return parseList(unwrapList(response.data, ['gaps']), CoverageGap.fromJson);
  }

  Future<List<ExpertTask>> fetchTasks({
    String? courseId,
    String? status,
    String? assigneeId,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/tasks',
      queryParameters: {
        if (courseId != null) 'courseId': courseId,
        if (status != null) 'status': status,
        if (assigneeId != null) 'assigneeId': assigneeId,
      },
    );
    return parseList(unwrapList(response.data, ['tasks']), ExpertTask.fromJson);
  }

  Future<ExpertTask> assignTask(String taskId, String assigneeId) async {
    final response = await _spring.post<Map<String, dynamic>>(
      '/api/v2/expert-training/tasks/$taskId/assign',
      data: {'assigneeId': assigneeId, 'assigneeTier': 'TEACHER'},
    );
    return ExpertTask.fromJson(unwrapMap(response.data));
  }

  Future<GoldQaItem> submitGoldQa({
    required String courseId,
    required String chapter,
    required String question,
    required String goldAnswer,
    required String usage,
    required String authorId,
    required String sourceTaskId,
    String difficulty = 'MEDIUM',
  }) async {
    final response = await _n8n.post<Map<String, dynamic>>(
      '/v2-gold-qa-submit',
      data: {
        'courseId': courseId,
        'chapter': chapter,
        'question': question,
        'goldAnswer': goldAnswer,
        'difficulty': difficulty,
        'usage': usage,
        'authorId': authorId,
        'sourceTaskId': sourceTaskId,
      },
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    return GoldQaItem.fromJson(unwrapMap(response.data));
  }

  Future<ExpertRubricItem> submitRubric({
    required String courseId,
    required String chapter,
    required String name,
    required String description,
    required Map<String, double> criteriaWeights,
    required String authorId,
    required String sourceTaskId,
  }) async {
    final response = await _n8n.post<Map<String, dynamic>>(
      '/v2-rubric-submit',
      data: {
        'courseId': courseId,
        'chapter': chapter,
        'name': name,
        'description': description,
        'criteriaWeights': criteriaWeights,
        'authorId': authorId,
        'sourceTaskId': sourceTaskId,
      },
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    return ExpertRubricItem.fromJson(unwrapMap(response.data));
  }

  Future<List<GoldQaItem>> fetchGoldQa({
    required String courseId,
    String? usage,
    String? status,
  }) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/gold-qa',
      queryParameters: {
        'courseId': courseId,
        if (usage != null) 'usage': usage,
        if (status != null) 'status': status,
      },
    );
    return parseList(unwrapList(response.data, ['items']), GoldQaItem.fromJson);
  }

  Future<List<ExpertRubricItem>> fetchRubrics(String courseId) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/rubrics',
      queryParameters: {'courseId': courseId},
    );
    return parseList(
      unwrapList(response.data, ['items']),
      ExpertRubricItem.fromJson,
    );
  }

  Future<GoldQaItem> approveGoldQa({
    required String goldQaId,
    required String reviewerId,
    required String reviewerRole,
    required String reviewNote,
  }) async {
    final response = await _n8n.post<Map<String, dynamic>>(
      '/v2-gold-qa-approve',
      data: {
        'goldQaId': goldQaId,
        'reviewerId': reviewerId,
        'reviewerRole': reviewerRole,
        'reviewNote': reviewNote,
      },
      options: Options(receiveTimeout: const Duration(seconds: 240)),
    );
    return GoldQaItem.fromJson(unwrapMap(response.data));
  }

  Future<ExpertRubricItem> approveRubric({
    required String rubricId,
    required String reviewerId,
    required String reviewerRole,
    required String reviewNote,
  }) async {
    final response = await _n8n.post<Map<String, dynamic>>(
      '/v2-rubric-approve',
      data: {
        'rubricId': rubricId,
        'reviewerId': reviewerId,
        'reviewerRole': reviewerRole,
        'reviewNote': reviewNote,
      },
      options: Options(receiveTimeout: aiReceiveTimeout),
    );
    return ExpertRubricItem.fromJson(unwrapMap(response.data));
  }

  Future<EvalRunItem> runEvaluation({
    required String courseId,
    required String chapter,
    required String triggeredBy,
    double passThreshold = 0.6,
  }) async {
    final response = await _n8n.post<Map<String, dynamic>>(
      '/v2-eval-run',
      data: {
        'courseId': courseId,
        'chapter': chapter,
        'triggeredBy': triggeredBy,
        'passThreshold': passThreshold,
        'harnessVersion': 'v2-mvp',
        'kbVersion': 'current',
        'promptVersion': 'current',
      },
      options: Options(receiveTimeout: const Duration(seconds: 300)),
    );
    return EvalRunItem.fromJson(unwrapMap(response.data));
  }

  Future<List<EvalRunItem>> fetchEvalRuns(String courseId) async {
    final response = await _spring.get<dynamic>(
      '/api/v2/expert-training/eval-runs',
      queryParameters: {'courseId': courseId},
    );
    return parseList(unwrapList(response.data, ['runs']), EvalRunItem.fromJson);
  }
}

final expertTrainingRepositoryProvider = Provider<ExpertTrainingRepository>((
  ref,
) {
  return ExpertTrainingRepository(
    ref.watch(springDioProvider),
    ref.watch(n8nDioProvider),
  );
});
