export const AI_SERVICE_ERROR_MESSAGE = [
  'AI Tutor chưa thể kết nối tới mô hình ngôn ngữ lúc này.',
  '',
  'Bạn có thể thử lại sau ít phút hoặc gửi câu hỏi cho giảng viên hỗ trợ.',
].join('\n');

const MOJIBAKE_PATTERN = /(LÃ|Lá»|Æ°|á»|áº|Ã²|Ã¡|Ãª|Ã´|Ä‘)/i;

const AI_SERVICE_ERROR_PATTERNS = [
  /chưa thể gọi dịch vụ llm/i,
  /chua the goi dich vu llm/i,
  /dịch vụ llm/i,
  /dich vu llm/i,
  /language model.*(failed|error|unavailable|timeout|timed out)/i,
  /llm.*(failed|error|unavailable|timeout|timed out|máy chủ|may chu)/i,
  /(failed|error|unavailable|timeout|timed out).*llm/i,
  /ai tutor service is temporarily unavailable/i,
  /ai tutor could not reach the language model/i,
];

const TECHNICAL_ERROR_PATTERNS = [
  /n8n request failed/i,
  /webhook/i,
  /net::err_/i,
  /failed to fetch/i,
  /networkerror/i,
  /econnrefused/i,
  /stack trace/i,
  /nullpointerexception/i,
  /sqlexception/i,
  /mongo(exception|db)?/i,
  /elasticsearch/i,
  /mode must be one of/i,
  /cannot read properties/i,
  /undefined is not/i,
  /backend did not return/i,
  /http\s?5\d\d/i,
];

export function isAiServiceErrorText(value) {
  const text = String(value || '');
  if (!text) return false;
  return AI_SERVICE_ERROR_PATTERNS.some((pattern) => pattern.test(text))
    || (MOJIBAKE_PATTERN.test(text) && /llm|dịch|dá»‹ch|máy|mÃ¡y|server/i.test(text));
}

function isTechnicalErrorText(value) {
  const text = String(value || '');
  if (!text) return false;
  return isAiServiceErrorText(text)
    || MOJIBAKE_PATTERN.test(text)
    || TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function getSafeUserMessage(value, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return isTechnicalErrorText(text) ? fallback : text;
}

export function buildAiServiceErrorMessage(fallback = '') {
  return isAiServiceErrorText(fallback) || !fallback
    ? AI_SERVICE_ERROR_MESSAGE
    : fallback;
}
