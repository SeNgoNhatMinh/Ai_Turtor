import { describe, expect, it } from 'vitest';
import {
  notificationFromRealtimeEvent,
  resolveNotificationPath,
  upsertNotification,
} from '../../src/features/notifications/notificationModel';

describe('shared notifications model', () => {
  it('builds a stored notification from the teacher reply event', () => {
    const notification = notificationFromRealtimeEvent({
      type: 'SUPPORT_ESCALATION_ANSWERED',
      entityId: 'escalation-1',
      data: {
        notificationId: 'notice-1',
        studentId: 'student-1',
        title: 'Cô Lan đã phản hồi yêu cầu hỗ trợ',
        body: 'JDK khác JRE ở điểm nào?',
        questionEscalationId: 'escalation-1',
        createdAt: '2026-11-01T00:40:00',
      },
    });

    expect(notification).toMatchObject({
      id: 'notice-1',
      title: 'Cô Lan đã phản hồi yêu cầu hỗ trợ',
      body: 'JDK khác JRE ở điểm nào?',
      questionEscalationId: 'escalation-1',
      unread: true,
    });
  });

  it('ignores support events that are not a stored reply', () => {
    expect(notificationFromRealtimeEvent({
      type: 'SUPPORT_ESCALATION_CREATED',
      data: { questionEscalationId: 'escalation-1' },
    })).toBeNull();
    expect(notificationFromRealtimeEvent({
      type: 'SUPPORT_ESCALATION_ANSWERED',
      data: { questionEscalationId: 'escalation-1' },
    })).toBeNull();
  });

  it('resolves role-specific paths from notification type', () => {
    expect(resolveNotificationPath({
      type: 'SUPPORT_REQUEST',
      linkPath: '/teacher/review-queue',
    }, 'TEACHER')).toBe('/teacher/review-queue');
    expect(resolveNotificationPath({ type: 'KNOWLEDGE_REVIEW' }, 'SENIOR_MENTOR')).toBe('/senior/review');
    expect(resolveNotificationPath({ type: 'GOLD_QA_REVIEW', courseId: 'PRJ301' }, 'SENIOR_MENTOR'))
      .toBe('/senior/v2?tab=review&courseId=PRJ301');
    expect(resolveNotificationPath({ type: 'SUPPORT_REQUEST' }, 'ADMIN')).toBe('/admin/users/escalations');
  });

  it('puts a new reply at the top and counts it unread once', () => {
    const current = {
      notifications: [{ id: 'older', title: 'Cũ', body: '', unread: false, readAt: '2026-10-01T00:00:00' }],
      unreadCount: 0,
    };
    const next = upsertNotification(current, {
      id: 'notice-1',
      title: 'Mới',
      body: 'Câu hỏi',
      unread: true,
    });

    expect(next.notifications.map((item) => item.id)).toEqual(['notice-1', 'older']);
    expect(next.unreadCount).toBe(1);
    expect(upsertNotification(next, next.notifications[0])).toBe(next);
  });
});
