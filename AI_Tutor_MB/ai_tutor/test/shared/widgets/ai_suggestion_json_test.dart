import 'package:ai_tutor/core/utils/ai_chat_content.dart';
import 'package:ai_tutor/shared/models/improve_suggestion.dart';
import 'package:ai_tutor/shared/widgets/ai_markdown_body.dart';
import 'package:ai_tutor/shared/widgets/ai_suggestion_json.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const prjOop = '''
{"suggestions":[{"title":"Tìm hiểu khái niệm OOP","reason":"Theo tài liệu môn học hiện tại, không có phần mô tả nào về khái niệm OOP.","nextSteps":["Tham khảo sách giáo trình lập trình Java cơ bản","Tìm hiểu bốn đặc trưng chính của OOP"]}]}
''';

  const ceaSql = '''
{"suggestions":[{"title":"Ôn SQL JOIN","reason":"Câu hỏi về INNER JOIN và LEFT JOIN chưa được tài liệu môn CEA201 nêu rõ.","nextSteps":["Vẽ sơ đồ quan hệ 1-n và n-n","Thực hành INNER JOIN với 2 bảng"]}]}
''';

  const prfServlet = '''
Gợi ý cho PRF192

```json
{"suggestions":[{"title":"Servlet lifecycle","reason":"Cần nắm init, service, destroy trước khi viết JSP.","nextSteps":["Vẽ vòng đời Servlet","So sánh JSP và Servlet"]}]}
```
''';

  test(
    'rewrites suggestion JSON into readable markdown instead of raw keys',
    () {
      final formatted = rewriteSuggestionJson(prjOop);

      expect(formatted.contains('"suggestions"'), isFalse);
      expect(formatted, contains('### Tìm hiểu khái niệm OOP'));
      expect(formatted, contains('Theo tài liệu môn học hiện tại'));
      expect(
        formatted,
        contains('- Tham khảo sách giáo trình lập trình Java cơ bản'),
      );
      expect(formatted, contains('- Tìm hiểu bốn đặc trưng chính của OOP'));
    },
  );

  test('rewrites fenced JSON and keeps surrounding prose', () {
    final formatted = rewriteSuggestionJson(
      'Tóm tắt buổi học.\n\n```json\n$prjOop\n```\n',
    );

    expect(formatted.contains('"suggestions"'), isFalse);
    expect(formatted, startsWith('Tóm tắt buổi học.'));
    expect(formatted, contains('### Tìm hiểu khái niệm OOP'));
  });

  test('turns JSON nextSteps into actionable chips', () {
    final items = suggestionItemsFromJson(prjOop);
    expect(items.map((item) => item.title), [
      'Tham khảo sách giáo trình lập trình Java cơ bản',
      'Tìm hiểu bốn đặc trưng chính của OOP',
    ]);
  });

  test(
    'salvages truncated JSON from any course instead of showing raw keys',
    () {
      const truncated = '''
{"suggestions":[{"title":"Tìm hiểu khái niệm OOP","reason":"Theo tài liệu môn học hiện tại, không có phần mô tả nào về khái niệm OOP (Lập trình hướng đối tượng). OOP là nền tảng quan trọng trong Java.","nextSteps":["Tham khảo sách giáo trình lập trình Java cơ bản hoặc tài liệu OOP bên ngoài khóa học","Tìm hiểu bốn đặc trưng chính của OOP: Encapsulation,
''';

      final formatted = rewriteSuggestionJson(truncated);
      expect(formatted.contains('"suggestions"'), isFalse);
      expect(formatted.contains('"nextSteps"'), isFalse);
      expect(formatted, contains('### Tìm hiểu khái niệm OOP'));
      expect(formatted, contains('Lập trình hướng đối tượng'));
      expect(formatted, contains('Tham khảo sách giáo trình lập trình Java'));
    },
  );

  test('formats suggestion envelopes for CEA and PRF as well as PRJ', () {
    final sql = rewriteSuggestionJson(ceaSql);
    expect(sql.contains('"suggestions"'), isFalse);
    expect(sql, contains('### Ôn SQL JOIN'));
    expect(sql, contains('- Vẽ sơ đồ quan hệ 1-n và n-n'));

    final servlet = rewriteSuggestionJson(prfServlet);
    expect(servlet.contains('"suggestions"'), isFalse);
    expect(servlet, startsWith('Gợi ý cho PRF192'));
    expect(servlet, contains('### Servlet lifecycle'));
    expect(servlet, contains('- Vẽ vòng đời Servlet'));
  });

  test('expands JSON chip titles and merges nextSteps from the answer', () {
    final items = expandImproveSuggestions([
      ImproveSuggestionItem.fromLabel('Xem lại tài liệu môn học'),
      ImproveSuggestionItem.fromLabel(prjOop),
    ], answer: ceaSql);

    expect(items.map((item) => item.title), [
      'Xem lại tài liệu môn học',
      'Tham khảo sách giáo trình lập trình Java cơ bản',
      'Tìm hiểu bốn đặc trưng chính của OOP',
      'Vẽ sơ đồ quan hệ 1-n và n-n',
      'Thực hành INNER JOIN với 2 bảng',
    ]);
    expect(items.any((item) => looksLikeSuggestionJson(item.title)), isFalse);
  });

  testWidgets('markdown body never paints raw suggestion JSON', (tester) async {
    const truncated =
        '{"suggestions":[{"title":"Tìm hiểu khái niệm OOP","reason":"Theo tài liệu môn học hiện tại.","nextSteps":["Ôn class và object"';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiMarkdownBody(data: prepareAiChatMarkdown(truncated)),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(ErrorWidget), findsNothing);
    expect(find.textContaining('"suggestions"'), findsNothing);
    expect(find.textContaining('Tìm hiểu khái niệm OOP'), findsWidgets);
  });
}
