const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_REVIEW_MODES = new Set(['RAG', 'CODE', 'ESCALATE']);

export const LIMITS = {
  emailMax: 254,
  nameMax: 80,
  passwordMin: 6,
  passwordMax: 128,
  chatMax: 4000,
  codeMax: 12000,
  codeMaxLines: 100,
  feedbackMax: 2000,
  uploadMaxBytes: 25 * 1024 * 1024,
};

function sanitizeText(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function validateEmail(email) {
  const value = sanitizeText(email, LIMITS.emailMax).toLowerCase();
  if (!value) return { ok: false, message: 'Email là bắt buộc.' };
  if (!EMAIL_RE.test(value)) return { ok: false, message: 'Hãy nhập địa chỉ email hợp lệ.' };
  return { ok: true, value };
}

function validatePassword(password) {
  const value = String(password ?? '');
  if (value.length < LIMITS.passwordMin) return { ok: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' };
  if (value.length > LIMITS.passwordMax) return { ok: false, message: 'Mật khẩu quá dài.' };
  return { ok: true, value };
}

function validateFullName(fullName) {
  const value = sanitizeText(fullName, LIMITS.nameMax);
  if (!value) return { ok: false, message: 'Họ và tên là bắt buộc.' };
  if (value.length < 2) return { ok: false, message: 'Họ và tên phải có ít nhất 2 ký tự.' };
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
    return { ok: false, message: `Câu hỏi quá dài. Vui lòng giới hạn trong ${LIMITS.chatMax} ký tự.` };
  }
  return { ok: true, value };
}

export function validateCodeInput(input) {
  const value = String(input ?? '').trim();
  if (!value) return { ok: false, message: 'Hãy dán mã nguồn trước khi gửi Code Mentor.' };
  if (value.length > LIMITS.codeMax) {
    return { ok: false, message: `Mã nguồn quá dài. Vui lòng giới hạn trong ${LIMITS.codeMax} ký tự.` };
  }
  const lineCount = value.split(/\r\n|\r|\n/).length;
  if (lineCount > LIMITS.codeMaxLines) {
    return { ok: false, message: `Mã nguồn quá dài. Vui lòng giới hạn trong ${LIMITS.codeMaxLines} dòng.` };
  }
  return { ok: true, value };
}

export function validateOptionalCodeInput(input) {
  const value = String(input ?? '').trim();
  if (!value) return { ok: true, value: '' };
  return validateCodeInput(value);
}

export function validateCodeMentorRequest(payload = {}) {
  const question = payload.question ?? payload.message;
  if (question != null && String(question).trim()) {
    const questionValidation = validateChatInput(question);
    if (!questionValidation.ok) return questionValidation;
  }

  const code = payload.codeSnippet ?? payload.code;
  const codeValidation = validateCodeInput(code);
  if (!codeValidation.ok) return codeValidation;

  return {
    ok: true,
    value: {
      ...payload,
      ...(payload.question !== undefined ? { question: String(payload.question).trim() } : {}),
      ...(payload.message !== undefined ? { message: String(payload.message).trim() } : {}),
      ...(payload.codeSnippet !== undefined ? { codeSnippet: codeValidation.value } : {}),
      ...(payload.code !== undefined ? { code: codeValidation.value } : {}),
    },
  };
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
  if (!file) return { ok: false, message: 'Hãy chọn tệp trước.' };
  if (file.size > LIMITS.uploadMaxBytes) return { ok: false, message: 'Tệp quá lớn. Dung lượng tối đa là 25 MB.' };
  if (allowedTypes.length && !allowedTypes.includes(file.type)) {
    return { ok: false, message: 'Định dạng tệp này không được hỗ trợ.' };
  }
  return { ok: true, value: file };
}
