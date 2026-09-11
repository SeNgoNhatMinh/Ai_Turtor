const CHECK_HEADING = /^(#{1,6})\s*(?:kiểm tra hiểu|understanding check|câu(?:\s+hỏi)?\s+trắc nghiệm mới(?:\s*\((?:(?:được|đã)\s+)?paraphrase\))?|câu hỏi ôn tập)\s*$/im;
const OPTION_MARK = /(?:^|\s)(?:\(([A-Da-d])\)|([A-Da-d])\.)\s+/g;
const CANONICAL_ANSWER = /(?:^|\s)(?<!chọn\s)(?<!choose\s)(?<!pick\s)(?:đáp án|dap an|(?:the\s+)?(?:correct\s+)?answer)(?:\s+đúng)?\s*(?:là|is|:|：|-)?\s*([A-Da-d])\b[^\n]*/i;
const REVEALED_ANSWER = /(?:^|\s)\s*[-*+]?\s*chọn đáp án đúng\s*[:：-]\s*(?:\n\s*[-*+]?\s*)?([A-Da-d])\s*[.)]?\s*[^\n]*/i;
const ANSWER_PROMPT_MARKER = /(?:^|\s)\s*[-*+]?\s*chọn đáp án đúng\s*[:：-]\s*(?:[-*+]\s*)?/i;
const LEAKED_ANSWER = /nếu bạn chọn(?:\s+đáp án)?\s+([A-Da-d])\b/i;
const CHOOSE_ANSWER = /(?:chọn|choose|pick)\s+(?:đáp án\s+)?([A-Da-d])\b/i;
const LONE_KEY = /(?:^|\n)\s*([A-Da-d])\s*[.)]?\s*$/;
const EXPLAIN_MARKER = /(?:^|\s)(?:giải thích|giai thich|explanation|lý do|ly do)\s*[:：]\s*/ig;
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
  return heading >= 0 ? heading : -1;
}

function javaStringHash(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash * 31) + text.charCodeAt(index)) | 0;
  }
  return hash;
}

function shuffleCorrectAnswerPosition(question, options, correctKey) {
  if (!correctKey || options.length < 2) return { options, correctKey };
  const correctOption = options.find((option) => option.key === correctKey);
  if (!correctOption) return { options, correctKey: '' };

  const seedInput = `${question}\u001f${options
    .map((option) => `${option.key}\u001e${option.text}`)
    .join('\u001f')}`;
  const targetIndex = ((javaStringHash(seedInput) % options.length) + options.length) % options.length;
  const reordered = options.filter((option) => option.key !== correctKey);
  reordered.splice(targetIndex, 0, correctOption);

  let shuffledCorrectKey = '';
  const relabeled = reordered.map((option, index) => {
    const key = String.fromCharCode(65 + index);
    if (option.key === correctKey) shuffledCorrectKey = key;
    return { key, text: option.text };
  });
  return { options: relabeled, correctKey: shuffledCorrectKey };
}

export function normalizeStructuredUnderstandingQuiz(value) {
  if (!value || typeof value !== 'object') return null;
  const question = String(value.question || '').trim();
  const seenKeys = new Set();
  const options = (Array.isArray(value.options) ? value.options : [])
    .map((option) => ({
      key: String(option?.key || '').trim().toUpperCase(),
      text: String(option?.text || '').trim(),
    }))
    .filter((option) => {
      if (!/^[A-D]$/.test(option.key) || !option.text || seenKeys.has(option.key)) return false;
      seenKeys.add(option.key);
      return true;
    });
  if (!question || options.length < 2) return null;

  const requestedKey = String(value.correctKey || '').trim().toUpperCase();
  const correctKey = options.some((option) => option.key === requestedKey) ? requestedKey : '';
  return {
    question,
    options,
    correctKey,
    explanation: String(value.explanation || '').trim(),
  };
}

