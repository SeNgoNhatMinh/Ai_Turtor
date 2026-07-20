const normalizeStatus = (value) => String(value || '').trim().toUpperCase();
const getId = (value) => value?.id || value?.assignmentId || value?.quizSessionId || value?.questionEscalationId || '';
const getTime = (value) => value?.dueAt || value?.updatedAt || value?.submittedAt || value?.createdAt || '';

const newestFirst = (left, right) => new Date(getTime(right) || 0) - new Date(getTime(left) || 0);
const dueFirst = (left, right) => new Date(left?.dueAt || '9999-12-31') - new Date(right?.dueAt || '9999-12-31');

export function buildStudentNextSteps({
  assignments = [],
  submissions = [],
  quizHistory = [],
  assignedQuizzes = [],
  escalations = [],
} = {}) {
  const submissionAssignmentIds = new Set(submissions.map((item) => String(item.assignmentId || item.assignment?.id || '')));
  const attemptedAssignmentIds = new Set(quizHistory.map((item) => String(item.assignmentId || '')).filter(Boolean));
  const items = [];

  const pendingAssignment = assignments
    .filter((item) => {
      const id = String(getId(item));
      const status = normalizeStatus(item.submissionStatus || item.status);
      return id && !submissionAssignmentIds.has(id) && !['SUBMITTED', 'REVIEWED', 'COMPLETED', 'CLOSED'].includes(status);
    })
    .sort(dueFirst)[0];
  if (pendingAssignment) {
    items.push({
      key: `assignment:${getId(pendingAssignment)}`,
      kind: 'assignment',
      title: pendingAssignment.title || 'Bài tập cần hoàn thành',
      description: pendingAssignment.dueAt
        ? `Hạn nộp ${new Date(pendingAssignment.dueAt).toLocaleString('vi-VN')}`
        : 'Mở đề bài, hoàn thành và nộp tệp cho giảng viên.',
      status: 'ASSIGNED',
      tab: 'student-materials',
    });
  }

  const activeQuiz = quizHistory
    .filter((item) => normalizeStatus(item.status) === 'GENERATED')
    .sort(newestFirst)[0];
  if (activeQuiz) {
    items.push({
      key: `quiz:${getId(activeQuiz)}`,
      kind: 'quiz',
      title: activeQuiz.title || activeQuiz.topic || 'Quiz đang làm dở',
      description: 'Tiếp tục quiz từ lần học trước. Đáp án chỉ hiển thị sau khi nộp.',
      status: 'IN_PROGRESS',
      tab: 'student-quizzes',
    });
  }

  const assignedQuiz = assignedQuizzes
    .filter((item) => {
      const id = String(item.assignmentId || item.id || '');
      const status = normalizeStatus(item.status);
      return id && !attemptedAssignmentIds.has(id) && !['CLOSED', 'COMPLETED'].includes(status);
    })
    .sort(newestFirst)[0];
  if (assignedQuiz) {
    items.push({
      key: `assigned-quiz:${getId(assignedQuiz)}`,
      kind: 'assignedQuiz',
      title: assignedQuiz.title || assignedQuiz.topic || 'Quiz mới được giao',
      description: 'Giảng viên đã giao quiz này cho lớp hoặc trực tiếp cho bạn.',
      status: assignedQuiz.status || 'PUBLISHED',
      tab: 'student-quizzes',
    });
  }

  const answeredTicket = escalations
    .filter((item) => {
      const status = normalizeStatus(item.status);
      return status.includes('ANSWERED') || ['RESOLVED', 'RESOLVED_INDEXED', 'COMPLETED'].includes(status);
    })
    .sort(newestFirst)[0];
  if (answeredTicket) {
    items.push({
      key: `support:${getId(answeredTicket)}`,
      kind: 'support',
      title: answeredTicket.questionPreview || answeredTicket.question || 'Giảng viên đã phản hồi câu hỏi',
      description: 'Mở yêu cầu hỗ trợ để xem câu trả lời chính thức và trạng thái kiểm duyệt.',
      status: answeredTicket.status || 'COMPLETED',
      tab: 'student-escalation',
    });
  }

  return items.slice(0, 4);
}
