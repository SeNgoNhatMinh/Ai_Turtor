import { findPersonById, getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames.js';

const SUPPORT_LABELS = {
  HIGH_SUPPORT: 'Hướng dẫn kỹ',
  STANDARD: 'Cân bằng',
  CHALLENGE: 'Tăng thử thách',
};

export function supportLevelLabel(level) {
  const key = String(level || '').trim().toUpperCase();
  return SUPPORT_LABELS[key] || key || 'Cân bằng';
}

export function mergeRosterIdentity(record, roster = []) {
  if (!record || typeof record !== 'object') return record;
  const person = findPersonById(roster, record.studentId);
  if (!person) return record;
  return {
    ...record,
    studentName: record.studentName || person.studentName || person.fullName || person.name,
    studentCode: record.studentCode || person.studentCode,
    studentEmail: record.studentEmail || person.studentEmail || person.email,
    fullName: record.fullName || person.fullName || person.studentName || person.name,
  };
}

export function studentInitials(record) {
  const name = getPersonDisplayName(record, '');
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  const code = String(record?.studentCode || '').trim();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  if (code) return code.slice(0, 2).toUpperCase();
  return 'SV';
}

export function formatTeacherStudentLabel(record, fallback = 'Sinh viên') {
  const name = getPersonDisplayName(record, '');
  const code = String(record?.studentCode || '').trim();
  if (name && code) return `${name} · ${code}`;
  if (name) return name;
  if (code) return code;
  const email = getPersonEmail(record);
  if (email) return email;
  return fallback;
}

export function studentSearchText(record) {
  return [
    getPersonDisplayName(record, ''),
    record?.studentCode,
    getPersonEmail(record),
    record?.topic,
    record?.summaryText,
    ...(Array.isArray(record?.learnedTopics) ? record.learnedTopics : []),
    ...(Array.isArray(record?.weakTopics) ? record.weakTopics : []),
    ...(Array.isArray(record?.studiedTopics) ? record.studiedTopics : []),
    ...(Array.isArray(record?.recentQuestions) ? record.recentQuestions : []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function asTextList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function uniqueTexts(values) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}

const META_TOPIC_RE = /tóm tắt các câu hỏi|câu hỏi gần đây|improve plan|learning improvement|^code mentor:/i;

export function isMemoryMetaPhrase(text) {
  return META_TOPIC_RE.test(String(text || '').trim());
}

export function isShortStudyTopic(text) {
  const topic = String(text || '').trim();
  if (!topic || topic.length > 56 || isMemoryMetaPhrase(topic)) return false;
  return true;
}

function isGenericSessionTopic(text) {
  const topic = String(text || '').trim();
  return !topic || /^học tự do$/i.test(topic) || isMemoryMetaPhrase(topic);
}

function recordTime(record) {
  const value = record?.updatedAt || record?.completedAt || record?.startedAt
    || record?.createdAt || record?.sharedWithTeacherAt;
  if (!value) return 0;
  const date = Array.isArray(value)
    ? new Date(value[0], (value[1] || 1) - 1, value[2] || 1, value[3] || 0, value[4] || 0)
    : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortByRecency(items = []) {
  return [...items].sort((left, right) => recordTime(right) - recordTime(left));
}

export function sessionStatusLabel(status) {
  const key = String(status || '').trim().toUpperCase();
  if (key === 'ACTIVE') return 'Đang học';
  if (key === 'COMPLETED') return 'Đã tổng kết';
  if (key === 'ABANDONED') return 'Dừng giữa chừng';
  return 'Buổi học';
}

export function formatTutorWhen(value) {
  if (!value) return '';
  const date = Array.isArray(value)
    ? new Date(value[0], (value[1] || 1) - 1, value[2] || 1, value[3] || 0, value[4] || 0)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function sessionHeadline(session, fallbackTopics = []) {
  const topic = String(session?.topic || '').trim();
  if (!isGenericSessionTopic(topic)) return topic;
  const suggested = Array.isArray(session?.suggestedTopics)
    ? String(session.suggestedTopics[0] || '').trim()
    : '';
  if (suggested && !isGenericSessionTopic(suggested)) return suggested;
  const fallback = fallbackTopics.find((item) => isShortStudyTopic(item));
  if (fallback) return fallback;
  const when = formatTutorWhen(session?.updatedAt || session?.startedAt || session?.createdAt);
  return when ? `Học tự do · ${when}` : 'Học tự do';
}

export function buildClassStudentRows({
  roster = [],
  memories = [],
  sessions = [],
  summaries = [],
} = {}) {
  const memoryByStudent = new Map();
  memories.forEach((memory) => {
    const id = getPersonId(memory);
    if (id) memoryByStudent.set(id, memory);
  });
  const sessionsByStudent = new Map();
  sessions.forEach((session) => {
    const id = String(session?.studentId || getPersonId(session) || '').trim();
    if (!id) return;
    if (!sessionsByStudent.has(id)) sessionsByStudent.set(id, []);
    sessionsByStudent.get(id).push(session);
  });
  const summariesByStudent = new Map();
  summaries.forEach((summary) => {
    const id = String(summary?.studentId || getPersonId(summary) || '').trim();
    if (!id) return;
    if (!summariesByStudent.has(id)) summariesByStudent.set(id, []);
    summariesByStudent.get(id).push(summary);
  });

  return [...roster]
    .map((student) => {
      const studentId = getPersonId(student);
      const memory = memoryByStudent.get(studentId) || {};
      const studentSessions = sortByRecency(sessionsByStudent.get(studentId) || []);
      const studentSummaries = sortByRecency(summariesByStudent.get(studentId) || []);
      const learnedTopics = asTextList(memory.learnedTopics).filter(isShortStudyTopic);
      const sessionTopics = studentSessions
        .map((session) => String(session?.topic || '').trim())
        .filter(isShortStudyTopic);
      const studiedTopics = uniqueTexts([...learnedTopics, ...sessionTopics]);
      const recentQuestions = uniqueTexts(asTextList(memory.recentQuestions));
      const weakTopics = uniqueTexts(asTextList(memory.weakTopics || memory.weakAreas))
        .filter((item) => !isMemoryMetaPhrase(item));
      const latestSession = studentSessions[0] || null;
      const hasActivity = studiedTopics.length > 0
        || recentQuestions.length > 0
        || studentSessions.length > 0
        || studentSummaries.length > 0;
      return mergeRosterIdentity({
        ...student,
        studentId: student.studentId || studentId,
        memory,
        sessions: studentSessions,
        summaries: studentSummaries,
        learnedTopics,
        studiedTopics,
        recentQuestions,
        weakTopics,
        latestSession,
        hasActivity,
        activityLabel: hasActivity
          ? (latestSession
            ? `${sessionStatusLabel(latestSession.status)}: ${sessionHeadline(latestSession, studiedTopics)}`
            : `${studiedTopics.length || recentQuestions.length} nội dung đã học`)
          : 'Chưa học với AI Tutor',
      }, roster);
    })
    .sort((left, right) => (
      formatTeacherStudentLabel(left).localeCompare(formatTeacherStudentLabel(right), 'vi')
    ));
}

export function groupTutorSummariesByStudent(summaries = []) {
  const groups = [];
  const index = new Map();
  summaries.forEach((summary) => {
    const key = String(summary?.studentId || getPersonId(summary) || summary?.id || '').trim();
    if (!key) return;
    if (!index.has(key)) {
      const group = { studentId: key, student: summary, sessions: [] };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).sessions.push(summary);
  });
  return groups;
}
