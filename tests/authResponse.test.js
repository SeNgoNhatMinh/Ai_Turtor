import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import {
  getAccountRoleFromJwt,
  normalizeLoginResponse,
} from '../src/features/auth/services/authResponse.js';

function createToken(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.signature`;
}

test('normalizes the flat Spring Boot login response', () => {
  const token = createToken({ role: 'ADMIN' });
  const result = normalizeLoginResponse({
    userId: 'admin-1',
    email: 'admin@example.com',
    fullName: 'Admin User',
    role: 'ADMIN',
    token,
  });

  assert.equal(result.token, token);
  assert.equal(result.user.userId, 'admin-1');
  assert.equal(result.user.role, 'ADMIN');
  assert.equal(result.user.authRoleVerified, true);
  assert.equal('token' in result.user, false);
});

test('normalizes a deployed response wrapped in data and user', () => {
  const token = createToken({ role: 'TEACHER' });
  const result = normalizeLoginResponse({
    data: {
      accessToken: token,
      user: {
        id: 'teacher-1',
        email: 'teacher@example.com',
        authority: 'ROLE_TEACHER',
      },
    },
  });

  assert.equal(result.token, token);
  assert.equal(result.user.id, 'teacher-1');
  assert.equal(result.user.role, 'TEACHER');
});

test('uses the signed JWT role when the response body omits role', () => {
  const token = createToken({ role: 'SENIOR_MENTOR' });
  const result = normalizeLoginResponse({
    result: {
      token,
      user: { userId: 'senior-1', email: 'senior@example.com' },
    },
  });

  assert.equal(getAccountRoleFromJwt(token), 'SENIOR_MENTOR');
  assert.equal(result.user.role, 'SENIOR_MENTOR');
});

test('prefers the JWT role over a conflicting body role', () => {
  const result = normalizeLoginResponse({
    userId: 'admin-1',
    role: 'STUDENT',
    token: createToken({ authorities: [{ authority: 'ROLE_ADMIN' }] }),
  });

  assert.equal(result.user.role, 'ADMIN');
});

test('rejects login responses without a supported account role', () => {
  assert.throws(
    () => normalizeLoginResponse({ userId: 'unknown-1', token: 'not-a-jwt' }),
    (error) => error.code === 'INVALID_AUTH_RESPONSE' && error.status === 502,
  );
});
