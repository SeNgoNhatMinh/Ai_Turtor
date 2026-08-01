const FEEDBACK_RECORDED_MESSAGE =
  'Cảm ơn phản hồi! Hệ thống đã ghi nhận. Chỉ khi nhiều sinh viên phản hồi tương tự về cùng câu trả lời AI, giảng viên hoặc senior mới được thông báo xử lý.';

const ANSWER_REVIEW_STATUS = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  NEEDS_MENTOR_REVIEW: 'NEEDS_MENTOR_REVIEW',
  NEEDS_SENIOR_REVIEW: 'NEEDS_SENIOR_REVIEW',
  RESOLVED: 'RESOLVED',
});

const ANSWER_REVIEW_STATUS_LABELS = Object.freeze({
  SUBMITTED: 'Đã ghi nhận',
  NEEDS_MENTOR_REVIEW: 'Chờ giáo viên xem xét',
  NEEDS_SENIOR_REVIEW: 'Chờ senior xem xét',
  RESOLVED: 'Đã xử lý',
});

const ANSWER_REVIEW_TYPE_LABELS = Object.freeze({
  QUALITY_FEEDBACK: 'Góp ý chất lượng',
  ANSWER_DISPUTE: 'Phản hồi câu trả lời',
  SOURCE_CONFLICT: 'Mâu thuẫn nguồn',
  MISSING_MATERIAL: 'Thiếu tài liệu',
  KNOWLEDGE_CORRECTION: 'Đính chính kiến thức',
  MATERIAL_CORRECTION: 'Đính chính tài liệu',
});

export const getAnswerReviewStatus = (response) => {
  const root = Array.isArray(response) ? response[0] : response;
  return String(
    root?.status
    || root?.review?.status
    || root?.data?.status
    || ANSWER_REVIEW_STATUS.SUBMITTED,
  ).trim().toUpperCase();
};

export const getFeedbackRecordedMessage = (response) => {
  const status = getAnswerReviewStatus(response);
  if (status === ANSWER_REVIEW_STATUS.NEEDS_MENTOR_REVIEW) {
    return 'Góp ý đã được gửi cho giáo viên phụ trách môn học. AI chưa học từ nội dung này.';
  }
  if (status === ANSWER_REVIEW_STATUS.NEEDS_SENIOR_REVIEW) {
    return 'Lỗi nghiêm trọng đã được ghi nhận và gửi cho senior mentor. AI chỉ học sau khi được phê duyệt.';
  }
  if (status === ANSWER_REVIEW_STATUS.RESOLVED) {
    return 'Góp ý cho câu trả lời này đã được xử lý.';
  }
  return FEEDBACK_RECORDED_MESSAGE;
};

export const formatAnswerReviewStatus = (status) => (
  ANSWER_REVIEW_STATUS_LABELS[String(status || '').toUpperCase()] || 'Đã ghi nhận'
);

export const formatAnswerReviewType = (reviewType) => (
  ANSWER_REVIEW_TYPE_LABELS[String(reviewType || '').toUpperCase()] || 'Góp ý câu trả lời'
);

const ESCALATION_TIER_LABELS = Object.freeze({
  MODERATE: 'Phản hồi tiêu cực vừa (2–3 sao)',
  SEVERE: 'Phản hồi rất tiêu cực (1 sao)',
  IMMEDIATE: 'Báo lỗi nguồn / tài liệu (ưu tiên)',
});

export const formatEscalationTier = (tier) => (
  ESCALATION_TIER_LABELS[String(tier || '').toUpperCase()] || 'Nhóm phản hồi AI'
);

