export function queueItemKey(group) {
  return group?.answerFingerprint || group?.representativeReviewId || group?.id || '';
}
