export const ACCOUNT_ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  SENIOR_MENTOR: 'SENIOR_MENTOR',
  ADMIN: 'ADMIN',
});

const ACCOUNT_ROLE_VALUES = Object.freeze(Object.values(ACCOUNT_ROLES));
const ACCOUNT_ROLE_SET = new Set(ACCOUNT_ROLE_VALUES);
const warnedLegacyRoles = new Set();

const WORKSPACES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
});

const ROLE_ALIASES = Object.freeze({
  STUDENT: ACCOUNT_ROLES.STUDENT,
  USER: ACCOUNT_ROLES.STUDENT,
  TEACHER: ACCOUNT_ROLES.TEACHER,
  MENTOR: ACCOUNT_ROLES.TEACHER,
  SENIOR_MENTOR: ACCOUNT_ROLES.SENIOR_MENTOR,
  SENIOR_MENTOR_ROLE: ACCOUNT_ROLES.SENIOR_MENTOR,
  ADMIN: ACCOUNT_ROLES.ADMIN,
});

export function normalizeAccountRole(role, fallback = ACCOUNT_ROLES.STUDENT) {
  const normalized = String(role || '')
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, '')
    .replace(/[\s-]+/g, '_');

  if (
    import.meta.env.DEV
    && normalized
    && !ACCOUNT_ROLE_SET.has(normalized)
    && !warnedLegacyRoles.has(normalized)
  ) {
    warnedLegacyRoles.add(normalized);
    console.warn(
      `[roles] Legacy or unknown account role "${normalized}" was normalized to "${ROLE_ALIASES[normalized] || fallback}". `
      + 'Canonical account roles are STUDENT, TEACHER, SENIOR_MENTOR, and ADMIN.',
    );
  }

  return ROLE_ALIASES[normalized] || fallback;
}

export function getWorkspaceRole(role) {
  const accountRole = normalizeAccountRole(role);
  if (accountRole === ACCOUNT_ROLES.ADMIN) return WORKSPACES.ADMIN;
  if ([ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.SENIOR_MENTOR].includes(accountRole)) return WORKSPACES.TEACHER;
  return WORKSPACES.STUDENT;
}

// ChatRoom senderRole is a transport label, not the authenticated account role.
export function getChatSenderRole(role) {
  const accountRole = normalizeAccountRole(role);
  return accountRole === ACCOUNT_ROLES.STUDENT ? 'STUDENT' : 'MENTOR';
}
