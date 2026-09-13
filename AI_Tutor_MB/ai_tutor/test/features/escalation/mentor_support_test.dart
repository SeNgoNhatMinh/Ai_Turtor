import 'package:ai_tutor/core/router/routes.dart';
import 'package:ai_tutor/core/theme/app_theme.dart';
import 'package:ai_tutor/features/escalation/application/escalation_controller.dart';
import 'package:ai_tutor/features/escalation/data/mentor_support.dart';
import 'package:ai_tutor/features/escalation/presentation/escalation_screens.dart';
import 'package:ai_tutor/l10n/app_localizations.dart';
import 'package:ai_tutor/shared/models/escalation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

EscalationHistoryItem ticket({
  required String id,
  required String status,
  String? question,
  String? courseId,
  String? classId,
  String? mentorAnswer,
  String? studentVisibleStatus,
  DateTime? createdAt,
  DateTime? updatedAt,
}) {
  return EscalationHistoryItem(
    id: id,
    status: status,
    originalQuestion: question,
    questionPreview: question,
    courseId: courseId,
    classId: classId,
    mentorAnswer: mentorAnswer,
    studentVisibleStatus: studentVisibleStatus,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}

void main() {
  test('studentSupport writes a ticket query like the web inbox', () {
    expect(AppRoutes.studentSupport(), AppRoutes.escalationHistory);
    expect(
      AppRoutes.studentSupport(ticketId: 'esc-1'),
      '/s/profile/escalations?ticket=esc-1',
    );
  });

  test('classifies answered and processing tickets like web', () {
    final waiting = ticket(id: '1', status: 'PENDING_OFFER');
    final chatting = ticket(id: '2', status: 'IN_CHAT');
    final answered = ticket(id: '3', status: 'ANSWERED', mentorAnswer: 'OK');
    final answeredByStatus = ticket(id: '4', status: 'RESOLVED');
    final visibleWaiting = ticket(
      id: '5',
      status: 'INTERNAL_MATCHING',
      studentVisibleStatus: 'OFFERED',
    );

    expect(isProcessingTicket(waiting), isTrue);
    expect(isAnsweredTicket(waiting), isFalse);
    expect(isProcessingTicket(chatting), isTrue);
    expect(isLiveChatTicket(chatting), isTrue);
    expect(canOpenMentorOffer(waiting), isTrue);
    expect(canOpenMentorOffer(chatting), isFalse);
    expect(isAnsweredTicket(answered), isTrue);
    expect(isProcessingTicket(answered), isFalse);
    expect(isAnsweredTicket(answeredByStatus), isTrue);
    expect(getSupportTicketStatus(visibleWaiting), 'OFFERED');
    expect(isProcessingTicket(visibleWaiting), isTrue);
  });

  test('filters inbox tickets by status and search query', () {
    final items = [
      ticket(
        id: '1',
        status: 'PENDING_OFFER',
        question: 'Servlet init khi nào?',
        courseId: 'PRJ301',
        classId: 'SE18B',
      ),
      ticket(
        id: '2',
        status: 'ANSWERED',
        question: 'JSP include khác forward ra sao?',
        courseId: 'PRJ301',
        mentorAnswer: 'include giữ request.',
      ),
      ticket(
        id: '3',
        status: 'IN_CHAT',
        question: 'Docker compose',
        courseId: 'PRN212',
      ),
    ];

    expect(supportTicketCounts(items).all, 3);
    expect(supportTicketCounts(items).waiting, 2);
    expect(supportTicketCounts(items).answered, 1);

    expect(
      filterSupportTickets(
        items,
        filter: SupportTicketFilter.answered,
      ).map((item) => item.id),
      ['2'],
    );
    expect(
      filterSupportTickets(
        items,
        filter: SupportTicketFilter.waiting,
      ).map((item) => item.id),
      ['1', '3'],
    );
    expect(
      filterSupportTickets(items, query: 'docker').map((item) => item.id),
      ['3'],
    );
    expect(filterSupportTickets(items, query: 'se18b').map((item) => item.id), [
      '1',
    ]);
  });

  test('parses detail envelope and merges list summary', () {
    final summary = ticket(
      id: 'esc-9',
      status: 'OFFERED',
      question: 'Câu hỏi từ inbox',
      courseId: 'PRJ301',
    );
    final detail = EscalationHistoryItem.fromDetailJson({
      'studentVisibleStatus': 'OFFERED',
      'latestMentorAnswer': {'answer': 'Mentor đã trả lời.'},
      'questionEscalation': {
        'id': 'esc-9',
        'status': 'ANSWERED',
        'originalQuestion': 'Câu hỏi đầy đủ hơn',
        'aiResponse': 'AI nói A',
        'classId': 'SE18B',
      },
    });

    expect(detail.id, 'esc-9');
    expect(detail.status, 'ANSWERED');
    expect(detail.mentorAnswer, 'Mentor đã trả lời.');
    expect(detail.aiResponse, 'AI nói A');
    expect(isAnsweredTicket(detail), isTrue);

    final merged = detail.merge(summary);
    expect(merged.courseId, 'PRJ301');
    expect(merged.classId, 'SE18B');
    expect(getQuestionText(merged), 'Câu hỏi đầy đủ hơn');
  });

  test('sorts newest tickets first', () {
    final older = ticket(
      id: 'old',
      status: 'OFFERED',
      createdAt: DateTime(2026, 1, 1),
    );
    final newer = ticket(
      id: 'new',
      status: 'OFFERED',
      updatedAt: DateTime(2026, 3, 1),
    );

    expect(
      sortSupportTicketsNewestFirst([older, newer]).map((item) => item.id),
      ['new', 'old'],
    );
  });

  testWidgets('inbox lists tickets, counts, and filters like web', (
    tester,
  ) async {
    await tester.pumpWidget(_supportInboxApp(ticketId: null));
    await tester.pumpAndSettle();

    expect(find.text('Trung tâm hỗ trợ học tập'), findsOneWidget);
    expect(find.text('1 đang xử lý'), findsOneWidget);
    expect(find.text('1 đã phản hồi'), findsOneWidget);
    expect(find.text('Servlet init khi nào?'), findsOneWidget);
    expect(find.text('JSP include'), findsOneWidget);

    await tester.tap(find.text('Đã phản hồi').first);
    await tester.pumpAndSettle();
    expect(find.text('JSP include'), findsOneWidget);
    expect(find.text('Servlet init khi nào?'), findsNothing);
  });

  testWidgets('deep link ticket= opens the in-app ticket detail', (
    tester,
  ) async {
    await tester.pumpWidget(_supportInboxApp(ticketId: '1'));
    await tester.pumpAndSettle();

    expect(find.text('Chi tiết yêu cầu'), findsWidgets);
    expect(find.text('Servlet init khi nào?'), findsOneWidget);
    expect(find.text('Câu trả lời AI trước đó'), findsOneWidget);
    expect(find.text('Chọn giảng viên'), findsOneWidget);
  });
}

Widget _supportInboxApp({String? ticketId}) {
  return ProviderScope(
    overrides: [
      escalationHistoryControllerProvider.overrideWith(_FakeSupportHistory.new),
      escalationDetailControllerProvider.overrideWith(_FakeSupportDetail.new),
    ],
    child: MaterialApp.router(
      theme: buildAppTheme(),
      locale: const Locale('vi'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: GoRouter(
        initialLocation: ticketId == null
            ? AppRoutes.escalationHistory
            : AppRoutes.studentSupport(ticketId: ticketId),
        routes: [
          GoRoute(
            path: AppRoutes.escalationHistory,
            builder: (_, state) => EscalationHistoryScreen(
              ticketId: state.uri.queryParameters['ticket'],
            ),
          ),
        ],
      ),
    ),
  );
}

class _FakeSupportHistory extends EscalationHistoryController {
  @override
  Future<List<EscalationHistoryItem>> build() async {
    return [
      ticket(
        id: '1',
        status: 'PENDING_OFFER',
        question: 'Servlet init khi nào?',
        courseId: 'PRJ301',
        classId: 'SE18B',
      ),
      ticket(
        id: '2',
        status: 'ANSWERED',
        question: 'JSP include',
        mentorAnswer: 'include giữ request.',
      ),
    ];
  }
}

class _FakeSupportDetail extends EscalationDetailController {
  @override
  Future<EscalationHistoryItem> build(String escalationId) async {
    return ticket(
      id: escalationId,
      status: 'PENDING_OFFER',
      question: 'Servlet init khi nào?',
      courseId: 'PRJ301',
      classId: 'SE18B',
    ).merge(
      const EscalationHistoryItem(
        id: '1',
        status: 'PENDING_OFFER',
        aiResponse: 'AI nói A',
      ),
    );
  }
}
