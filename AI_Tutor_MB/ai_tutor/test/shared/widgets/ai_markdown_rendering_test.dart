import 'package:ai_tutor/core/utils/ai_chat_content.dart';
import 'package:ai_tutor/core/utils/ai_markdown_normalizer.dart';
import 'package:ai_tutor/shared/widgets/ai_markdown_body.dart';
import 'package:ai_tutor/shared/widgets/markdown_code_block.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Shapes the backend prompt asks for (CourseAnswerPromptSections /
/// ExplanationStyles) plus common model drift.
const _samples = <String, String>{
  'concept with bold bullets': '''
## 1. Giải thích khái niệm

Đệ quy (recursion) là kỹ thuật trong lập trình mà một hàm gọi lại chính nó.

- **Base case** (trường hợp cơ sở): điều kiện dừng.
- **Recursive case** (trường hợp đệ quy): gọi lại hàm.
''',
  'python code fence': '''
## 2. Ví dụ nhỏ
```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```
''',
  'mermaid fence': '''
## 3. Minh họa trực quan
```mermaid
flowchart TD
  A[factorial(3)] --> B[factorial(2)]
```
''',
  'bare fence': '```\nx = 1\n```',
  'unclosed fence while streaming': '## Ví dụ\n```python\ndef f(n):\n    return',
  'comparison table': '''
## 4. So sánh
| Khía cạnh | Đệ quy | Vòng lặp |
| --- | --- | --- |
| Bộ nhớ | Stack | O(1) |
''',
  'one-line table': 'So sánh: | A | B | |---|---| | 1 | 2 |',
  'guided practice blanks': '''
## Bài tập có hướng dẫn
```java
public int sum(int n) {
    if (____) return 0;
    return n + sum(____);
}
```
''',
  'study sections': '''
## Học chuyên sâu
- **Đệ quy đuôi** (tail recursion)
- Stack overflow

## Bài tiếp theo
- Bài 5: Array-Based Sequences || 5 Array-Based Sequences
''',
  'nested list': '1. **Bước 1**: gọi `f(3)`\n   - con 1\n   - con 2\n2. Bước 2',
  'inline html': 'Dùng <br> để xuống dòng và a < b > c.',
  'empty bold': '** **\n\n- ****',
  'bold heading': '## **Giải thích**\n\nNội dung.',
  'empty links': '[](#x) và [a]()',
  'image': '![alt](https://example.com/a.png)',
  'rule': 'a\n\n---\n\nb',
  'checkbox': '- [ ] task\n- [x] done',
  'footnote': 'Text[^1]\n\n[^1]: note',
  'latex': r'Công thức \(n! = n \cdot (n-1)!\) và $$x^2$$',
  'unbalanced bold': 'Đây là **chữ đậm chưa đóng',
};

Future<void> _pump(WidgetTester tester, String markdown) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: AiMarkdownBody(data: prepareAiChatMarkdown(markdown)),
        ),
      ),
    ),
  );
}

bool _showsRawSyntax(WidgetTester tester) {
  final texts = [
    ...tester.widgetList<Text>(find.byType(Text)).map((w) => w.data ?? ''),
    ...tester
        .widgetList<RichText>(find.byType(RichText))
        .map((w) => w.text.toPlainText()),
  ];
  return texts.any(
    (text) =>
        RegExp(r'(^|\n)#{1,6} ').hasMatch(text) ||
        RegExp(r'\*\*\S').hasMatch(text),
  );
}

void main() {
  for (final entry in _samples.entries) {
    testWidgets('renders formatted: ${entry.key}', (tester) async {
      await _pump(tester, entry.value);
      expect(tester.takeException(), isNull, reason: entry.key);
      // The raw-markdown fallback is a SelectableText; it must not appear.
      expect(find.byType(SelectableText), findsNothing, reason: entry.key);
      expect(_showsRawSyntax(tester), isFalse, reason: entry.key);
    });
  }

  testWidgets('code fences render as a code block, not raw text', (
    tester,
  ) async {
    await _pump(tester, _samples['python code fence']!);
    expect(find.byType(MarkdownCodeBlock), findsOneWidget);
    expect(find.textContaining('## '), findsNothing);
  });

  testWidgets('heading and bold of the reported answer are styled', (
    tester,
  ) async {
    await _pump(tester, _samples['concept with bold bullets']!);
    expect(find.textContaining('Giải thích khái niệm'), findsOneWidget);
    expect(find.textContaining('## 1.'), findsNothing);
    expect(find.textContaining('**Base case**'), findsNothing);
  });

  group('normalizeAiMarkdown (web parity)', () {
    test('repairs list markers without touching bold, rules or numbers', () {
      final out = normalizeAiMarkdown(
        '-item một\n1.Bước đầu\n**Đậm** đầu dòng\n---\n-1 là số âm\n1.5 là số',
      );
      expect(out, contains('- item một'));
      expect(out, contains('1. Bước đầu'));
      expect(out, contains('**Đậm** đầu dòng'));
      expect(out, contains('---'));
      expect(out, contains('-1 là số âm'));
      expect(out, contains('1.5 là số'));
    });

    test('splits a one-line table into GFM rows', () {
      final out = normalizeAiMarkdown('So sánh: | A | B | |---|---| | 1 | 2 |');
      expect(out, contains('| A | B |\n| --- | --- |\n| 1 | 2 |'));
    });

    test('never turns lesson bullets with || into a table', () {
      const input = '- Bài 1: X || 1 X\n- Bài 2: Y || 2 Y';
      expect(normalizeAiMarkdown(input), input);
    });

    test('leaves code untouched', () {
      const input = '```python\n-x\n1.y\n| a | b |\n| c | d |\n```';
      expect(normalizeAiMarkdown(input), input);
    });

    test('drops empty numbered titles and closes the gap', () {
      final out = normalizeAiMarkdown(
        '## 1. Giải thích\nNội dung\n\n## 2. Ví dụ nhỏ\n\n## 3. So sánh\nBảng',
      );
      expect(out, isNot(contains('Ví dụ nhỏ')));
      expect(out, contains('## 2. So sánh'));
    });

    test('keeps the numbering of a later answer part', () {
      final out = normalizeAiMarkdown('## 4. Tự thực hành\nHãy thử.');
      expect(out, contains('## 4. Tự thực hành'));
    });

    test('restores accents on structural titles', () {
      expect(normalizeAiMarkdown('## Kiem tra hieu'), '## Kiểm tra hiểu');
      expect(normalizeAiMarkdown('## Hoc chuyen sau'), '## Học chuyên sâu');
    });

    test('promotes a plain section title but not a sentence', () {
      expect(normalizeAiMarkdown('Ví dụ minh họa'), '### Ví dụ minh họa');
      expect(
        normalizeAiMarkdown('Ví dụ, khi gọi f(3) thì hàm gọi f(2).'),
        'Ví dụ, khi gọi f(3) thì hàm gọi f(2).',
      );
    });

    test('removes leaked prompt instructions', () {
      final out = normalizeAiMarkdown(
        'Nội dung.\n(Omit as per instruction)\n## Bài tiếp theo\nThe prompt says leave it blank.',
      );
      expect(out, 'Nội dung.');
    });
  });

  test('markdownToPlainText removes syntax but keeps the words', () {
    expect(
      markdownToPlainText('## 1. Tiêu đề\n- **Đậm** và `code`\n> trích'),
      '1. Tiêu đề\n• Đậm và code\ntrích',
    );
  });
}
