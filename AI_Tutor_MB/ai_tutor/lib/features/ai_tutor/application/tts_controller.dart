import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/network/network_providers.dart';
import '../data/tts_models.dart';
import '../data/tts_repository.dart';
import 'tts_audio_session.dart';

final ttsVoicesProvider = FutureProvider.autoDispose
    .family<List<TtsVoice>, TtsScope>((ref, scope) async {
      if (!scope.isValid) return const [];
      return ref
          .read(ttsRepositoryProvider)
          .listVoices(courseId: scope.courseId, classId: scope.classId);
    });

class TtsSelectedVoiceNotifier
    extends AutoDisposeFamilyNotifier<String, TtsScope> {
  @override
  String build(TtsScope scope) {
    var disposed = false;
    ref.onDispose(() => disposed = true);
    unawaited(_hydrate(scope, () => disposed));
    return '';
  }

  Future<void> _hydrate(TtsScope scope, bool Function() isDisposed) async {
    List<TtsVoice> voices = const [];
    try {
      voices = await ref.read(ttsVoicesProvider(scope).future);
    } catch (_) {
      return;
    }
    if (isDisposed()) return;
    String stored = '';
    try {
      stored =
          await ref.read(secureStorageProvider).read(key: scope.storageKey) ??
          '';
    } catch (_) {
      stored = '';
    }
    if (isDisposed()) return;
    final next = resolveTtsVoiceId(
      voices: voices,
      selectedId: state,
      storedId: stored,
    );
    if (next.isNotEmpty && next != state) {
      state = next;
    }
  }

  Future<void> select(String voiceId) async {
    final voices = ref.read(ttsVoicesProvider(arg)).valueOrNull ?? const [];
    if (!voices.any((voice) => voice.id == voiceId)) return;
    state = voiceId;
    try {
      await ref
          .read(secureStorageProvider)
          .write(key: arg.storageKey, value: voiceId);
    } catch (_) {
      // The selection remains active for the current session.
    }
  }
}

final ttsSelectedVoiceProvider =
    AutoDisposeNotifierProvider.family<
      TtsSelectedVoiceNotifier,
      String,
      TtsScope
    >(TtsSelectedVoiceNotifier.new);

class ChatMessageAudioNotifier
    extends AutoDisposeFamilyNotifier<TtsSpeechState, String> {
  CancelToken? _cancel;
  TtsAudioSession? _session;
  final _subscriptions = <StreamSubscription<dynamic>>[];
  var _generation = 0;

  @override
  TtsSpeechState build(String conversationId) {
    ref.onDispose(() {
      _cancel?.cancel();
      unawaited(_disposeSession());
    });
    return TtsSpeechState.idle;
  }

  Future<void> toggle({
    required String messageKey,
    required String messageId,
    required String courseId,
    required String classId,
    required String text,
    String? providerVoiceId,
  }) async {
    final current = _session;
    if (current != null &&
        state.messageKey == messageKey &&
        current.hasSource) {
      if (current.isPlaying || state.status == TtsSpeechStatus.playing) {
        await current.pause();
        if (state.messageKey == messageKey) {
          state = state.copyWith(status: TtsSpeechStatus.paused);
        }
      } else {
        await current.play();
      }
      return;
    }
    if (state.messageKey == messageKey &&
        state.status == TtsSpeechStatus.loading &&
        current == null) {
      return;
    }

    _cancel?.cancel();
    await _disposeSession();
    final cancel = CancelToken();
    _cancel = cancel;
    final generation = ++_generation;
    state = TtsSpeechState(
      messageKey: messageKey,
      status: TtsSpeechStatus.loading,
    );

    try {
      final bytes = await ref
          .read(ttsRepositoryProvider)
          .synthesize(
            messageId: messageId,
            courseId: courseId,
            classId: classId,
            text: text,
            providerVoiceId: providerVoiceId,
            cancelToken: cancel,
          );
      if (cancel.isCancelled || generation != _generation) return;

      final session = ref.read(ttsAudioSessionFactoryProvider)();
      _session = session;
      _bindSession(session, messageKey, generation);
      await session.setSource(bytes);
      if (cancel.isCancelled || generation != _generation) return;
      state = TtsSpeechState(
        messageKey: messageKey,
        status: TtsSpeechStatus.paused,
        hasAudio: true,
      );
      await session.play();
    } catch (error) {
      if (cancel.isCancelled || generation != _generation) return;
      state = TtsSpeechState(
        messageKey: messageKey,
        status: TtsSpeechStatus.failed,
        error: _messageFor(error),
      );
    }
  }

  Future<void> stop(String messageKey) async {
    if (state.messageKey != messageKey) return;
    final session = _session;
    if (session != null) {
      await session.pause();
      await session.seek(Duration.zero);
    }
    state = state.copyWith(
      status: TtsSpeechStatus.idle,
      currentTime: Duration.zero,
    );
  }

  Future<void> seek(String messageKey, Duration position) async {
    final session = _session;
    if (session == null || state.messageKey != messageKey) return;
    final safe = position.isNegative ? Duration.zero : position;
    await session.seek(safe);
    state = state.copyWith(currentTime: safe);
  }

  void _bindSession(
    TtsAudioSession session,
    String messageKey,
    int generation,
  ) {
    _subscriptions.addAll([
      session.position.listen((value) {
        if (generation != _generation || state.messageKey != messageKey) {
          return;
        }
        state = state.copyWith(currentTime: value);
      }),
      session.duration.listen((value) {
        if (generation != _generation || state.messageKey != messageKey) {
          return;
        }
        state = state.copyWith(duration: value);
      }),
      session.playing.listen((playing) {
        if (generation != _generation || state.messageKey != messageKey) {
          return;
        }
        if (playing) {
          state = state.copyWith(status: TtsSpeechStatus.playing, error: '');
        } else if (state.status == TtsSpeechStatus.playing) {
          state = state.copyWith(status: TtsSpeechStatus.paused);
        }
      }),
      session.completed.listen((_) {
        if (generation != _generation || state.messageKey != messageKey) {
          return;
        }
        unawaited(session.seek(Duration.zero));
        state = state.copyWith(
          status: TtsSpeechStatus.idle,
          currentTime: Duration.zero,
        );
      }),
      session.failed.listen((_) {
        if (generation != _generation || state.messageKey != messageKey) {
          return;
        }
        state = state.copyWith(
          status: TtsSpeechStatus.failed,
          error: ttsPlaybackFailedMessage,
        );
      }),
    ]);
  }

  Future<void> _disposeSession() async {
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
    final session = _session;
    _session = null;
    await session?.dispose();
  }

  String _messageFor(Object error) {
    if (error is ApiBusinessException && error.message.trim().isNotEmpty) {
      return error.message;
    }
    if (error is DioException) {
      return ttsExceptionFromDio(error).message;
    }
    return ttsUnavailableFallback;
  }
}

final chatMessageAudioProvider =
    AutoDisposeNotifierProvider.family<
      ChatMessageAudioNotifier,
      TtsSpeechState,
      String
    >(ChatMessageAudioNotifier.new);
