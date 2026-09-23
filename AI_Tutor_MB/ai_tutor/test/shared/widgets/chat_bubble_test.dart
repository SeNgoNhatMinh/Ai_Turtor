import 'package:ai_tutor/core/theme/app_colors.dart';
import 'package:ai_tutor/shared/widgets/chat_bubble.dart';
import 'package:ai_tutor/shared/models/rag_source_evidence.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('assistant answer keeps a neutral surface when escalated', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ChatBubble(
              isUser: false,
              content: 'Giải thích bài học',
              escalated: true,
              useMarkdown: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

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

  testWidgets(
    'hides stale evidence when the answer says material is insufficient',
    (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: ChatBubble(
                isUser: false,
                content: 'Tài liệu hiện tại không đủ để trả lời câu hỏi này.',
                confidence: 0.92,
                sourceEvidence: [
                  RagSourceEvidence(
                    materialId: 'material-1',
                    materialTitle: 'Giáo trình Java',
                    excerpt: 'Một đoạn cũ không còn phù hợp.',
                  ),
                ],
                useMarkdown: false,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Bằng chứng tài liệu'), findsNothing);
      expect(find.textContaining('Độ khớp của nguồn'), findsNothing);
      expect(find.text('Giáo trình Java'), findsNothing);
    },
  );

  testWidgets('labels confidence as source-question matching', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ChatBubble(
              isUser: false,
              content: 'Servlet xử lý request và response.',
              confidence: 0.86,
              sourceEvidence: [
                RagSourceEvidence(
                  materialId: 'material-1',
                  materialTitle: 'Giáo trình Java',
                  excerpt: 'Servlet handles a request.',
                ),
              ],
              useMarkdown: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Độ khớp của nguồn với câu hỏi: 86%'), findsOneWidget);
  });

  testWidgets('can hide source references while keeping confidence', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ChatBubble(
              isUser: false,
              content: 'Nội dung trả lời theo tài liệu.',
              confidence: 0.45,
              sources: ['materialId=material-1'],
              showSourceReferences: false,
              useMarkdown: false,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Độ khớp của nguồn với câu hỏi: 45%'), findsOneWidget);
    expect(find.text('Nguồn tham khảo'), findsNothing);
    expect(find.text('materialId=material-1'), findsNothing);
  });
}
