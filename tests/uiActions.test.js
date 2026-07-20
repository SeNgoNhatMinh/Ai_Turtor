import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (relativePath) => readFile(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

test('app chrome does not claim hardcoded service health', async () => {
  const sidebar = await readSource('components/Sidebar.jsx');
  for (const misleadingLabel of ['Backend API Connected', 'MongoDB Running', 'Elasticsearch Ready']) {
    assert.equal(sidebar.includes(misleadingLabel), false, `${misleadingLabel} must come from diagnostics, not static UI`);
  }
});

test('mounted teacher roster has no toast-only Support command', async () => {
  const teacherClasses = await readSource('pages/teacher/TeacherClassesTab.jsx');
  assert.equal(teacherClasses.includes('Opening support chat with'), false);
  assert.doesNotMatch(teacherClasses, /onClick=\{\(\) => triggerToast\?\./);
});

test('prompt starters do not create mentor tickets without question context', async () => {
  const promptStarters = await readSource('pages/student/PromptStarters.jsx');
  assert.equal(promptStarters.includes('Nhờ mentor hỗ trợ'), false);
  assert.equal(promptStarters.includes('Vui lòng tạo yêu cầu mentor'), false);
});
