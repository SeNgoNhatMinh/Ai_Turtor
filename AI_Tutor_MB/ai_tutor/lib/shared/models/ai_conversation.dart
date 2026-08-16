import '../../core/utils/json_helpers.dart';
import 'improve_suggestion.dart';
import 'rag_source_evidence.dart';
import 'rag_visual_evidence.dart';

class AiConversation {
  const AiConversation({
    required this.id,
    required this.title,
    this.messageCount = 0,
    this.userQuestionCount = 0,
    this.maxTurnsReached = false,
    this.lastMessageAt,
    this.courseId,
    this.classId,
  });

  final String id;
  final String title;
  final int messageCount;
  final int userQuestionCount;
  final bool maxTurnsReached;
  final DateTime? lastMessageAt;
  final String? courseId;
  final String? classId;

  factory AiConversation.fromJson(Map<String, dynamic> json) {
    return AiConversation(
      id: readId(json, keys: ['id', 'conversationId']),
      title: readString(json, 'title', fallback: 'Cuộc trò chuyện mới'),
      messageCount: (json['messageCount'] as num?)?.toInt() ?? 0,
      userQuestionCount: (json['userQuestionCount'] as num?)?.toInt() ?? 0,
      maxTurnsReached: json['maxTurnsReached'] == true,
      lastMessageAt: parseDateTime(
        json['lastMessageAt'] ?? json['updatedAt'] ?? json['createdAt'],
      ),
      courseId: json['courseId']?.toString(),
      classId: json['classId']?.toString(),
    );
  }
}

class AiMessage {
  const AiMessage({
    required this.id,
    required this.content,
    required this.isUser,
    this.mode,
    this.confidence,
    this.sources = const [],
    this.sourceEvidence = const [],
    this.visualEvidence = const [],
    this.escalated = false,
    this.pinned = false,
    this.questionEscalationId,
    this.pinnedAt,
    this.conversationId,
    this.createdAt,
    this.improveSuggestions = const [],
  });

  final String id;
  final String content;
  final bool isUser;
  final String? mode;
  final double? confidence;
  final List<String> sources;
  final List<RagSourceEvidence> sourceEvidence;
  final List<RagVisualEvidence> visualEvidence;
  final bool escalated;
  final bool pinned;
  final String? questionEscalationId;
  final DateTime? pinnedAt;
  final String? conversationId;
  final DateTime? createdAt;
  final List<ImproveSuggestionItem> improveSuggestions;

  AiMessage copyWith({
    bool? pinned,
    DateTime? pinnedAt,
    List<ImproveSuggestionItem>? improveSuggestions,
    String? content,
    String? conversationId,
  }) {
    return AiMessage(
      id: id,
      content: content ?? this.content,
      isUser: isUser,
      mode: mode,
      confidence: confidence,
      sources: sources,
      sourceEvidence: sourceEvidence,
      visualEvidence: visualEvidence,
      escalated: escalated,
      pinned: pinned ?? this.pinned,
      questionEscalationId: questionEscalationId,
      pinnedAt: pinnedAt ?? this.pinnedAt,
      conversationId: conversationId ?? this.conversationId,
      createdAt: createdAt,
      improveSuggestions: improveSuggestions ?? this.improveSuggestions,
    );
  }

  factory AiMessage.fromJson(Map<String, dynamic> json) {
    final role = json['role']?.toString() ?? json['senderRole']?.toString();
    final isUser =
        role == 'USER' ||
        role == 'STUDENT' ||
        json['isUser'] == true ||
        json['userMessage'] == true;

    final questionEscalationId =
        (json['questionEscalationId'] ?? json['escalationId'])?.toString();
    final mode = json['mode']?.toString();
    final escalated =
        json['escalated'] == true ||
        json['escalationRecommended'] == true ||
        mode == 'ESCALATE' ||
        (questionEscalationId != null && questionEscalationId.isNotEmpty);

    return AiMessage(
      id: readId(json, keys: ['id', 'messageId']),
      content: readString(
        json,
        'content',
        fallback: readString(
          json,
          'message',
          fallback: readString(json, 'answer'),
        ),
      ),
      isUser: isUser,
      mode: mode,
      confidence: _parseConfidence(json['confidence'] ?? json['intentConfidence']),
      sources: _parseSources(json['sources'], json['sourceEvidence']),
      sourceEvidence: RagSourceEvidence.fromAiPayload(json),
      visualEvidence: RagVisualEvidence.fromAiPayload(json),
      escalated: escalated,
      questionEscalationId: questionEscalationId,
      pinned: json['pinned'] == true,
      pinnedAt: parseDateTime(json['pinnedAt']),
      conversationId: json['conversationId']?.toString(),
      createdAt: parseDateTime(json['createdAt'] ?? json['timestamp']),
      improveSuggestions: _parseImproveSuggestions(json['nextImproveSuggestions']),
    );
  }

