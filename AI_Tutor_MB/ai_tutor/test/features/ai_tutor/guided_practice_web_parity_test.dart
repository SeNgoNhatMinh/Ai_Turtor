import 'package:ai_tutor/features/ai_tutor/data/guided_practice.dart';
import 'package:ai_tutor/features/ai_tutor/data/understanding_check.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/curriculum_study_suggestions.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/guided_practice_card.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/understanding_check_quiz.dart';
import 'package:ai_tutor/shared/models/improve_suggestion.dart';
import 'package:ai_tutor/shared/widgets/ai_markdown_body.dart';
import 'package:ai_tutor/shared/widgets/ai_study_path_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _answer = '''
## Giải thích

Vòng lặp for.

## Bài tập có hướng dẫn

Điền điều kiện dừng:

```c
for (int i = 0; ____; i++) {
  printf("%d", ____);
}
```

## Kiểm tra hiểu
''';

Widget _host(Widget child, {ProviderContainer? container}) {
  return UncontrolledProviderScope(
    container: container ?? ProviderContainer(),
    child: MaterialApp(
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
}

void main() {
  final practice = extractGuidedPractice(_answer)!;

  testWidgets('exercise is filled inline and saving sends no message', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final saved = <String>[];
    await tester.pumpWidget(
      _host(
        GuidedPracticeCard(
          practice: practice,
          draftKey: 'm1',
          waitsForQuiz: true,
          onSaved: saved.add,
        ),
        container: container,
      ),
    );

    expect(find.text('Bài tập có hướng dẫn'), findsOneWidget);
    expect(find.text('0/2 chỗ'), findsOneWidget);
    expect(find.text('Làm bài tập'), findsNothing);
    expect(find.byType(TextField), findsNWidgets(2));

    await tester.enterText(find.byType(TextField).at(0), 'i < 3');
    await tester.enterText(find.byType(TextField).at(1), 'i');
    await tester.pump();
    expect(find.text('2/2 chỗ'), findsOneWidget);

    await tester.tap(find.text('Lưu bài làm'));
    await tester.pump();

    expect(saved, hasLength(1));
    expect(saved.single, contains('for (int i = 0; i < 3; i++)'));
    expect(find.text('Đã lưu bài làm'), findsOneWidget);
    final draft = container.read(guidedPracticeDraftsProvider)['m1']!;
    // Waiting for the quiz: the draft stays editable and is not reviewed yet.
    expect(draft.locked, isFalse);
    expect(draft.reviewed, isFalse);
  });

  testWidgets('without a quiz the saved exercise is final', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      _host(
        GuidedPracticeCard(practice: practice, draftKey: 'm2'),
        container: container,
      ),
    );
    await tester.enterText(find.byType(TextField).at(0), 'i < 3');
    await tester.enterText(find.byType(TextField).at(1), 'i');
    await tester.pump();
    await tester.tap(find.text('Lưu bài làm'));
    await tester.pump();

    expect(find.text('Đã nộp'), findsOneWidget);
    expect(
      find.text('Đã lưu bài làm. Không tạo câu trả lời mới.'),
      findsOneWidget,
    );
    expect(container.read(guidedPracticeDraftsProvider)['m2']!.locked, isTrue);
  });

  test('finished work review matches the web prompt', () {
    const quiz = UnderstandingQuiz(
      question: 'Vòng lặp nào kiểm tra điều kiện sau?',
      options: [
        UnderstandingOption(key: 'A', text: 'for'),
        UnderstandingOption(key: 'B', text: 'do-while'),
      ],
      correctKey: 'B',
    );
    final prompt = buildFinishedWorkReviewPrompt(
      draftText: 'bài đã điền',
      originalQuestion: 'Vòng lặp for\nchi tiết',
      incorrectAnswers: [
        UnderstandingRemediationAttempt(
          quizIndex: 0,
          quiz: quiz,
          selected: quiz.options.first,
          grade: const UnderstandingCheckGrade(
            quizIndex: 0,
            selectedKey: 'A',
            correct: false,
            correctKey: 'B',
            correctOptionText: 'do-while',
            explanation: '',
            messageId: 'm',
            attemptId: 'a',
          ),
        ),
      ],
    );
    expect(
      prompt,
      startsWith(
        'Học sinh đã nộp cả bài tập có hướng dẫn và quiz. Hãy sửa bài.',
      ),
    );
    expect(prompt, contains('Concept học sinh đã hỏi: Vòng lặp for'));
    expect(prompt, contains('Đáp án đúng: B. do-while'));
    expect(buildFinishedWorkReviewPrompt(draftText: '  '), isEmpty);
  });

  testWidgets('quiz keeps right/wrong hidden until the grade is revealed', (
    tester,
  ) async {
    const quiz = UnderstandingQuiz(
      question: 'Vòng lặp nào kiểm tra điều kiện sau?',
      options: [
        UnderstandingOption(key: 'A', text: 'for'),
        UnderstandingOption(key: 'B', text: 'do-while'),
      ],
      correctKey: 'B',
    );
    await tester.pumpWidget(
      _host(
        const UnderstandingCheckQuiz(
          quiz: quiz,
          lockedKey: 'A',
          revealGrade: false,
        ),
      ),
    );
    expect(
      find.textContaining('Đã lưu lựa chọn A. Đúng/sai hiện khi bạn làm'),
      findsOneWidget,
    );
    expect(find.textContaining('Đáp án đúng là B'), findsNothing);

    await tester.pumpWidget(
      _host(const UnderstandingCheckQuiz(quiz: quiz, lockedKey: 'A')),
    );
    expect(find.textContaining('Đáp án đúng là B'), findsOneWidget);
  });

  test('draft survives a JSON round trip for device storage', () {
    const draft = GuidedPracticeDraft(
      values: ['i < 3', 'i'],
      text: 'bài đã điền',
      locked: true,
      reviewed: true,
    );
    final restored = GuidedPracticeDraft.fromJson(draft.toJson())!;
    expect(restored.values, ['i < 3', 'i']);
    expect(restored.text, 'bài đã điền');
    expect(restored.locked, isTrue);
    expect(restored.reviewed, isTrue);
    expect(GuidedPracticeDraft.fromJson('rác'), isNull);
  });

  testWidgets('studied chapter shows "Đã học" instead of "Học ngay"', (
    tester,
  ) async {
    final suggestions = parseCurriculumStudySuggestions('''
