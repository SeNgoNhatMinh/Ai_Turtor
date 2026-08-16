import '../../core/config/env.dart';
import 'rag_source_evidence.dart';

/// Trang PDF minh chứng RAG (BE: `RagVisualEvidence`, visual retrieval).
class RagVisualEvidence {
  const RagVisualEvidence({
    this.imageUrl,
    this.documentUrl,
    this.caption,
    this.pageNumber,
    this.materialTitle,
  });

  final String? imageUrl;
  final String? documentUrl;
  final String? caption;
  final int? pageNumber;
  final String? materialTitle;

  String? resolveImageUrl() {
    return _resolveApiUrl(imageUrl);
  }

  String? resolveDocumentUrl() {
    return _resolveApiUrl(documentUrl);
  }

  static String? _resolveApiUrl(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    final base = Env.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    return value.startsWith('/') ? '$base$value' : '$base/$value';
  }

  factory RagVisualEvidence.fromJson(Map<String, dynamic> json) {
    return RagVisualEvidence(
      imageUrl: json['imageUrl']?.toString(),
      documentUrl: json['documentUrl']?.toString(),
      caption: json['caption']?.toString(),
      pageNumber: (json['pageNumber'] as num?)?.toInt(),
      materialTitle: json['materialTitle']?.toString(),
    );
  }

  static List<RagVisualEvidence> fromAiPayload(Map<String, dynamic> json) {
    final direct = _fromList(json['visualEvidence']);
    if (direct.isNotEmpty) return direct;

    final fromSources = <RagVisualEvidence>[];
    final sourceEvidence = json['sourceEvidence'];
    if (sourceEvidence is List) {
      for (final item in sourceEvidence) {
        if (item is! Map) continue;
        final ev = RagSourceEvidence.fromJson(Map<String, dynamic>.from(item));
        fromSources.addAll(ev.visualEvidence);
      }
    }
    return fromSources;
  }

  /// Gom thumbnail từ `sourceEvidence` khi BE không trả `visualEvidence` top-level.
  static List<RagVisualEvidence> collectFromSourceEvidence(
    List<RagSourceEvidence> sourceEvidence,
  ) {
    return sourceEvidence.expand((e) => e.visualEvidence).toList();
  }

  static List<RagVisualEvidence> _fromList(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((e) => RagVisualEvidence.fromJson(Map<String, dynamic>.from(e)))
        .where((e) => e.imageUrl != null && e.imageUrl!.isNotEmpty)
        .toList();
  }
}
