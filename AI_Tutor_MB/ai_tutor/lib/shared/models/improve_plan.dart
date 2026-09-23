import '../../core/utils/json_helpers.dart';
import 'improve_suggestion.dart';

enum PlanStepStatus { completed, inProgress, notStarted }

class PlanStep {
  const PlanStep({
    required this.title,
    this.status = PlanStepStatus.notStarted,
    this.progressLabel,
    this.progressValue,
  });

  final String title;
  final PlanStepStatus status;
  final String? progressLabel;
  final double? progressValue;
}

class ImprovePlanItemDetail {
  const ImprovePlanItemDetail({
    required this.id,
    required this.title,
    this.instruction = '',
    this.sourceTopic = '',
    this.groundingStatus = '',
    this.groundingConfidence,
    this.sourceTerms = const [],
    this.retrievalTerms = const [],
    this.sourceMaterialIds = const [],
    this.sourceChunkIds = const [],
  });

  final String id;
  final String title;
  final String instruction;
  final String sourceTopic;
  final String groundingStatus;
  final double? groundingConfidence;
  final List<String> sourceTerms;
  final List<String> retrievalTerms;
  final List<String> sourceMaterialIds;
  final List<String> sourceChunkIds;

  String get reviewText {
    final instructionText = instruction.trim();
    if (instructionText.isNotEmpty) return instructionText;
    return title.trim();
  }

  factory ImprovePlanItemDetail.fromJson(Map<String, dynamic> json) {
    return ImprovePlanItemDetail(
      id: readString(json, 'id'),
      title: readString(
        json,
        'title',
        fallback: readString(json, 'instruction'),
      ),
      instruction: readString(
        json,
        'instruction',
        fallback: readString(json, 'title'),
      ),
      sourceTopic: readString(json, 'sourceTopic'),
      groundingStatus: readString(json, 'groundingStatus'),
      groundingConfidence: (json['groundingConfidence'] as num?)?.toDouble(),
      sourceTerms: parseStringList(json['sourceTerms']),
      retrievalTerms: parseStringList(json['retrievalTerms']),
      sourceMaterialIds: parseStringList(json['sourceMaterialIds']),
      sourceChunkIds: parseStringList(json['sourceChunkIds']),
    );
  }
}

class ImprovePlan {
  const ImprovePlan({
    required this.id,
    this.riskLevel = 'LOW',
    this.riskPercent,
    this.weakTopics = const [],
    this.planItems = const [],
    this.planItemDetails = const [],
    this.steps = const [],
    this.evidence,
    this.completed = false,
  });

  final String id;
  final String riskLevel;
  final int? riskPercent;
  final List<String> weakTopics;
  final List<String> planItems;
  final List<ImprovePlanItemDetail> planItemDetails;
  final List<PlanStep> steps;
  final String? evidence;
  final bool completed;

  List<PlanStep> get resolvedSteps {
    if (steps.isNotEmpty) return steps;
    final titles = planItemDetails.isNotEmpty
        ? planItemDetails.map((item) => item.reviewText).toList()
        : planItems;
    if (titles.isEmpty) return const [];
    final firstOpen = completed ? titles.length : 0;
    return titles.asMap().entries.map((entry) {
      final index = entry.key;
      final title = entry.value;
      if (completed || index < firstOpen) {
        return PlanStep(title: title, status: PlanStepStatus.completed);
      }
      if (index == firstOpen) {
        return PlanStep(
          title: title,
          status: PlanStepStatus.inProgress,
          progressValue: 0.5,
        );
      }
      return PlanStep(title: title, status: PlanStepStatus.notStarted);
    }).toList();
  }

  factory ImprovePlan.fromJson(Map<String, dynamic> json) {
    final rawItems = json['planItems'] ?? json['items'] ?? json['steps'];
    final steps = _parseSteps(rawItems);
    return ImprovePlan(
      id: _readPlanId(json),
      riskLevel: readString(json, 'riskLevel', fallback: 'LOW'),
      riskPercent: ((json['riskPercent'] ?? json['riskScore']) as num?)
          ?.toInt(),
      weakTopics: parseStringList(json['weakTopics']),
      planItems: _parsePlanItems(rawItems),
      planItemDetails: _parsePlanItemDetails(json),
      steps: steps,
      evidence: _parseEvidence(json['evidence']) ?? json['summary']?.toString(),
      completed: json['completed'] == true || json['status'] == 'COMPLETED',
    );
  }

  List<ImproveSuggestionItem> get reviewSuggestions {
    if (planItemDetails.isNotEmpty) {
      return planItemDetails
          .where((item) => item.reviewText.isNotEmpty)
          .map(
            (item) => ImproveSuggestionItem.reviewItem(
              title: item.title,
              text: item.reviewText,
              improvePlanId: id,
              planItemId: item.id,
              groundingStatus: item.groundingStatus,
              sourceMaterialIds: item.sourceMaterialIds,
              sourceChunkIds: item.sourceChunkIds,
            ),
          )
          .toList();
    }
    return planItems
        .asMap()
        .entries
        .where((entry) => entry.value.trim().isNotEmpty)
        .map(
          (entry) => ImproveSuggestionItem.reviewItem(
            title: entry.value.trim(),
            text: entry.value.trim(),
            improvePlanId: id,
            planItemId: 'legacy-${entry.key}',
          ),
        )
        .toList();
  }

