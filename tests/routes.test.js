import assert from 'node:assert/strict';
import test from 'node:test';
import { appRoutes, getHomeRouteForRole, getRouteForTab, getRouteState } from '../src/app/routes.js';

test('keeps every canonical route unique', () => {
  assert.equal(new Set(appRoutes.map((route) => route.path)).size, appRoutes.length);
});

test('maps route paths and navigation tabs in both directions', () => {
  for (const route of appRoutes) {
    if (route.navigationPath) {
      assert.equal(getRouteForTab(route.tab), route.path);
    }
    if (!route.path.includes(':')) {
      assert.deepEqual(getRouteState(`${route.path}/`), { role: route.role, tab: route.tab });
    }
  }

  assert.deepEqual(
    getRouteState('/teacher/expert-tasks/task-123/contribute'),
    { role: 'teacher', tab: 'teacher-expert-training' },
  );
  assert.equal(getRouteForTab('teacher-expert-training'), '/teacher/expert-tasks');
  assert.deepEqual(
    getRouteState('/teacher/expert-training'),
    { role: 'teacher', tab: 'teacher-expert-training' },
  );
  assert.deepEqual(
    getRouteState('/admin/expert-training'),
    { role: 'admin', tab: 'admin-expert-training' },
  );
});

test('uses stable role home routes and rejects unknown routes', () => {
  assert.equal(getHomeRouteForRole('STUDENT'), '/student/chat');
  assert.equal(getHomeRouteForRole('TEACHER'), '/teacher/classes');
  assert.equal(getHomeRouteForRole('ADMIN'), '/admin/dashboard');
  assert.equal(getRouteState('/unknown'), null);
});
