import 'dart:math';

import 'exceptions.dart';

/// Builds trace/session ids and n8n webhook payloads expected by
/// `AI-tutor-workflow-runtime-fixed.json`.
String newTraceId([String prefix = 'trace']) {
  final stamp = DateTime.now().millisecondsSinceEpoch;
  final rand = Random().nextInt(0xFFFFFF).toRadixString(16).padLeft(6, '0');
  return '$prefix-$stamp-$rand';
}

String newSessionId([String prefix = 'session']) {
  return '$prefix-${DateTime.now().millisecondsSinceEpoch}';
}

Map<String, dynamic> withN8nContext(
  Map<String, dynamic> body, {
  String? authToken,
  String? traceId,
  String? sessionId,
}) {
  return {
    ...body,
    'traceId': traceId ?? body['traceId'] ?? newTraceId(),
    if (sessionId != null && sessionId.isNotEmpty) 'sessionId': sessionId,
    if (authToken != null && authToken.isNotEmpty) 'authToken': authToken,
  };
}

void ensureN8nSuccess(Map<String, dynamic> data) {
  if (data['success'] == false || data['ok'] == false) {
    final business = parseApiBusinessError(data);
    if (business != null) throw business;
    final message = data['message']?.toString() ??
        data['error']?.toString() ??
        'n8n workflow failed';
    throw StateError(message);
  }
  final code = data['code']?.toString();
  if (code == 'DAILY_QUESTION_LIMIT_REACHED') {
    throw parseApiBusinessError(data) ??
        ApiBusinessException(
          message: data['message']?.toString() ??
              data['error']?.toString() ??
              'Bạn đã hết lượt hỏi AI hôm nay.',
          code: code,
        );
  }
}
