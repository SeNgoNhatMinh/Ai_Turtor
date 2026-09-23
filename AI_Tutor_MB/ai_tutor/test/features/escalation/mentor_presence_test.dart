import 'package:ai_tutor/core/network/realtime_event.dart';
import 'package:ai_tutor/features/escalation/application/escalation_controller.dart';
import 'package:ai_tutor/shared/models/escalation.dart';
import 'package:ai_tutor/shared/widgets/mentor_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses and preserves mentor online status for class teacher route', () {
    final offer = EscalationOffer.fromJson({
      'id': 'esc-1',
      'route': 'CLASS_TEACHER',
      'mentors': [
        {'id': 'teacher-1', 'fullName': 'Giảng viên A', 'online': true},
      ],
    });

    expect(offer.mentors.single.online, isTrue);
    expect(offer.mentors.single.isClassTeacher, isTrue);
  });

  test('applies only matching teacher presence realtime events', () {
    const offer = EscalationOffer(
      questionEscalationId: 'esc-1',
      route: 'MENTOR_MATCHING',
      mentors: [
        MentorCandidate(id: 'teacher-1', fullName: 'Giảng viên A'),
        MentorCandidate(id: 'teacher-2', fullName: 'Giảng viên B'),
      ],
    );

    final updated = applyTeacherPresenceEvent(
      offer,
      const RealtimeEvent(
        type: 'TEACHER_PRESENCE_CHANGED',
        entityId: 'teacher-1',
        status: 'ONLINE',
        data: {'teacherId': 'teacher-1', 'online': true},
      ),
    );

    expect(updated.mentors.first.online, isTrue);
    expect(updated.mentors.last.online, isFalse);
    expect(
      applyTeacherPresenceEvent(
        updated,
        const RealtimeEvent(type: 'CHAT_MESSAGE_CREATED'),
      ),
      same(updated),
    );
  });

  testWidgets('shows presence-aware mentor action and keeps card selectable', (
    tester,
  ) async {
    var selected = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MentorCard(
            mentor: const MentorCandidate(
              id: 'teacher-1',
              fullName: 'Giảng viên A',
              online: false,
            ),
            onSelect: () => selected = true,
          ),
        ),
      ),
    );

    expect(find.text('Offline'), findsOneWidget);
    expect(find.text('Gửi yêu cầu đến giảng viên'), findsOneWidget);
    expect(find.textContaining('Yêu cầu vẫn được gửi'), findsOneWidget);

    await tester.tap(find.byType(MentorCard));
    expect(selected, isTrue);
  });
}
