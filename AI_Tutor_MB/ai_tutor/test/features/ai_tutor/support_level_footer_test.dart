import 'package:ai_tutor/features/ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('support level renders as a compact current-level chip', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.topRight,
              child: AiSupportLevelFooter(supportLevel: 'HIGH_SUPPORT'),
            ),
          ),
        ),
      ),
    );

    expect(find.text('High Support'), findsOneWidget);
    expect(find.textContaining('Mức hỗ trợ'), findsNothing);
    expect(find.text('Giảng viên đang thiết lập'), findsNothing);
    expect(find.text('Standard'), findsNothing);
    expect(
      tester
          .getTopRight(find.byKey(const ValueKey('ai-support-level-chip')))
          .dx,
      closeTo(344, 1),
    );
    expect(tester.takeException(), isNull);
  });

  test('support level labels match the web student chat values', () {
    expect(AiSupportLevelFooter.labelFor('STANDARD'), 'Standard');
    expect(AiSupportLevelFooter.labelFor('HIGH_SUPPORT'), 'High Support');
    expect(AiSupportLevelFooter.labelFor('challenge'), 'Challenge');
    expect(AiSupportLevelFooter.labelFor(null), 'Standard');
    expect(AiSupportLevelFooter.labelFor('CUSTOM'), 'Standard');
  });
}
