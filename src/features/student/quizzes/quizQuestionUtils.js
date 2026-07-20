const toDisplayString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return String(value?.text ?? value?.label ?? value?.value ?? value?.id ?? '');
};

const normalizeForComparison = (value) => toDisplayString(value).trim().toLocaleLowerCase();

export const getQuizSessionId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id;

export const getQuizQuestions = (quiz) => (Array.isArray(quiz?.questions) ? quiz.questions : []);

export const getQuestionId = (question, index) => (
  question?.questionId || question?.id || `question-${index}`
);

export const getQuestionName = (_question, index) => `q_${index + 1}`;

export const getQuestionText = (question, index) => (
  question?.questionText || question?.question || question?.text || question?.prompt || `Question ${index + 1}`
);

const getOptionValue = (option) => {
  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    return String(option);
  }
  return String(option?.value ?? option?.id ?? option?.text ?? option?.label ?? '');
};

const getOptionLabel = (option) => toDisplayString(option);

const answersMatch = (left, right) => {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const optionMatchesAnswer = (option, answer) => (
  answersMatch(option?.value, answer) || answersMatch(option?.text, answer)
);

export const getQuestionChoices = (question) => {
  const rawOptions = Array.isArray(question?.options) && question.options.length
    ? question.options
    : ['TRUE_FALSE', 'BOOLEAN'].includes(String(question?.type || question?.questionType || '').toUpperCase())
      ? ['True', 'False']
      : [];

  return rawOptions
    .map((option) => ({
      value: getOptionValue(option),
      text: getOptionLabel(option),
    }))
    .filter((option) => option.value || option.text);
};

export const getAnswerForQuestion = (answers, question, index) => {
  const safeAnswers = Array.isArray(answers) ? answers : [];
  const questionId = getQuestionId(question, index);
  return safeAnswers.find((answer) => (
    String(answer?.questionId || answer?.id || '') === String(questionId)
  )) || safeAnswers[index] || {};
};

export const getQuizReviewDetails = (question, answer = {}) => {
  const selectedAnswer = answer?.selectedAnswer
    ?? answer?.studentAnswer
    ?? question?.selectedAnswer
    ?? question?.selectedOption
    ?? '';
  const correctAnswer = answer?.correctAnswer
    ?? question?.correctAnswer
    ?? question?.correctOption
    ?? '';
  const explanation = answer?.explanation ?? question?.explanation ?? '';
  const explicitCorrect = answer?.correct ?? question?.isCorrect;
  const isCorrect = typeof explicitCorrect === 'boolean'
    ? explicitCorrect
    : answersMatch(selectedAnswer, correctAnswer);

  const choices = getQuestionChoices(question);
  const appendMissingChoice = (value) => {
    if (value === '' || value === null || value === undefined) return;
    const exists = choices.some((choice) => optionMatchesAnswer(choice, value));
    if (!exists) choices.push({ value: toDisplayString(value), text: toDisplayString(value) });
  };

  appendMissingChoice(selectedAnswer);
  appendMissingChoice(correctAnswer);

  return {
    selectedAnswer: toDisplayString(selectedAnswer),
    correctAnswer: toDisplayString(correctAnswer),
    explanation: toDisplayString(explanation),
    isCorrect,
    choices: choices.map((choice) => ({
      ...choice,
      isSelected: optionMatchesAnswer(choice, selectedAnswer),
      isCorrectAnswer: optionMatchesAnswer(choice, correctAnswer),
    })),
  };
};
