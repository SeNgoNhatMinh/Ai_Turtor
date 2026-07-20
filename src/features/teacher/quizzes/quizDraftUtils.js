export const QUIZ_QUESTION_TYPES = Object.freeze({
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  TRUE_FALSE: 'TRUE_FALSE',
});

const TRUE_FALSE_OPTIONS = Object.freeze(['Đúng', 'Sai']);

const normalizeForComparison = (value) => String(value || '').trim().toLocaleLowerCase();

const createQuestionId = () => (
  globalThis.crypto?.randomUUID?.() || `question-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

export const createDraftQuestion = (question = {}, index = 0) => {
  const type = String(question.type || '').toUpperCase() === QUIZ_QUESTION_TYPES.TRUE_FALSE
    ? QUIZ_QUESTION_TYPES.TRUE_FALSE
    : QUIZ_QUESTION_TYPES.MULTIPLE_CHOICE;
  const rawOptions = Array.isArray(question.options) ? question.options.map((option) => String(option ?? '')) : [];
  const options = type === QUIZ_QUESTION_TYPES.TRUE_FALSE
    ? [...TRUE_FALSE_OPTIONS]
    : rawOptions.length >= 2
      ? rawOptions
      : ['', '', '', ''];

  return {
    questionId: question.questionId || question.id || (question.questionText ? `q-${index + 1}` : createQuestionId()),
    type,
    questionText: question.questionText || question.text || '',
    options,
    correctAnswer: question.correctAnswer || '',
    explanation: question.explanation || '',
    sourceMaterialIds: Array.isArray(question.sourceMaterialIds) ? question.sourceMaterialIds : [],
  };
};

export const createEmptyDraftQuestion = () => createDraftQuestion({ questionId: createQuestionId() });

export const updateDraftOption = (question, optionIndex, nextValue) => {
  const options = [...question.options];
  const previousValue = options[optionIndex];
  options[optionIndex] = nextValue;
  const selectedOptionChanged = normalizeForComparison(question.correctAnswer)
    === normalizeForComparison(previousValue);

  return {
    ...question,
    options,
    correctAnswer: selectedOptionChanged ? nextValue : question.correctAnswer,
  };
};

export const setDraftQuestionType = (question, type) => {
  if (type === QUIZ_QUESTION_TYPES.TRUE_FALSE) {
    const matchingAnswer = TRUE_FALSE_OPTIONS.find((option) => (
      normalizeForComparison(option) === normalizeForComparison(question.correctAnswer)
    ));
    return {
      ...question,
      type,
      options: [...TRUE_FALSE_OPTIONS],
      correctAnswer: matchingAnswer || '',
    };
  }

  return {
    ...question,
    type: QUIZ_QUESTION_TYPES.MULTIPLE_CHOICE,
    options: question.options.length >= 2 ? [...question.options] : ['', '', '', ''],
  };
};

export const validateQuizDraft = (questions = []) => {
  if (!questions.length) {
    return { valid: false, generalError: 'Thêm ít nhất một câu hỏi trước khi lưu.', questionErrors: [] };
  }

  const questionErrors = questions.map((question) => {
    const errors = [];
    const options = (Array.isArray(question?.options) ? question.options : [])
      .map((option) => String(option || '').trim())
      .filter(Boolean);
    const uniqueOptions = new Set(options.map(normalizeForComparison));

    if (!String(question?.questionText || '').trim()) errors.push('Nội dung câu hỏi là bắt buộc.');
    if (options.length < 2) errors.push('Cần ít nhất hai lựa chọn.');
    if (uniqueOptions.size !== options.length) errors.push('Các lựa chọn không được trùng nhau.');
    if (!String(question?.correctAnswer || '').trim()) {
      errors.push('Chọn đáp án đúng.');
    } else if (!options.some((option) => normalizeForComparison(option) === normalizeForComparison(question.correctAnswer))) {
      errors.push('Đáp án đúng phải thuộc danh sách lựa chọn.');
    }
    return errors;
  });

  return {
    valid: questionErrors.every((errors) => errors.length === 0),
    generalError: '',
    questionErrors,
  };
};

export const buildQuizDraftPayload = (values, questions) => ({
  title: String(values.title || '').trim(),
  topic: String(values.topic || '').trim(),
  suggestionText: String(values.suggestionText || '').trim(),
  questions: questions.map((question) => {
    const options = question.options.map((option) => String(option || '').trim()).filter(Boolean);
    const correctAnswer = options.find((option) => (
      normalizeForComparison(option) === normalizeForComparison(question.correctAnswer)
    )) || String(question.correctAnswer || '').trim();

    return {
      ...question,
      questionText: String(question.questionText || '').trim(),
      options,
      correctAnswer,
      explanation: String(question.explanation || '').trim(),
    };
  }),
});
