import React from 'react';
import { sanitizeLinkUrl } from './markdownSecurity.js';
import { extractSourceFileLabels, isMaterialSourceText } from './sourceLabels.js';
import { normalizeUnicodeText } from './textEncoding.js';

/**
 * =========================================================
 * AI MARKDOWN NORMALIZER ENGINE
 * Production-grade — React Chat UI / AI Tutor
 *
 * Pipeline order:
 *   1. Repair encoding and normalize Unicode/newlines/spacing
 *   2. Protect original code fences and math
 *   3. Normalize math delimiters and protect converted math
 *   4. Normalize known headings, lists, tables and blockquotes
 *   5. Sanitize links
 *   6. Restore protected blocks
 *   7. Final blank-line collapse
 * =========================================================
 */

/* =========================================================
 * 1. UTILITIES
 * ========================================================= */

/**
 * Normalize \r\n and stray \r to \n.
 */
function normalizeNewlines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Strip trailing spaces / tabs on every line.
 */
function trimTrailingWhitespace(text) {
  return text.replace(/[ \t]+$/gm, '');
}

/**
 * Collapse runs of 3+ blank lines into exactly 2 (\n\n).
 */
function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, '\n\n');
}

const VIETNAMESE_SECTION_REPLACEMENTS = [
  [/^tai lieu mon hoc$/i, 'Tài liệu môn học'],
  [/^theo tai lieu mon hoc$/i, 'Theo tài liệu môn học'],
  [/^vi du nho$/i, 'Ví dụ nhỏ'],
  [/^luu y de hoc tot hon$/i, 'Lưu ý để học tốt hơn'],
  [/^nguon tai lieu da dung$/i, 'Nguồn tài liệu đã dùng'],
  [/^mo ta\b/i, 'Mô tả'],
  [/^cau truc\b/i, 'Cấu trúc'],
  [/^gia tri\b/i, 'Giá trị'],
  [/^cac he thong\b/i, 'Các hệ thống'],
  [/^thuat toan\b/i, 'Thuật toán'],
  [/^cong thuc\b/i, 'Công thức'],
  [/^dinh nghia\b/i, 'Định nghĩa'],
  [/^khai niem\b/i, 'Khái niệm'],
  [/^chuyen doi\b/i, 'Chuyển đổi'],
  [/^co so\b/i, 'Cơ số'],
  [/^phan\b/i, 'Phần'],
  [/^tom tat\b/i, 'Tóm tắt'],
  [/^ket luan\b/i, 'Kết luận'],
  [/^ket qua\b/i, 'Kết quả'],
  [/^buoc\b/i, 'Bước'],
  [/^dac diem\b/i, 'Đặc điểm'],
  [/^tinh chat\b/i, 'Tính chất'],
  [/^so sanh\b/i, 'So sánh'],
  [/^ung dung\b/i, 'Ứng dụng'],
  [/^phuong phap\b/i, 'Phương pháp'],
];

function toVietnameseSectionKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const VIETNAMESE_EXACT_SECTION_LABELS = {
  'tai lieu mon hoc': 'Tài liệu môn học',
  'theo tai lieu mon hoc': 'Theo tài liệu môn học',
  'vi du nho': 'Ví dụ nhỏ',
  'vi du nho neu can': 'Ví dụ nhỏ nếu cần',
  'luu y de hoc tot hon': 'Lưu ý để học tốt hơn',
  'nguon tai lieu da dung': 'Nguồn tài liệu đã dùng',
  'chan doan van de': 'Chẩn đoán vấn đề',
  'nguyen nhan co the': 'Nguyên nhân có thể',
  'cach debug tung buoc': 'Cách debug từng bước',
  'goi y sua': 'Gợi ý sửa',
  'chu de nen on lai': 'Chủ đề nên ôn lại',
};

