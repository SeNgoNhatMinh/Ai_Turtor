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

  testWidgets('hides keyword tip and disclaimer under the composer', (
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

    expect(find.text(AiChatInputBar.keywordTip), findsNothing);
    expect(find.text(AiChatInputBar.disclaimer), findsNothing);
    controller.dispose();
  });

  testWidgets('keeps a locked composer empty', (tester) async {
    final controller = TextEditingController();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatInputBar(
            controller: controller,
            hint: '',
            enabled: false,
            isPending: false,
            onSend: () {},
            onStop: () {},
            stopLabel: 'Dừng',
          ),
        ),
      ),
    );

    final input = tester.widget<TextField>(find.byType(TextField));
    expect(input.enabled, isFalse);
    expect(input.decoration?.hintText, isEmpty);
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

  testWidgets('collapses lesson chips into a dropdown picker', (tester) async {
    final selected = <String>[];
    const topics = [
      'Bắt đầu bài 1: Giới thiệu Java Platform, Enterprise Edition',
      'Bắt đầu bài 2: Sử dụng Web Containers',
    ];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatComposerTopics(topics: topics, onSelect: selected.add),
        ),
      ),
    );

    expect(find.text(AiChatComposerTopics.pickerLabel), findsOneWidget);
    expect(find.text('2 bài'), findsOneWidget);
    expect(find.byType(ActionChip), findsNothing);
    expect(find.text(topics.first), findsNothing);

    await tester.tap(find.text(AiChatComposerTopics.pickerLabel));
    await tester.pumpAndSettle();

    expect(find.text(AiChatComposerTopics.sheetTitle), findsOneWidget);
    expect(find.text(topics.first), findsOneWidget);
    expect(find.text(topics.last), findsOneWidget);

    await tester.tap(find.text(topics.last));
    await tester.pumpAndSettle();
    expect(selected, [topics.last]);
  });

  testWidgets('does not open the lesson picker when disabled', (tester) async {
    var selected = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatComposerTopics(
            enabled: false,
            topics: const ['Bắt đầu bài 1: Servlet'],
            onSelect: (_) => selected += 1,
          ),
        ),
      ),
    );

    await tester.tap(find.text(AiChatComposerTopics.pickerLabel));
    await tester.pumpAndSettle();

    expect(find.text(AiChatComposerTopics.sheetTitle), findsNothing);
    expect(selected, 0);
  });

  testWidgets('hides JSON payloads from the lesson picker', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatComposerTopics(
            topics: const [
              'Bắt đầu bài 1: Servlet',
              '{"suggestions":[{"title":"OOP","reason":"Thiếu"}]}',
            ],
            onSelect: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('1 bài'), findsOneWidget);
    await tester.tap(find.text(AiChatComposerTopics.pickerLabel));
    await tester.pumpAndSettle();
    expect(find.text('Bắt đầu bài 1: Servlet'), findsOneWidget);
    expect(find.textContaining('"suggestions"'), findsNothing);
  });
}
