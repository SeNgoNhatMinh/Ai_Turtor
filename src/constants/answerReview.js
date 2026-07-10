export const FEEDBACK_RECORDED_MESSAGE = 'Your feedback was recorded. AI will not learn from it until mentor/senior review.';

export const FEEDBACK_ACTIONS = {
  helpful: {
    key: 'helpful',
    label: 'Helpful',
    prompt: 'What made this answer helpful?',
    placeholder: 'Optional: tell us what worked well...',
    reviewType: 'QUALITY_FEEDBACK',
    rating: 5,
    accurate: true,
    helpful: true,
    correctnessLevel: 'HIGH',
    defaultFeedback: 'Helpful',
  },
  notCorrect: {
    key: 'notCorrect',
    label: 'Not correct',
    prompt: 'Which part is not correct?',
    placeholder: 'Point out the incorrect part...',
    reviewType: 'ANSWER_DISPUTE',
    rating: 1,
    accurate: false,
    helpful: false,
    correctnessLevel: 'INCORRECT',
    defaultFeedback: 'AI answer disputed by student.',
  },
  sourceConflict: {
    key: 'sourceConflict',
    label: 'Source conflict',
    prompt: 'Which source conflicts with this answer?',
    placeholder: 'Describe the source conflict...',
    reviewType: 'SOURCE_CONFLICT',
    rating: 2,
    accurate: false,
    helpful: false,
    correctnessLevel: 'LOW',
    defaultFeedback: 'Student reported a source conflict.',
  },
  missingMaterial: {
    key: 'missingMaterial',
    label: 'Missing material',
    prompt: 'What material is missing?',
    placeholder: 'Tell us which material or topic is missing...',
    reviewType: 'MISSING_MATERIAL',
    rating: 2,
    accurate: false,
    helpful: false,
    correctnessLevel: 'LOW',
    defaultFeedback: 'Student reported missing material.',
  },
  needMoreDetail: {
    key: 'needMoreDetail',
    label: 'Need more detail',
    prompt: 'What should AI explain in more detail?',
    placeholder: 'Tell us what needs more detail...',
    reviewType: 'QUALITY_FEEDBACK',
    rating: 3,
    accurate: true,
    helpful: false,
    correctnessLevel: 'MEDIUM',
    defaultFeedback: 'Student requested more detail.',
  },
};

export const getFeedbackAction = (key, fallback = 'needMoreDetail') => {
  return FEEDBACK_ACTIONS[key] || FEEDBACK_ACTIONS[fallback];
};
