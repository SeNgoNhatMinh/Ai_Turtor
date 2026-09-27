import 'package:ai_tutor/core/utils/ai_chat_content.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('rejects an answer that only contains a markdown heading', () {
    expect(
      hasMeaningfulAiChatContent('## Theo tài liệu môn học'),
      isFalse,
    );
  });

  test('removes a trailing source section without losing the answer body', () {
    const answer = '''
## Theo tài liệu môn học

List là một dãy có thứ tự và có thể thay đổi.

## Nguồn tài liệu đã dùng
materialId=material-1
''';

    final sanitized = sanitizeAiChatContent(answer);

    expect(sanitized, contains('List là một dãy có thứ tự'));
    expect(sanitized, isNot(contains('Nguồn tài liệu')));
    expect(sanitized, isNot(contains('material-1')));
    expect(hasMeaningfulAiChatContent(answer), isTrue);
  });

  test('keeps content after a misplaced source section', () {
    const answer = '''
## Theo tài liệu môn học

## Nguồn tài liệu đã dùng
materialId=material-1

## Giải thích
List là một dãy có thứ tự và có thể thay đổi.
''';

    final sanitized = sanitizeAiChatContent(answer);

    expect(sanitized, contains('## Giải thích'));
    expect(sanitized, contains('List là một dãy có thứ tự'));
    expect(sanitized, isNot(contains('material-1')));
    expect(hasMeaningfulAiChatContent(answer), isTrue);
  });

  test('splits a long prose block into shorter paragraphs', () {
    const sentence =
        'Đây là một câu giải thích khá dài về khái niệm IoC trong Spring Framework để học sinh dễ theo dõi. ';
    final block = sentence * 8;
    expect(block.length, greaterThan(520));

    final prepared = prepareAiChatMarkdown(block);
    expect(prepared.contains('\n\n'), isTrue);
    expect(prepared.split('\n\n').length, greaterThan(1));
  });

  test('does not split lists or headings even when the block is long', () {
    final items = List.generate(
      12,
      (index) =>
          '- Mục $index: giải thích dài về vòng lặp for, biến lặp và cách đọc từng phần tử trong danh sách.',
    ).join('\n');
    final markdown = '## Lưu ý\n$items';
    expect(splitLongProseParagraphs(markdown), markdown);
  });
}
