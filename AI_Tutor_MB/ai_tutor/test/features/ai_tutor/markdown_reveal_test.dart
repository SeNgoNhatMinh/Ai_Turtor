import 'package:ai_tutor/features/ai_tutor/data/markdown_reveal.dart';
import 'package:ai_tutor/shared/widgets/ai_markdown_reveal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('does not reveal short or reduced-motion answers', () {
    expect(shouldRevealAnswer(enabled: true, markdown: 'Ngắn'), isFalse);
    expect(
      shouldRevealAnswer(
        enabled: true,
        markdown: 'A' * 40,
        reducedMotion: true,
      ),
      isFalse,
    );
    expect(shouldRevealAnswer(enabled: true, markdown: 'A' * 40), isTrue);
  });

  test('advances reveal index on word boundaries like web', () {
    const text = 'Servlet gọi phương thức init trước khi phục vụ request.';
    final step = revealStepSize(text.length);
    expect(step, greaterThanOrEqualTo(6));
    final next = nextRevealIndex(text, 0, step);
    expect(next, greaterThan(0));
    expect(next, lessThanOrEqualTo(text.length));
    expect(nextRevealIndex(text, text.length, step), text.length);
  });

  testWidgets('completed answer does not restart on an unrelated rebuild', (
    tester,
  ) async {
    const answer =
        'Servlet nhận request, chuyển request qua service, xử lý dữ liệu và trả response cho client. '
        'Nội dung này đủ dài để kiểm tra hiệu ứng hiện dần của câu trả lời AI.';
    var completed = 0;

    Widget buildAnswer() => MaterialApp(
      home: Scaffold(
        body: AiMarkdownReveal(
          key: const ValueKey('assistant-answer-1'),
          data: answer,
          enabled: true,
          onComplete: () => completed += 1,
        ),
      ),
    );

    await tester.pumpWidget(buildAnswer());
    await tester.pump(const Duration(seconds: 3));
    await tester.pump();
    expect(completed, 1);

    await tester.pumpWidget(buildAnswer());
    await tester.pump(const Duration(seconds: 3));
    await tester.pump();
    expect(completed, 1);
  });

  testWidgets(
    'short answer still reports completion so its target is cleared',
    (tester) async {
      var completed = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiMarkdownReveal(
              data: 'Câu trả lời ngắn.',
              enabled: true,
              onComplete: () => completed += 1,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(completed, 1);
    },
  );
}