export const FEEDBACK_ACTIONS = {
  helpful: {
    key: 'helpful',
    label: 'Hữu ích',
    prompt: 'Điều gì trong câu trả lời này hữu ích?',
    placeholder: 'Tùy chọn: hãy cho chúng tôi biết điểm làm tốt...',
    reviewType: 'QUALITY_FEEDBACK',
    rating: 5,
    accurate: true,
    helpful: true,
    correctnessLevel: 'HIGH',
    defaultFeedback: 'Câu trả lời hữu ích.',
  },
  notCorrect: {
    key: 'notCorrect',
    label: 'Chưa chính xác',
    prompt: 'Phần nào chưa chính xác?',
    placeholder: 'Hãy chỉ ra nội dung chưa đúng...',
    reviewType: 'ANSWER_DISPUTE',
    rating: 2,
    accurate: false,
    helpful: false,
    correctnessLevel: 'INCORRECT',
    defaultFeedback: 'Sinh viên cho rằng câu trả lời AI chưa chính xác.',
  },
  moderateDispute: {
    key: 'moderateDispute',
    label: 'Chưa đủ rõ / hơi sai',
    prompt: 'Phần nào cần làm rõ hoặc chưa đúng?',
    placeholder: 'Mô tả ngắn (2–3 sao)...',
    reviewType: 'QUALITY_FEEDBACK',
    rating: 3,
    accurate: false,
    helpful: false,
    correctnessLevel: 'LOW',
    defaultFeedback: 'Sinh viên đánh giá câu trả lời chưa đủ tốt.',
  },
  knowledgeError: {
    key: 'knowledgeError',
    label: 'Sai kiến thức nghiêm trọng',
    prompt: 'Hãy mô tả lỗi kiến thức nghiêm trọng trong câu trả lời.',
    placeholder: 'Mô tả nội dung sai và hướng đính chính...',
    reviewType: 'ANSWER_DISPUTE',
    rating: 1,
    accurate: false,
    helpful: false,
    correctnessLevel: 'INCORRECT',
    defaultFeedback: 'Sinh viên báo cáo lỗi kiến thức nghiêm trọng.',
  },
  sourceConflict: {
    key: 'sourceConflict',
    label: 'Mâu thuẫn nguồn',
    prompt: 'Nguồn nào mâu thuẫn với câu trả lời?',
    placeholder: 'Mô tả nội dung mâu thuẫn...',
    reviewType: 'SOURCE_CONFLICT',
    rating: 2,
    accurate: false,
    helpful: false,
    correctnessLevel: 'LOW',
    defaultFeedback: 'Sinh viên báo cáo mâu thuẫn với nguồn tài liệu.',
  },
  missingMaterial: {
    key: 'missingMaterial',
    label: 'Thiếu tài liệu',
    prompt: 'Nội dung hoặc tài liệu nào đang thiếu?',
    placeholder: 'Cho chúng tôi biết tài liệu hoặc chủ đề còn thiếu...',
    reviewType: 'MISSING_MATERIAL',
    rating: 2,
    accurate: false,
    helpful: false,
    correctnessLevel: 'LOW',
    defaultFeedback: 'Sinh viên báo cáo thiếu tài liệu.',
  },
  needMoreDetail: {
    key: 'needMoreDetail',
    label: 'Cần chi tiết hơn',
    prompt: 'AI cần giải thích chi tiết hơn phần nào?',
    placeholder: 'Cho chúng tôi biết nội dung cần làm rõ...',
    reviewType: 'QUALITY_FEEDBACK',
    // A request for detail is normal quality feedback, not a mentor dispute.
    rating: 4,
    accurate: true,
    helpful: false,
    correctnessLevel: 'MEDIUM',
    defaultFeedback: 'Sinh viên yêu cầu giải thích chi tiết hơn.',
  },
};

export const getFeedbackAction = (key, fallback = 'needMoreDetail') => {
  return FEEDBACK_ACTIONS[key] || FEEDBACK_ACTIONS[fallback];
};

/** Maps 1–5 star UI to existing Flow 2 feedback actions (BE crowd tiers unchanged). */
const STAR_TO_FEEDBACK_ACTION_KEY = {
  5: 'helpful',
  4: 'needMoreDetail',
  3: 'moderateDispute',
  2: 'notCorrect',
  1: 'knowledgeError',
};

export const getFeedbackActionKeyForStar = (star) => {
  const n = Number(star);
  return STAR_TO_FEEDBACK_ACTION_KEY[n] || STAR_TO_FEEDBACK_ACTION_KEY[3];
};
