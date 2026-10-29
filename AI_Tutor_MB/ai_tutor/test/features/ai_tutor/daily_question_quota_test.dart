import 'package:ai_tutor/core/network/exceptions.dart';
import 'package:ai_tutor/features/ai_tutor/data/daily_question_quota.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('normalizes used remaining and limit like web', () {
    final quota = normalizeDailyQuota({
      'courseId': 'PRJ301',
      'used': 2,
      'remaining': 8,
      'dailyLimit': 10,
    });
    expect(quota.courseId, 'PRJ301');
    expect(quota.used, 2);
    expect(quota.remaining, 8);
    expect(quota.limit, 10);
    expect(quota.exhausted, isFalse);
  });

  test('treats remaining 0 as exhausted', () {
    final quota = normalizeDailyQuota({
      'dailyQuestionUsed': 10,
      'dailyQuestionRemaining': 0,
      'dailyQuestionLimit': 10,
    });
    expect(quota.used, 10);
    expect(quota.remaining, 0);
    expect(quota.exhausted, isTrue);
    expect(quota.exhaustedCopy().remaining, 0);
  });

  test('defaults when the quota endpoint is missing fields', () {
    expect(hasQuotaPayload(null), isFalse);
    expect(hasQuotaPayload({'ok': true}), isFalse);
    expect(hasQuotaPayload({'used': 1}), isTrue);
    final fallback = normalizeDailyQuota(null);
    expect(fallback.used, 0);
    expect(fallback.remaining, dailyCourseQuestionLimit);
    expect(fallback.exhausted, isFalse);
  });

  test('recognizes both daily quota error codes', () {
    expect(isDailyCourseQuotaCode(dailyCourseQuestionLimitCode), isTrue);
    expect(isDailyCourseQuotaCode(dailyQuestionLimitCode), isTrue);
    expect(
      ApiBusinessException(
        message: 'limit',
        code: dailyCourseQuestionLimitCode,
      ).isDailyQuestionLimitReached,
      isTrue,
    );
    expect(
      describeError(
        ApiBusinessException(
          message: 'Too many requests',
          code: dailyCourseQuestionLimitCode,
        ),
      ),
      contains('10 câu hỏi hôm nay'),
    );
  });

  testWidgets('keeps the daily-complete banner visible like web', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: AiChatDailyQuotaBanner())),
    );
    expect(find.text(dailySessionCompleteTitle), findsOneWidget);
    expect(find.text(dailySessionCompleteMessage), findsOneWidget);
    expect(find.text(dailySessionCompleteHint), findsOneWidget);

    await tester.pump(const Duration(seconds: 30));
    expect(find.text(dailySessionCompleteTitle), findsOneWidget);
  });

  testWidgets('warns when the student is near the daily quota', (tester) async {
    expect(AiChatNearQuotaBanner.shouldShow(used: 8, limit: 10), isTrue);
    expect(AiChatNearQuotaBanner.shouldShow(used: 9, limit: 10), isFalse);
    expect(AiChatNearQuotaBanner.shouldShow(used: 10, limit: 10), isFalse);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AiChatNearQuotaBanner(used: 8, limit: 10)),
      ),
    );
    expect(find.text('Còn 2 câu hỏi hôm nay cho môn này.'), findsOneWidget);
  });

  testWidgets('near-quota notice hides after two seconds', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AiChatQuotaNotice(used: 8, limit: 10)),
      ),
    );

    expect(find.text('Còn 2 câu hỏi hôm nay cho môn này.'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1900));
    expect(find.text('Còn 2 câu hỏi hôm nay cho môn này.'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 101));
    expect(find.text('Còn 2 câu hỏi hôm nay cho môn này.'), findsNothing);
  });

  testWidgets('exhausted notice also hides after two seconds', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AiChatQuotaNotice(used: 10, limit: 10)),
      ),
    );

    expect(
      find.text('Bạn đã dùng hết 10 câu hỏi hôm nay cho môn này.'),
      findsOneWidget,
    );
    await tester.pump(const Duration(seconds: 2));
    await tester.pump();
    expect(
      find.text('Bạn đã dùng hết 10 câu hỏi hôm nay cho môn này.'),
      findsNothing,
    );
  });
}
