import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/network/exceptions.dart';
import '../../../core/network/network_providers.dart';
import 'tts_models.dart';

class TtsRepository {
  TtsRepository(this._spring);

  final Dio _spring;

  Future<List<TtsVoice>> listVoices({
    required String courseId,
    required String classId,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _spring.get<dynamic>(
        '/api/tts/voices',
        queryParameters: {'courseId': courseId, 'classId': classId},
        cancelToken: cancelToken,
        options: Options(extra: const {skipUnauthorizedRedirectExtra: true}),
      );
      return parseTtsVoices(response.data);
    } on DioException catch (error) {
      throw ttsExceptionFromDio(error);
    }
  }

  Future<Uint8List> synthesize({
    required String messageId,
    required String courseId,
    required String classId,
    required String text,
    String? providerVoiceId,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _spring.post<dynamic>(
        '/api/tts/synthesize',
        data: {
          'messageId': messageId,
          'courseId': courseId,
          'classId': classId,
          'text': text,
          if (providerVoiceId != null && providerVoiceId.isNotEmpty)
            'providerVoiceId': providerVoiceId,
        },
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.bytes,
          receiveTimeout: ttsReceiveTimeout,
          extra: const {skipUnauthorizedRedirectExtra: true},
        ),
      );
      final data = response.data;
      if (data is Uint8List) return data;
      if (data is List<int>) return Uint8List.fromList(data);
      throw const FormatException(ttsUnavailableFallback);
    } on DioException catch (error) {
      throw ttsExceptionFromDio(error);
    }
  }
}

ApiBusinessException ttsExceptionFromDio(DioException error) {
  final parsed = parseApiBusinessError(
    decodeTtsErrorData(error.response?.data),
  );
  if (parsed != null) return parsed;
  return ApiBusinessException(
    message: ttsUnavailableFallback,
    code: error.response?.statusCode == 503 ? 'TTS_UNAVAILABLE' : null,
  );
}

final ttsRepositoryProvider = Provider<TtsRepository>((ref) {
  return TtsRepository(ref.watch(springDioProvider));
});
