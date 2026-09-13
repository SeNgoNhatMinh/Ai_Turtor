import 'dart:async';
import 'dart:typed_data';

import 'package:ai_tutor/core/network/exceptions.dart';
import 'package:ai_tutor/features/ai_tutor/application/tts_audio_session.dart';
import 'package:ai_tutor/features/ai_tutor/application/tts_controller.dart';
import 'package:ai_tutor/features/ai_tutor/data/tts_models.dart';
import 'package:ai_tutor/features/ai_tutor/data/tts_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeTtsRepository implements TtsRepository {
  Future<Uint8List> Function()? onSynthesize;
  var synthesizeCalls = 0;

  @override
  Future<List<TtsVoice>> listVoices({
    required String courseId,
    required String classId,
    CancelToken? cancelToken,
  }) async {
    return const [TtsVoice(id: 'voice-a', name: 'A')];
  }

  @override
  Future<Uint8List> synthesize({
    required String messageId,
    required String courseId,
    required String classId,
    required String text,
    String? providerVoiceId,
    CancelToken? cancelToken,
  }) async {
    synthesizeCalls += 1;
    if (onSynthesize != null) return onSynthesize!();
    return Uint8List.fromList([1, 2, 3]);
  }
}

class _FakeTtsAudioSession implements TtsAudioSession {
  final positionController = StreamController<Duration>.broadcast();
  final durationController = StreamController<Duration>.broadcast();
  final playingController = StreamController<bool>.broadcast();
  final completedController = StreamController<void>.broadcast();
  final failedController = StreamController<void>.broadcast();

  var sourceSet = false;
  var isActive = false;
  var disposed = false;
  Duration positionValue = Duration.zero;

  @override
  Stream<Duration> get position => positionController.stream;

  @override
  Stream<Duration> get duration => durationController.stream;

  @override
  Stream<bool> get playing => playingController.stream;

  @override
  Stream<void> get completed => completedController.stream;

  @override
  Stream<void> get failed => failedController.stream;

  @override
  bool get hasSource => sourceSet;

  @override
  bool get isPlaying => isActive;

  @override
  Future<void> setSource(Uint8List bytes) async {
    sourceSet = true;
  }

  @override
  Future<void> play() async {
    isActive = true;
    playingController.add(true);
  }

  @override
  Future<void> pause() async {
    isActive = false;
    playingController.add(false);
  }

  @override
  Future<void> stop() async {
    isActive = false;
    positionValue = Duration.zero;
  }

  @override
  Future<void> seek(Duration position) async {
    positionValue = position;
  }

  @override
  Future<void> dispose() async {
    disposed = true;
    await positionController.close();
    await durationController.close();
    await playingController.close();
    await completedController.close();
    await failedController.close();
  }
}

void main() {
  late _FakeTtsRepository repo;
  late List<_FakeTtsAudioSession> sessions;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeTtsRepository();
    sessions = <_FakeTtsAudioSession>[];
    container = ProviderContainer(
      overrides: [
        ttsRepositoryProvider.overrideWithValue(repo),
        ttsAudioSessionFactoryProvider.overrideWithValue(() {
          final session = _FakeTtsAudioSession();
          sessions.add(session);
          return session;
        }),
      ],
    );
    addTearDown(container.dispose);
  });

  Future<void> toggle(String messageKey) {
    return container
        .read(chatMessageAudioProvider('conv-1').notifier)
        .toggle(
          messageKey: messageKey,
          messageId: messageKey,
          courseId: 'PRO192',
          classId: 'SE1833',
          text: 'Xin chào',
          providerVoiceId: 'voice-a',
        );
  }

  test(
    'toggle synthesizes once then pauses and resumes the same audio',
    () async {
      await toggle('message-1');
      expect(repo.synthesizeCalls, 1);
      expect(
        container.read(chatMessageAudioProvider('conv-1')).status,
        TtsSpeechStatus.playing,
      );

      await toggle('message-1');
      expect(repo.synthesizeCalls, 1);
      expect(
        container.read(chatMessageAudioProvider('conv-1')).status,
        TtsSpeechStatus.paused,
      );

      await toggle('message-1');
      expect(repo.synthesizeCalls, 1);
      expect(
        container.read(chatMessageAudioProvider('conv-1')).status,
        TtsSpeechStatus.playing,
      );
    },
  );

  test('switching messages disposes the previous audio session', () async {
    await toggle('message-1');
    expect(sessions, hasLength(1));

    await toggle('message-2');
    expect(sessions.first.disposed, isTrue);
    expect(repo.synthesizeCalls, 2);
    expect(
      container.read(chatMessageAudioProvider('conv-1')).messageKey,
      'message-2',
    );
  });

  test('keeps the answer visible when synthesis fails', () async {
    repo.onSynthesize = () async {
      throw ApiBusinessException(
        message: 'Không thể tạo giọng đọc.',
        code: 'TTS_UNAVAILABLE',
      );
    };

    await toggle('message-1');
    final state = container.read(chatMessageAudioProvider('conv-1'));
    expect(state.status, TtsSpeechStatus.failed);
    expect(state.error, 'Không thể tạo giọng đọc.');
    expect(state.hasAudio, isFalse);
  });
}
