import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, BASELINE, startBaseline, compareBaseline } from './guard.mjs';

const command = process.argv[2] || 'help';
function assert(ok, message) { if (!ok) throw Error(message); }
function validate() {
  const skillsDir = path.join(ROOT, '.agents/skills');
  const skills = fs.readdirSync(skillsDir).filter(n => fs.statSync(path.join(skillsDir, n)).isDirectory());
  for (const name of skills) {
    const text = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
    assert(/^[a-z0-9-]{1,64}$/.test(name), 'Invalid skill directory: ' + name);
    assert(text.startsWith('---\nname: ' + name + '\n'), 'Skill name mismatch: ' + name);
    assert(/^description: ".+"$/m.test(text), 'Missing skill description: ' + name);
    assert(text.split('\n').length < 500, 'Oversized skill: ' + name);
    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) if (!/^https?:/.test(m[1])) assert(fs.existsSync(path.resolve(skillsDir, name, m[1])), 'Broken skill reference: ' + m[1]);
  }
  const rules = fs.readdirSync(path.join(ROOT, '.agents/rules')).filter(n => n.endsWith('.md'));
  for (const rule of rules) {
    const adapter = fs.readFileSync(path.join(ROOT, '.cursor/rules', rule.replace('.md', '.mdc')), 'utf8');
    assert(adapter.includes('.agents/rules/' + rule), 'Broken rule adapter: ' + rule);
    assert(/^alwaysApply: (true|false)$/m.test(adapter), 'Missing rule metadata: ' + rule);
  }
  const codex = JSON.parse(fs.readFileSync(path.join(ROOT, '.codex/hooks.json'), 'utf8'));
  const cursor = JSON.parse(fs.readFileSync(path.join(ROOT, '.cursor/hooks.json'), 'utf8'));
  assert(cursor.version === 1, 'Cursor schema version');
  for (const [event, action] of [['SessionStart', 'session'], ['PreToolUse', 'pre'], ['PostToolUse', 'post']]) {
    const c = codex.hooks[event]?.[0]?.hooks?.[0];
    const u = cursor.hooks[event[0].toLowerCase() + event.slice(1)]?.[0];
    assert(c?.type === 'command' && c.command === 'node .agents/hooks/runtime.mjs codex ' + action, 'Codex hook invalid: ' + event);
    assert(u?.command === 'node .agents/hooks/runtime.mjs cursor ' + action, 'Cursor hook invalid: ' + event);
  }
  const refs = ['lib/app.dart', 'lib/core/network/dio_client.dart', 'lib/core/router/app_router.dart', 'lib/shared/widgets/fpt_button.dart', 'test/core/network/dio_client_test.dart'];
  for (const ref of refs) assert(fs.existsSync(path.join(ROOT, ref)), 'Project reference moved/missing: ' + ref);
  for (const rel of ['.agents/hooks/runtime.mjs', '.agents/scripts/guard.mjs', '.agents/scripts/agent-kit.mjs', '.agents/tests/kit.test.mjs']) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, rel)], { encoding: 'utf8' });
    assert(r.status === 0, 'JS syntax check failed: ' + rel);
  }
  const evals = JSON.parse(fs.readFileSync(path.join(ROOT, '.agents/evals/scenarios.json'), 'utf8'));
  assert(evals.length >= 8 && evals.every(e => e.prompt && e.expected && e.forbidden), 'Invalid evaluation scenarios');
  console.log('PASS: ' + skills.length + ' skills, ' + rules.length + ' canonical rules/adapters, hook configuration, links, JS syntax and evaluation fixtures.');
}
try {
  if (command === 'validate') validate();
  else if (command === 'doctor') {
    assert(Number(process.versions.node.split('.')[0]) >= 18, 'Node >=18 required');
    console.log('Project: ' + ROOT + '\nNode: ' + process.version);
    console.log('UI baseline: ' + (fs.existsSync(path.join(ROOT, BASELINE)) ? 'active; run check-ui' : 'inactive'));
    validate();
    console.log('Runtime hook trust/discovery and Flutter SDK health require separate checks. Start the editor/session in this Flutter folder.');
  } else if (command === 'snapshot-ui') {
    const args = process.argv.slice(3), allow = [];
    for (let i = 0; i < args.length; i += 2) { assert(args[i] === '--allow' && args[i + 1], 'Usage: snapshot-ui [--allow exact/file]'); allow.push(args[i + 1]); }
    const b = startBaseline(ROOT, allow);
    console.log('UI baseline saved: ' + Object.keys(b.files).length + ' protected files; exceptions: ' + (b.allow.join(', ') || 'none'));
  } else if (command === 'check-ui' || command === 'finish-ui') {
    const drift = compareBaseline(ROOT);
    if (drift.length) { console.error('FAIL: protected files changed/added/deleted:\n' + drift.join('\n')); process.exitCode = 1; }
    else {
      console.log('PASS: protected file hashes unchanged. Review logic inside allowed UI files separately.');
      if (command === 'finish-ui') { fs.unlinkSync(path.join(ROOT, BASELINE)); console.log('Removed only the completed local UI baseline; app files untouched.'); }
    }
  } else {
    console.log('Commands: doctor | validate | snapshot-ui [--allow exact/file] | check-ui | finish-ui');
    if (command !== 'help') process.exitCode = 2;
  }
} catch (error) { console.error('ERROR: ' + error.message); process.exitCode = 2; }
