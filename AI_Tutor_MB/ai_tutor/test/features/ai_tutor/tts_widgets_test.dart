import 'package:ai_tutor/features/ai_tutor/data/tts_models.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/tts_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

TtsSpeechState speech(TtsSpeechStatus status, {String error = ''}) {
  return TtsSpeechState(
    messageKey: 'answer-1',
    status: status,
    currentTime: const Duration(seconds: 3),
    duration: const Duration(seconds: 12),
    error: error,
    hasAudio:
        status == TtsSpeechStatus.playing || status == TtsSpeechStatus.paused,
  );
}

void main() {
  testWidgets('renders idle loading playing and paused labels', (tester) async {
    Future<void> pumpStatus(TtsSpeechStatus status) {
      return tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TtsMessageAction(
              messageKey: 'answer-1',
              speech: speech(status),
              onToggle: () {},
              onStop: () {},
              onSeek: (_) {},
            ),
          ),
        ),
      );
    }

    await pumpStatus(TtsSpeechStatus.idle);
    expect(find.text(TtsCopy.read), findsOneWidget);

    await pumpStatus(TtsSpeechStatus.loading);
    expect(find.text(TtsCopy.loading), findsOneWidget);

    await pumpStatus(TtsSpeechStatus.playing);
    expect(find.text(TtsCopy.pause), findsOneWidget);

    await pumpStatus(TtsSpeechStatus.paused);
    expect(find.text(TtsCopy.resume), findsOneWidget);
  });

  testWidgets('offers stop and progress only after audio exists', (
    tester,
  ) async {
    var stopped = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TtsMessageAction(
            messageKey: 'answer-1',
            speech: speech(TtsSpeechStatus.playing),
            onToggle: () {},
            onStop: () => stopped += 1,
            onSeek: (_) {},
          ),
        ),
      ),
    );

    expect(find.text(TtsCopy.stop), findsOneWidget);
    expect(find.byType(Slider), findsOneWidget);
    await tester.tap(find.text(TtsCopy.stop));
    expect(stopped, 1);
  });

  testWidgets('shows the read button even when voices failed to load', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TtsMessageAction(
            messageKey: 'answer-1',
            speech: const TtsSpeechState(),
            voicesError: 'TTS is disabled or NVIDIA_API_KEY is not configured',
            onToggle: () {},
            onStop: () {},
            onSeek: (_) {},
          ),
        ),
      ),
    );

    expect(find.text(TtsCopy.read), findsOneWidget);
    expect(
      find.text('TTS is disabled or NVIDIA_API_KEY is not configured'),
      findsOneWidget,
    );
  });

  testWidgets('shows a generation failure without replacing the answer', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              const Text('Câu trả lời văn bản vẫn hiển thị.'),
              TtsMessageAction(
                messageKey: 'answer-1',
                speech: speech(
                  TtsSpeechStatus.failed,
                  error: 'Không thể tạo giọng đọc.',
                ),
                onToggle: () {},
                onStop: () {},
                onSeek: (_) {},
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Câu trả lời văn bản vẫn hiển thị.'), findsOneWidget);
    expect(find.text('Không thể tạo giọng đọc.'), findsOneWidget);
    expect(find.text(TtsCopy.stop), findsNothing);
  });

  testWidgets('voice selector reports the chosen NVIDIA voice', (tester) async {
    String? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TtsVoiceSelector(
            value: 'Magpie-Multilingual.VI-VN.Long.Neutral',
            voices: const [
              TtsVoice(
                id: 'Magpie-Multilingual.VI-VN.Long.Neutral',
                name: 'Long (trung tính)',
              ),
              TtsVoice(
                id: 'Magpie-Multilingual.VI-VN.Mai.Happy',
                name: 'Mai (vui)',
              ),
            ],
            onChange: (value) => selected = value,
          ),
        ),
      ),
    );

    expect(find.text('Long (trung tính)'), findsOneWidget);
    await tester.tap(find.text('Long (trung tính)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mai (vui)'));
    await tester.pumpAndSettle();
    expect(selected, 'Magpie-Multilingual.VI-VN.Mai.Happy');
  });
}
