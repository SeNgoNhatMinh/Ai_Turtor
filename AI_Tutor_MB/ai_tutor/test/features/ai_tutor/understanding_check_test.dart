import 'package:ai_tutor/features/ai_tutor/data/understanding_check.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/understanding_check_quiz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('validates a structured understanding-check payload from the API', () {
    final quiz = normalizeStructuredUnderstandingQuiz({
      'question': 'Servlet gọi phương thức nào trước?',
      'options': [
        {'key': 'a', 'text': 'service()'},
        {'key': 'B', 'text': 'init()'},
        {'key': 'B', 'text': 'duplicate must be ignored'},
        {'key': 'x', 'text': 'invalid key'},
      ],
      'correctKey': 'b',
      'explanation': 'init() khởi tạo tài nguyên.',
    });

    expect(quiz, isNotNull);
    expect(quiz!.options.map((item) => item.key).toList(), ['A', 'B']);
    expect(quiz.options.map((item) => item.text).toList(), [
      'service()',
      'init()',
    ]);
    expect(quiz.correctKey, 'B');
    expect(quiz.explanation, 'init() khởi tạo tài nguyên.');
  });

  test('parses parenthesized A/B/C options on one line', () {
    final quiz = parseUnderstandingQuiz(
      'Vai trò của Controller trong MVC là gì? (A) Chỉ xử lý yêu cầu từ View (B) Chỉ truy cập Model (C) Xử lý yêu cầu từ View, truy cập Model và chuẩn bị dữ liệu cho View.',
    );
    expect(quiz, isNotNull);
    expect(quiz!.question, 'Vai trò của Controller trong MVC là gì?');
    expect(quiz.options.map((item) => item.key).toList(), ['A', 'B', 'C']);
    expect(quiz.options[2].text, contains('chuẩn bị dữ liệu cho View'));
  });

  test('treats Understanding Check as the quiz heading', () {
    final extracted = extractUnderstandingCheck('''
## Giải thích
Controller nối View và Model.

## Understanding Check
Bạn có thể giải thích vai trò của Controller không? (A) Chỉ View (B) Chỉ Model (C) View và Model
''');
    expect(extracted.quiz, isNotNull);
    expect(extracted.quiz!.options, hasLength(3));
    expect(extracted.before.contains('Understanding Check'), isFalse);
  });

  test('parses an inline A/B/C understanding check', () {
    final quiz = parseUnderstandingQuiz(
      "Khi dùng vòng lặp for để duyệt danh sách fruits, biến lặp sẽ có giá trị nào ở lần lặp thứ hai? A. 'apple' B. 'banana' C. 'cherry'",
    );

    expect(
      quiz!.question,
      "Khi dùng vòng lặp for để duyệt danh sách fruits, biến lặp sẽ có giá trị nào ở lần lặp thứ hai?",
    );
    expect(quiz.options.map((item) => item.key).toList(), ['A', 'B', 'C']);
    expect(quiz.options[1].text, "'banana'");
    expect(quiz.correctKey, '');
  });

  test('drops a trailing markdown rule from the last option', () {
    final quiz = parseUnderstandingQuiz(
      "Khi dùng vòng lặp for, biến lặp lần hai là gì? A. 'apple' B. 'banana' C. 'cherry' ---",
    );
    expect(quiz!.options[2].text, "'cherry'");
  });

  test('hides the answer key until the quiz widget reads it', () {
    final extracted = extractUnderstandingCheck('''
## Giải thích
for duyệt từng phần tử.

## Kiểm tra hiểu
Câu hỏi: Lần lặp thứ hai của fruits lấy giá trị nào?
A. apple
B. banana
C. cherry
Đáp án: B
Giải thích: Index 1 là banana.

## Bài tiếp theo
- Bài 2: Biến lặp
''');

    expect(extracted.before, contains('for duyệt từng phần tử'));
    expect(extracted.before.contains('Đáp án'), isFalse);
    expect(extracted.after, contains('Bài 2: Biến lặp'));
    expect(extracted.quiz!.correctKey, 'A');
    expect(extracted.quiz!.explanation, 'Index 1 là banana.');
    expect(extracted.quiz!.optionFor('A')!.text, 'banana');
  });

  test(
    'hides an inline answer and explanation leaked into the last option',
    () {
      final extracted = extractUnderstandingCheck('''
## Kiểm tra hiểu
Câu hỏi: Khi một Servlet được tải lần đầu, phương thức nào được gọi đầu tiên?
A. service() xử lý HTTP ngay lập tức
B. init() thiết lập tài nguyên cần thiết
C. destroy() giải phóng tài nguyên. **Giải thích:** init() được gọi ngay sau khi Servlet được khởi tạo. **Đáp án:** B **Giải thích:** init() chuẩn bị tài nguyên.
''');

      expect(extracted.quiz!.correctKey, 'A');
      expect(
        extracted.quiz!.options[2].text,
        'destroy() giải phóng tài nguyên.',
      );
      expect(
        extracted.quiz!.explanation,
        'init() được gọi ngay sau khi Servlet được khởi tạo.',
      );
      expect(extracted.quiz!.explanation.contains('Đáp án'), isFalse);
      expect(extracted.quiz!.explanation.contains('Giải thích'), isFalse);
      expect(extracted.before.contains('Đáp án'), isFalse);
      expect(extracted.after.contains('Đáp án'), isFalse);
    },
  );

  test(
    'keeps an answer below a markdown rule inside the hidden quiz payload',
    () {
      final extracted = extractUnderstandingCheck('''
## Kiểm tra hiểu
Câu hỏi: Servlet callback đầu tiên là gì?
A. service()
B. init()
C. destroy()
---
Đáp án: B Giải thích: init() chạy một lần khi khởi tạo.
''');

    expect(extracted.quiz!.correctKey, 'A');
    expect(extracted.quiz!.options[2].text, 'destroy()');
      expect(extracted.quiz!.explanation, 'init() chạy một lần khi khởi tạo.');
      expect(extracted.after, '');
    },
  );

  test('parses Đáp án without a colon', () {
    final quiz = parseUnderstandingQuiz('''
Câu hỏi: Vai trò của Controller?
A. Chỉ View
B. View và Model
C. Chỉ Model
Đáp án B
Giải thích: Controller nối View với Model.
''');
    expect(quiz!.correctKey, 'B');
    expect(quiz.explanation, 'Controller nối View với Model.');
  });

  test('parses English "the correct answer is" keys', () {
    final quiz = parseUnderstandingQuiz('''
Câu hỏi: Lần lặp thứ hai lấy giá trị nào?
A. apple
B. banana
C. cherry
The correct answer is B
''');
    expect(quiz!.correctKey, 'A');
    expect(quiz.optionFor('A')!.text, 'banana');
  });

  test('does not treat a trailing lone letter as a reliable answer key', () {
    final quiz = parseUnderstandingQuiz('''
Câu hỏi: Lần lặp thứ hai lấy giá trị nào?
A. apple
B. banana
C. cherry
B
''');
    expect(quiz, isNotNull);
    expect(quiz!.correctKey, '');
  });

  test('grades leaked answer text without calling the tutor', () {
    final quiz = parseUnderstandingQuiz('''
Câu hỏi: Bạn hiểu đúng về vai trò của Controller trong kiến trúc MVC chưa?
A. Controller chỉ chịu trách nhiệm xử lý yêu cầu từ View.
B. Controller chịu trách nhiệm cả xử lý yêu cầu từ View và cập nhật dữ liệu trong Model.
C. Controller chỉ chịu trách nhiệm cập nhật dữ liệu trong Model. Nếu bạn chọn đáp án B, bạn có thể muốn tìm hiểu thêm về cách Controller tương tác với Model và View.
''');
    expect(quiz!.correctKey, 'B');
    expect(
      quiz.options[2].text,
      'Controller chỉ chịu trách nhiệm cập nhật dữ liệu trong Model.',
    );
    expect(
      quiz.explanation,
      contains('Controller tương tác với Model và View'),
    );
  });

  test(
    'builds an in-place grading prompt instead of a new study-start chat',
    () {
      final prompt = buildUnderstandingCheckPrompt(
        const UnderstandingQuiz(
          question: 'Lần lặp thứ hai lấy giá trị nào?',
          options: [
            UnderstandingOption(key: 'A', text: "'apple'"),
            UnderstandingOption(key: 'B', text: "'banana'"),
          ],
        ),
        const UnderstandingOption(key: 'B', text: "'banana'"),
      );
      expect(prompt, contains('Học sinh chọn: B'));
      expect(prompt, contains('không phải chủ đề mới'));
      expect(prompt.contains('Nay mình học'), isFalse);
    },
  );

  test('prefers structured payload over markdown extract', () {
    final extracted = resolveUnderstandingCheck(
      markdown: '''
## Kiểm tra hiểu
Câu hỏi: Markdown question?
A. one
B. two
Đáp án: A
''',
      structured: {
        'question': 'Structured question?',
        'options': [
          {'key': 'A', 'text': 'alpha'},
          {'key': 'B', 'text': 'beta'},
        ],
        'correctKey': 'B',
      },
    );
    expect(extracted.quiz!.question, 'Structured question?');
    expect(extracted.quiz!.correctKey, 'B');
    expect(extracted.before.contains('Đáp án'), isFalse);
  });

  testWidgets('locks after one tap and shows the grade', (tester) async {
    String? locked;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: UnderstandingCheckQuiz(
            quiz: const UnderstandingQuiz(
              question: 'Servlet gọi phương thức nào trước?',
              options: [
                UnderstandingOption(key: 'A', text: 'service()'),
                UnderstandingOption(key: 'B', text: 'init()'),
              ],
              correctKey: 'B',
              explanation: 'init() khởi tạo tài nguyên.',
            ),
            onLockAnswer: (key, attempt) => locked = key,
          ),
        ),
      ),
    );

    expect(find.text('Kiểm tra hiểu'), findsOneWidget);
    await tester.tap(find.text('service()'));
    await tester.pump();

    expect(locked, 'A');
    expect(find.text('Chưa đúng.'), findsOneWidget);
    expect(find.textContaining('Đáp án đúng là B'), findsOneWidget);

    await tester.tap(find.text('init()'));
    await tester.pump();
    expect(locked, 'A');
  });
}
