import 'dart:async';

import 'package:ai_tutor/features/ai_tutor/data/student_own_llm.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/student_own_llm_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('own LLM unlocks chat after the system quota is exhausted', () {
    expect(
      isAiChatCreationLocked(
        dailyQuotaExhausted: true,
        ownLlmReady: false,
        maxTurnsReached: true,
      ),
      isTrue,
    );
    expect(
      isAiChatCreationLocked(
        dailyQuotaExhausted: true,
        ownLlmReady: true,
        maxTurnsReached: true,
      ),
      isFalse,
    );
  });

  test('lists the same student LLM providers as web', () {
    expect(studentLlmProviders.map((item) => item.id).toList(), [
      'openrouter',
      'groq',
      'openai',
      'nvidia',
    ]);
  });

  test('rejects incomplete own-LLM credentials', () {
    expect(
      parseStudentOwnLlm(
        userId: 'student-1',
        provider: 'openrouter',
        model: 'openai/gpt-oss-20b',
        apiKey: '',
      ),
      isNull,
    );
    expect(
      parseStudentOwnLlm(
        userId: '',
        provider: 'groq',
        model: 'llama-3.1-8b',
        apiKey: 'sk-test',
      ),
      isNull,
    );
  });

  test('keeps own-LLM credentials in memory for the current user only', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final saved = parseStudentOwnLlm(
      userId: 'student-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-session',
    )!;
    container.read(studentOwnLlmProvider.notifier).save(saved);

    expect(container.read(studentOwnLlmProvider)?.matches('student-1'), isTrue);
    expect(
      container.read(studentOwnLlmProvider.notifier).forUser('student-2'),
      isNull,
    );

    container.read(studentOwnLlmProvider.notifier).clear();
    expect(container.read(studentOwnLlmProvider), isNull);
  });

  testWidgets('quota banner attaches and clears the session LLM', (
    tester,
  ) async {
    var attached = 0;
    var cleared = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatDailyQuotaBanner(onAttachLlm: () => attached++),
        ),
      ),
    );
    expect(find.text('Gắn API LLM'), findsOneWidget);
    expect(find.text('Gỡ API'), findsNothing);
    await tester.tap(find.text('Gắn API LLM'));
    expect(attached, 1);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatDailyQuotaBanner(
            ownLlmReady: true,
            onAttachLlm: () => attached++,
            onClearLlm: () => cleared++,
          ),
        ),
      ),
    );
    expect(find.text('Học tiếp bằng API của bạn'), findsOneWidget);
    expect(find.text('Đổi API'), findsOneWidget);
    expect(find.text('Gỡ API'), findsOneWidget);
    await tester.tap(find.text('Gỡ API'));
    expect(cleared, 1);
  });

  testWidgets('compact own-LLM access remains available after quota notice', (
    tester,
  ) async {
    var attached = 0;
    var cleared = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatOwnLlmAccessBar(
            ownLlmReady: false,
            onAttachLlm: () => attached += 1,
          ),
        ),
      ),
    );
    expect(find.text('Tiếp tục học bằng API LLM của bạn'), findsOneWidget);
    await tester.tap(find.text('Gắn API LLM'));
    expect(attached, 1);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatOwnLlmAccessBar(
            ownLlmReady: true,
            onAttachLlm: () => attached += 1,
            onClearLlm: () => cleared += 1,
          ),
        ),
      ),
    );
    expect(find.text('API LLM cá nhân đã sẵn sàng'), findsOneWidget);
    await tester.tap(find.byTooltip('Gỡ API LLM'));
    expect(cleared, 1);
  });

  testWidgets('own-LLM sheet saves only a complete session key', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () {
                  unawaited(
                    showStudentOwnLlmSheet(context, userId: 'student-1'),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final saveButton = find.widgetWithText(FilledButton, 'Dùng API này');
    expect(tester.widget<FilledButton>(saveButton).onPressed, isNull);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'openai/gpt-oss-20b');
    await tester.enterText(fields.at(1), 'sk-session');
    await tester.pump();

    expect(tester.widget<FilledButton>(saveButton).onPressed, isNotNull);
    await tester.tap(saveButton);
    await tester.pumpAndSettle();

    final stored = container.read(studentOwnLlmProvider);
    expect(stored?.userId, 'student-1');
    expect(stored?.provider, 'openrouter');
    expect(stored?.model, 'openai/gpt-oss-20b');
    expect(stored?.apiKey, 'sk-session');
  });
}
