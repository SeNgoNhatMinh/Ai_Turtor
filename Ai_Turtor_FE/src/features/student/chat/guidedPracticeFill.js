const SECTION_HEADING = /^(#{1,6})\s+(?:\d+\.\s*)?bài tập có hướng dẫn\s*$/i;
const NEXT_HEADING = /^#{1,6}\s+\S/;
const FENCE = /```[^\n]*\n([\s\S]*?)```/;
const BLANK = /_{3,}|【\s*】|\[\s*(?:\.{2,}|blank)\s*\]|\bTODO\b/i;

function splitBlanks(source) {
  const text = String(source || '');
  const segments = [];
  const pattern = new RegExp(BLANK.source, 'gi');
  let cursor = 0;
  let blankCount = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    segments.push({ type: 'text', text: text.slice(cursor, index) });
    segments.push({ type: 'blank', index: blankCount });
    blankCount += 1;
    cursor = index + match[0].length;
  }
  segments.push({ type: 'text', text: text.slice(cursor) });
  return { segments, blankCount };
}

function wrapPracticeMessage(body) {
  return `Mình điền bài tập có hướng dẫn như sau:\n\n\`\`\`\n${String(body || '').trim()}\n\`\`\`\n\nNhờ kiểm tra phần mình điền, chưa đưa lời giải hoàn chỉnh.`;
}

export function guidedPracticeDraftKey(attemptId) {
  const id = String(attemptId || '').trim();
  return id ? `guided-practice-draft:${id}` : '';
}

export function readGuidedPracticeDraft(attemptId) {
  const key = guidedPracticeDraftKey(attemptId);
  if (!key || typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    if (!parsed || typeof parsed !== 'object' || !String(parsed.text || '').trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGuidedPracticeDraft(attemptId, draft) {
  const key = guidedPracticeDraftKey(attemptId);
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    window.dispatchEvent(new CustomEvent('guided-practice-draft', { detail: { attemptId: String(attemptId) } }));
  } catch {
    // Private mode can block localStorage; the in-memory draft still holds.
  }
}

export function lockGuidedPracticeDraft(attemptId) {
  const current = readGuidedPracticeDraft(attemptId);
  if (!current) return;
  writeGuidedPracticeDraft(attemptId, { ...current, locked: true });
}

export function readFirstGuidedPracticeDraft(attemptIds) {
  const seen = new Set();
  for (const attemptId of attemptIds || []) {
    const id = String(attemptId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const draft = readGuidedPracticeDraft(id);
    if (draft?.text) return { attemptId: id, draft };
  }
  return null;
}

export function extractGuidedPractice(markdown) {
  const text = String(markdown || '');
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => SECTION_HEADING.test(String(line || '').trim()));
  if (start < 0) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (NEXT_HEADING.test(String(lines[index] || '').trim())) {
      end = index;
      break;
    }
  }

  const section = lines.slice(start, end).join('\n').trim();
  const body = lines.slice(start + 1, end).join('\n').trim();
  const fence = body.match(FENCE);
  const code = fence ? fence[1].replace(/\n$/, '') : '';
  const prose = (fence ? body.replace(FENCE, '') : '').trim();
  const blankSource = code || body;
  const { segments, blankCount } = splitBlanks(blankSource);
  const match = blankSource.match(BLANK);
  const token = match ? match[0] : '';
  const tokenAt = match ? match.index : -1;

  return {
    before: lines.slice(0, start).join('\n').trim(),
    section,
    after: lines.slice(end).join('\n').trim(),
    prose: token && !code ? '' : prose,
    code,
    token,
    blankCount,
    segments,
    prefix: tokenAt >= 0 ? blankSource.slice(0, tokenAt) : (code || body),
    suffix: tokenAt >= 0 ? blankSource.slice(tokenAt + token.length) : '',
  };
}

export function filledPracticeMessage(practice, value) {
  const values = (Array.isArray(value) ? value : [value]).map((item) => String(item || '').trim());
  if (!practice || values.every((item) => !item)) return '';
  const blankCount = Number(practice.blankCount || 0);
  if (!blankCount) {
    const filled = values[0];
    if (!filled) return '';
    return wrapPracticeMessage(`${practice.code || practice.section}\n\nChỗ mình điền: ${filled}`);
  }
  const filled = values.slice(0, blankCount);
  if (filled.length < blankCount || filled.some((item) => !item)) return '';
  let cursor = 0;
  const body = (Array.isArray(practice.segments) ? practice.segments : []).map((segment) => {
    if (segment?.type !== 'blank') return segment?.text || '';
    const next = filled[cursor];
    cursor += 1;
    return next;
  }).join('');
  return wrapPracticeMessage(body);
}