function normalizeVietnameseSectionLine(line) {
  const prefix = line.match(/^(\s*#{0,6}\s*)/)?.[1] || '';
  const body = line.slice(prefix.length).trim();
  if (!body || body.length > 90) return line;

  const exactLabel = VIETNAMESE_EXACT_SECTION_LABELS[toVietnameseSectionKey(body)];
  if (exactLabel) {
    return `${prefix}${exactLabel}`;
  }

  for (const [pattern, replacement] of VIETNAMESE_SECTION_REPLACEMENTS) {
    if (pattern.test(body)) {
      return `${prefix}${body.replace(pattern, replacement)}`;
    }
  }

  return line;
}

function normalizeVietnameseSectionLabels(text) {
  return text
    .split('\n')
    .map(normalizeVietnameseSectionLine)
    .join('\n');
}

/* =========================================================
 * 2. LINE DETECTORS
 * ========================================================= */

function isFenceLine(line) {
  return /^\s*(```|~~~)/.test(line);
}

function isListLine(line) {
  return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
}

function isTableLine(line) {
  const t = line.trim();
  return t.includes('|') && t.split('|').filter(Boolean).length >= 2;
}

function isHeadingLine(line) {
  return /^#{1,6}\s+/.test(line.trim());
}

/* =========================================================
 * 3. INLINE TABLE HARD-FIX
 * =========================================================
 * AI sometimes smashes an entire table into one line:
 *   "Text: | A | B | |---|---| |1|2|"
 *
 * Strategy: detect consecutive pipe-groups and split them
 * onto separate lines.
 * ========================================================= */

function hardFixInlineTables(text) {
  return text.replace(
    /([^\n|])[ \t]*(\|(?:[^|\n]+\|){1,}(?:\s*\|(?:[^|\n]+\|){1,})+)/g,
    (_, prefix, tableBlob) => {
      // Split on boundaries where a cell-end pipe is followed by whitespace
      // then another cell-start pipe.
      const rows = tableBlob
        .replace(/\|\s*\|/g, '|\n|')
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);
      return `${prefix}\n\n${rows.join('\n')}`;
    },
  );
}

/* =========================================================
 * 4. MATH NORMALIZATION
 * =========================================================
 * Handles:
 *   \[...\]  → $$ ... $$  (block)
 *   \(...\)  → $ ... $    (inline)
 *   Lone $ on a line → $$ (block delimiter)
 *   Blank lines INSIDE $$ blocks → removed
 *   Missing blank lines AROUND $$ → injected
 * ========================================================= */

function normalizeMath(text) {
  // A) Convert LaTeX display/inline delimiters
  let result = text
    .replace(/\\\[/g, '\n$$\n')
    .replace(/\\\]/g, '\n$$\n')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');

  // B) Convert isolated single-$ lines into $$ block delimiters
  let lines = result.split('\n').map((line) => {
    if (/^\s*\$\s*$/.test(line)) return '$$';
    return line;
  });

  // C) Remove blank lines inside $$ blocks (remark-math chokes on them)
  let inBlock = false;
  let cleaned = [];

  for (const line of lines) {
    if (/^\s*\$\$\s*$/.test(line)) {
      inBlock = !inBlock;
      cleaned.push('$$');
      continue;
    }
    if (inBlock && line.trim() === '') continue;
    cleaned.push(line);
  }

  // D) Ensure blank lines surround every $$ delimiter
  //    so remark-math treats them as paragraph-level blocks
  const spaced = [];
  for (let i = 0; i < cleaned.length; i++) {
    const cur = cleaned[i];
    const prev = spaced[spaced.length - 1];

    if (cur === '$$') {
      if (prev !== undefined && prev.trim() !== '') spaced.push('');
      spaced.push(cur);
      const next = cleaned[i + 1];
      if (next !== undefined && next.trim() !== '') spaced.push('');
    } else {
      spaced.push(cur);
    }
  }

  return spaced.join('\n');
}

/* =========================================================
 * 5. PROTECT / RESTORE BLOCKS
 * =========================================================
 * Code fences (```…```) and math blocks ($$…$$) must be
 * invisible to the normalizer steps that follow.
 *
 * We swap them with NUL-delimited placeholders, run the
 * pipeline, then swap them back.
 *
 * Uses a line-based state machine (not regex) to precisely
 * capture block boundaries without eating surrounding blanks.
 * ========================================================= */

const PLACEHOLDER_PREFIX = '\x00BLK';
const PLACEHOLDER_SUFFIX = '\x00';

function protectBlocks(text) {
  const vault = [];
  let id = 0;

  const store = (content) => {
    const key = `${PLACEHOLDER_PREFIX}${id++}${PLACEHOLDER_SUFFIX}`;
    vault.push({ key, content });
    return key;
  };

  // --- Pass 1: line-based scan for code fences and $$ blocks ---
  const lines = text.split('\n');
  const output = [];
  let blockLines = [];
  let blockType = null; // 'fence' | 'math'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (blockType === null) {
      // Not inside a block — check for openers
      if (isFenceLine(line)) {
        blockType = 'fence';
        blockLines = [line];
      } else if (/^\s*\$\$\s*$/.test(line)) {
        blockType = 'math';
        blockLines = [line];
      } else {
        output.push(line);
      }
    } else if (blockType === 'fence') {
      blockLines.push(line);
      if (isFenceLine(line) && blockLines.length > 1) {
        // Closing fence found
        output.push(store(blockLines.join('\n')));
        blockLines = [];
        blockType = null;
      }
    } else if (blockType === 'math') {
      blockLines.push(line);
      if (/^\s*\$\$\s*$/.test(line) && blockLines.length > 1) {
        // Closing $$ found — strip any blank lines inside the block
        // (normalizeMath already removed them, but spacing lines from
        //  step D may have been absorbed by the state machine)
        const cleanedBlock = blockLines
          .filter((l) => l.trim() !== '' || /^\s*\$\$\s*$/.test(l))
          .join('\n');
        output.push(store(cleanedBlock));
        blockLines = [];
        blockType = null;
      }
    }
  }

  // Protect partial blocks too so streaming output is never rewritten.
  if (blockLines.length > 0) {
    output.push(store(blockLines.join('\n')));
  }

  let result = output.join('\n');

  // --- Pass 2: protect inline math ($…$) on single lines ---
  result = result.replace(
    /\$([^$\n]+)\$/g,
    (match) => store(match),
  );

  return { text: result, vault };
}

function restoreBlocks(text, vault) {
  // IMPORTANT: Do NOT use .replace() or .replaceAll() here!
  // JavaScript treats $$ in replacement strings as "insert literal $",
  // which silently destroys math block delimiters ($$).
  // Using split().join() avoids all replacement-pattern pitfalls.
  for (let i = vault.length - 1; i >= 0; i--) {
    text = text.split(vault[i].key).join(vault[i].content);
  }
  return text;
}

/* =========================================================
 * 6. LIST NORMALIZATION
 * =========================================================
 * Fixes:
 *   "text - item" → "text\n- item"
 *   "-item"       → "- item"
 *   "1.item"      → "1. item"
 * ========================================================= */

function normalizeLists(text) {
  return text
    .replace(/([^\n])(\s+)([-*+]\s+)/g, '$1\n$3')
    .replace(/([^\n])(\s+)(\d+[.)]\s+)/g, '$1\n$3')
    .replace(/^(\s*)[-*+](\S)/gm, '$1- $2')
    .replace(/^(\s*)(\d+)[.)](\S)/gm, '$1$2. $3');
}

/* =========================================================
 * 7. TABLE ENGINE (GFM)
 * =========================================================
 * Groups consecutive table-like lines, pads columns,
 * infers a missing separator row, and outputs valid GFM.
 * ========================================================= */

function splitCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function buildGfmTable(rows) {
  if (!rows.length) return [];

  const parsed = rows.map(splitCells);
  const cols = Math.max(...parsed.map((r) => r.length));

  // Pad every row to the same column count
  const padded = parsed.map((r) => {
    const copy = [...r];
    while (copy.length < cols) copy.push('');
    return copy;
  });

  const header = padded[0];
  let body = padded.slice(1);

  // Strip existing separator (if present)
  if (body.length && isSeparatorRow(body[0])) {
    body = body.slice(1);
  }

  const sep = Array(cols).fill('---');

  return [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ];
}

function repairTables(text) {
  const lines = text.split('\n');
  const out = [];
  let buf = [];

  const flush = () => {
    if (buf.length) {
      out.push(...buildGfmTable(buf));
      buf = [];
    }
  };

  for (const line of lines) {
    if (isTableLine(line)) {
      buf.push(line);
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join('\n');
}

/* =========================================================
 * 8. HEADING INFERENCE
 * =========================================================
 * Vietnamese AI answers frequently emit section titles as
 * plain text (no # prefix). We detect them by pattern and
 * promote to ### headings.
 * ========================================================= */

// JavaScript's `\b` is ASCII-oriented and fails after Vietnamese characters
// such as "ý", "ụ" and "ị". Use an explicit Unicode-safe suffix instead.
const SECTION_BOUNDARY = '(?=\\s|:|$)';
const sectionPattern = (label) => new RegExp(`^${label}${SECTION_BOUNDARY}`, 'iu');

const HEADING_PATTERNS = [
  /^tài liệu môn học$/i,
  /^theo tài liệu môn học$/i,
  sectionPattern('mô tả'),
  sectionPattern('cấu trúc'),
  sectionPattern('giá trị'),
  /^các .+ được đề cập$/i,
  sectionPattern('thuật toán'),
  sectionPattern('ví dụ'),
  sectionPattern('lưu ý'),
  sectionPattern('nguồn tài liệu'),
  sectionPattern('công thức'),
  sectionPattern('định nghĩa'),
  sectionPattern('khái niệm'),
  sectionPattern('chuyển đổi'),
  sectionPattern('cơ số'),
  sectionPattern('phần'),
  sectionPattern('tóm tắt'),
  sectionPattern('kết luận'),
  sectionPattern('kết quả'),
  sectionPattern('bước'),
  sectionPattern('đặc điểm'),
  sectionPattern('tính chất'),
  sectionPattern('so sánh'),
  sectionPattern('ứng dụng'),
  sectionPattern('phương pháp'),
  sectionPattern('chẩn đoán'),
  sectionPattern('nguyên nhân'),
  sectionPattern('cách debug'),
  sectionPattern('gợi ý sửa'),
  sectionPattern('chủ đề nên ôn'),
];

function inferHeadings(text) {
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (
        t.length > 0 &&
        t.length < 90 &&
        !isHeadingLine(t) &&
        !isListLine(t) &&
        !isTableLine(t) &&
        !isFenceLine(t) &&
        HEADING_PATTERNS.some((p) => p.test(t))
      ) {
        return `### ${t}`;
      }
      return line;
    })
    .join('\n');
}

