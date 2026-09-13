import 'package:flutter_secure_storage/flutter_secure_storage.dart';

String reviewedMessageIdsStorageKey(String conversationId) {
  return 'reviewed_message_ids_$conversationId';
}

Set<String> parseReviewedMessageIds(String? raw) {
  if (raw == null || raw.trim().isEmpty) return {};
  return raw
      .split(',')
      .map((id) => id.trim())
      .where((id) => id.isNotEmpty)
      .toSet();
}

String encodeReviewedMessageIds(Set<String> ids) {
  return ids.where((id) => id.isNotEmpty).join(',');
}

Future<Set<String>> loadReviewedMessageIds(
  FlutterSecureStorage storage, {
  required String conversationId,
}) async {
  final raw = await storage.read(
    key: reviewedMessageIdsStorageKey(conversationId),
  );
  return parseReviewedMessageIds(raw);
}

Future<void> persistReviewedMessageIds(
  FlutterSecureStorage storage, {
  required String conversationId,
  required Set<String> ids,
}) async {
  await storage.write(
    key: reviewedMessageIdsStorageKey(conversationId),
    value: encodeReviewedMessageIds(ids),
  );
}
