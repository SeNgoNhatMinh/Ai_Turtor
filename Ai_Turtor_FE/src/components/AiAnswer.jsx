import { memo, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRenderer from './markdown/MarkdownRenderer';
import GuidedPracticeFill from '../features/student/chat/components/GuidedPracticeFill';
import UnderstandingCheckQuiz from '../features/student/chat/components/UnderstandingCheckQuiz';
import {
  extractGuidedPractice,
  readGuidedPracticeDraft,
  writeGuidedPracticeDraft,
} from '../features/student/chat/guidedPracticeFill';
import {
  answerWaitsForQuiz,
  buildFinishedWorkReviewPrompt,
  composeFinishedQuizPrompt,
  extractUnderstandingCheck,
  normalizeStructuredUnderstandingQuiz,
} from '../features/student/chat/understandingCheck';

function numberedSectionCount(markdown) {
  return String(markdown || '')
    .split('\n')
    .filter((line) => /^#{2,3}\s+\d+\.\s+\S/.test(line.trim()))
    .length;
}

function MarkdownPart({
  markdown,
  streaming,
  sourceMap,
  onStudyTipStudy,
  onDownloadSource,
  hideSourceSection,
  headingStart = 1,
  courseMaterialHeadingAddon,
}) {
  if (!markdown) return null;
  return (
    <MarkdownRenderer
      markdown={markdown}
      streaming={streaming}
      sourceMap={sourceMap}
      onStudyTipStudy={onStudyTipStudy}
      onDownloadSource={onDownloadSource}
      hideSourceSection={hideSourceSection}
      headingStart={headingStart}
      courseMaterialHeadingAddon={courseMaterialHeadingAddon}
    />
  );
}

function AnswerWithQuizzes({
  markdown,
  understandingCheck,
  understandingAttempts,
  streaming,
  sourceMap,
  onStudyTipStudy,
  onLockAnswer,
  onDownloadSource,
  hideSourceSection,
  reviewer,
  understandingSelectedKey,
  attemptId,
  deferGrade = false,
  headingStart = 1,
  courseMaterialHeadingAddon,
}) {
  const extracted = useMemo(() => extractUnderstandingCheck(markdown), [markdown]);
  const structuredQuiz = useMemo(
    () => normalizeStructuredUnderstandingQuiz(understandingCheck),
    [understandingCheck],
  );
  const quizzes = useMemo(() => {
    if (Array.isArray(extracted.quizzes) && extracted.quizzes.length > 1) return extracted.quizzes;
    if (structuredQuiz) return [structuredQuiz];
    if (Array.isArray(extracted.quizzes) && extracted.quizzes.length) return extracted.quizzes;
    return extracted.quiz ? [extracted.quiz] : [];
  }, [structuredQuiz, extracted.quizzes, extracted.quiz]);
  const answeredIndexes = new Set(
    (Array.isArray(understandingAttempts) ? understandingAttempts : [])
      .map((attempt) => Number(attempt?.quizIndex ?? -1))
      .filter((index) => index >= 0),
  );
  if (understandingSelectedKey && !answeredIndexes.has(0)) answeredIndexes.add(0);
  const revealGrade = !deferGrade && (
    reviewer || quizzes.every((_, index) => answeredIndexes.has(index))
  );

  if (!quizzes.length) {
    return (
      <MarkdownPart
        markdown={markdown}
        streaming={streaming}
        sourceMap={sourceMap}
        onStudyTipStudy={onStudyTipStudy}
        onDownloadSource={onDownloadSource}
        hideSourceSection={hideSourceSection}
        headingStart={headingStart}
        courseMaterialHeadingAddon={courseMaterialHeadingAddon}
      />
    );
  }

  return (
    <>
      <MarkdownPart
        markdown={extracted.before}
        streaming={streaming}
        sourceMap={sourceMap}
        onStudyTipStudy={onStudyTipStudy}
        onDownloadSource={onDownloadSource}
        hideSourceSection={hideSourceSection}
        headingStart={headingStart}
        courseMaterialHeadingAddon={courseMaterialHeadingAddon}
      />
      {quizzes.map((quiz, index) => {
        const savedAttempt = (Array.isArray(understandingAttempts) ? understandingAttempts : [])
          .find((attempt) => Number(attempt?.quizIndex ?? -1) === index);
        return (
          <UnderstandingCheckQuiz
            key={`${quiz.question}-${index}`}
            quiz={quiz}
            reviewer={reviewer}
            lockedKey={savedAttempt?.selectedKey || (index === 0 ? understandingSelectedKey : '')}
            attemptId={attemptId ? `${attemptId}:${index + 1}` : `inline-quiz-${index + 1}`}
            revealGrade={revealGrade}
            onLockAnswer={onLockAnswer
              ? (key, attempt) => onLockAnswer(key, { ...attempt, quizIndex: index })
              : undefined}
          />
        );
      })}
      <MarkdownPart
        markdown={extracted.after}
        streaming={streaming}
        sourceMap={sourceMap}
        onStudyTipStudy={onStudyTipStudy}
        onDownloadSource={onDownloadSource}
        hideSourceSection={hideSourceSection}
        headingStart={headingStart + numberedSectionCount(extracted.before)}
        courseMaterialHeadingAddon={courseMaterialHeadingAddon}
      />
    </>
  );
}

function AiAnswer({
  markdown,
  understandingCheck,
  understandingAttempts = [],
  streaming = false,
  sourceMap = {},
  onStudyTipStudy,
  onSubmitGuidedPractice,
  onLockAnswer,
  onDownloadSource,
  hideSourceSection = false,
  reviewer = false,
  understandingSelectedKey = '',
  attemptId = '',
  courseMaterialHeadingAddon,
}) {
  const practice = useMemo(
    () => (streaming ? null : extractGuidedPractice(markdown)),
    [streaming, markdown],
  );
  const waitsForQuiz = useMemo(
    () => answerWaitsForQuiz(markdown, understandingCheck),
    [markdown, understandingCheck],
  );
  const [practiceSaved, setPracticeSaved] = useState(
    () => Boolean(readGuidedPracticeDraft(attemptId)?.text),
  );
  const quizFinished = useMemo(() => {
    if (!waitsForQuiz) return false;
    const extracted = extractUnderstandingCheck(markdown);
    const quizTotal = Math.max(
      Array.isArray(extracted.quizzes) ? extracted.quizzes.length : 0,
      normalizeStructuredUnderstandingQuiz(understandingCheck) ? 1 : 0,
    );
    if (!quizTotal) return false;
    const answered = new Set(
      (Array.isArray(understandingAttempts) ? understandingAttempts : [])
        .map((attempt) => Number(attempt?.quizIndex ?? -1))
        .filter((index) => index >= 0),
    );
    if (understandingSelectedKey) answered.add(0);
    return answered.size >= quizTotal;
  }, [markdown, understandingAttempts, understandingCheck, understandingSelectedKey, waitsForQuiz]);
  const reviewSent = useRef(false);
  const reviewWasReady = useRef(false);
  const sawOpeningState = useRef(false);
  useEffect(() => {
    const draft = readGuidedPracticeDraft(attemptId);
    const draftText = String(draft?.text || '').trim();
    const waitingForPractice = Boolean(practice) && waitsForQuiz && !draftText;
    const ready = quizFinished && !waitingForPractice && !draft?.reviewed;
    if (!sawOpeningState.current) {
      sawOpeningState.current = true;
      reviewWasReady.current = ready;
      return;
    }
    const justBecameReady = ready && !reviewWasReady.current;
    reviewWasReady.current = ready;
    if (reviewer || reviewSent.current || !justBecameReady) return;
    if (draft?.reviewed) return;
    const quizzes = extractUnderstandingCheck(markdown).quizzes || [];
    const reviewQuizzes = quizzes.length
      ? quizzes
      : [normalizeStructuredUnderstandingQuiz(understandingCheck)].filter(Boolean);
    const incorrectAnswers = (Array.isArray(understandingAttempts) ? understandingAttempts : [])
      .map((attempt) => {
        const index = Number(attempt?.quizIndex ?? -1);
        const quiz = reviewQuizzes[index];
        const selectedKey = String(attempt?.selectedKey || '').trim().toUpperCase();
        const selected = (Array.isArray(quiz?.options) ? quiz.options : [])
          .find((option) => option.key === selectedKey);
        const correctKey = String(quiz?.correctKey || '').trim().toUpperCase();
        const correct = typeof attempt?.correct === 'boolean'
          ? attempt.correct
          : (correctKey ? selectedKey === correctKey : false);
        if (!quiz?.question || correct) return null;
        return {
          quizIndex: index,
          quiz,
          selected: selected || { key: selectedKey, text: '' },
        };
      })
      .filter(Boolean);
    const prompt = draftText
      ? buildFinishedWorkReviewPrompt({ draftText, incorrectAnswers })
      : composeFinishedQuizPrompt({ incorrectAnswers, draftText: '' });
    if (!prompt || !onSubmitGuidedPractice) return;
    reviewSent.current = true;
    if (draftText) {
      writeGuidedPracticeDraft(attemptId, { ...draft, text: draftText, locked: true, reviewed: true });
    }
    onSubmitGuidedPractice(prompt);
  }, [
    attemptId,
    markdown,
    onSubmitGuidedPractice,
    practice,
    practiceSaved,
    quizFinished,
    reviewer,
    understandingAttempts,
    understandingCheck,
    waitsForQuiz,
  ]);
  const shared = {
    understandingCheck,
    understandingAttempts,
    streaming,
    sourceMap,
    onStudyTipStudy,
    onLockAnswer,
    onDownloadSource,
    hideSourceSection,
    reviewer,
    understandingSelectedKey,
    attemptId,
    courseMaterialHeadingAddon,
    deferGrade: Boolean(practice) && !practiceSaved && !reviewer,
  };

  if (!practice) {
    return <AnswerWithQuizzes markdown={markdown} {...shared} />;
  }

  const checkInAfter = /kiểm tra hiểu|understanding check|quiz tự luyện|câu hỏi ôn tập|trắc nghiệm/i
    .test(practice.after || '');

  return (
    <>
      <AnswerWithQuizzes
        markdown={practice.before}
        {...shared}
        understandingCheck={checkInAfter ? null : understandingCheck}
      />
      <GuidedPracticeFill
        practice={practice}
        reviewer={reviewer}
        attemptId={attemptId}
        waitsForQuiz={waitsForQuiz}
        quizFinished={quizFinished}
        onSaved={() => setPracticeSaved(true)}
      />
      <AnswerWithQuizzes
        markdown={practice.after}
        {...shared}
        headingStart={numberedSectionCount(practice.before) + 1}
        understandingCheck={checkInAfter ? understandingCheck : null}
      />
    </>
  );
}

export default memo(AiAnswer);
