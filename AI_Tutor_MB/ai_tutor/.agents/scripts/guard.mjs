import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE = '.agents/.local/ui-baseline.json';
const trees = ['lib', 'android', 'ios', 'web', 'linux', 'macos', 'windows', 'tooling', 'scripts'];
const rootFiles = ['pubspec.yaml', 'pubspec.lock', 'l10n.yaml', 'analysis_options.yaml', '.metadata'];
const skip = new Set(['build', '.dart_tool', '.gradle', 'Pods', '.symlinks', 'ephemeral', '.git']);
export const normalized = p => p.replaceAll('\\', '/').replace(/^\.\//, '');
export function isProtected(p, allow = []) {
  p = normalized(p).toLowerCase();
  if (allow.some(a => normalized(a).toLowerCase() === p)) return false;
  if (rootFiles.includes(p)) return true;
  if (!trees.some(t => p.startsWith(t + '/'))) return false;
  if (p.startsWith('lib/')) {
    if (/^lib\/features\/[^/]+\/presentation\//.test(p)) return false;
    if (/^lib\/(shared\/widgets|core\/theme|core\/icons)\//.test(p)) return false;
    if (/^lib\/l10n\/[^/]+\.arb$/.test(p)) return false;
  }
  return true;
}
export function generated(p) {
  p = normalized(p).toLowerCase();
  return /(?:\.g|\.freezed)\.dart$/.test(p) || /^lib\/l10n\/app_localizations.*\.dart$/.test(p);
}
export function safeRelative(root, candidate, cwd = root) {
  const full = path.resolve(cwd, candidate);
  const rel = normalized(path.relative(root, full));
  if (!rel || rel === '..' || rel.startsWith('../') || path.isAbsolute(rel)) return null;
  return rel;
}
export function validateAllow(root, allow) {
  return [...new Set(allow.map(p => {
    const rel = safeRelative(root, p);
    if (!rel || /[*?\[\]]/.test(rel) || rel !== normalized(p) || !isProtected(rel)) throw Error('Exception must be an exact protected project file: ' + p);
    if (fs.existsSync(path.join(root, rel)) && !fs.lstatSync(path.join(root, rel)).isFile()) throw Error('Exception must not be a directory: ' + p);
    return rel;
  }))];
}
export function inventory(root, allow = []) {
  const result = {};
  function visit(rel) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) return;
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw Error('Refusing to follow symlink in guarded tree: ' + rel);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) if (!skip.has(name)) visit(normalized(path.join(rel, name)));
    } else if (stat.isFile() && isProtected(rel, allow)) {
      result[rel] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    }
  }
  for (const p of [...trees, ...rootFiles]) visit(p);
  return result;
}
export function readBaseline(root) {
  const file = path.join(root, BASELINE);
  if (!fs.existsSync(file)) return null;
  const b = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (b.version !== 1 || !Array.isArray(b.allow) || !b.files || typeof b.files !== 'object' || Array.isArray(b.files)) throw Error('Invalid UI baseline schema');
  validateAllow(root, b.allow);
  for (const [p, hash] of Object.entries(b.files)) {
    if (safeRelative(root, p) !== p || !isProtected(p, b.allow) || !/^[a-f0-9]{64}$/.test(hash)) throw Error('Invalid UI baseline entry');
  }
  return b;
}
export function startBaseline(root, allow = []) {
  if (fs.existsSync(path.join(root, BASELINE))) throw Error('A baseline already exists. Check and finish it; never overwrite it to hide drift.');
  const exceptions = validateAllow(root, allow);
  const b = { version: 1, createdAt: new Date().toISOString(), allow: exceptions, files: inventory(root, exceptions) };
  fs.mkdirSync(path.dirname(path.join(root, BASELINE)), { recursive: true });
  fs.writeFileSync(path.join(root, BASELINE), JSON.stringify(b, null, 2) + '\n', { flag: 'wx' });
  return b;
}
export function compareBaseline(root) {
  const b = readBaseline(root);
  if (!b) throw Error('No UI baseline. Run snapshot-ui BEFORE editing, not after.');
  const now = inventory(root, b.allow);
  return [...new Set([...Object.keys(b.files), ...Object.keys(now)])].sort().filter(p => b.files[p] !== now[p]);
}
export function editPaths(input, root) {
  const tool = String(input.tool_name || '');
  if (!/^(?:apply_patch|Edit|Write|MultiEdit|StrReplace|write_file|edit_file)$/i.test(tool)) return [];
  let args = input.tool_input ?? {};
  if (typeof args === 'string') {
    try { args = JSON.parse(args); } catch { args = { command: args }; }
  }
  const candidates = [];
  for (const key of ['file_path', 'path', 'target_file']) if (typeof args[key] === 'string') candidates.push(args[key]);
  if (Array.isArray(args.edits)) for (const e of args.edits) if (typeof e.file_path === 'string') candidates.push(e.file_path);
  const patch = args.command || args.patch || args.input || '';
  if (typeof patch === 'string') for (const m of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)\r?$/gm)) candidates.push(m[1].trim());
  return [...new Set(candidates.map(p => safeRelative(root, p, input.cwd || root)).filter(Boolean))];
}
