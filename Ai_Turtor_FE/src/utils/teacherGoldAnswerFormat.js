import { normalizeAiMarkdown } from './markdownPreprocessor.js';

const CODE_TOKEN = /(?:<%@[\s\S]*?%>|<%=?[\s\S]*?%>|<\/?(?:jsp:)?[A-Za-z][\w:.-]*\b[^>]*>)/g;
const CODE_LINE = /(?:<%@|<%=?|%>|<jsp:|<\/jsp:)|(?:^\s*<\/?[A-Za-z][\w:.-]*[\s/>])|(?:[{};]\s*$)/;
const LABEL_LINE = /^(định nghĩa|khái niệm|cú pháp|ví dụ|lưu ý|khác biệt|so sánh|ưu điểm|nhược điểm|jspx?|xml|html)\s*[:：]\s+/i;

const looksLikeMarkdown = (text) => (
  /(^|\n)\s{0,3}#{1,6}\s+\S/.test(text)
  || /(^|\n)```/.test(text)
  || /(^|\n)\|.+\|/.test(text)
  || /\*\*[^*\n]{2,}\*\*/.test(text)
);

const looksLikeCodeLine = (line) => {
  const trimmed = line.trim();
  if (trimmed.length < 8 || !CODE_LINE.test(trimmed)) return false;
  const leftover = trimmed.replace(CODE_TOKEN, '').replace(/`+/g, '').trim();
  return leftover.length <= 16;
};

function wrapInlineCode(text) {
  return text.replace(CODE_TOKEN, (token) => {
    const compact = token.replace(/\s+/g, ' ').trim();
    if (!compact || compact.includes('`')) return token;
    return `\`${compact}\``;
  });
}

function fenceCodeRuns(text) {
  const lines = text.split('\n');
  const output = [];
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    output.push('```xml', ...buffer, '```');
    buffer = [];
  };

  for (const line of lines) {
    if (looksLikeCodeLine(line) && line.trim().length > 6) {
      buffer.push(line.trim());
      continue;
    }
    flush();
    output.push(line);
  }
  flush();
  return output.join('\n');
}

function emphasizeLabels(text) {
  return text
    .split('\n')
    .map((line) => {
      const match = line.match(LABEL_LINE);
      if (!match) return line;
      const label = match[1];
      const rest = line.slice(match[0].length).trim();
      const pretty = `${label[0].toUpperCase()}${label.slice(1)}`;
      return rest ? `### ${pretty}\n\n${rest}` : line;
    })
    .join('\n');
}

function breakPackedSentences(text) {
  return text.replace(/([.!?…])[ \t]+(?=[\p{Lu}“"0-9])/gu, '$1\n\n');
}

function promoteShortLead(text) {
  const blocks = text.split(/\n{2,}/);
  if (blocks.length < 2) return text;
  const lead = blocks[0].trim();
  if (lead.length > 72 || /[.!?]$/.test(lead) || lead.startsWith('#')) return text;
  blocks[0] = `### ${lead}`;
  return blocks.join('\n\n');
}

export function formatTeacherGoldAnswer(input = '') {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (looksLikeMarkdown(raw)) {
    return normalizeAiMarkdown(raw);
  }

  let text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ');

  text = wrapInlineCode(text);
  text = fenceCodeRuns(text);
  text = breakPackedSentences(text);
  text = emphasizeLabels(text);
  text = text
    .replace(/([^\n])\s+[-*•]\s+/g, '$1\n- ')
    .replace(/([^\n])\s+(\d+)[.)]\s+/g, '$1\n$2. ');
  text = promoteShortLead(text);

  return normalizeAiMarkdown(text);
}
