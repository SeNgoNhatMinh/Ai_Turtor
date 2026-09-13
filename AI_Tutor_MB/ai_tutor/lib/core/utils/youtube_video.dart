final _videoIdPattern = RegExp(r'^[A-Za-z0-9_-]{11}$');

/// Trích YouTube video id từ URL hoặc id thuần — khớp web `youtubeVideoId`.
String youtubeVideoId(String? rawUrl) {
  final value = (rawUrl ?? '').trim();
  if (value.isEmpty) return '';
  if (_videoIdPattern.hasMatch(value)) return value;
  try {
    final url = Uri.parse(value);
    final host = url.host.toLowerCase();
    if (host == 'youtu.be') {
      final id = url.pathSegments.isNotEmpty ? url.pathSegments.first : '';
      return _videoIdPattern.hasMatch(id) ? id : '';
    }
    if (!host.endsWith('youtube.com') && !host.endsWith('youtube-nocookie.com')) {
      return '';
    }
    final fromQuery = url.queryParameters['v'];
    if (fromQuery != null && _videoIdPattern.hasMatch(fromQuery)) {
      return fromQuery;
    }
    final match = RegExp(
      r'(?:embed|shorts|live|v)/([A-Za-z0-9_-]{11})',
    ).firstMatch(url.path);
    return match?.group(1) ?? '';
  } catch (_) {
    return '';
  }
}
