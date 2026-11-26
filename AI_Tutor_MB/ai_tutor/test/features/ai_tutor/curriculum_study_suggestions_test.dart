import 'package:ai_tutor/core/utils/study_suggestion_prompt.dart';
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
- Tìm hiểu cách cấu hình Servlet Filter.
- Thực hành xử lý lỗi trong ứng dụng Java Web.
Mẹo: Hãy chọn một chủ đề cụ thể.
''';

const _lessonChipMarkdown = '''
## Gợi ý học tập
- Bài 1: Giới thiệu nền tảng Java EE || Chapter 1: Introducing Java Platform, Enterprise Edition
- Bài 2: Sử dụng web container || Chapter 2: Using Web Containers
- Bài 4: Recursion || 4 Recursion
- Bài 4: Recursion
- Bài 5: Không có tiêu đề gốc
''';

void main() {
  test('extracts all web curriculum starters and removes duplicate text', () {
    final suggestions = parseCurriculumStudySuggestions(_curriculumMarkdown);
    final display = stripCurriculumStudySuggestionSection(_curriculumMarkdown);

    expect(suggestions, hasLength(7));
    expect(suggestions.first.title, 'Tôi muốn tìm hiểu về Servlet và JSP.');
    expect(display, contains('Nội dung chính'));
    expect(display, isNot(contains('Gợi ý học tập')));
    expect(display, isNot(contains('Mẹo:')));
  });

  test('shows only the Vietnamese label and keeps the source chapter', () {
    final suggestions = parseCurriculumStudySuggestions(_lessonChipMarkdown);

    expect(suggestions.map((item) => item.title).toList(), [
      'Bài 1: Giới thiệu nền tảng Java EE',
      'Bài 2: Sử dụng web container',
      'Bài 4: Recursion',
      'Bài 5: Không có tiêu đề gốc',
    ]);
    expect(
      suggestions.map((item) => item.suggestionText).toList(),
      suggestions.map((item) => item.title).toList(),
    );
    expect(suggestions.map((item) => item.chapterTitle).toList(), [
      'Chapter 1: Introducing Java Platform, Enterprise Edition',
      'Chapter 2: Using Web Containers',
      '4 Recursion',
      '',
    ]);
    expect(suggestions.any((item) => item.title.contains('||')), isFalse);
  });

  test('keeps every lesson beyond the old eight-item cap', () {
    final markdown = [
      '## Gợi ý học tập',
      for (var i = 1; i <= 12; i++) '- Bài $i: Chủ đề $i || Chapter $i: Topic $i',
    ].join('\n');
    expect(parseCurriculumStudySuggestions(markdown), hasLength(12));
  });

  test(
    'converts a seeded welcome message instead of leaving markdown bullets',
    () {
      final suggestions = curriculumStudySuggestionsForMessage(
        markdown: _curriculumMarkdown,
        isUser: false,
        hasInteractiveQuiz: false,
      );

      expect(suggestions, hasLength(7));
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
    final selected = <StudyPathSuggestion>[];
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
    expect(find.text('Hiển thị thêm (2)'), findsOneWidget);
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
    expect(selected.map((item) => item.suggestionText), [
      'Tôi muốn tìm hiểu về Servlet và JSP.',
    ]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('searches, expands, and collapses curriculum suggestions', (
    tester,
  ) async {
    final suggestions = parseCurriculumStudySuggestions(_curriculumMarkdown);
    tester.view.physicalSize = const Size(360, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: CurriculumStudySuggestions(
              suggestions: suggestions,
              onSelected: (_) {},
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Hiển thị thêm (2)'));
    await tester.pump();
    expect(find.text('Học ngay'), findsNWidgets(7));
    expect(find.text('Ẩn bớt'), findsOneWidget);

    await tester.tap(find.text('Ẩn bớt'));
    await tester.pump();
    expect(find.text('Học ngay'), findsNWidgets(5));

    await tester.enterText(find.byType(TextField), 'Servlet Filter');
    await tester.pump();
    expect(find.text('Học ngay'), findsOneWidget);
    expect(find.text('Tìm hiểu cách cấu hình Servlet Filter.'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'không tồn tại');
    await tester.pump();
    expect(find.text('Không tìm thấy bài học phù hợp.'), findsOneWidget);
    expect(find.text('Học ngay'), findsNothing);

    await tester.tap(find.byTooltip('Xóa tìm kiếm'));
    await tester.pump();
    expect(find.text('Học ngay'), findsNWidgets(5));
    expect(find.text('Hiển thị thêm (2)'), findsOneWidget);
  });

  testWidgets('stays usable on a narrow screen at 200 percent text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: SingleChildScrollView(
              child: CurriculumStudySuggestions(
                suggestions: parseCurriculumStudySuggestions(
                  _curriculumMarkdown,
                ),
                onSelected: (_) {},
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('Hiển thị thêm (2)'), findsOneWidget);
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
