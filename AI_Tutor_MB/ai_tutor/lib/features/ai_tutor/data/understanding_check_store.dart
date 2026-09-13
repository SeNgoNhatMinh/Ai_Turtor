import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'understanding_check.dart';

final _validKey = RegExp(r'^[A-D]$');

String normalizeUnderstandingSelectedKey(String? value) {
  final key = (value ?? '').trim().toUpperCase();
  return _validKey.hasMatch(key) ? key : '';
}

Future<String> loadUnderstandingSelectedKey(
  FlutterSecureStorage storage,
  String messageId,
) async {
  final id = messageId.trim();
  if (id.isEmpty) return '';
  try {
    return normalizeUnderstandingSelectedKey(
      await storage.read(key: understandingCheckStorageKey(id)),
    );
  } catch (_) {
    return '';
  }
}

Future<void> persistUnderstandingSelectedKey(
  FlutterSecureStorage storage, {
  required String messageId,
  required String selectedKey,
}) async {
  final id = messageId.trim();
  final key = normalizeUnderstandingSelectedKey(selectedKey);
  if (id.isEmpty || key.isEmpty) return;
  try {
    await storage.write(key: understandingCheckStorageKey(id), value: key);
  } catch (_) {
    // Private storage can fail; in-memory lock still holds.
  }
}
