const ACTIVE_STATUSES = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED']);
const DOING_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED']);
const FINISHED_STATUSES = new Set(['COMPLETED', 'DONE', 'CANCELLED']);

const asTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortExpertTasks = (left, right) => (
  Number(right.priority || 0) - Number(left.priority || 0)
  || asTimestamp(left.dueAt) - asTimestamp(right.dueAt)
  || asTimestamp(right.updatedAt || right.createdAt) - asTimestamp(left.updatedAt || left.createdAt)
);

function isExpertTaskVisibleToTeacher(task, userId) {
  return task.status === 'OPEN'
    || task.assigneeId === userId
    || (!task.assigneeId && ACTIVE_STATUSES.has(task.status));
}

export function groupTeacherExpertTasks(tasks = [], userId = '') {
  const visible = tasks.filter((task) => isExpertTaskVisibleToTeacher(task, userId));
  return {
    TODO: visible.filter((task) => task.status === 'OPEN' && !task.assigneeId).sort(sortExpertTasks),
    DOING: visible.filter((task) => (
      task.assigneeId === userId && DOING_STATUSES.has(task.status)
    )).sort(sortExpertTasks),
    DONE: visible.filter((task) => FINISHED_STATUSES.has(task.status)).sort(sortExpertTasks),
  };
}
