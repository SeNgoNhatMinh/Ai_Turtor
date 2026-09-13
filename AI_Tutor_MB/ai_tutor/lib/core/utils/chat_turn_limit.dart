import '../../shared/models/ai_conversation.dart';

/// Khớp web `CHAT_TURN_LIMIT` — tối đa 10 câu hỏi user / một cuộc trò chuyện.
const int chatTurnLimit = 10;

int sessionQuestionCount(
  AiConversation? session, {
  List<AiMessage> messages = const [],
}) {
  if (session != null) {
    if (session.userQuestionCount > 0) {
      return session.userQuestionCount.clamp(0, chatTurnLimit);
    }
    if (session.messageCount > 0) {
      return (session.messageCount ~/ 2).clamp(0, chatTurnLimit);
    }
  }
  final fromMessages = messages.where((m) => m.isUser).length;
  return fromMessages.clamp(0, chatTurnLimit);
}

bool sessionMaxTurnsReached(
  AiConversation? session, {
  List<AiMessage> messages = const [],
}) {
  if (session?.maxTurnsReached == true) return true;
  return sessionQuestionCount(session, messages: messages) >= chatTurnLimit;
}
