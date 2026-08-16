import '../config/env.dart';

/// Chuyển HTTP base URL sang WebSocket base (ws/wss).
String wsBaseFromHttp(String httpBaseUrl) {
  final uri = Uri.parse(httpBaseUrl);
  final scheme = uri.scheme == 'https' ? 'wss' : 'ws';
  return Uri(
    scheme: scheme,
    host: uri.host,
    port: uri.hasPort ? uri.port : null,
  ).toString();
}

String eventsWebSocketUrl(String token) {
  final base = wsBaseFromHttp(Env.apiBaseUrl);
  return '$base/ws/events?token=${Uri.encodeQueryComponent(token)}';
}

String chatWebSocketUrl({
  required String token,
  required String chatRoomId,
}) {
  final base = wsBaseFromHttp(Env.apiBaseUrl);
  return '$base/ws/chat?token=${Uri.encodeQueryComponent(token)}'
      '&chatRoomId=${Uri.encodeQueryComponent(chatRoomId)}';
}
