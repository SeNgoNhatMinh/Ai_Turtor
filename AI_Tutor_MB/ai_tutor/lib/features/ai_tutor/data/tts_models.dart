import 'dart:convert';

import '../../../core/utils/json_helpers.dart';

class TtsVoice {
  const TtsVoice({
    required this.id,
    required this.name,
    this.providerVoiceId = '',
    this.language = '',
    this.description = '',
  });

  final String id;
  final String name;
  final String providerVoiceId;
  final String language;
  final String description;

  factory TtsVoice.fromJson(Map<String, dynamic> json) {
    final id = readString(json, 'id');
    return TtsVoice(
      id: id,
      name: readString(json, 'name'),
      providerVoiceId: readString(json, 'providerVoiceId', fallback: id),
      language: readString(json, 'language'),
      description: readString(json, 'description'),
    );
  }
}

class TtsScope {
  const TtsScope({
    required this.courseId,
    required this.classId,
    this.userId = 'current',
  });

  final String courseId;
  final String classId;
  final String userId;

  bool get isValid => courseId.trim().isNotEmpty && classId.trim().isNotEmpty;

  String get storageKey =>
      ttsVoiceStorageKey(userId: userId, courseId: courseId, classId: classId);

  @override
  bool operator ==(Object other) =>
      other is TtsScope &&
      other.courseId == courseId &&
      other.classId == classId &&
      other.userId == userId;

  @override
  int get hashCode => Object.hash(courseId, classId, userId);
}

enum TtsSpeechStatus { idle, loading, playing, paused, failed }

class TtsSpeechState {
  const TtsSpeechState({
    this.messageKey = '',
    this.status = TtsSpeechStatus.idle,
    this.currentTime = Duration.zero,
    this.duration = Duration.zero,
    this.error = '',
    this.hasAudio = false,
  });

  static const idle = TtsSpeechState();

  final String messageKey;
  final TtsSpeechStatus status;
  final Duration currentTime;
  final Duration duration;
  final String error;
  final bool hasAudio;

  TtsSpeechState copyWith({
    String? messageKey,
    TtsSpeechStatus? status,
    Duration? currentTime,
    Duration? duration,
    String? error,
    bool? hasAudio,
  }) {
    return TtsSpeechState(
      messageKey: messageKey ?? this.messageKey,
      status: status ?? this.status,
      currentTime: currentTime ?? this.currentTime,
      duration: duration ?? this.duration,
      error: error ?? this.error,
      hasAudio: hasAudio ?? this.hasAudio,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is TtsSpeechState &&
      other.messageKey == messageKey &&
      other.status == status &&
      other.currentTime == currentTime &&
      other.duration == duration &&
      other.error == error &&
      other.hasAudio == hasAudio;

  @override
  int get hashCode =>
      Object.hash(messageKey, status, currentTime, duration, error, hasAudio);
}

final _evidenceAppendixPattern = RegExp(
  r'\n{1,3}#{1,3}\s*Bằng chứng trích từ tài liệu[\s\S]*$',
  caseSensitive: false,
);

TtsScope ttsScopeForChat({
  required String? userId,
  required String? courseId,
  required String? classId,
  String? courseCode,
  String? className,
}) {
  final resolvedCourse = (courseCode != null && courseCode.trim().isNotEmpty)
      ? courseCode.trim()
      : (courseId?.trim() ?? '');
  final resolvedClass = (classId != null && classId.trim().isNotEmpty)
      ? classId.trim()
      : (className?.trim() ?? '');
  return TtsScope(
    userId: (userId == null || userId.trim().isEmpty) ? 'current' : userId,
    courseId: resolvedCourse,
    classId: resolvedClass,
  );
}

String ttsVoiceStorageKey({
  required String userId,
  required String courseId,
  required String classId,
}) {
  final safeUser = userId.trim().isEmpty ? 'current' : userId.trim();
  final safeCourse = courseId.trim().isEmpty ? 'none' : courseId.trim();
  final safeClass = classId.trim().isEmpty ? 'none' : classId.trim();
  return 'ai-tutor:student-tts-voice:$safeUser:$safeCourse:$safeClass';
}

String resolveTtsVoiceId({
  required List<TtsVoice> voices,
  required String selectedId,
  required String storedId,
}) {
  if (voices.any((voice) => voice.id == selectedId)) return selectedId;
  if (voices.any((voice) => voice.id == storedId)) return storedId;
  return voices.isEmpty ? '' : voices.first.id;
}

List<TtsVoice> parseTtsVoices(dynamic data) {
  return parseListSafe(
    unwrapList(data, const ['voices']),
    TtsVoice.fromJson,
  ).where((voice) => voice.id.isNotEmpty && voice.name.isNotEmpty).toList();
}

String ttsSpeakableText(String answer, {bool hasEvidenceMetadata = false}) {
  final value = answer.trim();
  if (!hasEvidenceMetadata) return value;
  return value.replaceFirst(_evidenceAppendixPattern, '').trim();
}

String formatTtsClock(Duration value) {
  final safe = value.isNegative ? Duration.zero : value;
  final minutes = safe.inMinutes;
  final seconds = safe.inSeconds.remainder(60);
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}

const ttsUnavailableFallback =
    'Không thể tạo giọng đọc lúc này. Vui lòng thử lại sau.';

const ttsPlaybackFailedMessage = 'Không thể phát file giọng đọc.';

dynamic decodeTtsErrorData(dynamic data) {
  if (data is Map) return Map<String, dynamic>.from(data);
  if (data is List<int>) {
    return decodeTtsErrorData(utf8.decode(data, allowMalformed: true));
  }
  if (data is String) {
    final trimmed = data.trim();
    if (trimmed.isEmpty) return data;
    try {
      return jsonDecode(trimmed);
    } catch (_) {
      return data;
    }
  }
  return data;
}