export function parseUnderstandingQuiz(sectionBody) {
  const raw = String(sectionBody || '')
    .replace(/[*_`]+/g, '')
    .trim();
  if (!raw) return null;

  const canonicalMatch = raw.match(CANONICAL_ANSWER);
  const revealedAnswerMatch = raw.match(REVEALED_ANSWER);
  const leakedMatch = raw.match(LEAKED_ANSWER);
  const chooseMatch = raw.match(CHOOSE_ANSWER);
  const loneMatch = raw.match(LONE_KEY);
  const answerMatch = canonicalMatch || revealedAnswerMatch || leakedMatch || chooseMatch || loneMatch;
  const answerPromptMatch = raw.match(ANSWER_PROMPT_MARKER);
  let answerPromptIndex;
  if (Number.isInteger(answerPromptMatch?.index)) {
    const optionMarkersBeforePrompt = [...raw.slice(0, answerPromptMatch.index).matchAll(OPTION_MARK)];
    if (optionMarkersBeforePrompt.length >= 2) answerPromptIndex = answerPromptMatch.index;
  }
  const explainMarkers = [...raw.matchAll(EXPLAIN_MARKER)];
  const firstExplain = explainMarkers[0];
  const explanationEndCandidates = [
    ...explainMarkers.slice(1).map((item) => item.index),
    canonicalMatch?.index,
    revealedAnswerMatch?.index,
    raw.length,
  ].filter((index) => Number.isInteger(index) && index > (firstExplain?.index ?? -1));
  const explanationEnd = explanationEndCandidates.length
    ? Math.min(...explanationEndCandidates)
    : raw.length;
  const parsedExplanation = firstExplain
    ? raw.slice(firstExplain.index + firstExplain[0].length, explanationEnd)
    : '';
  const metadataIndexes = [
    canonicalMatch?.index,
    revealedAnswerMatch?.index,
    answerPromptIndex,
    ...explainMarkers.map((item) => item.index),
  ].filter(Number.isInteger);
  let working = raw;
  if (metadataIndexes.length) {
    working = working
      .slice(0, Math.min(...metadataIndexes))
      .replace(/(?:^|\n)\s*[-+]\s*$/, '');
  }
  else if (!leakedMatch && !chooseMatch && loneMatch) working = working.replace(loneMatch[0], '\n');
  working = working.replace(QUESTION_PREFIX, '').trim();

  const marks = [];
  OPTION_MARK.lastIndex = 0;
  let match = OPTION_MARK.exec(working);
  while (match) {
    marks.push({
      key: (match[1] || match[2]).toUpperCase(),
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

  let correctKey = answerMatch ? answerMatch[1].toUpperCase() : '';
  let explanation = stripDecorations(
    parsedExplanation
      .replace(CANONICAL_ANSWER, ' ')
      .replace(REVEALED_ANSWER, ' ')
      .replace(EXPLAIN_MARKER, ' '),
  );
  const last = options[options.length - 1];
  const leaked = last?.text?.match(
    /^(.{12,}?[.!?])\s+(Nếu bạn chọn(?:\s+đáp án)?\s+[A-D]\b[\s\S]+)$/i,
  );
  if (leaked) {
    last.text = stripDecorations(leaked[1]);
    const leakedKey = leaked[2].match(LEAKED_ANSWER);
    if (!correctKey && leakedKey) correctKey = leakedKey[1].toUpperCase();
    if (!explanation) explanation = stripDecorations(leaked[2]);
  }

  const shuffled = shuffleCorrectAnswerPosition(question, options, correctKey);
  return {
    question: `${question}?`,
    options: shuffled.options,
    correctKey: shuffled.correctKey,
    explanation,
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

export function buildIncorrectAnswerRemediationPrompt(quiz, selected) {
  const question = String(quiz?.question || '').trim();
  const selectedKey = String(selected?.key || '').trim().toUpperCase();
  const selectedText = String(selected?.text || '').trim();
  const correctKey = String(quiz?.correctKey || '').trim().toUpperCase();
  const correctOption = (Array.isArray(quiz?.options) ? quiz.options : [])
    .find((option) => option.key === correctKey);
  if (!question || !selectedKey || !correctKey || selectedKey === correctKey) return '';

  return [
    'Ôn lại sau câu trả lời chưa đúng.',
    `Câu vừa làm: ${question}`,
    `Em đã chọn: ${selectedKey}. ${selectedText}`,
    `Đáp án đúng: ${correctKey}. ${String(correctOption?.text || '').trim()}`,
    quiz?.explanation ? `Lý do trong bài: ${String(quiz.explanation).trim()}` : '',
    'Hãy tự động giảng lại đúng kiến thức này bằng cách dễ hiểu hơn, dùng cả Giải thích khái niệm (Conceptual Explanation) và Minh họa trực quan (Visual Representation).',
    'Sau đó cho em làm lại một câu trắc nghiệm dễ hơn về cùng kiến thức, nhưng phải paraphrase câu hỏi và các lựa chọn; không lặp nguyên văn câu cũ và không chuyển sang chủ đề mới.',
  ].filter(Boolean).join('\n');
}

export function buildMissingAnswerKeyRemediationPrompt(quiz, selected) {
  const question = String(quiz?.question || '').trim();
  const selectedKey = String(selected?.key || '').trim().toUpperCase();
  const selectedText = String(selected?.text || '').trim();
  const options = (Array.isArray(quiz?.options) ? quiz.options : [])
    .map((option) => `${option.key}. ${String(option.text || '').trim()}`)
    .filter((option) => option.length > 3)
    .join('\n');
  if (!question || !selectedKey || !options) return '';

  return [
    'Ôn lại sau câu kiểm tra chưa có đáp án.',
    `Câu vừa làm: ${question}`,
    'Các lựa chọn:',
    options,
    `Em đã chọn: ${selectedKey}. ${selectedText}`,
    'Hãy dựa vào tài liệu môn học để xác định và chấm đáp án em đã chọn, rồi giảng lại kiến thức này bằng Giải thích khái niệm (Conceptual Explanation) và Minh họa trực quan (Visual Representation).',
    'Sau đó cho em làm lại một câu trắc nghiệm dễ hơn về cùng kiến thức nhưng được paraphrase. Câu mới phải có các lựa chọn A, B, C và kết thúc bằng đúng hai dòng: Đáp án: <A hoặc B hoặc C>; Giải thích: <một câu ngắn>.',
  ].join('\n');
}
