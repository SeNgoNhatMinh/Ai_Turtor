import 'package:ai_tutor/features/ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('formats the enrolled class label like the web pill', () {
    expect(
      AiChatAppBar.formatClassLabel(className: 'SE1833', classId: 'SE1833'),
      'SE1833',
    );
    expect(AiChatAppBar.formatClassLabel(className: 'SE1832'), 'SE1832');
    expect(AiChatAppBar.formatClassLabel(), isEmpty);
  });

  testWidgets('prompt starters expose the three web study prompts', (
    tester,
  ) async {
    final selected = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AiChatPromptStarters(onSelect: selected.add)),
      ),
    );

    expect(find.text(AiChatPromptStarters.title), findsOneWidget);
    expect(find.text(AiChatPromptStarters.keywordTipTitle), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('Giải thích khái niệm'), findsOneWidget);
    expect(find.text('Kiểm tra mã nguồn'), findsOneWidget);
    expect(find.text('Tóm tắt bài học'), findsOneWidget);

    await tester.tap(find.text('Giải thích khái niệm'));
    expect(selected, [AiChatPromptStarters.prompts.first.prompt]);
  });

  testWidgets('hides send until the user types, then shows mic and send', (
    tester,
  ) async {
    final controller = TextEditingController();
    var micTapped = 0;
    var sent = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: AiChatInputBar(
              controller: controller,
              hint: 'Nhắn cho Cóc...',
              enabled: true,
              isPending: false,
              onSend: () => sent += 1,
              onStop: () {},
              stopLabel: 'Dừng',
              onMic: () => micTapped += 1,
            ),
          ),
        ),
      ),
    );

    expect(find.byTooltip('Gửi'), findsNothing);
    expect(find.byTooltip('Thêm tệp'), findsNothing);
    expect(find.byTooltip('Nhập bằng giọng nói'), findsOneWidget);

    await tester.tap(find.byTooltip('Nhập bằng giọng nói'));
    expect(micTapped, 1);

    controller.text = 'Xin chào';
    await tester.pump();

    expect(find.byTooltip('Gửi'), findsOneWidget);
    await tester.tap(find.byTooltip('Gửi'));
    expect(sent, 1);

    controller.dispose();
  });

  testWidgets('shows keyword tip and disclaimer under the composer', (
    tester,
  ) async {
    final controller = TextEditingController();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatInputBar(
            controller: controller,
            hint: 'Nhắn cho Cóc...',
            enabled: true,
            isPending: false,
            onSend: () {},
            onStop: () {},
            stopLabel: 'Dừng',
            showComposerTips: true,
          ),
        ),
      ),
    );

    expect(find.text(AiChatInputBar.keywordTip), findsOneWidget);
    expect(find.text(AiChatInputBar.disclaimer), findsOneWidget);
    controller.dispose();
  });

  testWidgets('shows the first loading step while AI is thinking', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: AiChatLoadingSteps())),
    );

    expect(find.text(AiChatLoadingSteps.steps.first), findsOneWidget);
    expect(find.text(AiChatLoadingSteps.preparing), findsOneWidget);
    await tester.pump(const Duration(seconds: 11));
    expect(find.text(AiChatLoadingSteps.takingLonger), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