/* =========================================================
 * 8B. STUDY TIP ACTION LINKS
 * =========================================================
 * Backend/LLM often emits a "Lưu ý để học tốt hơn" section
 * as normal bullets or plain lines. The chat UI can analyze
 * those study tips, so we convert only that section into safe
 * internal markdown links. React markdown renders those links
 * as buttons through LinkRenderer.
 * ========================================================= */

function escapeMarkdownLabel(text) {
  return String(text || '').replace(/([\\[\]])/g, '\\$1');
}

function isStudyTipHeading(line) {
  return /^#{1,6}\s*lưu ý(?=\s|:|$)/iu.test(line.trim());
}

function isSourceHeading(line) {
  return /^#{1,6}\s*nguồn tài liệu\b/i.test(line.trim());
}

function isSectionHeading(line) {
  return /^#{1,6}\s+\S/.test(line.trim());
}

function stripSourceListPrefix(line) {
  return String(line || '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .trim();
}

function hasMarkdownLink(text) {
  return /\[[^\]]+\]\([^)]+\)/.test(text);
}

function makeStudyTipLink(text, index) {
  return `[${escapeMarkdownLabel(text)}](#ai-study-tip-${index})`;
}

function enhanceStudyTips(text) {
  const lines = text.split('\n');
  const output = [];
  let inStudyTips = false;
  let tipIndex = 1;

  for (const line of lines) {
    const trimmed = line.trim();

    if (isStudyTipHeading(line)) {
      inStudyTips = true;
      output.push(line);
      continue;
    }

    if (inStudyTips && isSectionHeading(line)) {
      inStudyTips = false;
      output.push(line);
      continue;
    }

    if (
      !inStudyTips ||
      !trimmed ||
      isTableLine(line) ||
      isFenceLine(line) ||
      isMaterialSourceText(trimmed) ||
      hasMarkdownLink(trimmed)
    ) {
      output.push(line);
      continue;
    }

    const bullet = line.match(/^(\s*[-*+]\s+)(.+)$/);
    if (bullet) {
      output.push(`${bullet[1]}${makeStudyTipLink(bullet[2].trim(), tipIndex++)}`);
      continue;
    }

    const ordered = line.match(/^(\s*\d+[.)]\s+)(.+)$/);
    if (ordered) {
      output.push(`${ordered[1]}${makeStudyTipLink(ordered[2].trim(), tipIndex++)}`);
      continue;
    }

    output.push(`- ${makeStudyTipLink(trimmed, tipIndex++)}`);
  }

  return output.join('\n');
}

