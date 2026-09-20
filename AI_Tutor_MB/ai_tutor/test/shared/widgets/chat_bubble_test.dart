import 'package:ai_tutor/core/theme/app_colors.dart';
import 'package:ai_tutor/shared/widgets/chat_bubble.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('assistant answer keeps a neutral surface when escalated', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ChatBubble(
            isUser: false,
            content: 'Giải thích bài học',
            escalated: true,
            useMarkdown: false,
          ),
        ),
      ),
    );

    final bubble = tester.widget<Container>(
      find
          .descendant(
            of: find.byType(ChatBubble),
            matching: find.byType(Container),
          )
          .first,
    );
    final decoration = bubble.decoration! as BoxDecoration;

    expect(decoration.color, AppColors.card);
    expect(decoration.border?.top.color, AppColors.borderHairline);
    expect(decoration.color, isNot(AppColors.infoBg));
  });
}
