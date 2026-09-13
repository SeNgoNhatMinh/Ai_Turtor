import 'package:ai_tutor/core/network/exceptions.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses tomorrow copy when resetAt is missing', () {
    expect(
      describeDailyQuestionLimit(null),
      'Bạn đã dùng hết 10 câu hỏi hôm nay cho môn học này. Hạn mức sẽ tự làm mới vào ngày mai.',
    );
  });

  test('includes reset clock when backend sends resetAt', () {
    expect(
      describeDailyQuestionLimit(
        ApiBusinessException(
          message: 'ignored',
          code: 'DAILY_QUESTION_LIMIT_REACHED',
          resetAt: DateTime(2026, 9, 14, 0, 5),
        ),
      ),
      'Bạn đã dùng hết 10 câu hỏi hôm nay cho môn học này. Hạn mức làm mới lúc 00:05.',
    );
  });

  test('describeError prefers daily-limit copy', () {
    expect(
      describeError(
        ApiBusinessException(
          message: 'Too many requests',
          code: 'DAILY_QUESTION_LIMIT_REACHED',
        ),
      ),
      contains('10 câu hỏi hôm nay'),
    );
  });
}
