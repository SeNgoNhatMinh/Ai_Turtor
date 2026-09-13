import 'package:ai_tutor/features/ai_tutor/data/tutor_session.dart';
import 'package:ai_tutor/features/ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:ai_tutor/shared/models/course.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses the tutor-session opening payload like web', () {
    final opened = TutorSessionOpenResult.fromJson({
      'conversationId': 'conv-1',
      'resumed': true,
      'openingMessage': {
        'messageId': 'open-1',
        'content':
            '## Chào mừng bạn đến với môn OSG2022 (Modern Operating Systems)\n\n'
            '### Bắt đầu học một phần của môn\n'
            '- 1.1 WHAT IS AN OPERATING SYSTEM?',
        'proactive': true,
      },
    });

    expect(opened.conversationId, 'conv-1');
    expect(opened.resumed, isTrue);
    expect(opened.openingMessage, isNotNull);
    expect(opened.openingMessage!.proactive, isTrue);
    expect(
      opened.openingMessage!.content,
      contains('Chào mừng bạn đến với môn OSG2022'),
    );
    expect(parseOpeningMessage(<String, dynamic>{}), isNull);
  });

  test('seeds the welcome turn into an empty chat', () {
    final opening = parseOpeningMessage({
      'messageId': 'open-1',
      'content': '## Chào mừng bạn đến với môn PRJ301',
    })!;
    final seeded = seedOpeningMessage(const [], opening);

    expect(seeded, hasLength(1));
    expect(seeded.first.id, 'open-1');
    expect(isWelcomeTutorTurn(seeded.first), isTrue);
  });

  test('does not treat a normal answer as the welcome turn', () {
    const answer = AiMessage(
      id: 'ai-2',
      content: 'Servlet gọi init() trước.',
      isUser: false,
    );
    expect(
      isWelcomeTutorTurn(answer, precedingUserQuestion: 'Servlet là gì?'),
      isFalse,
    );
    expect(isWelcomeTutorTurn(answer), isFalse);
  });

  testWidgets('first-visit opening placeholder lays out inside a list', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ListView(children: const [AiChatOpeningPlaceholder()]),
        ),
      ),
    );

    expect(find.text(AiChatOpeningPlaceholder.title), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('empty chat uses the web mascot artwork', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AiChatPromptStarters(onSelect: (_) {})),
      ),
    );

    expect(find.byType(TutorMascot), findsOneWidget);
    expect(find.text(AiChatPromptStarters.title), findsOneWidget);
    final image = tester.widget<Image>(find.byType(Image));
    expect((image.image as AssetImage).assetName, 'assets/images/mascot.jpg');
  });

  test('first-time course has no student chat history', () {
    expect(hasStudentChattedCourse(const []), isFalse);
    expect(
      hasStudentChattedCourse(const [
        AiConversation(id: 'c1', title: 'Mới', messageCount: 0),
        AiConversation(
          id: 'c2',
          title: 'Chỉ lời chào',
          messageCount: 1,
          userQuestionCount: 0,
          courseId: 'OSG202',
        ),
      ], courseCode: 'OSG202'),
      isFalse,
    );
  });

  test('returning course is detected from prior student questions', () {
    expect(
      hasStudentChattedCourse(const [
        AiConversation(
          id: 'c1',
          title: 'OSG',
          userQuestionCount: 3,
          messageCount: 6,
          courseId: 'OSG202',
        ),
      ], courseCode: 'OSG202'),
      isTrue,
    );
    expect(
      hasStudentChattedCourse(const [
        AiConversation(
          id: 'other',
          title: 'PRJ',
          userQuestionCount: 4,
          courseId: 'PRJ301',
        ),
      ], courseCode: 'OSG202'),
      isFalse,
    );
  });

  test('welcome opening lists lesson starters like web', () {
    final opening = buildCourseWelcomeOpening(
      courseLabel: 'OSG202',
      courseName: 'Modern Operating Systems',
      lessonStarters: const [
        '1.1 WHAT IS AN OPERATING SYSTEM?',
        '1.2 HISTORY OF OPERATING SYSTEMS',
      ],
    );
    expect(opening.proactive, isTrue);
    expect(opening.content, contains('Chào mừng bạn đến với môn OSG202'));
    expect(opening.content, contains('Bắt đầu học một phần của môn'));
    expect(opening.content, contains('1.1 WHAT IS AN OPERATING SYSTEM?'));
  });

  test('welcome always keeps the web learning-path section', () {
    final opening = buildCourseWelcomeOpening(courseLabel: 'DBI202');

    expect(opening.content, contains('Bắt đầu học một phần của môn'));
    expect(opening.content, contains('- phần mở đầu môn DBI202'));
    expect(opening.content, contains('Chọn một gợi ý ở trên để bắt đầu học'));
    expect(opening.content, isNot(contains('Nhập chủ đề bạn muốn bắt đầu')));
  });

  test('course enrollment resolves classCode exactly like web', () {
    final course = Course.fromJson({
      'courseId': 'DBI202',
      'courseName': 'Database Systems',
      'classCode': 'DBI202-01',
      'classId': 'internal-class-id',
    });

    expect(course.id, 'DBI202');
    expect(course.classId, 'DBI202-01');
  });

  test('pickOpeningLessonStarters skips front matter', () {
    expect(
      pickOpeningLessonStarters(const [
        'About the Author',
        '1.1 WHAT IS AN OPERATING SYSTEM?',
        '0.1 Outline of the Book',
      ]),
      ['1.1 WHAT IS AN OPERATING SYSTEM?'],
    );
  });

  test('first-visit rule is the same for every course code', () {
    const codes = ['CEA201', 'OSG202', 'PRJ301', 'MAD101'];
    for (final code in codes) {
      expect(
        hasStudentChattedCourse(const [
          AiConversation(id: 'empty', title: 'Mới', messageCount: 0),
        ], courseCode: code),
        isFalse,
        reason: '$code chưa chat thì phải ra lời chào, không ra gợi ý',
      );
      expect(
        hasStudentChattedCourse([
          AiConversation(
            id: 'asked-$code',
            title: code,
            userQuestionCount: 2,
            messageCount: 4,
            courseId: code,
          ),
        ], courseCode: code),
        isTrue,
        reason: '$code đã chat thì cuộc mới ra gợi ý',
      );
    }
  });

  test('does not treat another course or unscoped chats as this course', () {
    expect(
      hasStudentChattedCourse(const [
        AiConversation(
          id: 'osg',
          title: 'OSG',
          userQuestionCount: 6,
          messageCount: 12,
        ),
        AiConversation(
          id: 'prj',
          title: 'PRJ',
          userQuestionCount: 4,
          courseId: 'PRJ301',
        ),
      ], courseCode: 'CEA201'),
      isFalse,
    );
    expect(resolveTutorClassId(className: 'CEA201-01'), 'CEA201-01');
  });

  test('parses tutor session object from open payload', () {
    final opened = TutorSessionOpenResult.fromJson({
      'conversationId': 'conv-9',
      'resumed': true,
      'session': {
        'id': 'sess-1',
        'studentId': 'sv1',
        'courseId': 'PRJ301',
        'status': 'ACTIVE',
        'phase': 'TEACH',
        'supportLevel': 'STANDARD',
        'suggestedTopics': ['Bài 1 Inheritance', 'Bài 2 Servlet'],
      },
    });

    expect(opened.session?.id, 'sess-1');
    expect(opened.session?.phase, 'TEACH');
    expect(opened.session?.suggestedTopics, hasLength(2));
    expect(
      composerTopicsForSession(sessionTopics: opened.session!.suggestedTopics),
      ['Bài 1 Inheritance', 'Bài 2 Servlet'],
    );
  });

  test('merges later session phase and topics', () {
    const current = TutorSessionState(
      id: 'sess-1',
      phase: 'OPEN',
      supportLevel: 'STANDARD',
    );
    final next = current.merge(
      const TutorSessionState(
        id: 'sess-1',
        phase: 'PRACTICE',
        suggestedTopics: ['Ôn lại MVC'],
      ),
    );
    expect(next.phase, 'PRACTICE');
    expect(next.suggestedTopics, ['Ôn lại MVC']);
  });

  testWidgets('session strip shows phase and next-session action', (
    tester,
  ) async {
    var started = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AiChatTutorSessionStrip(
            dailyQuotaExhausted: false,
            phase: 'TEACH',
            supportLevel: 'HIGH_SUPPORT',
            status: 'COMPLETED',
            summaryText: 'Đã học inheritance.',
            onStartNext: () => started = true,
          ),
        ),
      ),
    );

    expect(find.text(AiChatTutorSessionStrip.companionTitle), findsOneWidget);
    expect(find.text(AiChatTutorSessionStrip.completedHint), findsOneWidget);
    expect(find.text('Đã học inheritance.'), findsOneWidget);
    await tester.tap(find.text(AiChatTutorSessionStrip.startNextLabel));
    expect(started, isTrue);
  });
}
