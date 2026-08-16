import '../../core/utils/json_helpers.dart';

class CourseMaterial {
  const CourseMaterial({
    required this.id,
    required this.title,
    this.fileName,
    this.category,
    this.classId,
    this.pdfFileId,
    this.pdfFileSize,
    this.sourceFileSize,
    this.pageCount,
    this.tocItemCount,
    this.indexStatus,
    this.uploadedAt,
  });

  final String id;
  final String title;
  final String? fileName;
  final String? category;
  final String? classId;
  final String? pdfFileId;
  final int? pdfFileSize;
  final int? sourceFileSize;
  final int? pageCount;
  final int? tocItemCount;
  final String? indexStatus;
  final DateTime? uploadedAt;

  /// Tài liệu có file PDF đã lưu để xem/tải.
  bool get hasPdf => pdfFileId != null && pdfFileId!.isNotEmpty;

  bool get isIndexed {
    final status = indexStatus?.toUpperCase();
    if (status == 'INDEXED' || status == 'COMPLETED' || status == 'READY') {
      return true;
    }
    if (status == 'INDEXING' || status == 'PENDING' || status == 'PROCESSING') {
      return false;
    }
    return hasPdf;
  }

  String get fileTypeLabel {
    final name = (fileName ?? title).toLowerCase();
    if (name.endsWith('.ppt') || name.endsWith('.pptx')) return 'PPT';
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'DOC';
    return 'PDF';
  }

  int? get displayFileSize => sourceFileSize ?? pdfFileSize;

  factory CourseMaterial.fromJson(Map<String, dynamic> json) {
    final pdfFileId = json['pdfFileId']?.toString();
    final indexStatus = (json['indexingStatus'] ??
            json['indexStatus'] ??
            json['ragStatus'] ??
            json['status'])
        ?.toString();
    return CourseMaterial(
      id: readId(json, keys: ['id', 'materialId', 'documentId']),
      title: readString(json, 'title', fallback: readString(json, 'name')),
      fileName: (json['sourceFileName'] ?? json['fileName'])?.toString(),
      category: json['category']?.toString(),
      classId: json['classId']?.toString(),
      pdfFileId: pdfFileId,
      pdfFileSize: (json['pdfFileSize'] as num?)?.toInt(),
      sourceFileSize: (json['sourceFileSize'] as num?)?.toInt(),
      pageCount: ((json['pageCount'] ?? json['pages'] ?? json['slideCount']) as num?)
          ?.toInt(),
      tocItemCount: (json['tocItemCount'] as num?)?.toInt(),
      indexStatus: indexStatus,
      uploadedAt: parseDateTime(json['uploadedAt'] ?? json['createdAt']),
    );
  }
}

/// Một mục trong mục lục (table of contents) của trang tài liệu HTML.
class HtmlTocItem {
  const HtmlTocItem({
    required this.title,
    required this.url,
    this.level = 0,
  });

  final String title;
  final String url;
  final int level;

  factory HtmlTocItem.fromJson(Map<String, dynamic> json) {
    return HtmlTocItem(
      title: readString(json, 'title', fallback: readString(json, 'url')),
      url: readString(json, 'url'),
      level: (json['level'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Kết quả xem trước mục lục trước khi import HTML làm tài liệu môn học.
class HtmlTocPreview {
  const HtmlTocPreview({
    required this.title,
    required this.sourceUrl,
    this.items = const [],
  });

  final String title;
  final String sourceUrl;
  final List<HtmlTocItem> items;

  factory HtmlTocPreview.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    return HtmlTocPreview(
      title: readString(json, 'title', fallback: readString(json, 'sourceUrl')),
      sourceUrl: readString(json, 'sourceUrl'),
      items: rawItems is List
          ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(HtmlTocItem.fromJson)
              .toList()
          : const [],
    );
  }
}
