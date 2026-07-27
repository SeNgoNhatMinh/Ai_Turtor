import { repairMojibake } from '../../utils/textEncoding.js';

const PDF_INDD_ARTIFACT = /\b[a-z]\d{2}\.indd\s+\d+\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}\b/gi;
const PDF_PAGE_FOOTER = /\b\d{1,4}\s*\|\s*CH(?:ap(?:ter)?)?(?:Ter)?\s*\d+\b/gi;
const PDF_PAGE_HEADER = /^\s*\d{1,4}\s*\|\s*Chap(?:ter)?\s*\d+[^\n.]{0,140}\.?\s*/i;

const CODE_SIGNAL = /<%[@!=!]?|<jsp:|<\/[a-z][\w:-]*>|public\s+(static\s+)?(void|class|interface)\b|import\s+java\.|\bclass\s+\w+\s*\{/i;

function polishProse(text) {
  return repairMojibake(String(text || '')).replace(/\s+/g, ' ').trim();
}

export function looksLikeCodeText(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/^\s*<\?xml[\s>]/i.test(s)) return true;
  if (/<jsp:[\w-]+|<jsp:root|<jsp:directive|<jsp:output|<jsp:useBean/i.test(s)) return true;
  if (/<%[@!=!]?|<%[^@%]/i.test(s)) return true;
  const tagCount = (s.match(/<[a-z][\w:-]*[\s/>]/gi) || []).length;
  if (tagCount >= 2) return true;
  if (/<\/[a-z][\w:-]*>/i.test(s) && tagCount >= 1) return true;
  if (/\bpublic\s+(static\s+)?(class|void|interface)\b/.test(s) && /[{;]/.test(s)) return true;
  return CODE_SIGNAL.test(s) && tagCount >= 1;
}

export function inferExcerptLanguage(code) {
  const text = String(code || '');
  if (/<%[@!=!]?|<jsp:/i.test(text)) return 'markup';
  if (/^\s*[{[]/.test(text.trim())) return 'json';
  if (/\b(public|class|static|void|import java\.)\b/.test(text)) return 'java';
  if (/<[a-z][\s\S]*>/i.test(text)) return 'markup';
  if (/\b(select|from|where)\b/i.test(text)) return 'sql';
  return 'text';
}

/** Inserts line breaks so PDF-extracted JSP/HTML/Java is readable in a code viewer. */
export function normalizeCodeNewlines(text) {
  if (!looksLikeCodeText(text)) return String(text || '').trim();

  let value = String(text).replace(/\r\n/g, '\n');
  value = value.replace(/\s*(<\?xml)/gi, '\n$1');
  value = value.replace(/\s*(<jsp:)/gi, '\n$1');
  value = value.replace(/\s*(<%@)/g, '\n$1');
  value = value.replace(/\s*(<%[!@=])/g, '\n$1');
  value = value.replace(/([^%\n])\s*(<%)(?![@!@=])/g, '$1\n$2');
  value = value.replace(/%>\s*/g, '%>\n');
  value = value.replace(/>\s*(<)/g, '>\n$1');
  value = value.replace(/;\s+(?=(?:public|private|protected|import|@|\/\/|\/\*|\w+\s+\w+\s*=))/g, ';\n');
  value = value.replace(/\{\s*(?=\w)/g, '{\n');
  value = value.replace(/\}\s*(?=else\b|catch\b|finally\b|\))/g, '}\n');
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function splitTitleFromCode(text) {
  const formatted = normalizeCodeNewlines(text);
  const lines = formatted.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return { title: null, code: formatted };
  }

  const first = lines[0];
  const rest = lines.slice(1).join('\n');
  if (!looksLikeCodeText(first) && first.length <= 140 && looksLikeCodeText(rest)) {
    return { title: first, code: rest };
  }
  return { title: null, code: formatted };
}

/** Removes common PDF extraction noise without changing technical meaning. */
export function cleanChapterExcerptRaw(text) {
  let value = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!value) return '';

  value = value.replace(PDF_INDD_ARTIFACT, ' ');
  value = value.replace(PDF_PAGE_FOOTER, ' ');
  value = value.replace(PDF_PAGE_HEADER, '');
  if (!looksLikeCodeText(value)) {
    value = value.replace(/\s+In This Chapter\s+/gi, '\n\nIn This Chapter\n\n');
    value = value.replace(/\s>>\s+/g, '\n• ');
    value = value.replace(/[ \t]{2,}/g, ' ');
  }
  value = value.replace(/\n{3,}/g, '\n\n');

  return value.trim();
}

function splitLongParagraph(text, maxLen = 520) {
  const blocks = [];
  let rest = String(text || '').trim();
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('. ', maxLen);
    if (cut < maxLen * 0.35) cut = rest.lastIndexOf(' ', maxLen);
    if (cut < 1) cut = maxLen;
    const chunk = rest.slice(0, cut + (rest[cut] === '.' ? 1 : 0)).trim();
    if (chunk) blocks.push({ type: 'paragraph', text: chunk });
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) blocks.push({ type: 'paragraph', text: rest });
  return blocks;
}

function asCodeBlock(text) {
  const { title, code } = splitTitleFromCode(text);
  const blocks = [];
  if (title) blocks.push({ type: 'heading', text: polishProse(title) });
  if (code && looksLikeCodeText(code)) {
    blocks.push({
      type: 'code',
      text: code,
      language: inferExcerptLanguage(code),
    });
  } else if (code) {
    blocks.push({ type: 'paragraph', text: polishProse(code) });
  }
  return blocks;
}

function classifyBlock(text, index) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  if (looksLikeCodeText(trimmed)) {
    return asCodeBlock(trimmed);
  }

  if (trimmed.startsWith('• ')) {
    return { type: 'list-item', text: trimmed.slice(2).trim() };
  }

  const isShortLead = index === 0
    && trimmed.length <= 180
    && !trimmed.endsWith('.')
    && !looksLikeCodeText(trimmed);
  const isSectionLabel = /^In This Chapter$/i.test(trimmed);
  if (isShortLead || isSectionLabel) {
    return { type: 'heading', text: polishProse(trimmed) };
  }

  if (trimmed.length > 720) {
    return splitLongParagraph(trimmed).map((block) => ({
      ...block,
      text: polishProse(block.text),
    }));
  }

  return { type: 'paragraph', text: polishProse(trimmed) };
}

function pushClassified(blocks, classified) {
  if (Array.isArray(classified)) blocks.push(...classified);
  else if (classified) blocks.push(classified);
}

/** Turns a raw backend excerpt into readable blocks for teacher/senior review UI. */
export function parseChapterExcerptBlocks(text) {
  const cleaned = cleanChapterExcerptRaw(text);
  if (!cleaned) return [];

  if (looksLikeCodeText(cleaned) && !cleaned.includes('\n• ') && cleaned.length > 60) {
    return asCodeBlock(cleaned);
  }

  const segments = cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const blocks = [];

  segments.forEach((segment, index) => {
    if (looksLikeCodeText(segment)) {
      pushClassified(blocks, asCodeBlock(segment));
      return;
    }

    const lines = segment.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length > 1) {
      lines.forEach((line, lineIndex) => {
        pushClassified(blocks, classifyBlock(line, index + lineIndex));
      });
      return;
    }

    pushClassified(blocks, classifyBlock(segment, index));
  });

  return blocks;
}
