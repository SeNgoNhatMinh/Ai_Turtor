import 'package:ai_tutor/features/ai_tutor/application/ai_tutor_controller.dart';
import 'package:ai_tutor/core/theme/app_colors.dart';
import 'package:ai_tutor/features/ai_tutor/data/understanding_check.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/understanding_check_quiz.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('history refresh preserves the locked quiz grade and answer key', () {
    const previous = AiMessage(
      id: 'assistant-1',
      content: 'Quiz',
      isUser: false,
      understandingSelectedKey: 'D',
      understandingCheckAttempts: [
        UnderstandingCheckAttemptRecord(
          quizIndex: 0,
          attemptId: 'attempt-1',
          selectedKey: 'D',
          correct: false,
          check: {
            'question': 'Which interface?',
            'correctKey': 'C',
            'explanation': 'HttpJspPage is correct.',
          },
        ),
      ],
    );
    const fetched = AiMessage(
      id: 'assistant-1',
      content: 'Quiz',
      isUser: false,
      understandingCheckAttempts: [
        UnderstandingCheckAttemptRecord(
          quizIndex: 0,
          attemptId: 'attempt-1',
          selectedKey: 'D',
          correct: false,
          check: {
            'question': 'Which interface?',
            'correctKey': '',
            'explanation': '',
          },
        ),
      ],
    );

    final merged = preserveUnderstandingCheckState(
      previous: const [previous],
      fetched: const [fetched],
    ).single;

    expect(merged.understandingSelectedKey, 'D');
    expect(merged.understandingCheckAttempts, hasLength(1));
    expect(merged.understandingCheckAttempts.single.check?['correctKey'], 'C');
    expect(
      merged.understandingCheckAttempts.single.check?['explanation'],
      'HttpJspPage is correct.',
    );
  });

  test('parses separately persisted attempts for every quiz index', () {
    final message = AiMessage.fromJson({
      'messageId': 'message-1',
      'role': 'ASSISTANT',
      'content': 'Quiz',
      'understandingCheckAttempts': [
        {
          'quizIndex': 0,
          'attemptId': 'attempt-1',
          'selectedKey': 'A',
          'correct': true,
        },
        {
          'quizIndex': 1,
          'attemptId': 'attempt-2',
          'selectedKey': 'B',
          'correct': false,
        },
      ],
    });

    expect(message.understandingCheckAttempts, hasLength(2));
    expect(message.understandingCheckAttempts[1].quizIndex, 1);
    expect(message.understandingCheckAttempts[1].attemptId, 'attempt-2');
    expect(message.understandingCheckAttempts[1].correct, isFalse);
  });

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

  test('preserves technical option text wrapped as Markdown code', () {
    final quiz = parseUnderstandingQuiz('''
Câu hỏi: Toán tử nào được dùng để lấy địa chỉ của một biến?
A. `*`
B. `&`
C. `=`
Đáp án: B
Giải thích: Toán tử `&` lấy địa chỉ của biến.
''');

    expect(quiz, isNotNull);
    expect(quiz!.options.map((item) => item.text).toSet(), {'*', '&', '='});
    expect(quiz.optionFor(quiz.correctKey)?.text, '&');
    expect(quiz.explanation, 'Toán tử & lấy địa chỉ của biến.');
  });

  test(
    'preserves punctuation in technical answers while removing only wrappers',
    () {
      final quiz = parseUnderstandingQuiz('''
Question: Which declaration is valid?
A. `int *p`
B. `!=`
C. `_value`
D. `a[i]`
Answer: A
''');

      expect(quiz, isNotNull);
      expect(quiz!.options.map((item) => item.text).toSet(), {
        'int *p',
        '!=',
        '_value',
        'a[i]',
      });
      expect(quiz.optionFor(quiz.correctKey)?.text, 'int *p');
    },
  );

  test(
    'keeps the correct answer mapped to its option after deterministic shuffle',
    () {
      final quiz = parseUnderstandingQuiz('''
Question: Which operator takes an address?
A. `*`
B. `&`
C. `=`
Answer: B
''');

      expect(quiz, isNotNull);
      expect(quiz!.optionFor(quiz.correctKey)?.text, '&');
    },
  );

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

  test('parses a trailing lone letter after the options', () {
    final quiz = parseUnderstandingQuiz('''
Câu hỏi: Lần lặp thứ hai lấy giá trị nào?
A. apple
B. banana
C. cherry
B
''');
    expect(quiz, isNotNull);
    expect(quiz!.optionFor(quiz.correctKey)?.text, 'banana');
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

  test('extracts every understanding quiz from one assistant answer', () {
    final extracted = extractUnderstandingCheck('''
## Bài học
Servlet có một vòng đời xác định.

## Kiểm tra hiểu
Câu hỏi: Phương thức nào chạy khi khởi tạo Servlet?
A. init()
B. service()
Đáp án: A

## Kiểm tra hiểu
Câu hỏi: Phương thức nào xử lý request?
A. destroy()
B. service()
Đáp án: B

## Bài tiếp theo
- Filter chain
''');

    expect(extracted.quizzes, hasLength(2));
    expect(extracted.quizzes[0].question, contains('khởi tạo Servlet'));
    expect(extracted.quizzes[1].question, contains('xử lý request'));
    expect(extracted.after, contains('Bài tiếp theo'));
  });

  test('builds one remediation prompt for all incorrect quiz items', () {
    const first = UnderstandingQuiz(
      question: 'Servlet khởi tạo bằng phương thức nào?',
      options: [
        UnderstandingOption(key: 'A', text: 'service()'),
        UnderstandingOption(key: 'B', text: 'init()'),
      ],
      correctKey: 'B',
    );
    const second = UnderstandingQuiz(
      question: 'Servlet xử lý request bằng phương thức nào?',
      options: [
        UnderstandingOption(key: 'A', text: 'service()'),
        UnderstandingOption(key: 'B', text: 'destroy()'),
      ],
      correctKey: 'A',
    );

    final prompt = buildIncorrectAnswersRemediationPrompt([
      UnderstandingRemediationAttempt(
        quizIndex: 0,
        quiz: first,
        selected: first.optionFor('A')!,
        grade: const UnderstandingCheckGrade(
          quizIndex: 0,
          selectedKey: 'A',
          correct: false,
          correctKey: 'B',
          attemptId: 'attempt-1',
        ),
      ),
      UnderstandingRemediationAttempt(
        quizIndex: 1,
        quiz: second,
        selected: second.optionFor('B')!,
        grade: const UnderstandingCheckGrade(
          quizIndex: 1,
          selectedKey: 'B',
          correct: false,
          correctKey: 'A',
          attemptId: 'attempt-2',
        ),
      ),
    ]);

    expect(prompt, contains('2 câu trả lời chưa đúng'));
    expect(prompt, contains('Câu 1:'));
    expect(prompt, contains('Câu 2:'));
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
            onLockAnswer: (key, attempt) {
              locked = key;
              return UnderstandingCheckGrade(
                quizIndex: 0,
                selectedKey: key,
                correct: attempt.isCorrect,
                correctKey: attempt.quiz.correctKey,
                explanation: attempt.quiz.explanation,
              );
            },
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

  testWidgets('restored grade keeps correct and incorrect option colors', (
    tester,
  ) async {
    const quiz = UnderstandingQuiz(
      question: 'Default page variable uses which interface?',
      options: [
        UnderstandingOption(key: 'C', text: 'HttpJspPage'),
        UnderstandingOption(key: 'D', text: 'java.sql.Connection'),
      ],
    );
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: UnderstandingCheckQuiz(
            quiz: quiz,
            lockedKey: 'D',
            restoredGrade: UnderstandingCheckGrade(
              quizIndex: 0,
              selectedKey: 'D',
              correct: false,
              correctKey: 'C',
              correctOptionText: 'HttpJspPage',
            ),
          ),
        ),
      ),
    );

    final correctMaterial = tester.widget<Material>(
      find
          .ancestor(
            of: find.text('HttpJspPage'),
            matching: find.byType(Material),
          )
          .first,
    );
    final wrongMaterial = tester.widget<Material>(
      find
          .ancestor(
            of: find.text('java.sql.Connection'),
            matching: find.byType(Material),
          )
          .first,
    );
    expect(correctMaterial.color, AppColors.successBg);
    expect(wrongMaterial.color, AppColors.errorBg);
  });

  testWidgets('exhausted quota keeps quiz visible but blocks new answers', (
    tester,
  ) async {
    var submissions = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: UnderstandingCheckQuiz(
            enabled: false,
            quiz: const UnderstandingQuiz(
              question: 'Servlet khởi tạo bằng phương thức nào?',
              options: [
                UnderstandingOption(key: 'A', text: 'service()'),
                UnderstandingOption(key: 'B', text: 'init()'),
              ],
              correctKey: 'B',
            ),
            onLockAnswer: (key, attempt) {
              submissions += 1;
              return null;
            },
          ),
        ),
      ),
    );

    expect(find.text('Servlet khởi tạo bằng phương thức nào?'), findsOneWidget);
    expect(find.textContaining('Đã hết lượt đặt câu hỏi'), findsOneWidget);
    await tester.tap(find.text('service()'));
    await tester.pump();
    expect(submissions, 0);
    expect(find.textContaining('Bạn chọn'), findsNothing);
  });

  test('builds a focused remediation prompt for an incorrect answer', () {
    const quiz = UnderstandingQuiz(
      question: 'Trong vòng lặp for, biến lặp được cập nhật như thế nào?',
      options: [
        UnderstandingOption(
          key: 'A',
          text: 'Chỉ được khởi tạo một lần trước vòng lặp',
        ),
        UnderstandingOption(
          key: 'B',
          text: 'Được thay đổi tự động cho mỗi phần tử trong tập hợp',
        ),
      ],
      correctKey: 'B',
      explanation:
          'Biến lặp tự động nhận từng phần tử trong tập hợp được lặp qua.',
    );

    final prompt = buildIncorrectAnswerRemediationPrompt(
      quiz,
      quiz.optionFor('A')!,
    );

    expect(
      prompt,
      'Ôn lại sau câu trả lời chưa đúng.\n'
      'Câu hỏi trọng tâm: ${quiz.question}',
    );
    expect(prompt, isNot(contains(quiz.optionFor('A')!.text)));
    expect(prompt, isNot(contains(quiz.optionFor('B')!.text)));
    expect(prompt, isNot(contains(quiz.explanation)));
  });
}
