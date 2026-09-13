import 'package:ai_tutor/features/ai_tutor/data/code_mentor.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts empty optional code', () {
    expect(validateOptionalCodeInput('').ok, isTrue);
    expect(validateOptionalCodeInput('  ').value, '');
  });

  test('rejects code that is too long', () {
    final tooManyChars = 'a' * (codeMentorMaxChars + 1);
    expect(validateOptionalCodeInput(tooManyChars).ok, isFalse);
    expect(
      validateOptionalCodeInput(tooManyChars).message,
      contains('$codeMentorMaxChars ký tự'),
    );

    final tooManyLines = List.filled(
      codeMentorMaxLines + 1,
      'print(1);',
    ).join('\n');
    expect(validateOptionalCodeInput(tooManyLines).ok, isFalse);
    expect(
      validateOptionalCodeInput(tooManyLines).message,
      contains('$codeMentorMaxLines dòng'),
    );
  });

  test('recognizes CODE and CODE_MENTOR modes', () {
    expect(isCodeMentorMode('CODE'), isTrue);
    expect(isCodeMentorMode('code_mentor'), isTrue);
    expect(isCodeMentorMode('RAG'), isFalse);
  });

  testWidgets('shows a code paste field and enables send from code only', (
    tester,
  ) async {
    final message = TextEditingController();
    final code = TextEditingController();
    var sent = 0;
    var expanded = true;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              return AiChatInputBar(
                controller: message,
                hint: 'Nhắn cho Cóc...',
                enabled: true,
                isPending: false,
                onSend: () => sent += 1,
                onStop: () {},
                stopLabel: 'Dừng',
                codeController: code,
                codeExpanded: expanded,
                onToggleCode: () => setState(() => expanded = !expanded),
              );
            },
          ),
        ),
      ),
    );

    expect(find.byTooltip('Ẩn ô dán mã nguồn'), findsOneWidget);
    expect(find.text('Dán mã nguồn hoặc log lỗi...'), findsOneWidget);
    expect(find.byTooltip('Gửi'), findsNothing);

    await tester.enterText(find.byType(TextField).first, 'public class A {}');
    await tester.pump();
    expect(find.byTooltip('Gửi'), findsOneWidget);
    await tester.tap(find.byTooltip('Gửi'));
    expect(sent, 1);

    message.dispose();
    code.dispose();
  });
}
