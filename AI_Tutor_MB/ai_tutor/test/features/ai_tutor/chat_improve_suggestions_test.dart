import 'package:ai_tutor/core/utils/study_suggestion_prompt.dart';
import 'package:ai_tutor/features/ai_tutor/data/chat_improve_suggestions.dart';
import 'package:ai_tutor/features/memory/presentation/widgets/improve_suggestion_widgets.dart';
import 'package:ai_tutor/l10n/app_localizations.dart';
import 'package:ai_tutor/shared/models/improve_suggestion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('keeps API improve chips in the current chat turn', () {
    final items = chatImproveSuggestionsForMessage(
      answer: '1. Bài 1: Servlet\n2. Bài 2: JSP',
      apiSuggestions: [ImproveSuggestionItem.fromLabel('Ôn IoC và DI')],
    );

    expect(items.map((item) => item.title), ['Ôn IoC và DI']);
    expect(
      buildStudySuggestionPrompt(items.first.title),
      'Ôn tập phần "Ôn IoC và DI"',
    );
  });

  test('keeps source provenance on API study suggestions', () {
    final items = chatImproveSuggestionsForMessage(
      answer: '1. Bài 1: Servlet',
      apiSuggestions: [
        ImproveSuggestionItem.fromJson({
          'title': 'Ôn Servlet lifecycle',
          'sourceMaterialIds': ['material-1'],
          'sourceChunkIds': ['chunk-1'],
        }),
      ],
    );

    expect(items.single.sourceMaterialIds, ['material-1']);
    expect(items.single.sourceChunkIds, ['chunk-1']);
  });

  test('parses Bài N from the answer when the API sent no chips', () {
    final items = chatImproveSuggestionsForMessage(
      answer: '''
## Lộ trình học
1. Bài 1: Servlet là gì?
2. Bài 2: Request và Response
''',
    );

    expect(items.map((item) => item.title).toList(), [
      'Bắt đầu bài 1: Servlet là gì?',
      'Bắt đầu bài 2: Request và Response',
    ]);
    expect(
      answerHasLessonPathSuggestions(
        '1. Bài 1: Servlet là gì?\n2. Bài 2: Request',
      ),
      isTrue,
    );
  });

  test('Học ngay stays a chat prompt, not an improve-plan page', () {
    expect(
      buildStudySuggestionPrompt('Ôn IoC và DI'),
      'Ôn tập phần "Ôn IoC và DI"',
    );
    expect(
      buildStudySuggestionPrompt('Bài 1: Servlet là gì?'),
      'Bắt đầu bài 1: Servlet là gì?',
    );
  });

  testWidgets('shows lesson chips inside the chat answer card', (tester) async {
    final learned = <String>[];

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: ImproveSuggestionsStrip(
            suggestions: chatImproveSuggestionsForMessage(
              answer: '1. Bài 1: Servlet\n2. Bài 2: JSP',
            ),
            consumedKeys: const {},
            onLearn: (item) => learned.add(item.title),
            onCreateQuiz: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Tiếp tục học'), findsOneWidget);
    expect(find.text('Bắt đầu bài 1: Servlet'), findsOneWidget);
    expect(find.text('Bắt đầu bài 2: JSP'), findsOneWidget);
    expect(find.text('Học ngay'), findsNWidgets(2));
    expect(find.text('Ôn tập'), findsNWidgets(2));

    await tester.tap(find.text('Học ngay').first);
    expect(learned, ['Bắt đầu bài 1: Servlet']);
  });

  testWidgets('still shows improve chips when the answer has study tips', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: ImproveSuggestionsStrip(
            suggestions: [ImproveSuggestionItem.fromLabel('Ôn IoC và DI')],
            consumedKeys: const {},
            onLearn: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Ôn IoC và DI'), findsOneWidget);
    expect(find.text('Học ngay'), findsOneWidget);
  });

  testWidgets('keeps old suggestions visible but disables new chat actions', (
    tester,
  ) async {
    var learned = false;
    var createdQuiz = false;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: ImproveSuggestionsStrip(
            suggestions: [ImproveSuggestionItem.fromLabel('Ôn IoC và DI')],
            consumedKeys: const {},
            enabled: false,
            onLearn: (_) => learned = true,
            onCreateQuiz: (_) => createdQuiz = true,
          ),
        ),
      ),
    );

    expect(find.text('Ôn IoC và DI'), findsOneWidget);
    final actions = tester.widgetList<TextButton>(find.byType(TextButton));
    expect(actions, hasLength(2));
    expect(actions.every((button) => button.onPressed == null), isTrue);
    expect(learned, isFalse);
    expect(createdQuiz, isFalse);
  });

  testWidgets('does not render raw suggestion JSON as a chip title', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: ImproveSuggestionsStrip(
            suggestions: [
              ImproveSuggestionItem.fromLabel(
                '{"suggestions":[{"title":"Tìm hiểu khái niệm OOP","reason":"Thiếu OOP","nextSteps":["Ôn class và object","Ôn inheritance"]}]}',
              ),
            ],
            consumedKeys: const {},
            onLearn: (_) {},
            onCreateQuiz: (_) {},
          ),
        ),
      ),
    );

    expect(find.textContaining('"suggestions"'), findsNothing);
    expect(find.text('Ôn class và object'), findsOneWidget);
    expect(find.text('Ôn inheritance'), findsOneWidget);
  });
}
