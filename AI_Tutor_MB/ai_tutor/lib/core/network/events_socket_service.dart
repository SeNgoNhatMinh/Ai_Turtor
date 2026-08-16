import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'realtime_event.dart';
import 'ws_url.dart';

/// Kết nối `/ws/events` — push indexing, assignment, expert training, grading...
class EventsSocketService {
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  String? _token;
  bool _manualClose = false;

  final _eventsController = StreamController<RealtimeEvent>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();

  Stream<RealtimeEvent> get events => _eventsController.stream;
  Stream<bool> get connectionChanges => _connectionController.stream;
  bool get isConnected => _channel != null;

  Future<void> connect(String token) async {
    final trimmed = token.trim();
    if (trimmed.isEmpty) return;
    if (_token == trimmed && _channel != null) return;

    await disconnect(manual: true);
    _token = trimmed;
    _manualClose = false;
    await _openChannel();
  }

  Future<void> disconnect({bool manual = true}) async {
    _manualClose = manual;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _pingTimer?.cancel();
    _pingTimer = null;
    await _subscription?.cancel();
    _subscription = null;
    await _channel?.sink.close();
    _channel = null;
    if (manual) {
      _token = null;
    }
    _connectionController.add(false);
  }

  Future<void> _openChannel() async {
    final token = _token;
    if (token == null || token.isEmpty || _manualClose) return;

    try {
      final channel = WebSocketChannel.connect(Uri.parse(eventsWebSocketUrl(token)));
      _channel = channel;

      _subscription = channel.stream.listen(
        _onMessage,
        onError: (_) {
          _connectionController.add(false);
          _scheduleReconnect();
        },
        onDone: () {
          _connectionController.add(false);
          _scheduleReconnect();
        },
        cancelOnError: true,
      );

      _connectionController.add(true);

      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) {
        _sendJson({'type': 'PING'});
      });
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _onMessage(dynamic raw) {
    if (raw is! String) return;
    try {
      final json = jsonDecode(raw);
      if (json is! Map) return;
      final map = Map<String, dynamic>.from(json);
      final type = map['type']?.toString() ?? '';
      if (type == 'PONG' || type == 'CONNECTED') return;
      _eventsController.add(RealtimeEvent.fromJson(map));
    } catch (_) {}
  }

  void _sendJson(Map<String, dynamic> payload) {
    final channel = _channel;
    if (channel == null) return;
    try {
      channel.sink.add(jsonEncode(payload));
    } catch (_) {}
  }

  void _scheduleReconnect() {
    if (_manualClose || _token == null) return;
    _channel = null;
    _connectionController.add(false);
    _pingTimer?.cancel();
    _pingTimer = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), _openChannel);
  }

  void dispose() {
    disconnect(manual: true);
    _eventsController.close();
    _connectionController.close();
  }
}
