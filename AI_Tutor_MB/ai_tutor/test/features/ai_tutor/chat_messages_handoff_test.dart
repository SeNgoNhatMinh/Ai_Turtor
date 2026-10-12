import 'package:ai_tutor/features/ai_tutor/application/tutor_session_controller.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('seeds the next conversation so Học ngay is not a blank reload', () {
    const handoff = ChatMessagesHandoff(
      conversationId: 'conv-2',
      messages: [
        AiMessage(id: 'u1', content: 'Bắt đầu bài 7: Logging', isUser: true),
        AiMessage(
          id: 'a1',
          content: 'Logging giúp theo dõi ứng dụng.',
          isUser: false,
        ),
      ],
    );

    expect(takeChatMessagesHandoff(handoff, 'conv-1'), isNull);
    expect(takeChatMessagesHandoff(handoff, 'conv-2')?.map((item) => item.id), [
      'u1',
      'a1',
    ]);
    expect(takeChatMessagesHandoff(null, 'conv-2'), isNull);
  });
}
