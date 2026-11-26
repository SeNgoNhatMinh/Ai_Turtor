// Chaos load test: 500 students hit the API at random, with random and broken input.
// Run through scripts/loadtest/run.sh (k6 in Docker). Never point at the real database.
//
// Each VU is one seeded student (users.json). Every iteration picks a random action:
//   - any endpoint of the catalog (all methods), path variables filled with real ids,
//     other students' ids, or junk; random query strings and random/broken JSON bodies
//   - realistic student reads (courses, profile, conversations, quota...)
//   - auth chaos: no token or a forged token
//   - at most one AI question per VU (cloud LLM), with a 20% chance
// Expected: 2xx/4xx. Any 5xx, timeout or a student getting 2xx on an admin route is logged
// as a JSON line ("FINDING ...") for the report.
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://host.docker.internal';
const ENDPOINTS = JSON.parse(open('/results/endpoints.json'));
const POOL = JSON.parse(open('/results/id-pool.json'));
const USERS = JSON.parse(open('/results/users.json'));
const MAX_VUS = Number(__ENV.VUS || 500);
const HOLD = __ENV.HOLD || '5m';

export const options = {
  scenarios: {
    chaos: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '2m', target: MAX_VUS },
        { duration: HOLD, target: MAX_VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '3m',
    },
  },
  // Chaos traffic is expected to produce 4xx; only 5xx/timeouts count as errors.
  thresholds: { server_errors: ['count>=0'] },
  summaryTrendStats: ['avg', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: false,
};

const serverErrors = new Counter('server_errors');
const timeouts = new Counter('timeouts');
const authzFindings = new Counter('authz_findings');
const aiOk = new Counter('ai_ok');
const aiFail = new Counter('ai_fail');
const aiLatency = new Trend('ai_latency', true);
const spaFallback = new Counter('spa_fallback');

const r = (n) => Math.floor(Math.random() * n);
const pick = (a) => (a && a.length ? a[r(a.length)] : 'missing');
const chance = (p) => Math.random() < p;

const JUNK = [
  '', ' ', '0', '-1', '999999999999', 'null', 'undefined', '{}', '[]', 'true',
  "' OR '1'='1", '{"$gt":""}', '$where', '../../etc/passwd', '%2e%2e%2f', '%00', '<script>alert(1)</script>',
  'Ⓐⓑⓒ😀đệ quy', 'a'.repeat(300), '00000000-0000-0000-0000-000000000000', 'NaN', '1e309',
];
const junk = () => encodeURIComponent(pick(JUNK));

let me = null; // { user, token }
let askedAi = false;
let relogin = false;
let wantsAi = false; // decided once per VU: about AI_SHARE of the students ask one AI question

function ownOrOther(own, others) {
  if (chance(0.6)) return own;
  if (chance(0.6)) return pick(others);
  return junk();
}

function fillVar(name) {
  if (chance(0.12)) return junk();
  const u = me.user;
  switch (name) {
    case 'courseId': return chance(0.7) ? u.courseId : pick(POOL.courseCodes);
    case 'classId': return chance(0.7) ? u.classId : pick(POOL.classIds);
    case 'studentId': case 'userId': return ownOrOther(u.userId, POOL.studentIds);
    case 'teacherId': case 'mentorId': return pick(POOL.teacherIds.concat(POOL.mentorIds));
    case 'materialId': case 'fileId': return pick(POOL.materialIds);
    case 'conversationId': return pick(POOL.conversationIds);
    case 'escalationId': case 'ticket': return pick(POOL.escalationIds);
    case 'quizSessionId': return pick(POOL.quizSessionIds);
    case 'sessionId': return pick(POOL.sessionIds);
    case 'reviewId': return pick(POOL.reviewIds);
    case 'cacheId': return pick(POOL.cacheIds);
    case 'behaviorId': return pick(POOL.behaviorIds);
    case 'directiveId': return pick(POOL.directiveIds);
    case 'planId': return pick(POOL.planIds);
    case 'messageId': return pick(POOL.messageIds);
    case 'summaryId': return pick(POOL.summaryIds);
    case 'chapterKey': return encodeURIComponent(pick(POOL.chapterKeys));
    case 'pageNumber': return String(pick([1, 2, 0, -3, 99999]));
    case 'traceId': return `chaos-${r(1e9)}`;
    default: return pick([].concat(POOL.conversationIds, POOL.materialIds, POOL.studentIds, [junk()]));
  }
}

