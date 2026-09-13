import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, BASELINE, isProtected, generated, safeRelative, startBaseline, compareBaseline, readBaseline, editPaths } from '../scripts/guard.mjs';
import { handle } from '../hooks/runtime.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tutor-kit-test-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('ai-tutor-kit-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const write = (p, text = 'fixture') => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), text); };
  write('lib/features/quiz/data/repository.dart');
  write('lib/features/quiz/presentation/screen.dart');
  write('lib/app.dart');
  write('pubspec.yaml');
  return { root, write };
}
test('scope distinguishes UI from business and configuration', () => {
  for (const p of ['lib/features/quiz/data/repository.dart', 'lib/features/auth/application/auth.dart', 'lib/shared/models/quiz.dart', 'lib/core/network/dio_client.dart', 'lib/core/router/student_shell.dart', 'lib/app.dart', 'pubspec.lock', 'android/app/build.gradle.kts']) assert.equal(isProtected(p), true, p);
  for (const p of ['lib/features/quiz/presentation/screen.dart', 'lib/shared/widgets/fpt_button.dart', 'lib/core/theme/app_theme.dart', 'lib/core/icons/nav.dart', 'lib/l10n/app_vi.arb', 'test/widget_test.dart', 'assets/image.png']) assert.equal(isProtected(p), false, p);
  assert.equal(isProtected('lib\\features\\quiz\\data\\repo.dart'), true);
  assert.equal(isProtected('LIB/CORE/NETWORK/dio_client.dart'), true);
});
test('snapshot uses current content and detects modified, added and deleted protected files', t => {
  const { root, write } = fixture(t);
  write('lib/app.dart', 'pre-existing user change');
  startBaseline(root);
  assert.deepEqual(compareBaseline(root), []);
  write('lib/features/quiz/presentation/screen.dart', 'redesigned');
  assert.deepEqual(compareBaseline(root), []);
  write('lib/app.dart', 'changed logic');
  write('lib/core/network/new.dart');
  fs.unlinkSync(path.join(root, 'lib/features/quiz/data/repository.dart'));
  assert.deepEqual(compareBaseline(root), ['lib/app.dart', 'lib/core/network/new.dart', 'lib/features/quiz/data/repository.dart']);
});
test('baseline cannot be overwritten; exact approved exception works', t => {
  const { root, write } = fixture(t);
  startBaseline(root, ['lib/app.dart']);
  write('lib/app.dart', 'approved bridge');
  assert.deepEqual(compareBaseline(root), []);
  assert.throws(() => startBaseline(root), /already exists/);
  const b = readBaseline(root);
  assert.equal(JSON.stringify(b).includes('approved bridge'), false);
});
test('missing/malformed baseline and broad exceptions are rejected', t => {
  const { root, write } = fixture(t);
  assert.throws(() => compareBaseline(root), /No UI baseline/);
  assert.throws(() => startBaseline(root, ['../outside.dart']));
  assert.throws(() => startBaseline(root, ['lib/features/quiz/data']));
  assert.throws(() => startBaseline(root, ['lib/core/network/*.dart']));
  write(BASELINE, '{"version":1,"allow":[],"files":{"../outside":"bad"}}');
  assert.throws(() => readBaseline(root));
});
test('paths are normalized and traversal/outside edits are not treated as project files', t => {
  const { root } = fixture(t);
  assert.equal(safeRelative(root, '../outside'), null);
  assert.equal(safeRelative(root, path.join(root, 'lib/app.dart')), 'lib/app.dart');
  assert.deepEqual(editPaths({ tool_name: 'Read', tool_input: { file_path: 'lib/app.dart' } }, root), []);
  const patch = '*** Update File: lib/app.dart\n*** Move to: lib/main.dart\n*** Add File: lib/core/network/new.dart\n*** Delete File: lib/shared/models/old.dart';
  assert.deepEqual(editPaths({ tool_name: 'apply_patch', tool_input: { command: patch } }, root), ['lib/app.dart', 'lib/main.dart', 'lib/core/network/new.dart', 'lib/shared/models/old.dart']);
  assert.deepEqual(editPaths({ tool_name: 'Write', tool_input: JSON.stringify({ file_path: 'lib/app.dart' }) }, root), ['lib/app.dart']);
});
test('Codex pre-tool guard denies protected edits only during active UI task', t => {
  const { root } = fixture(t);
  const event = { tool_name: 'apply_patch', tool_input: { command: '*** Update File: lib/app.dart\n' } };
  assert.deepEqual(handle('codex', 'pre', event, root), {});
  startBaseline(root);
  const out = handle('codex', 'pre', event, root).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  assert.deepEqual(handle('codex', 'pre', { tool_name: 'Read', tool_input: { path: 'lib/app.dart' } }, root), {});
});
test('Cursor pre-tool guard uses Cursor protocol; permitted UI edit is not blocked', t => {
  const { root } = fixture(t);
  startBaseline(root);
  assert.equal(handle('cursor', 'pre', { tool_name: 'Write', tool_input: { file_path: 'lib/app.dart' } }, root).permission, 'deny');
  assert.deepEqual(handle('cursor', 'pre', { tool_name: 'Write', tool_input: { file_path: 'lib/features/quiz/presentation/screen.dart' } }, root), {});
});
test('generated file writes blocked even without baseline', t => {
  const { root } = fixture(t);
  for (const p of ['lib/l10n/app_localizations_vi.dart', 'lib/shared/models/x.g.dart', 'lib/shared/models/x.freezed.dart']) {
    assert.ok(generated(p));
    assert.equal(handle('cursor', 'pre', { tool_name: 'Write', tool_input: { path: p } }, root).permission, 'deny');
  }
});
test('post-tool guard reports shell drift with runtime-specific context', t => {
  const { root, write } = fixture(t);
  startBaseline(root);
  assert.deepEqual(handle('codex', 'post', {}, root), {});
  write('lib/app.dart', 'shell write');
  assert.match(handle('codex', 'post', {}, root).hookSpecificOutput.additionalContext, /lib\/app.dart/);
  assert.match(handle('cursor', 'post', {}, root).additional_context, /lib\/app.dart/);
});
test('approved generated outputs may change through generation, but direct edits still denied', t => {
  const { root, write } = fixture(t);
  const output = 'lib/l10n/app_localizations_vi.dart';
  startBaseline(root, [output]);
  write(output, 'generated fixture');
  assert.deepEqual(compareBaseline(root), []);
  assert.equal(handle('cursor', 'pre', { tool_name: 'Write', tool_input: { path: output } }, root).permission, 'deny');
});
test('hook executable emits valid JSON and does not echo sensitive malformed input', () => {
  for (const adapter of ['codex', 'cursor']) {
    const result = spawnSync(process.execPath, [path.join(ROOT, '.agents/hooks/runtime.mjs'), adapter, 'session'], { input: '{}', encoding: 'utf8' });
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.ok(adapter === 'codex' ? out.hookSpecificOutput.additionalContext : out.additional_context);
  }
  const bad = spawnSync(process.execPath, [path.join(ROOT, '.agents/hooks/runtime.mjs'), 'codex', 'pre'], { input: '{secret-fixture-not-real', encoding: 'utf8' });
  assert.equal(bad.status, 0);
  assert.deepEqual(JSON.parse(bad.stdout), {});
  assert.equal((bad.stdout + bad.stderr).includes('secret-fixture-not-real'), false);
});
