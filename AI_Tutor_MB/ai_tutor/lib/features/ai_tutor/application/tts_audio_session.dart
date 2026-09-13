import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

/// Abstraction so chat TTS can be tested without a native audio plugin.
abstract class TtsAudioSession {
  Stream<Duration> get position;
  Stream<Duration> get duration;
  Stream<bool> get playing;
  Stream<void> get completed;
  Stream<void> get failed;
  bool get hasSource;
  bool get isPlaying;

  Future<void> setSource(Uint8List bytes);
  Future<void> play();
  Future<void> pause();
  Future<void> stop();
  Future<void> seek(Duration position);
  Future<void> dispose();
}

typedef TtsAudioSessionFactory = TtsAudioSession Function();

class AudioPlayersTtsAudioSession implements TtsAudioSession {
  AudioPlayersTtsAudioSession() : _player = AudioPlayer();

  final AudioPlayer _player;
  final _failed = StreamController<void>.broadcast();
  File? _sourceFile;
  var _hasSource = false;
  var _playing = false;

  @override
  Stream<Duration> get position => _player.onPositionChanged;

  @override
  Stream<Duration> get duration => _player.onDurationChanged;

  @override
  Stream<bool> get playing =>
      _player.onPlayerStateChanged.map((state) => state == PlayerState.playing);

  @override
  Stream<void> get completed => _player.onPlayerComplete;

  @override
  Stream<void> get failed => _failed.stream;

  @override
  bool get hasSource => _hasSource;

  @override
  bool get isPlaying => _playing;

  @override
  Future<void> setSource(Uint8List bytes) async {
    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}${Platform.pathSeparator}ai-tutor-tts-${identityHashCode(this)}.wav',
    );
    await file.writeAsBytes(bytes, flush: true);
    await _player.setSourceDeviceFile(file.path);
    _sourceFile = file;
    _hasSource = true;
  }

  @override
  Future<void> play() async {
    try {
      await _player.resume();
      _playing = true;
    } catch (_) {
      _playing = false;
      if (!_failed.isClosed) _failed.add(null);
    }
  }

  @override
  Future<void> pause() async {
    await _player.pause();
    _playing = false;
  }

  @override
  Future<void> stop() async {
    await _player.stop();
    _playing = false;
  }

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> dispose() async {
    await _player.dispose();
    await _failed.close();
    final file = _sourceFile;
    _sourceFile = null;
    _hasSource = false;
    if (file != null && await file.exists()) {
      await file.delete();
    }
  }
}

final ttsAudioSessionFactoryProvider = Provider<TtsAudioSessionFactory>((ref) {
  return AudioPlayersTtsAudioSession.new;
});
