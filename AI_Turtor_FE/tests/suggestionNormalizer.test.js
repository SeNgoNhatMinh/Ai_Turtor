import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeImprovePlan,
  normalizeStudentDashboard,
  normalizeSuggestions,
} from '../src/services/normalizers.js';

const rawSuggestionPayload = JSON.stringify({
  suggestions: [{
    title: 'Ôn lại các chủ đề yếu',
    reason: 'Bạn đang yếu ở JSP và Code debugging.',
    nextSteps: [
      'Ôn lại JSP.',
      'Thực hành debug với breakpoint.',
    ],
  }],
  notes: 'Câu hỏi ngoài phạm vi môn học không thể được trả lời từ tài liệu.',
});

test('formats fenced AI suggestion JSON into cards and a separate note', () => {
  const result = normalizeSuggestions({
    aiSuggestion: `\`\`\`json\n${rawSuggestionPayload}\n\`\`\``,
  });

  assert.deepEqual(result, [
    {
      title: 'Ôn lại các chủ đề yếu',
      reason: 'Bạn đang yếu ở JSP và Code debugging.',
      nextSteps: ['Ôn lại JSP.', 'Thực hành debug với breakpoint.'],
      priority: 'medium',
      content: 'Bạn đang yếu ở JSP và Code debugging.',
    },
    {
      kind: 'note',
      priority: 'info',
      title: 'Lưu ý từ AI Tutor',
      content: 'Câu hỏi ngoài phạm vi môn học không thể được trả lời từ tài liệu.',
      reason: 'Câu hỏi ngoài phạm vi môn học không thể được trả lời từ tài liệu.',
      nextSteps: [],
    },
  ]);
});

test('formats a direct JSON payload instead of exposing raw JSON text', () => {
  const result = normalizeSuggestions(rawSuggestionPayload);

  assert.equal(result[0].title, 'Ôn lại các chủ đề yếu');
  assert.deepEqual(result[0].nextSteps, ['Ôn lại JSP.', 'Thực hành debug với breakpoint.']);
  assert.equal(result.some((item) => item.content.includes('"suggestions"')), false);
});

test('unwraps legacy suggestion JSON stored as one next step', () => {
  const result = normalizeSuggestions([{
    title: 'Kế hoạch cải thiện',
    content: `Các bước nên làm:\n• ${rawSuggestionPayload}`,
  }]);

  assert.equal(result[0].title, 'Ôn lại các chủ đề yếu');
  assert.equal(result.some((item) => item.content.includes('"suggestions"')), false);
});

test('unwraps suggestion JSON stored inside improve plan items', () => {
  const plan = normalizeImprovePlan({
    id: 'plan-1',
    planItems: [rawSuggestionPayload],
  });
  const dashboard = normalizeStudentDashboard({
    improvePlans: [{ id: 'plan-1', planItems: [rawSuggestionPayload] }],
  });

  assert.equal(plan.structuredSuggestions[0].title, 'Ôn lại các chủ đề yếu');
  assert.deepEqual(plan.structuredSuggestions[0].nextSteps, [
    'Ôn lại JSP.',
    'Thực hành debug với breakpoint.',
  ]);
  assert.equal(dashboard.suggestions[0].title, 'Ôn lại các chủ đề yếu');
  assert.equal(dashboard.suggestions.some((item) => item.content.includes('"suggestions"')), false);
  assert.equal(dashboard.suggestions[0].deletable, false);
});

test('keeps the exact backend memory value needed to delete a normalized suggestion', () => {
  const dashboard = normalizeStudentDashboard({
    memories: [{ improveSuggestions: [rawSuggestionPayload] }],
  });

  assert.equal(dashboard.suggestions[0].title, 'Ôn lại các chủ đề yếu');
  assert.equal(dashboard.suggestions[0].deleteValue, rawSuggestionPayload);
  assert.equal(dashboard.suggestions[0].persistence, 'BACKEND_MEMORY');
  assert.equal(dashboard.suggestions[0].deletable, true);
});

test('normalizes a direct memory response used when the dashboard request fails', () => {
  const dashboard = normalizeStudentDashboard({
    studentId: 'student-1',
    courseId: 'PRJ301',
    improveSuggestions: ['Practice servlet lifecycle'],
  });

  assert.equal(dashboard.suggestions[0].deleteValue, 'Practice servlet lifecycle');
  assert.equal(dashboard.suggestions[0].persistence, 'BACKEND_MEMORY');
});
