import 'package:ai_tutor/core/utils/study_suggestion_prompt.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/lesson_deep_dive_cta.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'builds the visible student chat message for a generic study suggestion',
    () {
      expect(
        buildStudySuggestionPrompt('Nắm vững các khái niệm IoC và DI'),
        'Ôn tập phần "Nắm vững các khái niệm IoC và DI"',
      );
    },
  );

  test(
    'uses the grounded review prompt for an identified improve-plan item',
    () {
      expect(
        buildStudySuggestionPrompt(
          'Nắm vững IoC và DI',
          improvePlanId: 'plan-1',
          planItemId: 'item-1',
        ),
        'Ôn tập theo Improve Plan: Nắm vững IoC và DI',
      );
    },
  );

  test('does not build a chat message for an empty suggestion', () {
    expect(buildStudySuggestionPrompt('   '), '');
  });

  test(
    'sends a numbered lesson chip as a lesson start, not an improve-plan wrap',
    () {
      expect(
        buildStudySuggestionPrompt('Bài 1: Servlet là gì?'),
        'Bắt đầu bài 1: Servlet là gì?',
      );
      expect(
        buildStudySuggestionPrompt('Bắt đầu bài 2: Request và Response'),
        'Bắt đầu bài 2: Request và Response',
      );
    },
  );

  test('course opening chips start the same topic-study flow', () {
    expect(
      buildLessonChatPrompt('Chapter 3 Functions'),
      'Nay mình học Chapter 3 Functions',
    );
    expect(
      buildLessonChatPrompt('Nay mình học Servlet'),
      'Nay mình học Servlet',
    );
    expect(
      buildLessonChatPrompt('Bài 1: Servlet là gì?'),
      'Bắt đầu bài 1: Servlet là gì?',
    );
  });

  test('numbered lesson with an en-dash still starts that lesson', () {
    expect(
      buildStudySuggestionPrompt(
        'Bài 2 – Sử dụng biến lặp (itervar) trong thân vòng.',
      ),
      'Bắt đầu bài 2: Sử dụng biến lặp (itervar) trong thân vòng.',
    );
  });

  test('parses numbered Bài lines from a learning-path answer', () {
    final items = parseLessonSuggestionsFromAnswer('''
## Lộ trình học
1. **Bài 1: Giới thiệu vòng lặp `for`** – hiểu cú pháp.
2. Bài 2: Vòng lặp while
6. Bài 6: Xử lý lỗi ngữ nghĩa (semantic error) khi viết vòng lặp – tránh lỗi logic.

## Bắt đầu thế nào
Bạn muốn bắt đầu với bài nào? Gợi ý: **Bắt đầu bài 1: Giới thiệu vòng lặp for**.
''');
    expect(items.map((item) => item.title).toList(), [
      'Bắt đầu bài 1: Giới thiệu vòng lặp for – hiểu cú pháp.',
      'Bắt đầu bài 2: Vòng lặp while',
      'Bắt đầu bài 6: Xử lý lỗi ngữ nghĩa (semantic error) khi viết vòng lặp – tránh lỗi logic.',
    ]);
  });

  test(
    'uses parsed lessons when the API did not send nextImproveSuggestions',
    () {
      final parsed = lessonSuggestionsForMessage(
        answer: '1. Bài 1: Servlet là gì?\n2. Bài 2: Request',
      );
      expect(parsed.first.title, 'Bắt đầu bài 1: Servlet là gì?');
    },
  );

  test('prefers roadmap lessons over an instruction-only API suggestion', () {
    final parsed = lessonSuggestionsForMessage(
      answer: '''
## Lộ trình học
1. Bài 1: Tại sao nên học viết chương trình?
2. Bài 2: Vai trò của máy tính như trợ lý cá nhân
''',
      apiSuggestionTitles: const [
        'Chọn bài này để AI Tutor hướng dẫn từng bước.',
      ],
    );

    expect(isActionableStudySuggestionText(parsed.first.title), isTrue);
    expect(parsed.map((item) => item.title).toList(), [
      'Bắt đầu bài 1: Tại sao nên học viết chương trình?',
      'Bắt đầu bài 2: Vai trò của máy tính như trợ lý cá nhân',
    ]);
    expect(
      isActionableStudySuggestionText(
        'Chọn bài này để AI Tutor hướng dẫn từng bước.',
      ),
      isFalse,
    );
  });

  test('asks AI for deeper angles of the current numbered lesson', () {
    expect(
      buildDeepDiveListPrompt('Bắt đầu bài 3: Cache'),
      'Gợi ý học chuyên sâu bài 3: Cache',
    );
    expect(buildDeepDiveListPrompt('Gợi ý học chuyên sâu bài 3: Cache'), '');
    expect(buildDeepDiveListPrompt('Đào sâu bài 3: Cache miss'), '');
    expect(
      buildDeepDiveListPrompt(
        'Bắt đầu bài 4: Cache',
        '## Học chuyên sâu\n- So sánh L1 và L2\n\n## Bài tiếp theo\n- Bài 5: File',
      ),
      '',
    );
    expect(
      buildDeepDiveListPrompt(
        'Bắt đầu bài 4: Cache',
        '## Học tiếp phần này\n- False sharing\n\n## Bài tiếp theo\n- Bài 5: File',
      ),
      '',
    );
    expect(
      buildStudySuggestionPrompt('Gợi ý học chuyên sâu bài 3: Cache'),
      'Gợi ý học chuyên sâu bài 3: Cache',
    );
  });

  test(
    'deep-dive bullets stay on the current bài instead of starting the next one',
    () {
      expect(
        buildDeepDiveTopicPrompt(
          '3',
          'Cache miss khi CPU không tìm thấy dữ liệu',
        ),
        'Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu',
      );
      expect(
        resolveChatStudyTip(
          'Gợi ý học chuyên sâu bài 3: Cache',
          'Cache miss khi CPU không tìm thấy dữ liệu',
        ),
        'Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu',
      );
      expect(
        resolveChatStudyTip(
          'Gợi ý học chuyên sâu bài 3: Cache',
          'Bài 4: Các cấp độ cache (L1, L2)',
        ),
        'Bắt đầu bài 4: Các cấp độ cache (L1, L2)',
      );
      expect(
        resolveChatStudyTip(
          'Đào sâu bài 4: Phân tích cách các core đa lõi chia sẻ cache L2/L3',
          'False sharing khi hai core ghi cùng cache line',
        ),
        'Đào sâu bài 4: False sharing khi hai core ghi cùng cache line',
      );
      expect(
        buildStudySuggestionPrompt(
          'Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu',
        ),
        'Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu',
      );
    },
  );

  test('extracts deep-dive bullets for review', () {
    final items = parseDeepDiveSuggestionsFromAnswer('''
## Học chuyên sâu
- Cache miss khi CPU không tìm thấy dữ liệu
- False sharing khi hai core ghi cùng cache line

## Bài tiếp theo
- Bài 4: File system
''');
    expect(items.map((item) => item.suggestionText).toList(), [
      'Cache miss khi CPU không tìm thấy dữ liệu',
      'False sharing khi hai core ghi cùng cache line',
    ]);
    expect(
      teacherStudentPathLabel('Gợi ý học chuyên sâu bài 3: Cache'),
      'Yêu cầu học chuyên sâu',
    );
    expect(
      teacherStudentPathLabel('Đào sâu bài 3: Cache miss'),
      'Đào sâu bài 3',
    );
    expect(
      parseNextLessonSuggestionsFromAnswer('''
## Bài tiếp theo
- Bài 4: File system
''').map((item) => item.suggestionText).toList(),
      ['Bài 4: File system'],
    );
  });

  testWidgets('shows the deep-dive CTA and sends the list prompt', (
    tester,
  ) async {
    String? sent;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LessonDeepDiveCta(
            question: 'Bắt đầu bài 3: Cache',
            answer: '## Giải thích\nCache lưu dữ liệu hay dùng.',
            onStudy: (prompt) => sent = prompt,
          ),
        ),
      ),
    );

    expect(find.text('Học chuyên sâu'), findsOneWidget);
    await tester.tap(find.text('Học chuyên sâu bài này'));
    expect(sent, 'Gợi ý học chuyên sâu bài 3: Cache');
  });

  testWidgets('hides the CTA after the answer already listed deep-dive ideas', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: LessonDeepDiveCta(
            question: 'Bắt đầu bài 3: Cache',
            answer: '## Học chuyên sâu\n- Cache miss',
            onStudy: _noop,
          ),
        ),
      ),
    );
    expect(find.text('Học chuyên sâu bài này'), findsNothing);
  });
}

void _noop(String _) {}
