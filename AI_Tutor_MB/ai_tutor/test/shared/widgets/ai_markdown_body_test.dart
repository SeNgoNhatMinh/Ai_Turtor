import 'package:ai_tutor/core/utils/ai_chat_content.dart';
import 'package:ai_tutor/shared/widgets/ai_markdown_body.dart';
import 'package:ai_tutor/shared/widgets/ai_study_path_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('stabilizes truncated emphasis and links', () {
    expect(stabilizeAiMarkdown('Chào **bạn'), 'Chào **bạn**');
    expect(hasUnclosedMarkdownInlines('Chào **bạn'), isTrue);
    expect(sliceMarkdownForReveal('Line 1\n**cut', 10), 'Line 1');
  });

  testWidgets('renders the course welcome list without a markdown crash', (
    tester,
  ) async {
    const content = '''
## Chào mừng bạn đến với môn PRF192 (Lập trình)

Mình sẽ đồng hành như gia sư: cùng xem môn này dạy những gì, rồi học từng phần theo lộ trình.

### Bắt đầu học một phần của môn
- Bắt đầu bài 1: Giới thiệu Java Platform, Enterprise Edition (Java EE)
- Bắt đầu bài 2: Sử dụng Web Containers
- Bắt đầu bài 3: Viết Servlet đầu tiên
- Bắt đầu bài 4: Quản lý trạng thái với Sessions

Chọn một gợi ý ở trên để bắt đầu học, hoặc nhập chủ đề khác.
''';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiMarkdownBody(data: prepareAiChatMarkdown(content)),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(ErrorWidget), findsNothing);
    expect(
      find.textContaining('Chào mừng bạn đến với môn PRF192'),
      findsWidgets,
    );
  });

  testWidgets('study-tip links stay tappable after the inline-builder fix', (
    tester,
  ) async {
    final tapped = <String>[];
    final markdown = prepareAiChatMarkdown('''
## Lưu ý để học tốt hơn
- Ôn lại vòng lặp for
''');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiMarkdownBody(data: markdown, onStudyTipTap: tapped.add),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(ErrorWidget), findsNothing);
    await tester.tap(find.text('Ôn lại vòng lặp for'));
    expect(tapped, ['Ôn lại vòng lặp for']);
  });

  testWidgets('deep-dive choices stay tappable like web', (tester) async {
    final tapped = <String>[];
    const topic = 'So sánh O, Ω, và Θ trong các đường hợp thức';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiMarkdownBody(
            data: '## **Học chuyên sâu**\n- $topic',
            onStudyTipTap: tapped.add,
          ),
        ),
      ),
    );

    await tester.tap(find.text(topic));
    expect(tapped, [topic]);
  });

  testWidgets('plain Học chuyên sâu headings still become study links', (
    tester,
  ) async {
    final tapped = <String>[];
    const topic = 'Phân tích độ phức tạp trung bình';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiMarkdownBody(
            data: 'Học chuyên sâu\n- $topic',
            onStudyTipTap: tapped.add,
          ),
        ),
      ),
    );

    await tester.tap(find.text(topic));
    expect(tapped, [topic]);
  });

  test('extracts Bài tiếp theo chips the same way web calls them', () {
    final segments = splitStudyPathSegments('''
## Học chuyên sâu
- So sánh O và Θ

## Bài tiếp theo
- Bài 3: Chapter 5: Recursion
''');

    expect(segments, hasLength(2));
    expect(segments[0].heading, 'Học chuyên sâu');
    expect(segments[0].tips, ['So sánh O và Θ']);
    expect(segments[0].isNextLessonHeading, isFalse);
    expect(segments[1].heading, 'Bài tiếp theo');
    expect(segments[1].tips, ['Bài 3: Chapter 5: Recursion']);
    expect(segments[1].isNextLessonHeading, isTrue);
    expect(isNextLessonStudyTip('Bài 3: Chapter 5: Recursion'), isTrue);
  });

  test(
    'does not turn the in-answer lesson roadmap into Bài tiếp theo chips',
    () {
      expect(
        nextLessonTipsForAnswer('''
Các bài dưới đây là chương có trong tài liệu môn học.
1. Bắt đầu bài 1: Type conversion functions
2. Bắt đầu bài 2: Adding new functions
3. Bắt đầu bài 3: Built-in functions
'''),
        isEmpty,
      );
    },
  );

  test('sends only the first Bài tiếp theo like web', () {
    expect(
      nextLessonTipsForAnswer('''
## Bài tiếp theo
- Bài 3: Chapter 5: Recursion
- Bài 4: File I/O
- Bài 5: Recursion review
'''),
      ['Bài 3: Chapter 5: Recursion'],
    );
  });

  test('prefers Bài tiếp theo bullets over API-style ôn tập titles', () {
    expect(
      nextLessonTipsForAnswer('''
## Học chuyên sâu
- Cache miss

## Bài tiếp theo
- Bài 3: Chapter 5: Recursion
'''),
      ['Bài 3: Chapter 5: Recursion'],
    );
  });

  testWidgets('renders Bài tiếp theo as web chips under the chat answer', (
    tester,
  ) async {
    final tapped = <String>[];
    const lesson = 'Bài 3: Chapter 5: Recursion';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiStudyPathBlock(
            heading: 'Bài tiếp theo',
            tips: nextLessonTipsForAnswer('## Bài tiếp theo\n- $lesson'),
            isNextLessonHeading: true,
            onStudyTipTap: tapped.add,
          ),
        ),
      ),
    );

    expect(find.text('Tiếp tục học'), findsNothing);
    expect(find.text('Ôn tập'), findsNothing);
    expect(find.byType(AiNextLessonChip), findsOneWidget);
    await tester.tap(find.text(lesson));
    expect(tapped, [lesson]);
  });

  testWidgets('study continuation choices work across course content', (
    tester,
  ) async {
    final tapped = <String>[];
    const topics = [
      'Thêm action mới vào switch của Servlet',
      'So sánh INNER JOIN và LEFT JOIN',
      'Quản lý state bằng Riverpod',
    ];

    for (final topic in topics) {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiMarkdownBody(
              data: '## Học tiếp phần này\n- $topic',
              onStudyTipTap: tapped.add,
            ),
          ),
        ),
      );

      await tester.tap(find.text(topic));
    }

    expect(tapped, topics);
  });

  testWidgets('horizontal rules do not paint black separator lines', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AiMarkdownBody(data: 'Nội dung trước\n\n---\n\nVí dụ nhỏ'),
        ),
      ),
    );

    final decorations = tester
        .widgetList<Container>(find.byType(Container))
        .map((container) => container.decoration)
        .whereType<BoxDecoration>();
    expect(
      decorations.any((decoration) => decoration.color == Colors.transparent),
      isTrue,
    );
    expect(
      decorations.any(
        (decoration) => decoration.border?.top.color == Colors.black,
      ),
      isFalse,
    );
  });

  testWidgets('missing markdown images do not expand into a red error box', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AiMarkdownBody(data: 'Xem hình ![sơ đồ](not-a-real-asset.png)'),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.byType(ErrorWidget), findsNothing);
  });

  testWidgets('unclosed HTML and footnotes do not show a red error box', (
    tester,
  ) async {
    const messy = '''
## Chào mừng bạn đến với môn PRF192

<span class="note">Gợi ý học
- Bắt đầu bài 1: Servlet **lifecycle
[^footnote] xem thêm

<table><tr><td>cột
''';

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AiMarkdownBody(data: messy)),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(ErrorWidget), findsNothing);
    expect(
      find.textContaining('Chào mừng bạn đến với môn PRF192'),
      findsWidgets,
    );
  });
}
