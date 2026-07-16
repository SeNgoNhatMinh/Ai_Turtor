const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_REVIEW_MODES = new Set(['RAG', 'CODE', 'ESCALATE']);

export const LIMITS = {
  emailMax: 254,
  nameMax: 80,
  passwordMin: 6,
  passwordMax: 128,
  chatMax: 8000,
  feedbackMax: 2000,
  uploadMaxBytes: 25 * 1024 * 1024,
};

function sanitizeText(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function validateEmail(email) {
  const value = sanitizeText(email, LIMITS.emailMax).toLowerCase();
  if (!value) return { ok: false, message: 'Email address is required.' };
  if (!EMAIL_RE.test(value)) return { ok: false, message: 'Please enter a valid email address.' };
  return { ok: true, value };
}

function validatePassword(password) {
  const value = String(password ?? '');
  if (value.length < LIMITS.passwordMin) return { ok: false, message: 'Password must be at least 6 characters.' };
  if (value.length > LIMITS.passwordMax) return { ok: false, message: 'Password is too long.' };
  return { ok: true, value };
}

function validateFullName(fullName) {
  const value = sanitizeText(fullName, LIMITS.nameMax);
  if (!value) return { ok: false, message: 'Full name is required.' };
  if (value.length < 2) return { ok: false, message: 'Full name must be at least 2 characters.' };
  return { ok: true, value };
}

export function validateAuthForm({ email, password, fullName, isLoginView }) {
  const emailResult = validateEmail(email);
  if (!emailResult.ok) return emailResult;
  const passwordResult = validatePassword(password);
  if (!passwordResult.ok) return passwordResult;
  if (!isLoginView) {
    const nameResult = validateFullName(fullName);
    if (!nameResult.ok) return nameResult;
    return { ok: true, value: { email: emailResult.value, password: passwordResult.value, fullName: nameResult.value } };
  }
  return { ok: true, value: { email: emailResult.value, password: passwordResult.value } };
}

export function validateChatInput(input) {
  const value = sanitizeText(input, LIMITS.chatMax);
  if (!value) return { ok: false, message: 'Hãy nhập nội dung trước khi gửi.' };
  if (String(input ?? '').trim().length > LIMITS.chatMax) {
    return { ok: false, message: `Tin nhắn quá dài. Vui lòng giới hạn trong ${LIMITS.chatMax} ký tự.` };
  }
  return { ok: true, value };
}

export function normalizeReviewMode(mode) {
  if (mode === 'CODE_MENTOR') return 'CODE';
  return VALID_REVIEW_MODES.has(mode) ? mode : 'RAG';
}

export function validateFeedbackText(input) {
  const value = sanitizeText(input, LIMITS.feedbackMax);
  if (!value) return { ok: false, message: 'Hãy nhập một nội dung góp ý ngắn.' };
  return { ok: true, value };
}

export function validateUploadFile(file, allowedTypes = []) {
  if (!file) return { ok: false, message: 'Please choose a file first.' };
  if (file.size > LIMITS.uploadMaxBytes) return { ok: false, message: 'File is too large. Maximum size is 25MB.' };
  if (allowedTypes.length && !allowedTypes.includes(file.type)) {
    return { ok: false, message: 'This file type is not supported.' };
  }
  return { ok: true, value: file };
}
