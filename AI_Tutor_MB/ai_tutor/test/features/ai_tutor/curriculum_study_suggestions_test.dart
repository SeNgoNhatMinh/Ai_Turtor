import 'package:ai_tutor/features/ai_tutor/presentation/widgets/curriculum_study_suggestions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _curriculumMarkdown = '''
# Java Web

## Nội dung chính
- Servlet
- JSP

## 4. Gợi ý học tập
Bạn có thể bắt đầu bằng cách hỏi AI Tutor:
- Tôi muốn tìm hiểu về Servlet và JSP.
- Giải thích Session, application, request, page bằng ví dụ đơn giản.
- Hướng dẫn tôi thực hành Kiến trúc MVC.
- Cho tôi bài tập luyện tập về Servlet và JSP.
- Kiểm tra kiến thức của tôi về Session, application, request, page.
Mẹo: Hãy chọn một chủ đề cụ thể.
''';

void main() {
  test('extracts five web curriculum starters and removes duplicate text', () {
    final suggestions = parseCurriculumStudySuggestions(_curriculumMarkdown);
    final display = stripCurriculumStudySuggestionSection(_curriculumMarkdown);

    expect(suggestions, hasLength(5));
    expect(suggestions.first.title, 'Tôi muốn tìm hiểu về Servlet và JSP.');
    expect(display, contains('Nội dung chính'));
    expect(display, isNot(contains('Gợi ý học tập')));
    expect(display, isNot(contains('Mẹo:')));
  });

  test(
    'converts a seeded welcome message instead of leaving markdown bullets',
    () {
      final suggestions = curriculumStudySuggestionsForMessage(
        markdown: _curriculumMarkdown,
        isUser: false,
        hasInteractiveQuiz: false,
      );

      expect(suggestions, hasLength(5));
      expect(
        stripCurriculumStudySuggestionSection(_curriculumMarkdown),
        isNot(contains('Tôi muốn tìm hiểu về Servlet và JSP.')),
      );
      expect(
        curriculumStudySuggestionsForMessage(
          markdown: _curriculumMarkdown,
          isUser: true,
          hasInteractiveQuiz: false,
        ),
        isEmpty,
      );
    },
  );

  testWidgets('renders web-style study rows and fires one callback', (
    tester,
  ) async {
    final selected = <String>[];
    final suggestions = parseCurriculumStudySuggestions(_curriculumMarkdown);
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: CurriculumStudySuggestions(
              suggestions: suggestions,
              onSelected: selected.add,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Gợi ý học tập'), findsOneWidget);
    expect(find.text('Học ngay'), findsNWidgets(5));
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.label ==
                'Học ngay: Tôi muốn tìm hiểu về Servlet và JSP.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('Học ngay').first);
    await tester.pump();
    expect(selected, ['Tôi muốn tìm hiểu về Servlet và JSP.']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('disabled suggestions do not send a prompt', (tester) async {
    var callbackCount = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CurriculumStudySuggestions(
            suggestions: parseCurriculumStudySuggestions(_curriculumMarkdown),
            enabled: false,
            onSelected: (_) => callbackCount++,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Học ngay').first);
    await tester.pump();
    expect(callbackCount, 0);
  });
}
