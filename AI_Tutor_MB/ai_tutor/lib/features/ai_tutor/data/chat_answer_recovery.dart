import 'package:dio/dio.dart';

import '../../../shared/models/ai_conversation.dart';

const canonicalAnswerRetryDelays = <int>[0, 350, 800];
const inFlightAnswerRetryDelays = <int>[
  2000,
  4000,
  8000,
  10000,
  15000,
  20000,
  20000,
];

bool isN8nTimeoutError(Object error) {
  if (error is DioException) {
    return error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout;
  }
  return false;
}

bool isCanceledChatError(Object error) {
  return error is DioException && CancelToken.isCancel(error);
}

String normalizeComparableQuestion(String? value) {
  return (value ?? '').trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
}

AiMessage? findCanonicalAssistantReply({
  required List<AiMessage> messages,
  required String question,
}) {
  final needle = normalizeComparableQuestion(question);
  if (needle.isEmpty) return null;
  for (var i = 0; i < messages.length; i++) {
    final item = messages[i];
    if (!item.isUser) continue;
    if (normalizeComparableQuestion(item.content) != needle) continue;
    for (var j = i + 1; j < messages.length; j++) {
      final reply = messages[j];
      if (reply.isUser) break;
      if (reply.content.trim().isEmpty) continue;
      return reply;
    }
  }
  return null;
}

AiAnswer answerFromRecoveredMessage(
  AiMessage message, {
  String? conversationId,
}) {
  return AiAnswer(
    answer: message.content,
    mode: message.mode,
    confidence: message.confidence,
    escalated: message.escalated,
    conversationId: conversationId ?? message.conversationId,
    questionEscalationId: message.questionEscalationId,
    sources: message.sources,
    sourceEvidence: message.sourceEvidence,
    visualEvidence: message.visualEvidence,
    nextImproveSuggestions: message.improveSuggestions,
    assistantMessageId: message.id,
    understandingCheck: message.understandingCheck,
  );
}
