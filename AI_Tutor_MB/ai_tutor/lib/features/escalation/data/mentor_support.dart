import '../../../shared/models/escalation.dart';

enum SupportTicketFilter { all, waiting, answered }

const answeredSupportStatuses = {
  'ANSWERED',
  'ANSWERED_PENDING_SENIOR_REVIEW',
  'ANSWERED_NO_KNOWLEDGE_CANDIDATE',
  'ANSWERED_KNOWLEDGE_REJECTED',
  'MENTOR_ANSWERED',
  'MENTOR_ANSWERED_PENDING_SENIOR_REVIEW',
  'RESOLVED',
  'RESOLVED_INDEXED',
  'AI_BRAIN_UPDATED',
  'COMPLETED',
  'CLOSED',
};

const processingSupportStatuses = {
  '',
  'PENDING',
  'PENDING_OFFER',
  'WAITING_FOR_MENTOR',
  'OFFERED',
  'MENTOR_SELECTED',
  'ASSIGNED',
  'IN_CHAT',
  'CHAT_ACTIVE',
};

const liveChatSupportStatuses = {'IN_CHAT', 'CHAT_ACTIVE', 'MENTOR_SELECTED'};

const mentorOfferSupportStatuses = {
  'PENDING',
  'PENDING_OFFER',
  'WAITING_FOR_MENTOR',
  'OFFERED',
};

String normalizeSupportStatus(String? status) =>
    (status ?? '').trim().toUpperCase();

String getSupportTicketStatus(EscalationHistoryItem ticket) {
  final workflowStatus = normalizeSupportStatus(ticket.status);
  if (answeredSupportStatuses.contains(workflowStatus) ||
      workflowStatus.contains('ANSWERED')) {
    return workflowStatus;
  }
  final visible = normalizeSupportStatus(ticket.studentVisibleStatus);
  return visible.isNotEmpty ? visible : workflowStatus;
}

String getMentorAnswer(EscalationHistoryItem ticket) =>
    ticket.mentorAnswer?.trim() ?? '';

String getAssignedMentor(EscalationHistoryItem ticket) =>
    ticket.mentorName?.trim() ?? '';

String getQuestionText(EscalationHistoryItem ticket) {
  for (final value in [ticket.originalQuestion, ticket.questionPreview]) {
    final text = value?.trim() ?? '';
    if (text.isNotEmpty) return text;
  }
  return 'Không có nội dung câu hỏi.';
}

String getAiSnapshot(EscalationHistoryItem ticket) =>
    ticket.aiResponse?.trim() ?? '';

bool isAnsweredTicket(EscalationHistoryItem ticket) {
  final status = getSupportTicketStatus(ticket);
  return getMentorAnswer(ticket).isNotEmpty ||
      answeredSupportStatuses.contains(status) ||
      status.contains('ANSWERED');
}

bool isProcessingTicket(EscalationHistoryItem ticket) {
  if (isAnsweredTicket(ticket)) return false;
  return processingSupportStatuses.contains(getSupportTicketStatus(ticket));
}

bool isLiveChatTicket(EscalationHistoryItem ticket) {
  return liveChatSupportStatuses.contains(getSupportTicketStatus(ticket));
}

bool canOpenMentorOffer(EscalationHistoryItem ticket) {
  if (isAnsweredTicket(ticket) || isLiveChatTicket(ticket)) return false;
  return mentorOfferSupportStatuses.contains(getSupportTicketStatus(ticket));
}

bool ticketMatchesQuery(EscalationHistoryItem ticket, String query) {
  final needle = query.trim().toLowerCase();
  if (needle.isEmpty) return true;
  final haystacks = [
    ticket.originalQuestion,
    ticket.questionPreview,
    ticket.courseId,
    ticket.classId,
    ticket.status,
    ticket.mentorName,
  ];
  return haystacks.any((value) => (value ?? '').toLowerCase().contains(needle));
}

List<EscalationHistoryItem> filterSupportTickets(
  List<EscalationHistoryItem> tickets, {
  SupportTicketFilter filter = SupportTicketFilter.all,
  String query = '',
}) {
  return tickets.where((ticket) {
    if (filter == SupportTicketFilter.waiting && !isProcessingTicket(ticket)) {
      return false;
    }
    if (filter == SupportTicketFilter.answered && !isAnsweredTicket(ticket)) {
      return false;
    }
    return ticketMatchesQuery(ticket, query);
  }).toList();
}

({int all, int waiting, int answered}) supportTicketCounts(
  List<EscalationHistoryItem> tickets,
) {
  return (
    all: tickets.length,
    waiting: tickets.where(isProcessingTicket).length,
    answered: tickets.where(isAnsweredTicket).length,
  );
}

List<EscalationHistoryItem> sortSupportTicketsNewestFirst(
  List<EscalationHistoryItem> tickets,
) {
  final sorted = [...tickets];
  sorted.sort((a, b) {
    final at = a.updatedAt ?? a.createdAt;
    final bt = b.updatedAt ?? b.createdAt;
    if (at == null && bt == null) return 0;
    if (at == null) return 1;
    if (bt == null) return -1;
    return bt.compareTo(at);
  });
  return sorted;
}

EscalationHistoryItem? findSupportTicket(
  List<EscalationHistoryItem> tickets,
  String? ticketId,
) {
  final id = ticketId?.trim() ?? '';
  if (id.isEmpty) return null;
  for (final ticket in tickets) {
    if (ticket.id == id) return ticket;
  }
  return null;
}
