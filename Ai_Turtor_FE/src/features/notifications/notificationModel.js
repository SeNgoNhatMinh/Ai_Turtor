export function normalizeNotification(item) {
  const readAt = item?.readAt || null;
  return {
    id: item?.id || item?.notificationId || '',
    type: item?.type || '',
    title: item?.title || 'Thông báo mới',
    body: item?.body || '',
    questionEscalationId: item?.questionEscalationId || '',
    courseId: item?.courseId || '',
    classId: item?.classId || '',
    linkPath: item?.linkPath || '',
    entityType: item?.entityType || '',
    entityId: item?.entityId || '',
    readAt,
    createdAt: item?.createdAt || '',
    unread: !readAt,
  };
}

export function notificationFromRealtimeEvent(event) {
  const data = event?.data || {};
  if (!data.notificationId) return null;
  return normalizeNotification({
    id: data.notificationId,
    type: data.type,
    title: data.title,
    body: data.body,
    questionEscalationId: data.questionEscalationId || event.entityId,
    courseId: data.courseId,
    classId: data.classId,
    linkPath: data.linkPath,
    entityType: data.entityType || event.entityType,
    entityId: data.entityId || event.entityId,
    createdAt: data.createdAt,
    readAt: null,
  });
}

export function upsertNotification(current, incoming) {
  const notifications = current?.notifications || [];
  if (!incoming?.id || notifications.some((item) => item.id === incoming.id)) return current;
  const next = [incoming, ...notifications].slice(0, 30);
  return {
    notifications: next,
    unreadCount: next.filter((item) => item.unread).length,
  };
}

export function resolveNotificationPath(item, accountRole) {
  if (item?.linkPath) return item.linkPath;
  const role = String(accountRole || '').toUpperCase();
  const ticketId = item?.questionEscalationId || '';
  const type = String(item?.type || '').toUpperCase();

  if (type === 'SUPPORT_REPLY' || (ticketId && role === 'STUDENT')) {
    return ticketId ? `/student/mentor-review?ticket=${encodeURIComponent(ticketId)}` : '/student/mentor-review';
  }
  if (type === 'SUPPORT_REQUEST') {
    if (role === 'ADMIN') return '/admin/users/escalations';
    return '/teacher/review-queue';
  }
  if (type === 'KNOWLEDGE_REVIEW') {
    return role === 'ADMIN' ? '/admin/indexed-teaching-notes' : '/senior/review';
  }
  if (type === 'GOLD_QA_REVIEW') {
    if (role === 'ADMIN') return '/admin/expert-training';
    const courseId = item?.courseId ? `&courseId=${encodeURIComponent(item.courseId)}` : '';
    return `/senior/v2?tab=review${courseId}`;
  }
  if (role === 'TEACHER') return '/teacher/review-queue';
  if (role === 'SENIOR_MENTOR') return '/senior/review';
  if (role === 'ADMIN') return '/admin/dashboard';
  return '/student/dashboard';
}
