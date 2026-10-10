import { ArrowRight, Lock, Mail } from 'lucide-react';
import TutorMascot from '../../../components/common/TutorMascot';
import FptWordmark from './FptWordmark';

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function LoginAuthCard({
  email,
  handleSubmit,
  isLoading,
  password,
  setEmail,
  setPassword,
}) {
  return (
    <section className="login-auth-card" aria-label="Biểu mẫu đăng nhập">
      <div className="login-card-header">
        <div className="login-auth-brand-row">
          <TutorMascot
            size="md"
            className="login-auth-mascot"
            alt="Biểu tượng FPT University AI Tutor"
          />
          <div className="login-brand-mark">
            <FptWordmark className="is-compact" />
            <span className="brand-university">University</span>
            <small>AI Tutor</small>
          </div>
        </div>
        <h2>Chào mừng bạn quay lại</h2>
        <p>Đăng nhập để tiếp tục phiên học của bạn.</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        <label className="login-field">
          <span>Email</span>
          <div className="login-input-wrap">
            <Mail size={18} aria-hidden="true" />
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        <label className="login-field">
          <span>Mật khẩu</span>
          <div className="login-input-wrap">
            <Lock size={18} aria-hidden="true" />
            <input
              type="password"
              placeholder="Mật khẩu"
              required
              value={password}
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </label>

        <button type="submit" className="login-submit btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Đang xử lý...' : <>Đăng nhập <ArrowRight size={18} /></>}
        </button>
      </form>

      <div className="login-auth-divider" role="separator" aria-label="hoặc">
        <span>hoặc</span>
      </div>

      <button type="button" className="login-google-btn">
        <GoogleMark />
        Đăng nhập bằng Google
      </button>
    </section>
  );
}

export default LoginAuthCard;
