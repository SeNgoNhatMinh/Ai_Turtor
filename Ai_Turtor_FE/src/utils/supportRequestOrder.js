const recency = (item) => {
  const value = item?.createdAt || item?.updatedAt || item?.questionAskedAt || 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export function sortSupportRequestsNewestFirst(items) {
  return (Array.isArray(items) ? items : []).slice().sort(
    (left, right) => recency(right) - recency(left),
  );
}
