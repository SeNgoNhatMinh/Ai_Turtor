import 'dart:convert';

import 'package:ai_tutor/core/network/exceptions.dart';
import 'package:ai_tutor/features/ai_tutor/data/tts_models.dart';
import 'package:ai_tutor/features/ai_tutor/data/tts_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses NVIDIA voice options and ignores incomplete rows', () {
    final voices = parseTtsVoices([
      {
        'id': 'Magpie-Multilingual.VI-VN.Long.Neutral',
        'name': 'Long (trung tính)',
        'providerVoiceId': 'Magpie-Multilingual.VI-VN.Long.Neutral',
        'language': 'vi-VN',
      },
      {'id': '', 'name': 'broken'},
      {'name': 'missing id'},
    ]);

    expect(voices, hasLength(1));
    expect(voices.single.id, 'Magpie-Multilingual.VI-VN.Long.Neutral');
    expect(voices.single.name, 'Long (trung tính)');
  });

  test('resolves stored then first available voice like web', () {
    const voices = [TtsVoice(id: 'a', name: 'A'), TtsVoice(id: 'b', name: 'B')];

    expect(
      resolveTtsVoiceId(voices: voices, selectedId: 'b', storedId: 'a'),
      'b',
    );
    expect(
      resolveTtsVoiceId(voices: voices, selectedId: '', storedId: 'a'),
      'a',
    );
    expect(
      resolveTtsVoiceId(voices: voices, selectedId: 'gone', storedId: 'gone'),
      'a',
    );
    expect(
      ttsVoiceStorageKey(
        userId: 'student-1',
        courseId: 'PRO192',
        classId: 'SE1833',
      ),
      'ai-tutor:student-tts-voice:student-1:PRO192:SE1833',
    );
  });

  test('strips the legacy evidence appendix before synthesis', () {
    const answer = '''
DAO là mẫu thiết kế truy cập dữ liệu.

### Bằng chứng trích từ tài liệu
- slide 12
''';

    expect(
      ttsSpeakableText(answer, hasEvidenceMetadata: true),
      'DAO là mẫu thiết kế truy cập dữ liệu.',
    );
    expect(ttsSpeakableText(answer), contains('Bằng chứng trích từ tài liệu'));
  });

  test(
    'decodes a JSON TTS error even when the caller expected audio bytes',
    () {
      final bytes = utf8.encode(
        jsonEncode({
          'code': 'TTS_UNAVAILABLE',
          'error': 'NVIDIA Magpie tạm thời không sẵn sàng.',
          'message': 'NVIDIA Magpie tạm thời không sẵn sàng.',
        }),
      );
      final decoded = decodeTtsErrorData(bytes);
      expect(decoded, isA<Map>());
      expect((decoded as Map)['code'], 'TTS_UNAVAILABLE');

      final error = ttsExceptionFromDio(
        DioException(
          requestOptions: RequestOptions(path: '/api/tts/synthesize'),
          response: Response<List<int>>(
            requestOptions: RequestOptions(path: '/api/tts/synthesize'),
            statusCode: 503,
            data: bytes,
          ),
        ),
      );
      expect(error, isA<ApiBusinessException>());
      expect(error.code, 'TTS_UNAVAILABLE');
      expect(error.message, 'NVIDIA Magpie tạm thời không sẵn sàng.');
    },
  );

  test('uses course code and class name when enrollment ids are blank', () {
    final scope = ttsScopeForChat(
      userId: 'student-1',
      courseId: '',
      courseCode: 'PRJ301',
      classId: '',
      className: 'SE1832',
    );
    expect(scope.courseId, 'PRJ301');
    expect(scope.classId, 'SE1832');
    expect(scope.isValid, isTrue);
  });

  test('formats the mini-player clock like web', () {
    expect(formatTtsClock(Duration.zero), '0:00');
    expect(formatTtsClock(const Duration(seconds: 3)), '0:03');
    expect(formatTtsClock(const Duration(seconds: 72)), '1:12');
  });
}
