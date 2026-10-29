import 'package:ai_tutor/features/ai_tutor/application/ai_tutor_controller.dart';
import 'package:ai_tutor/features/ai_tutor/application/daily_question_quota_controller.dart';
import 'package:ai_tutor/features/ai_tutor/data/ai_tutor_repository.dart';
import 'package:ai_tutor/features/ai_tutor/data/daily_question_quota.dart';
import 'package:ai_tutor/features/ai_tutor/data/student_own_llm.dart';
import 'package:ai_tutor/features/auth/application/auth_controller.dart';
import 'package:ai_tutor/core/network/realtime_providers.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:ai_tutor/shared/models/auth_session.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'uses the student LLM route after quota exhaustion without calling n8n',
    () async {
      const courseId = 'PRJ301';
      const conversationId = 'conversation-1';
      final repository = _OwnLlmFlowRepository();
      final container = ProviderContainer(
        overrides: [
          currentUserIdProvider.overrideWithValue('student-1'),
          authControllerProvider.overrideWith(_EmptyAuthController.new),
          aiTutorRepositoryProvider.overrideWithValue(repository),
          realtimeEventsProvider.overrideWith((ref) => const Stream.empty()),
        ],
      );
      addTearDown(container.dispose);

      final quotaSubscription = container.listen(
        dailyQuestionQuotaProvider(courseId),
        (_, _) {},
        fireImmediately: true,
      );
      addTearDown(quotaSubscription.close);
      await container
          .read(dailyQuestionQuotaProvider(courseId).notifier)
          .refresh();
      expect(
        container.read(dailyQuestionQuotaProvider(courseId)).exhausted,
        isTrue,
      );

      container
          .read(studentOwnLlmProvider.notifier)
          .save(
            const StudentOwnLlmCredentials(
              userId: 'student-1',
              provider: 'openrouter',
              model: 'openai/gpt-oss-20b',
              apiKey: 'sk-session-test',
            ),
          );

      final chatSubscription = container.listen(
        chatControllerProvider(conversationId),
        (_, _) {},
        fireImmediately: true,
      );
      addTearDown(chatSubscription.close);
      await container.read(chatControllerProvider(conversationId).future);

      final effectiveConversationId = await container
          .read(chatControllerProvider(conversationId).notifier)
          .sendMessage(
            conversationId: conversationId,
            message: 'Giải thích Servlet',
            courseId: courseId,
            classId: 'SE1832',
          );

      expect(effectiveConversationId, conversationId);
      expect(repository.schoolAnswerCalls, 1);
      expect(repository.standardAskCalls, 0);
      expect(repository.receivedProvider, 'openrouter');
      expect(repository.receivedModel, 'openai/gpt-oss-20b');
      expect(repository.receivedApiKey, 'sk-session-test');
      expect(repository.receivedQuestion, 'Giải thích Servlet');

      final messages = container
          .read(chatControllerProvider(conversationId))
          .requireValue;
      expect(messages, hasLength(2));
      expect(messages.first.isUser, isTrue);
      expect(messages.last.content, 'Nội dung từ API LLM cá nhân.');
    },
  );
}

class _EmptyAuthController extends AuthController {
  @override
  Future<AuthSession?> build() async => null;
}

class _OwnLlmFlowRepository extends AiTutorRepository {
  _OwnLlmFlowRepository() : super(Dio(), Dio());

  var schoolAnswerCalls = 0;
  var standardAskCalls = 0;
  String? receivedProvider;
  String? receivedModel;
  String? receivedApiKey;
  String? receivedQuestion;

  @override
  Future<List<AiMessage>> fetchMessages({
    required String conversationId,
    required String userId,
  }) async => const [];

  @override
  Future<List<AiMessage>> fetchPinnedMessages({
    required String conversationId,
    required String userId,
  }) async => const [];

  @override
  Future<DailyQuestionQuota> fetchQuestionQuota({
    required String studentId,
    required String courseId,
  }) async {
    return const DailyQuestionQuota(
      courseId: 'PRJ301',
      used: 10,
      remaining: 0,
      limit: 10,
    );
  }

  @override
  Future<AiAnswer> answerFromSchoolMaterials({
    required String courseId,
    required String question,
    required String provider,
    required String model,
    required String studentLlmKey,
    String? classId,
    CancelToken? cancelToken,
  }) async {
    schoolAnswerCalls += 1;
    receivedProvider = provider;
    receivedModel = model;
    receivedApiKey = studentLlmKey;
    receivedQuestion = question;
    return const AiAnswer(
      answer: 'Nội dung từ API LLM cá nhân.',
      conversationId: 'conversation-1',
      assistantMessageId: 'assistant-1',
    );
  }

  @override
  Future<AiAnswer> ask({
    required String userId,
    required String courseId,
    required String message,
    String? classId,
    String? conversationId,
    String? studentName,
    String? studentEmail,
    String? authToken,
    String? codeSnippet,
    String? sessionId,
    String? interactionType,
    String? originAssistantMessageId,
    String? understandingAttemptId,
    String? originalQuestion,
    String? tutorSessionId,
    String? sessionPhase,
    String? improvePlanId,
    String? planItemId,
    String? clickedSuggestion,
    String? chapterKey,
    String? chapterTitle,
    String? requestedMode,
    List<String> sourceMaterialIds = const [],
    List<String> sourceChunkIds = const [],
    CancelToken? cancelToken,
  }) async {
    standardAskCalls += 1;
    throw StateError('The standard n8n route must not be called.');
  }
}