function randomValue(depth = 0) {
  switch (r(depth > 1 ? 6 : 8)) {
    case 0: return pick(JUNK);
    case 1: return r(2) ? r(1000) : -r(1000);
    case 2: return chance(0.5);
    case 3: return null;
    case 4: return pick(['Đệ quy là gì?', 'Servlet là gì?', 'giải thích JOIN', 'help', '?']);
    case 5: return pick([me.user.userId, me.user.courseId, me.user.classId, pick(POOL.studentIds)]);
    case 6: return [randomValue(depth + 1), randomValue(depth + 1)];
    default: { const o = {}; for (let i = 0; i < 3; i++) o[pick(KEYS)] = randomValue(depth + 1); return o; }
  }
}

const KEYS = ['question', 'message', 'courseId', 'classId', 'studentId', 'userId', 'title', 'content', 'answer',
  'email', 'password', 'fullName', 'role', 'status', 'name', 'description', 'score', 'level', 'mode',
  'conversationId', 'materialId', 'chapterKey', 'students', 'items', 'page', 'size', 'enabled', 'text', 'url'];

function randomBody() {
  const roll = Math.random();
  if (roll < 0.08) return '{"broken": ';                        // malformed JSON
  if (roll < 0.11) return JSON.stringify({ content: 'x'.repeat(200000) }); // 200 KB body
  if (roll < 0.15) return 'not json at all';
  if (roll < 0.2) return '';
  const o = {};
  const n = 1 + r(6);
  for (let i = 0; i < n; i++) o[pick(KEYS)] = randomValue();
  if (chance(0.5)) { o.courseId = me.user.courseId; o.classId = me.user.classId; o.studentId = me.user.userId; }
  return JSON.stringify(o);
}

function randomQuery() {
  if (!chance(0.4)) return '';
  const opts = ['page=' + pick([0, 1, -1, 99999, 'abc']), 'size=' + pick([1, 20, 0, -5, 100000, 'x']),
    'q=' + junk(), 'courseId=' + me.user.courseId, 'classId=' + me.user.classId, 'sort=' + junk(),
    'status=' + pick(['OPEN', 'CLOSED', 'xyz']), 'limit=' + pick([1, 1000000, -1])];
  return '?' + Array.from({ length: 1 + r(3) }, () => pick(opts)).join('&');
}

function headers(auth) {
  const h = { 'Content-Type': chance(0.03) ? 'text/plain' : 'application/json' };
  if (auth === 'none') return h;
  h.Authorization = auth === 'forged'
    ? 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiJ9.' + r(1e9)
    : `Bearer ${me.token}`;
  return h;
}

function report(kind, method, template, url, res, extra = {}) {
  console.log('FINDING ' + JSON.stringify({
    kind, method, endpoint: template, url: url.replace(BASE, ''), status: res.status,
    ms: Math.round(res.timings.duration), error: res.error || undefined,
    body: (typeof res.body === 'string' ? res.body : '').slice(0, 300), ...extra,
  }));
}

function check(method, template, url, res, auth) {
  if (res.status === 0) { timeouts.add(1); report('TIMEOUT_OR_NETWORK', method, template, url, res); return; }
  if (res.status >= 500) { serverErrors.add(1, { endpoint: `${method} ${template}` }); report('SERVER_ERROR', method, template, url, res); }
  // Caddy normalises encoded ../ segments out of /api and serves the SPA's index.html: not an API answer.
  if (/text\/html/.test(res.headers['Content-Type'] || '')) { spaFallback.add(1); return; }
  if (res.status === 401 && auth === 'token') relogin = true; // e.g. a random POST /api/users/logout revoked it
  const adminRoute = /^\/api\/(admin|academic)\//.test(template);
  if (res.status >= 200 && res.status < 300 && (auth !== 'token' || adminRoute) && !/\/(login|register|refresh|health)/.test(template)) {
    authzFindings.add(1);
    report(auth === 'token' ? 'STUDENT_REACHED_ADMIN_ROUTE' : `UNAUTHENTICATED_2XX(${auth})`, method, template, url, res);
  }
}

