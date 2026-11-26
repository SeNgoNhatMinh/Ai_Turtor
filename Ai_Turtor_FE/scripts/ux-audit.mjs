#!/usr/bin/env node
// Visual UI/UX audit with a real browser (Playwright, Chromium).
//
//   UX_BASE=http://<server-ip> UX_OUT=../ux-results/<run> \
//   UX_ACCOUNTS='{"student":{"email":..,"password":..},...}' node scripts/ux-audit.mjs
//
// Use the server's LAN address, not localhost: browsers treat http://<ip> as an
// insecure context (no crypto.randomUUID, no navigator.clipboard), which is what
// students on the LAN get.
// For each role and viewport (desktop 1440x900, phone 390x844) it logs in through the
// login form, opens every route of that role, and records a full-page screenshot plus:
//   console errors, uncaught page errors, failed API calls (>= 400), load time,
//   horizontal overflow, elements wider than the viewport, controls without an
//   accessible name, images without alt, tap targets under 24 px (phone),
//   text under 12 px, and leaked "undefined" / "null" / "NaN" / "[object Object]".
// The student also asks the AI a question in the chat and, when offered, presses
// "Học ngay"; answer times and raw-Markdown leaks are recorded.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.UX_BASE || 'http://localhost';
const OUT = process.env.UX_OUT || 'ux-results';
const ACCOUNTS = JSON.parse(process.env.UX_ACCOUNTS || '{}');
const ONLY = (process.env.UX_ROLES || 'student,teacher,senior,admin').split(',');
const AI_TIMEOUT = Number(process.env.UX_AI_TIMEOUT_MS || 240000);

const ROUTES = {
  student: ['/student/dashboard', '/student/chat', '/student/quizzes', '/student/materials', '/student/mentor-review'],
  teacher: ['/teacher/classes', '/teacher/quizzes', '/teacher/materials', '/teacher/grading', '/teacher/review-queue',
    '/teacher/ai-tutoring', '/teacher/teaching-behaviors', '/teacher/expert-tasks'],
  senior: ['/senior/review', '/senior/v2', '/senior/answer-cache'],
  admin: ['/admin/dashboard', '/admin/users', '/admin/users/students', '/admin/users/teachers', '/admin/users/senior-mentors',
    '/admin/users/admins', '/admin/users/mentors', '/admin/users/escalations', '/admin/academic/courses',
    '/admin/academic/classes', '/admin/academic/enrollments', '/admin/academic/import', '/admin/academic/materials',
    '/admin/academic/curriculum', '/admin/ai-logs/providers', '/admin/ai-logs/runtime', '/admin/ai-logs/history',
    '/admin/answer-cache', '/admin/reindex', '/admin/indexed-teaching-notes'],
};
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const results = { base: BASE, startedAt: new Date().toISOString(), pages: [], flows: [] };
const slug = (s) => s.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'root';

function watch(page) {
  const log = { console: [], pageErrors: [], failed: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') log.console.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => log.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400 && u.startsWith(BASE)) log.failed.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, '')}`.slice(0, 200));
  });
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(BASE)) log.failed.push(`FAILED ${r.method()} ${r.url().replace(BASE, '')} ${r.failure()?.errorText || ''}`.slice(0, 200));
  });
  return log;
}

async function inspect(page, phone) {
  return page.evaluate((isPhone) => {
    const vw = document.documentElement.clientWidth;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const describe = (el) => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`;
    };
    const all = [...document.querySelectorAll('body *')].filter(visible);
    const wide = all.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 1 || r.left >= vw) return false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; // contained by a scroller
      }
      return true;
    });
    const named = (el) => (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title')
      || el.getAttribute('aria-labelledby') || el.querySelector('img[alt]:not([alt=""])');
    const controls = all.filter((el) => el.matches('button, a[href], [role="button"]'));
    const unnamed = controls.filter((el) => !named(el));
    const inputs = all.filter((el) => el.matches('input:not([type=hidden]), textarea, select'));
    const unlabeled = inputs.filter((el) => !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
      || el.getAttribute('placeholder') || el.getAttribute('title') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label')));
    const smallTargets = isPhone ? controls.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < 24 || r.height < 24;
    }) : [];
    const tinyText = all.filter((el) => el.childElementCount === 0 && (el.innerText || '').trim()
      && parseFloat(getComputedStyle(el).fontSize) < 12);
    const bodyText = document.body.innerText || '';
    const leaks = [...new Set((bodyText.match(/(^|[\s:(>])(undefined|null|NaN|\[object Object\])(?=$|[\s,.)<])/g) || []).map((s) => s.trim()))];
    const rawMarkdown = (bodyText.match(/^(#{1,4} |\*\*[^*\n]+\*\*|```)/gm) || []).length;
    return {
      title: document.title,
      horizontalOverflow: document.documentElement.scrollWidth - vw,
      wideElements: wide.slice(0, 6).map(describe),
      wideCount: wide.length,
      unnamedControls: unnamed.length, unnamedSamples: unnamed.slice(0, 5).map((el) => el.outerHTML.slice(0, 160)),
      imagesWithoutAlt: [...document.images].filter((i) => visible(i) && !i.hasAttribute('alt')).length,
      unlabeledInputs: unlabeled.length, unlabeledSamples: unlabeled.slice(0, 3).map(describe),
      smallTapTargets: smallTargets.length, smallTapSamples: smallTargets.slice(0, 6).map((el) => {
        const r = el.getBoundingClientRect();
        return `${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`;
      }),
      tinyText: tinyText.length, tinyTextSamples: tinyText.slice(0, 4).map((el) => `${describe(el)} ${getComputedStyle(el).fontSize}`),
      leakedValues: leaks, rawMarkdownLines: rawMarkdown,
      emptyMain: (document.querySelector('main')?.innerText || bodyText).trim().length < 20,
    };
  }, phone);
}

