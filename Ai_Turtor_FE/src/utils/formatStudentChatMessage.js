/**
 * Display helpers so pasted student source looks like ChatGPT:
 * reconstruct exploded markup, split the question from the code, indent tags.
 */

const MARKUP_START = /(?:<\s*[\w!?/]|<%@|<%!|<%=|<%\s|public\s+class\s|function\s+\w+\s*\()/;
const SHORT_LINE = 24;

export function isExplodedMarkup(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 8) return false;
  const shortCount = lines.filter((line) => line.length <= SHORT_LINE).length;
  return shortCount / lines.length >= 0.65
    && /jsp:|xmlns:|<\/|<%|<!/.test(String(text || ''));
}

export function reconstructExplodedMarkup(text) {
  const joined = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  return joined
    .replace(/:\s+/g, ':')
    .replace(/\s*=\s*/g, '=')
    .replace(/<\s+/g, '<')
    .replace(/<\/\s+/g, '</')
    .replace(/\s+\/>/g, '/>')
    .replace(/\s+>/g, '>')
    .replace(/="\s+/g, '="')
    .replace(/\s+"/g, '"')
    .replace(/"(\w+=)/g, '" $1')
    .trim();
}

export function prettyPrintMarkup(text) {
  const splitTags = String(text || '')
    .replace(/>\s*</g, '>\n<')
    .trim();
  if (!splitTags) return '';

  const lines = splitTags.split(/\n/).map((line) => line.trim()).filter(Boolean);
  let depth = 0;
  const out = [];

  for (const line of lines) {
    const isClosing = /^<\//.test(line);
    const isComment = /^<!--/.test(line);
    const isSelfClosing = /\/>$/.test(line) || /^<!(?:DOCTYPE)/.test(line);
    const isSameLinePair = /^<[^>]+>.*<\/[\w:.-]+>\s*$/.test(line);
    if (isClosing) {
      depth = Math.max(0, depth - 1);
    }
    out.push(`${'  '.repeat(depth)}${line}`);
    if (!isClosing && !isSelfClosing && !isSameLinePair && !isComment && /^<[\w!]/.test(line)) {
      depth += 1;
    }
  }

  return out.join('\n');
}

export function splitProseAndCode(text) {
  const raw = String(text || '').trim();
  if (!raw) return { prose: '', code: '' };

  const start = raw.search(MARKUP_START);
  if (start < 0) {
    return { prose: raw, code: '' };
  }

  const before = raw.slice(0, start).trim();
  let code = raw.slice(start).trim();
  let after = '';

  const closing = code.lastIndexOf('</');
  if (closing >= 0) {
    const afterClose = code.indexOf('>', closing);
    if (afterClose >= 0 && afterClose < code.length - 1) {
      const trailing = code.slice(afterClose + 1).trim();
      if (trailing && !trailing.startsWith('<')) {
        after = trailing;
        code = code.slice(0, afterClose + 1).trim();
      }
    }
  }

  const prose = [before, after].filter(Boolean).join('\n\n');
  return { prose, code };
}

function looksLikeMarkup(text) {
  return /<[a-zA-Z!?/]/.test(String(text || ''));
}

export function formatStudentChatMessage(text) {
  const raw = String(text || '');
  const source = isExplodedMarkup(raw) ? reconstructExplodedMarkup(raw) : raw;
  const parts = splitProseAndCode(source);
  if (parts.code && parts.code.length < 12) {
    return { prose: raw.trim(), code: '' };
  }
  return {
    prose: parts.prose,
    code: looksLikeMarkup(parts.code) ? prettyPrintMarkup(parts.code) : parts.code,
  };
}
