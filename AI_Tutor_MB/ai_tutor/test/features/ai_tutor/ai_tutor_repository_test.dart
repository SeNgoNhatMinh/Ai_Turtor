import 'dart:typed_data';

import 'package:ai_tutor/features/ai_tutor/data/ai_tutor_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class _RecordingAdapter implements HttpClientAdapter {
  _RecordingAdapter({
    this.body = '{"answer":"Dựa trên tài liệu môn học.","mode":"RAG"}',
  });

  final String body;
  RequestOptions? lastRequest;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    return ResponseBody.fromString(
      body,
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _ThrowingAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    throw DioException(
      requestOptions: options,
      type: DioExceptionType.connectionError,
      error: 'n8n unavailable',
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('guided provenance requests stay inside the n8n Harness', () async {
    final springAdapter = _RecordingAdapter();
    final n8nAdapter = _RecordingAdapter();
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
      ..httpClientAdapter = n8nAdapter;
    final repository = AiTutorRepository(spring, n8n);

    await repository.ask(
      userId: 'student-1',
      courseId: 'PRJ301',
      message: 'Ôn lại servlet lifecycle',
      requestedMode: 'RAG',
      interactionType: 'SOURCE_BACKED_STUDY_TIP',
      clickedSuggestion: 'Servlet lifecycle',
      sourceMaterialIds: const ['material-1'],
      sourceChunkIds: const ['chunk-1'],
      chapterKey: 'chapter-2',
      chapterTitle: 'Servlet lifecycle',
    );

    expect(n8nAdapter.lastRequest?.path, '/student-chat');
    expect(springAdapter.lastRequest, isNull);
    final payload = n8nAdapter.lastRequest?.data as Map<String, dynamic>;
    expect(payload['requestedMode'], 'RAG');
    expect(payload['interactionType'], 'SOURCE_BACKED_STUDY_TIP');
    expect(payload['sourceMaterialIds'], ['material-1']);
    expect(payload['sourceChunkIds'], ['chunk-1']);
    expect(payload['chapterKey'], 'chapter-2');
    expect(payload['chapterTitle'], 'Servlet lifecycle');
  });

  test('remediation sends the originating quiz evidence context', () async {
    final springAdapter = _RecordingAdapter();
    final n8nAdapter = _RecordingAdapter();
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
      ..httpClientAdapter = n8nAdapter;
    final repository = AiTutorRepository(spring, n8n);

    await repository.ask(
      userId: 'student-1',
      courseId: 'PRJ301',
      message: 'Ôn lại câu chưa đúng',
      interactionType: 'UNDERSTANDING_REMEDIATION',
      originAssistantMessageId: 'message-9',
      understandingAttemptId: 'attempt-2',
      originalQuestion: 'Servlet gọi phương thức nào trước?',
      sourceMaterialIds: const ['material-1'],
      sourceChunkIds: const ['chunk-7'],
    );

    final payload = n8nAdapter.lastRequest?.data as Map<String, dynamic>;
    expect(payload['interactionType'], 'UNDERSTANDING_REMEDIATION');
    expect(payload['originAssistantMessageId'], 'message-9');
    expect(payload['understandingAttemptId'], 'attempt-2');
    expect(payload['originalQuestion'], 'Servlet gọi phương thức nào trước?');
    expect(payload['sourceMaterialIds'], ['material-1']);
    expect(payload['sourceChunkIds'], ['chunk-7']);
  });

  test('records each understanding quiz with its quizIndex', () async {
    final springAdapter = _RecordingAdapter(
      body:
          '{"status":"RECORDED","attemptId":"attempt-2",'
          '"messageId":"message-9","quizIndex":1,"selectedKey":"B",'
          '"correct":false,"correctKey":"A",'
          '"correctOptionText":"init()","explanation":"init runs first"}',
    );
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final repository = AiTutorRepository(spring, Dio());

    final result = await repository.recordUnderstandingCheck(
      conversationId: 'conversation-1',
      messageId: 'message-9',
      userId: 'student-1',
      selectedKey: 'B',
      quizIndex: 1,
    );

    expect(
      springAdapter.lastRequest?.path,
      '/api/ai/conversations/conversation-1/messages/message-9/understanding-check',
    );
    final payload = springAdapter.lastRequest?.data as Map<String, dynamic>;
    expect(payload['quizIndex'], 1);
    expect(payload['selectedKey'], 'B');
    expect(result.attemptId, 'attempt-2');
    expect(result.correct, isFalse);
    expect(result.correctKey, 'A');
  });

  test(
    'lesson-start prompts are tagged GUIDED_LESSON like the web composer',
    () async {
      final springAdapter = _RecordingAdapter();
      final n8nAdapter = _RecordingAdapter();
      final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
        ..httpClientAdapter = springAdapter;
      final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
        ..httpClientAdapter = n8nAdapter;
      final repository = AiTutorRepository(spring, n8n);

      await repository.ask(
        userId: 'student-1',
        courseId: 'PFP191',
        message: 'Bắt đầu bài 3: Counting and summing loops',
        requestedMode: 'RAG',
      );

      final payload = n8nAdapter.lastRequest?.data as Map<String, dynamic>;
      expect(payload['interactionType'], 'GUIDED_LESSON');
      expect(payload['message'], 'Bắt đầu bài 3: Counting and summing loops');
    },
  );

  test(
    'ordinary RAG chat goes through n8n even when requestedMode is RAG',
    () async {
      final springAdapter = _RecordingAdapter();
      final n8nAdapter = _RecordingAdapter();
      final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
        ..httpClientAdapter = springAdapter;
      final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
        ..httpClientAdapter = n8nAdapter;
      final repository = AiTutorRepository(spring, n8n);

      await repository.ask(
        userId: 'student-1',
        courseId: 'PRJ301',
        message: 'Bắt đầu bài 3: Cấu trúc điều khiển',
        requestedMode: 'RAG',
      );

      expect(n8nAdapter.lastRequest?.path, '/student-chat');
      expect(springAdapter.lastRequest, isNull);
      final payload = n8nAdapter.lastRequest?.data as Map<String, dynamic>;
      expect(payload['interactionType'], 'GUIDED_LESSON');
    },
  );

  test(
    'rejects a source-only response instead of returning a blank answer',
    () async {
      final springAdapter = _RecordingAdapter(body: '[]');
      final n8nAdapter = _RecordingAdapter(
        body:
            '{"answer":"## Theo tài liệu môn học\\n\\n'
            '## Nguồn tài liệu đã dùng\\nmaterialId=material-1",'
            '"confidence":0.8,"sources":["material-1"]}',
      );
      final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
        ..httpClientAdapter = springAdapter;
      final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
        ..httpClientAdapter = n8nAdapter;
      final repository = AiTutorRepository(spring, n8n);

      await expectLater(
        repository.ask(
          userId: 'student-1',
          courseId: 'PFP191',
          message: 'Bắt đầu bài 2: A list is a sequence',
        ),
        throwsA(isA<FormatException>()),
      );
    },
  );

  test('explicit CODE mode also stays inside the n8n Harness', () async {
    final springAdapter = _RecordingAdapter();
    final n8nAdapter = _RecordingAdapter();
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
      ..httpClientAdapter = n8nAdapter;
    final repository = AiTutorRepository(spring, n8n);

    await repository.ask(
      userId: 'student-1',
      courseId: 'PRJ301',
      message: 'Giải thích lỗi trong đoạn code này',
      requestedMode: 'CODE',
    );

    expect(n8nAdapter.lastRequest?.path, '/student-chat');
    expect(springAdapter.lastRequest, isNull);
    final payload = n8nAdapter.lastRequest?.data as Map<String, dynamic>;
    expect(payload['requestedMode'], 'CODE');
  });

  test('does not create a duplicate Spring request when n8n fails', () async {
    final springAdapter = _RecordingAdapter();
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
      ..httpClientAdapter = _ThrowingAdapter();
    final repository = AiTutorRepository(spring, n8n);

    await expectLater(
      repository.ask(
        userId: 'student-1',
        courseId: 'PRJ301',
        message: 'Giải thích dependency injection',
      ),
      throwsA(isA<DioException>()),
    );

    expect(springAdapter.lastRequest, isNull);
  });

  test('loads the teacher-controlled support profile from Spring', () async {
    final springAdapter = _RecordingAdapter(
      body:
          '{"studentId":"student-1","courseId":"PRJ301",'
          '"classId":"SE1801","supportLevel":"HIGH_SUPPORT",'
          '"teacherControlled":true,"hasActiveTeacherDirective":true}',
    );
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final repository = AiTutorRepository(spring, Dio());

    final profile = await repository.fetchStudentSupportProfile(
      studentId: 'student-1',
      courseId: 'PRJ301',
      classId: 'SE1801',
    );

    expect(
      springAdapter.lastRequest?.path,
      '/api/tutor/students/student-1/courses/PRJ301/support-profile',
    );
    expect(springAdapter.lastRequest?.queryParameters['classId'], 'SE1801');
    expect(profile.supportLevel, 'HIGH_SUPPORT');
    expect(profile.hasActiveTeacherDirective, isTrue);
  });

  test('loads the stored course learning guide used by web chat', () async {
    final springAdapter = _RecordingAdapter(
      body:
          '{"courseId":"PRJ301","courseName":"Java Web",'
          '"welcomeMarkdown":"# Chào mừng",'
          '"topics":[{"title":"Servlet lifecycle"}]}',
    );
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final repository = AiTutorRepository(spring, Dio());

    final guide = await repository.fetchCourseLearningGuide('PRJ301');

    expect(
      springAdapter.lastRequest?.path,
      '/api/courses/PRJ301/learning-guide',
    );
    expect(guide.topicTitles, ['Servlet lifecycle']);
  });

  test('posts school-answer to Spring with the student LLM header', () async {
    final springAdapter = _RecordingAdapter(
      body: '{"answer":"Theo slide 3.","grounded":true,"source":"RAG"}',
    );
    final n8nAdapter = _RecordingAdapter();
    final spring = Dio(BaseOptions(baseUrl: 'https://spring.example'))
      ..httpClientAdapter = springAdapter;
    final n8n = Dio(BaseOptions(baseUrl: 'https://n8n.example'))
      ..httpClientAdapter = n8nAdapter;
    final repository = AiTutorRepository(spring, n8n);

    final answer = await repository.answerFromSchoolMaterials(
      courseId: 'PRJ301',
      classId: 'SE1801',
      question: 'Servlet là gì?',
      provider: 'openrouter',
      model: 'openai/gpt-oss-20b',
      studentLlmKey: 'sk-test-key',
    );

    expect(n8nAdapter.lastRequest, isNull);
    expect(springAdapter.lastRequest?.path, '/api/ai/school-answer');
    expect(springAdapter.lastRequest?.method, 'POST');
    expect(
      springAdapter.lastRequest?.headers['X-Student-Llm-Key'],
      'sk-test-key',
    );
    final payload = springAdapter.lastRequest?.data as Map<String, dynamic>;
    expect(payload['courseId'], 'PRJ301');
    expect(payload['classId'], 'SE1801');
    expect(payload['question'], 'Servlet là gì?');
    expect(payload['provider'], 'openrouter');
    expect(payload['model'], 'openai/gpt-oss-20b');
    expect(payload.containsKey('apiKey'), isFalse);
    expect(answer.answer, 'Theo slide 3.');
    expect(answer.groundingType, 'COURSE_MATERIAL');
    expect(answer.sources, ['Tài liệu nhà trường']);
    expect(answer.confidence, 0.9);
  });
}