async function login(page, account) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill(account.email);
  await page.locator('input[type=password]').fill(account.password);
  const t0 = Date.now();
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 });
  return Date.now() - t0;
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function askAi(page, vpName, question) {
  const flow = { flow: 'student-chat-question', viewport: vpName, question };
  const box = page.getByLabel('Câu hỏi cho AI Tutor');
  await box.waitFor({ timeout: 20000 });
  const before = await page.locator('.chat-message-turn').count();
  await box.fill(question);
  const t0 = Date.now();
  await box.press('Enter');
  const stop = page.getByLabel('Dừng tạo câu trả lời');
  flow.generatingIndicatorShown = await stop.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  await stop.waitFor({ state: 'detached', timeout: AI_TIMEOUT }).catch(() => { flow.timedOut = true; });
  await settle(page);
  flow.answerMs = Date.now() - t0;
  flow.turnsBefore = before;
  flow.turnsAfter = await page.locator('.chat-message-turn').count();
  flow.lastTurnText = ((await page.locator('.chat-message-turn').last().innerText().catch(() => '')) || '').slice(0, 600);
  flow.errorToast = await page.locator('[role=alert], .toast, .ant-message-error').allInnerTexts().catch(() => []);
  return flow;
}

async function studyNow(page, vpName) {
  const flow = { flow: 'student-hoc-ngay', viewport: vpName };
  const btn = page.getByRole('button', { name: /Học ngay/ }).first();
  if (!(await btn.isVisible().catch(() => false))) {
    flow.skipped = 'no "Học ngay" button visible after the answer';
    return flow;
  }
  const t0 = Date.now();
  await btn.click();
  const stop = page.getByLabel('Dừng tạo câu trả lời');
  flow.generatingIndicatorShown = await stop.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  await stop.waitFor({ state: 'detached', timeout: AI_TIMEOUT }).catch(() => { flow.timedOut = true; });
  await settle(page);
  flow.answerMs = Date.now() - t0;
  flow.lastTurnText = ((await page.locator('.chat-message-turn').last().innerText().catch(() => '')) || '').slice(0, 400);
  return flow;
}

const browser = await chromium.launch({ channel: 'chromium' }); // full Chromium (new headless), no headless-shell download
try {
  for (const role of ONLY) {
    const account = ACCOUNTS[role];
    if (!account) continue;
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({ ...vp, locale: 'vi-VN' });
      const page = await context.newPage();
      const log = watch(page);
      let loginMs = null;
      try {
        loginMs = await login(page, account);
      } catch (e) {
        results.pages.push({ role, viewport: vpName, route: '/login', error: `login failed: ${e.message.slice(0, 200)}`, ...log });
        await page.screenshot({ path: path.join(OUT, 'shots', `${role}-${vpName}-login-failed.png`), fullPage: true });
        await context.close();
        continue;
      }
      for (const route of ROUTES[role]) {
        log.console.length = 0; log.pageErrors.length = 0; log.failed.length = 0;
        const t0 = Date.now();
        let navError = null;
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => { navError = e.message; });
        await settle(page);
        const loadMs = Date.now() - t0;
        const shot = `${role}-${vpName}-${slug(route)}.png`;
        await page.screenshot({ path: path.join(OUT, 'shots', shot), fullPage: true }).catch(() => {});
        const checks = await inspect(page, vpName === 'phone').catch((e) => ({ inspectError: e.message }));
        results.pages.push({
          role, viewport: vpName, route, finalUrl: page.url().replace(BASE, ''), loadMs, loginMs, navError, shot, ...checks,
          console: [...log.console], pageErrors: [...log.pageErrors], failed: [...new Set(log.failed)],
        });
        loginMs = null;
        console.log(`${role} ${vpName} ${route} ${loadMs}ms errors=${log.console.length + log.pageErrors.length} failed=${log.failed.length} overflow=${checks.horizontalOverflow}`);
      }
      if (role === 'student') {
        log.console.length = 0; log.pageErrors.length = 0; log.failed.length = 0;
        await page.goto(`${BASE}/student/chat`, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const q = vpName === 'desktop' ? 'Đệ quy là gì?' : 'Servlet là gì?';
        const ask = await askAi(page, vpName, q).catch((e) => ({ flow: 'student-chat-question', viewport: vpName, error: e.message.slice(0, 200) }));
        await page.screenshot({ path: path.join(OUT, 'shots', `student-${vpName}-chat-answer.png`), fullPage: true });
        ask.checks = await inspect(page, vpName === 'phone').catch(() => null);
        const study = await studyNow(page, vpName).catch((e) => ({ flow: 'student-hoc-ngay', viewport: vpName, error: e.message.slice(0, 200) }));
        await page.screenshot({ path: path.join(OUT, 'shots', `student-${vpName}-hoc-ngay.png`), fullPage: true });
        for (const f of [ask, study]) {
          results.flows.push({ ...f, console: [...log.console], pageErrors: [...log.pageErrors], failed: [...new Set(log.failed)] });
          console.log(`flow ${f.flow} ${vpName} ${f.answerMs ?? '-'}ms timedOut=${!!f.timedOut} ${f.skipped || f.error || ''}`);
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
}
