import 'package:ai_tutor/features/ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('support level footer shows the web labels under home', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AiSupportLevelFooter(supportLevel: 'HIGH_SUPPORT'),
        ),
      ),
    );

    expect(find.text('Mức hỗ trợ'), findsOneWidget);
    expect(find.text('High Support'), findsOneWidget);
    expect(find.text('Giảng viên đang thiết lập'), findsNothing);
    expect(find.text('Standard'), findsNothing);
  });

  test('support level labels match the web student chat values', () {
    expect(AiSupportLevelFooter.labelFor('STANDARD'), 'Standard');
    expect(AiSupportLevelFooter.labelFor('HIGH_SUPPORT'), 'High Support');
    expect(AiSupportLevelFooter.labelFor('challenge'), 'Challenge');
    expect(AiSupportLevelFooter.labelFor(null), 'Standard');
    expect(AiSupportLevelFooter.labelFor('CUSTOM'), 'Standard');
  });
}