function login() {
  const user = USERS[(__VU - 1) % USERS.length];
  const res = http.post(`${BASE}/api/users/login`, JSON.stringify({ email: user.email, password: __ENV.LOADTEST_PASSWORD || 'Loadtest@123' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /api/users/login' } });
  if (res.status !== 200) { report('LOGIN_FAILED', 'POST', '/api/users/login', '/api/users/login', res); return null; }
  const body = res.json();
  const token = body.accessToken || body.token || (body.data && (body.data.accessToken || body.data.token));
  return token ? { user, token } : null;
}

function chaosCall() {
  const ep = pick(ENDPOINTS);
  const url = BASE + ep.path.replace(/\{(\w+)\}/g, (_, v) => fillVar(v)) + randomQuery();
  const auth = chance(0.05) ? 'none' : chance(0.03) ? 'forged' : 'token';
  const params = { headers: headers(auth), timeout: '60s', tags: { name: `${ep.method} ${ep.path}` } };
  const body = ['POST', 'PUT', 'PATCH'].includes(ep.method) ? randomBody() : null;
  const res = http.request(ep.method, url, body, params);
  check(ep.method, ep.path, url, res, auth);
}

const STUDENT_READS = [
  '/api/courses', '/api/users/profile', '/api/notifications', '/api/ai/student-llm/usage',
  '/api/courses/{courseId}/learning-guide', '/api/courses/{courseId}/materials',
  '/api/students/{studentId}/courses/{courseId}/classes/{classId}/materials',
  '/api/students/{studentId}/improve-plans',
  '/api/tutor/students/{studentId}/courses/{courseId}/question-quota',
  '/api/tutor/students/{studentId}/courses/{courseId}/memory',
  '/api/tutor/students/{studentId}/courses/{courseId}/sessions',
  '/api/tutor/students/{studentId}/courses/{courseId}/quizzes',
  '/api/tutor/students/{studentId}/courses/{courseId}/support-profile',
];

function studentRead() {
  const template = pick(STUDENT_READS);
  const url = BASE + template.replace('{courseId}', me.user.courseId).replace('{studentId}', me.user.userId)
    .replace('{classId}', encodeURIComponent(me.user.classId));
  const res = http.get(url, { headers: headers('token'), timeout: '60s', tags: { name: `GET ${template}` } });
  check('GET', template, url, res, 'token');
}

function askAi() {
  askedAi = true;
  const q = pick(['Đệ quy là gì?', 'Servlet là gì?', 'Giải thích khóa ngoại trong SQL', 'Stack và queue khác nhau thế nào?',
    'Vòng lặp for hoạt động ra sao?', 'Kế thừa trong Java là gì?']);
  const body = JSON.stringify({ question: q, message: q, courseId: me.user.courseId, classId: me.user.classId, persist: false });
  const res = http.post(`${BASE}/api/ai/query`, body,
    { headers: headers('token'), timeout: '240s', tags: { name: 'POST /api/ai/query (AI)' } });
  aiLatency.add(res.timings.duration);
  let answered = false;
  try { const j = res.json(); answered = res.status === 200 && !!(j.answer || (j.data && j.data.answer)); } catch (e) { /* not JSON */ }
  if (answered) aiOk.add(1);
  else { aiFail.add(1); report('AI_FAILED', 'POST', '/api/ai/query', '/api/ai/query', res, { question: q }); }
  check('POST', '/api/ai/query', `${BASE}/api/ai/query`, res, 'token');
}

export default function () {
  if (!me || relogin) {
    relogin = false;
    const keepAi = me ? wantsAi : null;
    me = login();
    if (!me) { sleep(5); return; }
    wantsAi = keepAi === null ? chance(Number(__ENV.AI_SHARE || 0.2)) : keepAi;
  }
  const roll = Math.random();
  if (wantsAi && !askedAi && roll < 0.05) askAi();
  else if (roll < 0.6) chaosCall();
  else studentRead();
  sleep(0.3 + Math.random() * 3);
}

export function handleSummary(data) {
  return { '/results/summary.json': JSON.stringify(data, null, 1) };
}
