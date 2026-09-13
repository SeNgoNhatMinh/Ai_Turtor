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

  testWidgets('shows the web daily-complete copy', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: AiChatDailyQuotaBanner())),
    );
    expect(find.text(dailySessionCompleteTitle), findsOneWidget);
    expect(find.text(dailySessionCompleteMessage), findsOneWidget);
    expect(find.text(dailySessionCompleteHint), findsOneWidget);
  });
}
