import 'dart:typed_data';

import 'package:ai_tutor/features/ai_tutor/data/ai_tutor_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class _RecordingAdapter implements HttpClientAdapter {
  RequestOptions? lastRequest;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    return ResponseBody.fromString(
      '{"answer":"Dựa trên tài liệu môn học.","mode":"RAG"}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('mode and provenance requests go directly to Spring', () async {
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
    );

    expect(springAdapter.lastRequest?.path, '/api/ai/query');
    expect(n8nAdapter.lastRequest, isNull);
    final payload = springAdapter.lastRequest?.data as Map<String, dynamic>;
    expect(payload['requestedMode'], 'RAG');
    expect(payload['interactionType'], 'SOURCE_BACKED_STUDY_TIP');
    expect(payload['sourceMaterialIds'], ['material-1']);
    expect(payload['sourceChunkIds'], ['chunk-1']);
  });
}