function normalizeSourceSection(text) {
  const lines = text.split('\n');
  const output = [];
  let inSources = false;
  let emittedSourceHeading = false;
  let pendingSources = [];
  const seenSources = new Set();

  const addSource = (value) => {
    const source = stripSourceListPrefix(value);
    if (!isMaterialSourceText(source)) return false;
    const sourceItems = extractSourceFileLabels(source);
    const normalizedSources = sourceItems.length ? sourceItems : [source];
    normalizedSources.forEach((item) => {
      const key = item.toLowerCase();
      if (!seenSources.has(key)) {
        seenSources.add(key);
        pendingSources.push(item);
      }
    });
    return true;
  };

  const flushSources = () => {
    if (!pendingSources.length) return;
    if (!emittedSourceHeading) {
      output.push('### Nguồn tài liệu đã dùng');
      emittedSourceHeading = true;
    }
    pendingSources.forEach((source) => output.push(`- ${source}`));
    pendingSources = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (isSourceHeading(line)) {
      inSources = true;
      if (!emittedSourceHeading) {
        output.push(line);
        emittedSourceHeading = true;
      }
      continue;
    }

    if (inSources && isSectionHeading(line)) {
      flushSources();
      inSources = false;
      output.push(line);
      continue;
    }

    if (isMaterialSourceText(stripSourceListPrefix(trimmed))) {
      addSource(trimmed);
      continue;
    }

    output.push(line);
  }

  flushSources();

  return output.join('\n');
}

