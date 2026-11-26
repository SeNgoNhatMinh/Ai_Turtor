// Sample real identifiers from tutor_db_loadtest for path variables. Prints JSON.
const d = db.getSiblingDB('tutor_db_loadtest');
const ids = (coll, field = '_id', n = 25, filter = {}) =>
  d.getCollection(coll).aggregate([{ $match: filter }, { $sample: { size: n } }, { $project: { v: '$' + field } }])
    .toArray().map(x => x.v).filter(v => v !== null && v !== undefined).map(v => String(v));
const has = c => d.getCollectionNames().includes(c);
const pick = (c, f, n, q) => has(c) ? ids(c, f, n, q) : [];
const pool = {
  courseCodes: pick('courses', 'courseId', 50),
  classIds: pick('class_sections', 'classId', 50),
  classCourseIds: pick('class_sections', 'courseId', 50),
  teacherIds: pick('users', '_id', 25, { role: 'TEACHER' }),
  studentIds: pick('users', '_id', 40, { role: 'STUDENT' }),
  adminIds: pick('users', '_id', 5, { role: 'ADMIN' }),
  mentorIds: pick('mentors', '_id', 15),
  materialIds: pick('course_materials', '_id', 40),
  conversationIds: pick('ai_conversations', '_id', 40),
  escalationIds: pick('question_escalations', '_id', 30).concat(pick('harness_handoffs', '_id', 30)),
  quizSessionIds: pick('harness_quiz_sessions', '_id', 20),
  assignmentIds: pick('assignments', '_id', 10),
  cacheIds: pick('harness_answer_cache', '_id', 15),
  reviewIds: pick('harness_answer_reviews', '_id', 15).concat(pick('harness_adaptive_reviews', '_id', 10)),
  sessionIds: pick('harness_sessions', '_id', 20),
  behaviorIds: pick('harness_behaviors', '_id', 10),
  directiveIds: pick('harness_directives', '_id', 10),
  planIds: pick('harness_improve_plans', '_id', 10),
  messageIds: pick('ai_messages', '_id', 20),
  jobIds: pick('course_material_index_jobs', '_id', 10),
  summaryIds: pick('harness_session_summaries', '_id', 10),
  chapterKeys: pick('harness_chapter_outlines', 'chapterKey', 20),
};
pool.classPairs = has('class_sections') ? d.class_sections.find({}, { _id: 0, courseId: 1, classId: 1 }).toArray()
  .filter(x => x.courseId && x.classId).map(x => [String(x.courseId), String(x.classId)]) : [];
pool.collections = d.getCollectionNames().sort();
print(JSON.stringify(pool));