  static List<ImproveSuggestionItem> _parseImproveSuggestions(dynamic value) {
    if (value is! List) return const [];
    return ImproveSuggestionItem.actionableChips(
      value
          .whereType<Map>()
          .map((e) => ImproveSuggestionItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }

  static double? _parseConfidence(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  static List<String> _parseSources(dynamic value, dynamic sourceEvidence) {
    final parsed = _parseSourceLabels(value);
    if (parsed.isNotEmpty) return parsed;

    if (sourceEvidence is List) {
      return sourceEvidence
          .whereType<Map>()
          .map((e) => RagSourceEvidence.fromJson(Map<String, dynamic>.from(e)))
          .map((e) {
            final page = e.pageLabel;
            if (page != null) return '${e.displayTitle} · $page';
            return e.displayTitle;
          })
          .where((e) => e.isNotEmpty)
          .toList();
    }
    return const [];
  }

  static List<String> _parseSourceLabels(dynamic value) {
    if (value is! List) return [];
    return value.map((e) {
      if (e is Map) {
        return (e['title'] ?? e['name'] ?? e['materialTitle'])?.toString() ??
            e.toString();
      }
      return e.toString();
    }).toList();
  }
}

class AiAnswer {
  const AiAnswer({
    required this.answer,
    this.mode,
    this.confidence,
    this.escalated = false,
    this.conversationId,
    this.questionEscalationId,
    this.sources = const [],
    this.sourceEvidence = const [],
    this.visualEvidence = const [],
    this.assignmentSafetyApplied = false,
    this.weakTopics = const [],
    this.nextImproveSuggestions = const [],
    this.userMessageId,
    this.assistantMessageId,
    this.suggestionConsumed = false,
  });

  final String answer;
  final String? mode;
  final double? confidence;
  final bool escalated;
  final String? conversationId;
  final String? questionEscalationId;
  final List<String> sources;
  final List<RagSourceEvidence> sourceEvidence;
  final List<RagVisualEvidence> visualEvidence;
  final bool assignmentSafetyApplied;
  final List<String> weakTopics;
  final List<ImproveSuggestionItem> nextImproveSuggestions;
  final String? userMessageId;
  final String? assistantMessageId;
  final bool suggestionConsumed;

  factory AiAnswer.fromJson(Map<String, dynamic> json) {
    final questionEscalationId =
        (json['questionEscalationId'] ?? json['escalationId'])?.toString();
    final mode = json['mode']?.toString();
    final escalated =
        json['escalated'] == true ||
        json['escalationRecommended'] == true ||
        mode == 'ESCALATE' ||
        (questionEscalationId != null && questionEscalationId.isNotEmpty);

    return AiAnswer(
      answer: readString(json, 'answer', fallback: readString(json, 'content')),
      mode: mode,
      confidence: AiMessage._parseConfidence(
        json['confidence'] ?? json['intentConfidence'],
      ),
      escalated: escalated,
      conversationId: json['conversationId']?.toString(),
      questionEscalationId: questionEscalationId,
      sources: AiMessage._parseSources(json['sources'], json['sourceEvidence']),
      sourceEvidence: RagSourceEvidence.fromAiPayload(json),
      visualEvidence: RagVisualEvidence.fromAiPayload(json),
      assignmentSafetyApplied: json['assignmentSafetyApplied'] == true,
      weakTopics: parseStringList(json['weakTopics']),
      nextImproveSuggestions: AiMessage._parseImproveSuggestions(
        json['nextImproveSuggestions'],
      ),
      userMessageId: json['userMessageId']?.toString(),
      assistantMessageId: json['assistantMessageId']?.toString(),
      suggestionConsumed: json['suggestionConsumed'] == true,
    );
  }
}
