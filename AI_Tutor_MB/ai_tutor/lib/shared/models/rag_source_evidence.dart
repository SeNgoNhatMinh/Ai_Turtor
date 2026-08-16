import 'rag_visual_evidence.dart';

/// Minh chứng RAG có cấu trúc (BE: `RagSourceEvidence`).
class RagSourceEvidence {
  const RagSourceEvidence({
    this.courseId,
    this.courseName,
    this.materialId,
    this.materialTitle,
    this.chapter,
    this.pageStart,
    this.pageEnd,
    this.pageEstimated = false,
    this.excerpt,
    this.visualEvidence = const [],
  });

  final String? courseId;
  final String? courseName;
  final String? materialId;
  final String? materialTitle;
  final String? chapter;
  final int? pageStart;
  final int? pageEnd;
  final bool pageEstimated;
  final String? excerpt;
  final List<RagVisualEvidence> visualEvidence;

  String get displayTitle {
    final title = materialTitle?.trim();
    if (title != null && title.isNotEmpty) return title;
    return courseName?.trim().isNotEmpty == true ? courseName! : 'Tài liệu môn học';
  }

  String? get pageLabel {
    if (pageStart == null && pageEnd == null) return null;
    if (pageStart != null && pageEnd != null && pageStart != pageEnd) {
      return 'Trang $pageStart–$pageEnd';
    }
    final page = pageStart ?? pageEnd;
    if (page == null) return null;
    return pageEstimated ? 'Trang ~$page' : 'Trang $page';
  }

  String get subtitle {
    final parts = <String>[
      if (chapter != null && chapter!.trim().isNotEmpty) chapter!.trim(),
      if (pageLabel != null) pageLabel!,
    ];
    return parts.join(' · ');
  }

  RagVisualEvidence? get primaryVisual =>
      visualEvidence.isNotEmpty ? visualEvidence.first : null;

  factory RagSourceEvidence.fromJson(Map<String, dynamic> json) {
    final visuals = <RagVisualEvidence>[];
    final nested = json['visualEvidence'];
    if (nested is List) {
      for (final item in nested) {
        if (item is Map) {
          visuals.add(
            RagVisualEvidence.fromJson(Map<String, dynamic>.from(item)),
          );
        }
      }
    }

    final title = json['materialTitle']?.toString();
    return RagSourceEvidence(
      courseId: json['courseId']?.toString(),
      courseName: json['courseName']?.toString(),
      materialId: json['materialId']?.toString(),
      materialTitle: title,
      chapter: json['chapter']?.toString(),
      pageStart: (json['pageStart'] as num?)?.toInt(),
      pageEnd: (json['pageEnd'] as num?)?.toInt(),
      pageEstimated: json['pageEstimated'] == true,
      excerpt: json['excerpt']?.toString(),
      visualEvidence: visuals
          .map(
            (v) => RagVisualEvidence(
              imageUrl: v.imageUrl,
              documentUrl: v.documentUrl,
              caption: v.caption,
              pageNumber: v.pageNumber ?? (json['pageStart'] as num?)?.toInt(),
              materialTitle: title ?? v.materialTitle,
            ),
          )
          .toList(),
    );
  }

  static List<RagSourceEvidence> fromAiPayload(Map<String, dynamic> json) {
    final value = json['sourceEvidence'];
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((e) => RagSourceEvidence.fromJson(Map<String, dynamic>.from(e)))
        .where((e) => e.hasContent)
        .toList();
  }

  bool get hasContent =>
      (excerpt != null && excerpt!.trim().isNotEmpty) ||
      visualEvidence.isNotEmpty ||
      (materialTitle != null && materialTitle!.trim().isNotEmpty);
}
