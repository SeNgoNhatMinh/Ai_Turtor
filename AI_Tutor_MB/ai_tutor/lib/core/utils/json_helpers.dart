import 'package:dio/dio.dart';

DateTime? parseDateTime(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  if (value is int) {
    return DateTime.fromMillisecondsSinceEpoch(value);
  }
  return null;
}

String readId(Map<String, dynamic> json, {List<String> keys = const ['id']}) {
  for (final key in keys) {
    final value = json[key];
    if (value != null) return value.toString();
  }
  throw FormatException('Missing id field in $json');
}

String readString(
  Map<String, dynamic> json,
  String key, {
  String fallback = '',
}) {
  final value = json[key];
  if (value == null) return fallback;
  return value.toString();
}

List<T> parseList<T>(dynamic data, T Function(Map<String, dynamic>) fromJson) {
  if (data is! List) return [];
  return data
      .whereType<Map>()
      .map((e) => fromJson(Map<String, dynamic>.from(e)))
      .toList();
}

/// Giống [parseList] nhưng bỏ qua phần tử parse lỗi thay vì fail cả list.
List<T> parseListSafe<T>(
  dynamic data,
  T Function(Map<String, dynamic>) fromJson,
) {
  if (data is! List) return [];
  final items = <T>[];
  for (final entry in data) {
    if (entry is! Map) continue;
    try {
      items.add(fromJson(Map<String, dynamic>.from(entry)));
    } catch (_) {}
  }
  return items;
}

/// Trích danh sách từ response của backend.
///
/// Backend Spring nhiều endpoint không trả List thuần mà bọc trong envelope
/// dạng `{ count, <key>: [...] }` (vd `{teacherId, count, escalations: [...]}`).
/// Hàm này trả về List dù response là List ở top-level hay nằm trong một trong
/// các key truyền vào / các key envelope phổ biến. Luôn trả List (rỗng nếu không
/// tìm thấy) để dùng trực tiếp với [parseList].
List<dynamic> unwrapList(dynamic data, [List<String> keys = const []]) {
  if (data is List) return data;
  if (data is Map) {
    for (final key in [...keys, 'content', 'items', 'data', 'results']) {
      final value = data[key];
      if (value is List) return value;
    }
  }
  return const <dynamic>[];
}

/// Trích object từ envelope Spring/n8n `{ data: {...} }` hoặc `{ offer: {...} }`.
Map<String, dynamic> unwrapMap(
  dynamic data, {
  List<String> keys = const [],
}) {
  if (data is! Map) return {};
  final map = Map<String, dynamic>.from(data);
  for (final key in [...keys, 'data', 'result', 'offer', 'response']) {
    final value = map[key];
    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }
  }
  return map;
}

List<String> parseStringList(dynamic data) {
  if (data is! List) return [];
  return data.map((e) => e.toString()).toList();
}

String? mapDioMessage(DioException error) {
  final data = error.response?.data;
  if (data is Map) {
    final message = data['message'] ?? data['error'];
    if (message != null) return message.toString();
  }
  return null;
}

/// Prefer grouped answer-review cards from BE mới (`groups[]`), fallback `reviews[]`.
List<dynamic> unwrapAnswerReviewItems(dynamic data) {
  final groups = unwrapList(data, const ['groups']);
  if (groups.isNotEmpty) return groups;
  return unwrapList(data, const ['reviews']);
}
