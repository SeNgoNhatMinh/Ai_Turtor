// One device per account: when this device's session is replaced by a sign-in
// elsewhere, the API answers 401 with code SESSION_REPLACED. The app then reloads to
// the login screen, which shows why (read once, then cleared).
const NOTICE_KEY = 'ai-tutor:auth-notice';

export const SESSION_REPLACED_MESSAGE = 'Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác, nên phiên trên máy này đã kết thúc. Mỗi tài khoản chỉ dùng được trên một máy tại một thời điểm.';

export function rememberSessionReplaced() {
  try {
    window.sessionStorage.setItem(NOTICE_KEY, 'SESSION_REPLACED');
  } catch {
    // Storage blocked: the login screen simply shows no notice.
  }
}

export function takeAuthNotice() {
  try {
    const value = window.sessionStorage.getItem(NOTICE_KEY);
    window.sessionStorage.removeItem(NOTICE_KEY);
    return value === 'SESSION_REPLACED' ? SESSION_REPLACED_MESSAGE : '';
  } catch {
    return '';
  }
}
