import 'package:ai_tutor/features/ai_tutor/data/markdown_reveal.dart';
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
}
