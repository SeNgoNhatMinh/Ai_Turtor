import 'package:ai_tutor/core/utils/chat_turn_limit.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('counts user questions and clamps to 10', () {
    const session = AiConversation(
      id: 'c1',
      title: 'Chat',
      userQuestionCount: 8,
    );
    expect(sessionQuestionCount(session), 8);
    expect(sessionMaxTurnsReached(session), isFalse);
  });

  test('treats 10 questions or flag as full', () {
    const full = AiConversation(id: 'c2', title: 'Chat', userQuestionCount: 10);
    const flagged = AiConversation(
      id: 'c3',
      title: 'Chat',
      maxTurnsReached: true,
    );
    expect(sessionMaxTurnsReached(full), isTrue);
    expect(sessionMaxTurnsReached(flagged), isTrue);
  });

  test('falls back to user message count', () {
    final messages = List<AiMessage>.generate(
      4,
      (i) => AiMessage(
        id: '$i',
        content: 'q',
        isUser: i.isEven,
        createdAt: DateTime(2026, 1, 1),
      ),
    );
    expect(sessionQuestionCount(null, messages: messages), 2);
  });
}