## 4. Gợi ý học tập

- Bài 1: Introduction
- Bài 2: Basic Computations
''');
    expect(suggestions, hasLength(2));
    var tapped = 0;
    await tester.pumpWidget(
      _host(
        CurriculumStudySuggestions(
          suggestions: suggestions,
          learnedKeys: {
            ImproveSuggestionItem.fromLabel(
              suggestions.first.suggestionText,
            ).key,
          },
          onSelected: (_) => tapped++,
        ),
      ),
    );

    expect(
      find.text(
        'Chọn một bài trong tài liệu để bắt đầu học. Bài đã học được đánh dấu.',
      ),
      findsOneWidget,
    );
    expect(find.text('Đã học'), findsOneWidget);
    expect(find.text('Học ngay'), findsOneWidget);
    await tester.tap(find.text('Đã học'));
    expect(tapped, 0);
  });

  testWidgets('answer keeps "Bài tiếp theo" as tappable lesson chips', (
    tester,
  ) async {
    const lesson = 'Bài 3: Basic Logic';
    final tapped = <String>[];
    await tester.pumpWidget(
      _host(
        AiMarkdownBody(
          data:
              '''
## Giải thích

Nội dung bài.

## Bài tiếp theo

- $lesson
''',
          onStudyTipTap: tapped.add,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Bài tiếp theo'), findsOneWidget);
    expect(find.byType(AiNextLessonChip), findsOneWidget);
    await tester.tap(find.text(lesson));
    expect(tapped, [lesson]);
  });
}
