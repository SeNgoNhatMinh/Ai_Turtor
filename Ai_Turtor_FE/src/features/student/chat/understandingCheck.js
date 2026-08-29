const CHECK_HEADING = /^(#{1,6})\s*kiểm tra hiểu\s*$/im;
const OPTION_MARK = /(?:^|\s)([A-D])\.\s+/g;
const ANSWER_LINE = /(?:^|\n)\s*(?:đáp án|dap an|answer|correct)\s*[:：]\s*([A-Da-d])\b\.?/i;
const EXPLAIN_LINE = /(?:^|\n)\s*(?:giải thích|giai thich|explanation|lý do|ly do)\s*[:：]\s*([\s\S]+)$/i;
const QUESTION_PREFIX = /^(?:câu hỏi|cau hoi|question)\s*[:：]\s*/im;

function stripDecorations(value) {
  return String(value || '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_`]+/g, '')
    .replace(/\s+-{2,}\s*$/g, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nextSectionBreak(text) {
  const heading = text.search(/(?:^|\n)#{1,6}\s+\S/);
  const rule = text.search(/(?:^|\n)\s*-{3,}\s*(?:\n|$)/);
  const indexes = [heading, rule].filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

export function parseUnderstandingQuiz(sectionBody) {
  const raw = String(sectionBody || '').trim();
  if (!raw) return null;

  const answerMatch = raw.match(ANSWER_LINE);
  const explainMatch = raw.match(EXPLAIN_LINE);
  let working = raw;
  if (explainMatch) working = working.replace(explainMatch[0], '\n');
  if (answerMatch) working = working.replace(answerMatch[0], '\n');
  working = working.replace(QUESTION_PREFIX, '').trim();

  const marks = [];
  OPTION_MARK.lastIndex = 0;
  let match = OPTION_MARK.exec(working);
  while (match) {
    marks.push({
      key: match[1].toUpperCase(),
      start: match.index,
      textStart: match.index + match[0].length,
    });
    match = OPTION_MARK.exec(working);
  }
  if (marks.length < 2) return null;

  const question = stripDecorations(working.slice(0, marks[0].start))
    .replace(/[?\s]+$/, '');
  if (!question) return null;

  const options = marks.map((item, index) => {
    const end = index + 1 < marks.length ? marks[index + 1].start : working.length;
    return {
      key: item.key,
      text: stripDecorations(working.slice(item.textStart, end)).replace(/[;|]+$/, ''),
    };
  }).filter((item) => item.text);

  if (options.length < 2) return null;

  return {
    question: `${question}?`,
    options,
    correctKey: answerMatch ? answerMatch[1].toUpperCase() : '',
    explanation: explainMatch ? stripDecorations(explainMatch[1]) : '',
  };
}

export function extractUnderstandingCheck(markdown) {
  const text = String(markdown || '');
  const heading = CHECK_HEADING.exec(text);
  if (!heading) {
    return { before: text, after: '', quiz: null };
  }

  const afterHeading = heading.index + heading[0].length;
  const rest = text.slice(afterHeading).replace(/^\s*\n/, '');
  const breakAt = nextSectionBreak(rest);
  const sectionBody = (breakAt < 0 ? rest : rest.slice(0, breakAt)).trim();
  const quiz = parseUnderstandingQuiz(sectionBody);
  if (!quiz) {
    return { before: text, after: '', quiz: null };
  }

  const after = breakAt < 0 ? '' : rest.slice(breakAt).replace(/^\s*-{3,}\s*/, '').trim();
  return {
    before: text.slice(0, heading.index).trimEnd(),
    after,
    quiz,
  };
}

export function buildUnderstandingCheckPrompt(quiz, selected) {
  const question = String(quiz?.question || '').trim();
  const choice = String(selected?.key || '').trim();
  const choiceText = String(selected?.text || '').trim();
  if (!question || !choice) return '';
  const options = (Array.isArray(quiz.options) ? quiz.options : [])
    .map((item) => `${item.key}. ${item.text}`)
    .join('\n');
  return [
    'Đây là câu kiểm tra hiểu trong bài đang học, không phải chủ đề mới.',
    `Câu hỏi: ${question}`,
    'Lựa chọn:',
    options,
    `Học sinh chọn: ${choice}. ${choiceText}`,
    'Hãy chấm: nói rõ Đúng hay Chưa đúng, nêu đáp án đúng, và giải thích ngắn theo tài liệu. Không mở lộ trình bài mới.',
  ].filter(Boolean).join('\n');
}
