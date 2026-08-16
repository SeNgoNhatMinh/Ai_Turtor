import 'package:dio/dio.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

/// Tải file từ API Spring (JWT) rồi mở bằng app hệ thống — thay cho `launchUrl` trực tiếp.
Future<void> openAuthenticatedApiDownload(
  Dio dio, {
  required String apiPath,
  String? fileName,
}) async {
  final dir = await getTemporaryDirectory();
  final safeName = fileName ?? apiPath.split('/').last;
  final localPath =
      '${dir.path}/ai_tutor_${DateTime.now().millisecondsSinceEpoch}_$safeName';
  await dio.download(
    apiPath,
    localPath,
    options: Options(
      receiveTimeout: const Duration(minutes: 3),
    ),
  );
  await OpenFilex.open(localPath);
}

/// `/api/...` hoặc URL đầy đủ trỏ về `Env.apiBaseUrl`.
String normalizeApiPath(String urlOrPath, String apiBaseUrl) {
  final trimmed = urlOrPath.trim();
  if (trimmed.startsWith('/api/')) return trimmed;
  final base = apiBaseUrl.replaceAll(RegExp(r'/$'), '');
  if (trimmed.startsWith('$base/api/')) {
    return trimmed.substring(base.length);
  }
  return trimmed;
}
