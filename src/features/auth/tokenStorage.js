const TOKEN_KEY = 'ai_tutor_jwt';

export function getAuthToken() {
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export { TOKEN_KEY };