  static String _readPlanId(Map<String, dynamic> json) {
    for (final key in ['id', 'planId']) {
      final value = json[key];
      if (value != null && value.toString().isNotEmpty) {
        return value.toString();
      }
    }
    return '';
  }

  static List<String> _parsePlanItems(dynamic raw) {
    if (raw is List) {
      return raw
          .map((e) {
            if (e is String) return e;
            if (e is Map) {
              return readString(
                Map<String, dynamic>.from(e),
                'title',
                fallback: readString(Map<String, dynamic>.from(e), 'name'),
              );
            }
            return e.toString();
          })
          .where((s) => s.isNotEmpty)
          .toList();
    }
    return parseStringList(raw);
  }

  static List<ImprovePlanItemDetail> _parsePlanItemDetails(
    Map<String, dynamic> json,
  ) {
    final raw = json['planItemDetails'] ?? json['itemDetails'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map(
          (item) =>
              ImprovePlanItemDetail.fromJson(Map<String, dynamic>.from(item)),
        )
        .where((item) => item.reviewText.isNotEmpty)
        .toList();
  }

  static String? _parseEvidence(dynamic value) {
    if (value == null) return null;
    if (value is String) return value.isEmpty ? null : value;
    if (value is List) {
      final lines = value
          .map((e) => e.toString().trim())
          .where((s) => s.isNotEmpty)
          .toList();
      return lines.isEmpty ? null : lines.join('\n');
    }
    return value.toString();
  }

  static List<PlanStep> _parseSteps(dynamic raw) {
    if (raw is! List) return const [];
    return raw.map((item) {
      if (item is String) {
        return PlanStep(title: item);
      }
      if (item is Map<String, dynamic>) {
        final statusRaw = readString(
          item,
          'status',
          fallback: '',
        ).toUpperCase();
        final status = switch (statusRaw) {
          'COMPLETED' || 'DONE' => PlanStepStatus.completed,
          'IN_PROGRESS' || 'ACTIVE' => PlanStepStatus.inProgress,
          _ => PlanStepStatus.notStarted,
        };
        final progress = item['progress'];
        double? progressValue;
        String? progressLabel;
        if (progress is num) {
          progressValue = progress.toDouble();
          if (progressValue > 1) progressValue = progressValue / 100;
        } else if (progress is String) {
          progressLabel = progress;
        }
        return PlanStep(
          title: readString(item, 'title', fallback: readString(item, 'name')),
          status: status,
          progressLabel: progressLabel ?? item['progressLabel']?.toString(),
          progressValue: progressValue,
        );
      }
      return PlanStep(title: item.toString());
    }).toList();
  }
}

class StudentMemory {
  const StudentMemory({
    this.weakTopics = const [],
    this.learnedTopics = const [],
    this.improveSuggestions = const [],
    this.pinnedSuggestions = const [],
    this.recentQuestions = const [],
    this.notes,
  });

  final List<String> weakTopics;
  final List<String> learnedTopics;
  final List<String> improveSuggestions;
  final List<String> pinnedSuggestions;
  final List<String> recentQuestions;
  final String? notes;

  factory StudentMemory.fromJson(Map<String, dynamic> json) {
    return StudentMemory(
      weakTopics: parseStringList(json['weakTopics']),
      learnedTopics: parseStringList(json['learnedTopics']),
      improveSuggestions: parseStringList(json['improveSuggestions']),
      pinnedSuggestions: parseStringList(json['pinnedImproveSuggestions']),
      recentQuestions: parseStringList(
        json['recentQuestions'] ?? json['recentUserQuestions'],
      ),
      notes: json['notes']?.toString() ?? json['summary']?.toString(),
    );
  }
}

/// Kết quả gọi `suggestions/learn` — dùng để mở thẳng cuộc chat đã trả lời.
class LearnSuggestionResult {
  const LearnSuggestionResult({
    this.conversationId,
    this.answer,
    this.userMessageId,
    this.assistantMessageId,
    this.suggestionConsumed = false,
    this.nextImproveSuggestions = const [],
  });

  final String? conversationId;
  final String? answer;
  final String? userMessageId;
  final String? assistantMessageId;
  final bool suggestionConsumed;
  final List<ImproveSuggestionItem> nextImproveSuggestions;

  factory LearnSuggestionResult.fromJson(Map<String, dynamic> json) {
    final rawSuggestions = json['nextImproveSuggestions'];
    final suggestions = rawSuggestions is List
        ? rawSuggestions
              .whereType<Map>()
              .map(
                (e) => ImproveSuggestionItem.fromJson(
                  Map<String, dynamic>.from(e),
                ),
              )
              .toList()
        : const <ImproveSuggestionItem>[];

    return LearnSuggestionResult(
      conversationId: json['conversationId']?.toString(),
      answer: json['answer']?.toString(),
      userMessageId: json['userMessageId']?.toString(),
      assistantMessageId: json['assistantMessageId']?.toString(),
      suggestionConsumed: json['suggestionConsumed'] == true,
      nextImproveSuggestions: suggestions,
    );
  }
}
