import 'package:ai_tutor/features/ai_tutor/data/chat_answer_recovery.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('detects n8n timeout from DioException', () {
    expect(
      isN8nTimeoutError(
        DioException(
          requestOptions: RequestOptions(path: '/student-chat'),
          type: DioExceptionType.receiveTimeout,
        ),
      ),
      isTrue,
    );
    expect(
      isCanceledChatError(
        DioException(
          requestOptions: RequestOptions(path: '/student-chat'),
          type: DioExceptionType.cancel,
        ),
      ),
      isTrue,
    );
  });

  test('finds the assistant reply after the matching student question', () {
    const messages = [
      AiMessage(id: 'u1', content: 'JPA là gì?', isUser: true),
      AiMessage(
        id: 'a1',
        content: 'JPA là API ánh xạ đối tượng-quan hệ.',
        isUser: false,
        mode: 'RAG',
      ),
    ];
    final reply = findCanonicalAssistantReply(
      messages: messages,
      question: '  jpa là gì?  ',
    );
    expect(reply?.id, 'a1');
    expect(answerFromRecoveredMessage(reply!).answer, contains('ánh xạ'));
  });
}
