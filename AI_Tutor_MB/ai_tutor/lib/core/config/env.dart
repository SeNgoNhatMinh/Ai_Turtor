import 'package:flutter/foundation.dart' show kIsWeb;

import 'env_native_stub.dart'
    if (dart.library.io) 'env_native.dart' as env_native;

abstract final class Env {
  // Override khi run:
  // flutter run --dart-define=API_BASE_URL=http://192.168.1.x:8085
  //               --dart-define=N8N_WEBHOOK=http://192.168.1.x:5678/webhook
  // Backend Docker: ai-tutor-api :8085, n8n :5678, trang link :8090
  static const _apiFromDefine = String.fromEnvironment('API_BASE_URL');
  static const _n8nFromDefine = String.fromEnvironment('N8N_WEBHOOK');

  static String get apiBaseUrl {
    if (_apiFromDefine.isNotEmpty) return _apiFromDefine;
    if (kIsWeb) return 'http://localhost:8085';
    return 'http://${env_native.nativeLoopbackHost()}:8085';
  }

  static String get n8nWebhook {
    if (_n8nFromDefine.isNotEmpty) return _n8nFromDefine;
    if (kIsWeb) return 'http://localhost:5678/webhook';
    return 'http://${env_native.nativeLoopbackHost()}:5678/webhook';
  }
}
