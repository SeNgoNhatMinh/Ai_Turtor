import 'dart:io' show Platform;

/// Android emulator: 10.0.2.2 = localhost của máy host.
/// iOS simulator / desktop: localhost.
/// Máy thật: override `--dart-define=API_BASE_URL=http://<LAN-IP>:8085`.
String nativeLoopbackHost() {
  if (Platform.isAndroid) return '10.0.2.2';
  return 'localhost';
}