/* =========================================================
 * 9. BLOCKQUOTE CLEANUP
 * ========================================================= */

function normalizeBlockquotes(text) {
  return text.replace(/^>\s*/gm, '> ');
}

/* =========================================================
 * 10. LINK SANITIZATION
 * ========================================================= */

function sanitizeLinks(text) {
  return text.replace(/\[(.*?)\]\((.*?)\)/g, (match, label, url) => {
    const safe = sanitizeLinkUrl(url);
    if (!safe) return label;
    return `[${label}](${safe})`;
  });
}

/* =========================================================
 * 11. PIPELINE
 * ========================================================= */

/**
 * Normalize messy AI-generated markdown into clean GFM that
 * renders correctly with react-markdown + remark-gfm +
 * remark-math + rehype-katex.
 *
 * Safe to call on every render — idempotent by design.
 *
 * @param {string} input  Raw AI markdown
 * @returns {string}      Cleaned GFM markdown
 */
export function normalizeAiMarkdown(input = '') {
  let text = normalizeUnicodeText(input);
  if (!text.trim()) return '';

  /* 1 */ text = normalizeNewlines(text);
  /* 2 */ text = trimTrailingWhitespace(text);
  /* 3 */ text = collapseBlankLines(text);
  // Protect original code/math before any structural repair can touch it.
  const originalBlocks = protectBlocks(text);
  text = originalBlocks.text;

  /* 5 */ text = normalizeMath(text);

  // Protect math blocks created from \[...\] before list/table normalization.
  const normalizedMathBlocks = protectBlocks(text);
  text = normalizedMathBlocks.text;

  /* 6 */  text = normalizeVietnameseSectionLabels(text);
  /* 7 */  text = hardFixInlineTables(text);
  /* 8 */  text = normalizeLists(text);
  /* 9 */  text = repairTables(text);
  /* 10 */ text = inferHeadings(text);
  /* 11 */ text = normalizeSourceSection(text);
  /* 12 */ text = enhanceStudyTips(text);
  /* 13 */ text = normalizeBlockquotes(text);
  /* 14 */ text = sanitizeLinks(text);

  /* 15 Restore protected blocks in reverse nesting order. */
  text = restoreBlocks(text, normalizedMathBlocks.vault);
  text = restoreBlocks(text, originalBlocks.vault);

  /* 16 */ text = collapseBlankLines(text);

  return text;
}

export function stripSourceSection(input = '') {
  const lines = String(input || '').split('\n');
  const output = [];
  let inSources = false;

  for (const line of lines) {
    if (isSourceHeading(line)) {
      inSources = true;
      continue;
    }

    if (inSources && isSectionHeading(line)) {
      inSources = false;
      output.push(line);
      continue;
    }

    if (!inSources) {
      output.push(line);
    }
  }

  return output.join('\n').trim();
}

/* =========================================================
 * 12. REACT HELPERS
 * ========================================================= */

/**
 * Recursively extract plain text from a React node tree.
 * Used by renderers (CodeBlock, CopyButton, etc.) to get
 * the raw text value of `children`.
 */
export function getNodeText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (React.isValidElement(node)) return getNodeText(node.props.children);
  return '';
}
