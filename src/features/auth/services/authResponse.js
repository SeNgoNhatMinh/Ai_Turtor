import { normalizeAccountRole } from '../../../constants/roles.js';

const TOKEN_FIELDS = ['token', 'accessToken', 'access_token', 'jwt', 'idToken'];
const ROLE_FIELDS = ['originalRole', 'role', 'roleKey', 'authority', 'userRole', 'accountRole'];

class InvalidAuthResponseError extends Error {
  constructor(details) {
    super('Máy chủ không trả về vai trò tài khoản hợp lệ. Vui lòng đăng nhập lại hoặc liên hệ quản trị viên.');
    this.name = 'InvalidAuthResponseError';
    this.userMessage = this.message;
    this.status = 502;
    this.code = 'INVALID_AUTH_RESPONSE';
    this.details = details;
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function getResponseLayers(response) {
  const root = asObject(response);
  if (!root) return [];
  const data = asObject(root.data);
  const result = asObject(root.result);
  const payload = asObject(root.payload);
  return [
    asObject(root.user),
    asObject(root.account),
    asObject(data?.user),
    asObject(data?.account),
    data,
    asObject(result?.user),
    asObject(result?.account),
    result,
    asObject(payload?.user),
    asObject(payload?.account),
    payload,
    root,
  ].filter(Boolean);
}

function normalizeRoleCandidate(value) {
  if (value && typeof value === 'object') {
    return normalizeRoleCandidate(value.authority || value.role || value.name || value.value);
  }
  return normalizeAccountRole(value, '');
}

function findRole(record) {
  if (!record) return '';
  for (const field of ROLE_FIELDS) {
    const role = normalizeRoleCandidate(record[field]);
    if (role) return role;
  }
  for (const field of ['roles', 'authorities']) {
    const values = Array.isArray(record[field]) ? record[field] : [record[field]];
    for (const value of values) {
      const role = normalizeRoleCandidate(value);
      if (role) return role;
    }
  }
  return '';
}

function findToken(layers) {
  for (const layer of layers) {
    for (const field of TOKEN_FIELDS) {
      const token = String(layer?.[field] || '').trim();
      if (token) return token;
    }
  }
  return '';
}

function decodeBase64Url(value) {
  if (typeof globalThis.atob !== 'function') return '';
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtPayload(token) {
  const payload = String(token || '').split('.')[1];
  if (!payload) return null;
  try {
    return asObject(JSON.parse(decodeBase64Url(payload)));
  } catch {
    return null;
  }
}

export function getAccountRoleFromJwt(token) {
  return findRole(decodeJwtPayload(token));
}

function selectUserRecord(layers) {
  return layers.find((layer) => (
    layer.userId || layer.id || layer._id || layer.email || layer.fullName || layer.name
  )) || null;
}

function stripAuthTransportFields(record) {
  const user = { ...record };
  TOKEN_FIELDS.forEach((field) => delete user[field]);
  delete user.data;
  delete user.result;
  delete user.payload;
  delete user.user;
  delete user.account;
  return user;
}

export function normalizeLoginResponse(response) {
  const layers = getResponseLayers(response);
  const token = findToken(layers);
  const tokenRole = getAccountRoleFromJwt(token);
  const responseRole = layers.map(findRole).find(Boolean) || '';
  const accountRole = tokenRole || responseRole;
  const userRecord = selectUserRecord(layers);

  if (!userRecord || !accountRole) {
    throw new InvalidAuthResponseError({
      hasToken: Boolean(token),
      responseKeys: asObject(response) ? Object.keys(response) : [],
    });
  }

  if (import.meta.env?.DEV && tokenRole && responseRole && tokenRole !== responseRole) {
    console.warn(`[auth] Response role ${responseRole} differs from JWT role ${tokenRole}; using JWT role.`);
  }

  return {
    token,
    user: {
      ...stripAuthTransportFields(userRecord),
      originalRole: accountRole,
      role: accountRole,
      authRoleVerified: true,
    },
  };
}
